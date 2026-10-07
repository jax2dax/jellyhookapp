// api/track-form-engagement/route.js
//
// Receives viewed/started/submitted/abandoned status updates, plus
// incremental per-field timing deltas, for one (session, page, form)
// scope — see mds/database.md's form_engagement section and
// public/tracker.js's "FORM ENGAGEMENT TRACKING" block for the full model.
//
// Keyed by (session_id, page_path, form_index), NOT page_view_id — a
// visitor tabbing away and back (or briefly visiting another page and
// returning to the SAME page) always gets a fresh page_view_id, but must
// resume the SAME form-fill-in-progress, not start a disconnected new one.
// page_view_id is still stored (informational — "most recent page_view
// that touched this row"), just no longer part of its identity.
//
// field_timings is accumulated here, server-side, by additively merging
// each incoming field_timings_delta into whatever's already stored — the
// client only ever reports "how long was I focused on this field THIS
// visit," never a running total, so a full page reload mid-fill (which
// wipes all client-side JS state) still accumulates correctly without the
// client needing to remember or re-fetch anything.
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emptyUsage, bump } from "@/lib/tracking/usage";
import { CORS, MAX_BODY_BYTES, cleanId, cleanStr, cleanNum, cleanTime, authorizeRequest, applySiteEffects, flushUsage, markHealthEvent } from "@/lib/tracking/server";

// Service role — see app/api/track/route.js's header comment for why.
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = () => CORS;

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}

const VALID_STATUSES = new Set(["viewed", "started", "submitted", "abandoned"]);
const MAX_FIELDS = 60;

// field_timings_delta from the tracker, reduced to the known keys with sane numbers.
function cleanDelta(delta) {
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) return undefined;
  const out = {};
  for (const [k, d] of Object.entries(delta).slice(0, MAX_FIELDS)) {
    if (!d || typeof d !== "object") continue;
    out[String(k).slice(0, 100)] = {
      firstFocusAt: typeof d.firstFocusAt === "string" ? d.firstFocusAt.slice(0, 40) : null,
      firstKeydownAt: typeof d.firstKeydownAt === "string" ? d.firstKeydownAt.slice(0, 40) : null,
      lastUnfocusAt: typeof d.lastUnfocusAt === "string" ? d.lastUnfocusAt.slice(0, 40) : null,
      totalFocusedMsDelta: cleanNum(d.totalFocusedMsDelta, 0, 24 * 3600_000) ?? 0,
    };
  }
  return out;
}

// Merges one incoming field's delta into whatever's already recorded for
// that field key. `order` is assigned once, the first time a key ever
// appears, based on how many fields are already known — never client-
// supplied, so it stays correct regardless of how many separate page
// visits/reloads this field's timing data was assembled across.
function mergeFieldTimings(existingTimings, delta) {
  const merged = { ...(existingTimings || {}) };
  for (const [key, d] of Object.entries(delta || {})) {
    const prev = merged[key];
    merged[key] = {
      order: prev?.order ?? Object.keys(merged).length + 1,
      firstFocusAt: prev?.firstFocusAt || d.firstFocusAt || null,
      firstKeydownAt: prev?.firstKeydownAt || d.firstKeydownAt || null, // first-ever keystroke in this field, never overwritten once set
      lastUnfocusAt: d.lastUnfocusAt || prev?.lastUnfocusAt || null, // most recent blur always wins
      totalFocusedMs: (prev?.totalFocusedMs || 0) + (d.totalFocusedMsDelta || 0), // additive — this is the whole point
    };
  }
  return merged;
}

export async function POST(req) {
  try {
    const supabase = supabaseAdmin;
    const usage = emptyUsage();
    const nowMs = Date.now();

    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: corsHeaders() });

    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
    }
    if (!payload || typeof payload !== "object") return NextResponse.json({ success: true }, { headers: corsHeaders() });

    const apiKey = req.headers.get("x-api-key") || payload?.api_key || null;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 400, headers: corsHeaders() });
    }
    const sessionId = cleanId(payload.session_id);
    const pagePath = cleanStr(payload.page_path, 500);
    const formIndex = cleanNum(payload.form_index, 0, 1000);
    if (!sessionId || !pagePath || formIndex === null || !VALID_STATUSES.has(payload.status)) {
      return NextResponse.json({ success: true }, { headers: corsHeaders() }); // malformed — drop silently, same as other tracker endpoints
    }
    payload.session_id = sessionId;
    payload.page_path = pagePath;
    payload.form_index = formIndex;
    payload.page_view_id = cleanId(payload.page_view_id);
    payload.visitor_id = cleanId(payload.visitor_id);
    payload.last_field_type = cleanStr(payload.last_field_type, 20);
    payload.last_field_key = payload.last_field_key == null ? payload.last_field_key : cleanStr(payload.last_field_key, 100);
    payload.form_top_y = cleanNum(payload.form_top_y, 0, 10_000_000);
    payload.form_bottom_y = cleanNum(payload.form_bottom_y, 0, 10_000_000);
    payload.field_timings_delta = cleanDelta(payload.field_timings_delta);
    const reportedActivity = cleanTime(payload.last_activity_at, nowMs);
    payload.last_activity_at = reportedActivity ? reportedActivity.toISOString() : undefined;

    const auth = await authorizeRequest(supabase, { apiKey, event: payload, headers: req.headers, now: nowMs });
    if (!auth.site || !auth.key.ok) return NextResponse.json({ success: true }, { headers: corsHeaders() });
    const { site, key, decision, host } = auth;

    bump(usage, "requests");
    bump(usage, "bytes_in", len);
    await applySiteEffects(supabase, { site, key, decision, host, now: nowMs });
    if (!decision.accept) {
      bump(usage, "dropped");
      after(() => flushUsage(supabase, site.id, usage, nowMs));
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }
    bump(usage, "engagement");
    after(() => flushUsage(supabase, site.id, usage, nowMs));
    // Real per-field timings from a form with marked fields prove data-track-field works.
    if (payload.field_timings_delta && payload.has_marked_fields === true) await markHealthEvent(supabase, site.id, pagePath, "field_attr", nowMs);

    const { data: existing } = await supabase
      .from("form_engagement")
      .select("id, status, field_timings, last_activity_at, viewed_at")
      .eq("session_id", payload.session_id)
      .eq("page_path", payload.page_path)
      .eq("form_index", payload.form_index)
      .maybeSingle();

    // Status only ever moves forward — viewed < started < submitted/abandoned
    // — so an out-of-order retry (e.g. a "started" arriving after
    // "abandoned" already landed because of network reordering) can't
    // regress a finished row back to an earlier state. A same-rank resend
    // (e.g. another "started" while already started) passes through fine —
    // that's the normal case for a field-timing flush, which doesn't change
    // status at all.
    const RANK = { viewed: 0, started: 1, submitted: 2, abandoned: 2 };
    if (existing && RANK[payload.status] < RANK[existing.status]) {
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    const now = new Date().toISOString();
    const isTerminal = payload.status === "submitted" || payload.status === "abandoned";
    // The client always sends the real moment of the triggering
    // focus/blur/submit event, not "now" — but fall back to now if it's
    // ever missing so last_activity_at is never left null.
    const incomingActivityAt = payload.last_activity_at || now;
    // Resolved ONCE, used for both last_activity_at and ended_at below — a
    // request that finalizes the form as abandoned typically carries this
    // SAME request's own final field-blur delta, so ended_at must reflect
    // the value being written THIS request, never the stale pre-update one
    // (that would silently drop the last field's dwell time from the
    // abandon timestamp). Defensive max() against out-of-order delivery.
    const resolvedActivityAt = existing?.last_activity_at && existing.last_activity_at > incomingActivityAt ? existing.last_activity_at : incomingActivityAt;
    // Abandonment must be dated to the true last activity, never to
    // whenever this request happened to be processed; submission dates to
    // the actual submit moment (now — there's no earlier "true" moment for it).
    const endedAt = payload.status === "abandoned" ? resolvedActivityAt : payload.status === "submitted" ? now : null;

    if (!existing) {
      const { error: insertError } = await supabase.from("form_engagement").insert({
        site_id: site.id,
        visitor_id: payload.visitor_id || null,
        session_id: payload.session_id,
        page_view_id: payload.page_view_id || null,
        page_path: payload.page_path,
        form_index: payload.form_index,
        status: payload.status,
        last_field_type: payload.last_field_type || null,
        last_field_key: payload.last_field_key || null,
        form_top_y: payload.form_top_y ?? null,
        form_bottom_y: payload.form_bottom_y ?? null,
        field_timings: mergeFieldTimings(null, payload.field_timings_delta),
        last_activity_at: resolvedActivityAt,
        first_input_at: payload.status === "started" ? resolvedActivityAt : null,
        ended_at: endedAt,
      });
      if (insertError) console.error("🔴 FORM ENGAGEMENT INSERT ERROR:", insertError.message);
    } else {
      const update = {
        status: payload.status,
        last_activity_at: resolvedActivityAt,
      };
      if (payload.last_field_type) update.last_field_type = payload.last_field_type;
      if (payload.last_field_key !== undefined) update.last_field_key = payload.last_field_key || null;
      if (payload.form_top_y != null) update.form_top_y = payload.form_top_y;
      if (payload.form_bottom_y != null) update.form_bottom_y = payload.form_bottom_y;
      if (payload.page_view_id) update.page_view_id = payload.page_view_id; // informational only, see header comment
      if (payload.field_timings_delta) update.field_timings = mergeFieldTimings(existing.field_timings, payload.field_timings_delta);
      if (payload.status === "started" && existing.status === "viewed") update.first_input_at = resolvedActivityAt;
      if (isTerminal) update.ended_at = endedAt;

      const { error: updateError } = await supabase.from("form_engagement").update(update).eq("id", existing.id);
      if (updateError) console.error("🔴 FORM ENGAGEMENT UPDATE ERROR:", updateError.message);
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (err) {
    console.error("FORM ENGAGEMENT TRACK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders() });
  }
}
