// api/track-form/route.js
//
// A form submission captured by the tracker (a lead). Same authorization as
// /api/track: key (current or previous), then "is this from the site's own
// host". Nothing in here logs the payload or the key: a submission is
// personal data (name, email, phone) and the key is a credential.
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emptyUsage, bump } from "@/lib/tracking/usage";
import { CORS, MAX_BODY_BYTES, cleanId, cleanStr, authorizeRequest, applySiteEffects, flushUsage, markHealthEvent } from "@/lib/tracking/server";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

const ok = () => NextResponse.json({ success: true }, { headers: CORS });

const MAX_RAW_FIELDS = 60;
const MAX_RAW_VALUE = 2000;

/** raw_data from the tracker, reduced to short string values under short keys. */
function cleanRaw(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, MAX_RAW_FIELDS)) {
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
    out[String(k).slice(0, 100)] = String(v).slice(0, MAX_RAW_VALUE);
  }
  return out;
}

export async function POST(req) {
  const supabase = supabaseAdmin;
  const usage = emptyUsage();
  const now = Date.now();
  try {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: CORS });

    let payload;
    try {
      payload = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
    }
    if (!payload || typeof payload !== "object") return ok();

    const apiKey = req.headers.get("x-api-key") || payload.api_key || null;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 400, headers: CORS });

    const auth = await authorizeRequest(supabase, { apiKey, event: payload, headers: req.headers, now });
    if (!auth.site || !auth.key.ok) return ok();
    const { site, key, decision, host } = auth;

    bump(usage, "requests");
    bump(usage, "bytes_in", len);
    await applySiteEffects(supabase, { site, key, decision, host, now });
    if (!decision.accept) {
      bump(usage, "dropped");
      after(() => flushUsage(supabase, site.id, usage, now));
      return ok();
    }

    // specify_form = true: only forms marked data-conversion="true" are leads.
    // Enforced here too, so a misbehaving tracker can't send the rest.
    if (site.specify_form === true && payload.is_labelled_conversion !== true) {
      bump(usage, "dropped");
      after(() => flushUsage(supabase, site.id, usage, now));
      return ok();
    }

    const visitorId = cleanId(payload.visitor_id);
    const email = cleanStr(payload.email, 320);

    // The same person submitting the same email within a minute is one lead.
    if (email && visitorId) {
      const { data: dupes } = await supabase
        .from("form_submissions")
        .select("id")
        .eq("site_id", site.id)
        .eq("visitor_id", visitorId)
        .eq("email", email)
        .gte("submitted_at", new Date(now - 60_000).toISOString())
        .limit(1);
      if (dupes && dupes.length > 0) return ok();
    }

    bump(usage, "forms");
    const pagePath = cleanStr(payload.page_path, 500);
    const { error: insertError } = await supabase.from("form_submissions").insert({
      site_id: site.id,
      visitor_id: visitorId,
      session_id: cleanId(payload.session_id),
      page_url: cleanStr(payload.page_url, 1000),
      page_path: pagePath,
      name: cleanStr(payload.name, 200),
      email,
      phone: cleanStr(payload.phone, 50),
      confidence: payload.confidence === "high" ? "high" : "low",
      raw_data: cleanRaw(payload.raw_data),
      submitted_at: new Date(now).toISOString(),
    });
    if (insertError) {
      console.error("[track-form] insert error:", insertError.message);
      return NextResponse.json({ error: "Server error" }, { status: 500, headers: CORS });
    }

    // A real conversion from a marked form is the proof the attribute works.
    if (payload.is_labelled_conversion === true) await markHealthEvent(supabase, site.id, pagePath, "conversion_form", now);
    // A conversion announced by a form inside an iframe (Typeform, Calendly, Jotform) proves that path works.
    if (payload.raw_data && payload.raw_data._kind === "iframe_submission") await markHealthEvent(supabase, site.id, pagePath, "iframe_forms", now);

    after(() => flushUsage(supabase, site.id, usage, now));
    return ok();
  } catch (err) {
    console.error("[track-form] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: CORS });
  }
}
