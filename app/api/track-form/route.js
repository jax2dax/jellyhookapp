// api/track-form/route.js
//
// A form submission captured by the tracker (a lead). Same authorization as
// /api/track: key (current or previous), then "is this from the site's own
// host". Nothing in here logs the payload or the key: a submission is
// personal data (name, email, phone) and the key is a credential.
import { NextResponse, after } from "next/server";
import { meteredAdmin } from "@/lib/db/admin";
import { metered, newMeter } from "@/lib/metrics/meter";
import { emptyUsage, bump } from "@/lib/tracking/usage";
import { CORS, MAX_BODY_BYTES, cleanId, cleanStr, authorizeRequest, applySiteEffects, flushUsage, markHealthEvent } from "@/lib/tracking/server";

const supabaseAdmin = meteredAdmin();

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

const ok = () => NextResponse.json({ success: true }, { headers: CORS });

import { dropSensitive } from "@/lib/tracking/sensitive";
import { checkNewLeads } from "@/lib/notifications/check";
import { canonicalVisitorId } from "@/lib/tracking/identity";
import { applyPageSnapshot } from "@/lib/tracking/pageSnapshot";
import { formKeyOf } from "@/lib/tracking/formKey";
import { countsAsLead, markOf } from "@/lib/tracking/formRules";

/**
 * The form's own switch in Settings, Lead forms (site_forms.counts_as_lead), or null when it has none or the table does
 * not exist yet (before migration 28: the site's default then applies, as before).
 */
async function formRule(supabase, siteId, formKey) {
  const { data, error } = await supabase.from("site_forms").select("counts_as_lead").eq("site_id", siteId).eq("form_key", formKey).maybeSingle();
  if (error || !data) return null;
  return data.counts_as_lead === true ? true : data.counts_as_lead === false ? false : null;
}

/** Counts one submission of a form, as a lead or skipped (no personal data). Never throws; before migration 28 a no-op. */
async function formSeen(supabase, siteId, formKey, pagePath, skipped, mark) {
  try {
    const { error } = await supabase.rpc("jh_form_seen", { p_site: siteId, p_key: formKey, p_page: pagePath, p_skipped: skipped, p_mark: mark });
    if (error && !/jh_form_seen|site_forms/.test(error.message || "")) console.error("[track-form] form count failed:", error.message);
  } catch (e) {
    console.error("[track-form] form count failed:", e instanceof Error ? e.message : String(e));
  }
}

const MAX_RAW_FIELDS = 60;
const MAX_RAW_VALUE = 2000;

/**
 * raw_data from the tracker, reduced to short string values under short keys, with every payment-card, bank-account
 * and identity-number field removed (lib/tracking/sensitive.js). The tracker already leaves those out; this is the
 * server's own check, for old cached trackers and HubSpot payloads.
 */
function cleanRaw(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw).slice(0, MAX_RAW_FIELDS)) {
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
    out[String(k).slice(0, 100)] = String(v).slice(0, MAX_RAW_VALUE);
  }
  const { raw: safe, removed } = dropSensitive(out);
  if (removed > 0) console.info("[track-form] removed " + removed + " sensitive field(s) from a submission"); // a count, never the value
  return safe;
}

// the request's database work and server time are counted (lib/metrics/meter.ts) and added to the site's daily usage
// by flushUsage, for the control room (app/admin)
export async function POST(req) {
  return metered(newMeter(), () => handlePost(req));
}

async function handlePost(req) {
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

    // Is this form a lead? The same rule as the tracker (lib/tracking/formRules.js): data-conversion, then the form's
    // switch in Settings, then the site's default (specify_form). Enforced here too, so an old or stale tracker cannot
    // add a lead the site switched off. A form that is not a lead, or the tracker's "skipped" ping (which carries no
    // answers), is only counted for Settings; nothing else is stored.
    const pagePath = cleanStr(payload.page_path, 500) || "/";
    const formIndex = Number.isInteger(payload.form_index) && payload.form_index >= -1 && payload.form_index < 1000 ? payload.form_index : 0;
    const formKey = formKeyOf(payload.form_key_hint, pagePath, formIndex).slice(0, 300);
    // old trackers (cached up to an hour) send only is_labelled_conversion: true means marked, false means unmarked
    const mark = markOf(payload.conversion_mark !== undefined ? payload.conversion_mark : payload.is_labelled_conversion === true ? "true" : null);
    const rule = mark === null ? await formRule(supabase, site.id, formKey) : null;
    if (payload.skipped === true || !countsAsLead({ mark, rule, specifyForm: site.specify_form === true })) {
      bump(usage, "dropped");
      after(async () => {
        await formSeen(supabase, site.id, formKey, pagePath, true, mark);
        await flushUsage(supabase, site.id, usage, now);
      });
      return ok();
    }

    // the visitor this id counts as (lib/tracking/identity.js): a lead is attached to the same visitor its visit was
    const visitorId = await canonicalVisitorId(supabase, site.id, cleanId(payload.visitor_id));
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
    const row = {
      site_id: site.id,
      visitor_id: visitorId,
      session_id: await canonicalVisitorId(supabase, site.id, cleanId(payload.session_id)), // an alias of a merged visit
      page_url: cleanStr(payload.page_url, 1000),
      page_path: pagePath,
      name: cleanStr(payload.name, 200),
      email,
      phone: cleanStr(payload.phone, 50),
      confidence: payload.confidence === "high" ? "high" : "low",
      raw_data: cleanRaw(payload.raw_data),
      submitted_at: new Date(now).toISOString(),
      form_key: formKey,
    };
    let { data: inserted, error: insertError } = await supabase.from("form_submissions").insert(row).select("id").single();
    if (insertError && /form_key/.test(insertError.message || "")) {
      // before 28-lead-forms.sql: the lead without its form
      delete row.form_key;
      ({ data: inserted, error: insertError } = await supabase.from("form_submissions").insert(row).select("id").single());
    }
    if (insertError) {
      console.error("[track-form] insert error:", insertError.message);
      return NextResponse.json({ error: "Server error" }, { status: 500, headers: CORS });
    }

    // A real conversion from a marked form is the proof the attribute works.
    if (payload.is_labelled_conversion === true) await markHealthEvent(supabase, site.id, pagePath, "conversion_form", now);
    // A conversion announced by a form inside an iframe (Typeform, Calendly, Jotform) proves that path works.
    if (payload.raw_data && payload.raw_data._kind === "iframe_submission") await markHealthEvent(supabase, site.id, pagePath, "iframe_forms", now);

    after(async () => {
      await formSeen(supabase, site.id, formKey, pagePath, false, mark);
      await flushUsage(supabase, site.id, usage, now);
    });
    // the new lead's marks and notification rules, after the response (never slows the tracker), in its site's lane:
    // lib/notifications/check.ts. Before migration 20 it falls back to checking the marks only. The form page's
    // heading times and scroll so far are written first (lib/tracking/pageSnapshot.js), so the marks and the hook's
    // visit summary see that page; a snapshot that fails is skipped and the lead is checked all the same.
    if (inserted?.id)
      after(async () => {
        if (payload.page_snapshot) await applyPageSnapshot(supabase, site.id, payload.page_snapshot, now);
        await checkNewLeads(site.id, [inserted.id]);
      });
    return ok();
  } catch (err) {
    console.error("[track-form] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: CORS });
  }
}
