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
import { cleanDelta, cleanErrors, cleanFormFields, mergeFieldTimings } from "@/lib/tracking/formEngagement";
import { formKeyOf } from "@/lib/tracking/formKey";
import { canonicalVisitorId } from "@/lib/tracking/identity";
import { CORS, MAX_BODY_BYTES, cleanId, cleanStr, cleanNum, cleanTime, authorizeRequest, applySiteEffects, flushUsage, markHealthEvent } from "@/lib/tracking/server";

// Service role — see app/api/track/route.js's header comment for why.
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = () => CORS;

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}

const VALID_STATUSES = new Set(["viewed", "started", "submitted", "abandoned"]);
// cleanDelta / cleanErrors / cleanFormFields / mergeFieldTimings: lib/tracking/formEngagement.js (pure, tested).

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
    payload.field_errors_delta = cleanErrors(payload.field_errors_delta);
    payload.form_fields = cleanFormFields(payload.form_fields);
    // on-screen time before the first input (form at least half visible, tab visible), sent with the first "started"
    payload.onscreen_before_start_ms = cleanNum(payload.onscreen_before_start_ms, 0, 24 * 3600_000);
    // the form's identity across pages: its id, else its name, else page + position (lib/tracking/formKey.js)
    const formKey = formKeyOf(payload.form_key_hint, pagePath, formIndex);
    const reportedActivity = cleanTime(payload.last_activity_at, nowMs);
    payload.last_activity_at = reportedActivity ? reportedActivity.toISOString() : undefined;

    const auth = await authorizeRequest(supabase, { apiKey, event: payload, headers: req.headers, now: nowMs });
    if (!auth.site || !auth.key.ok) return NextResponse.json({ success: true }, { headers: corsHeaders() });
    const { site, key, decision, host } = auth;
    payload.visitor_id = await canonicalVisitorId(supabase, site.id, payload.visitor_id); // lib/tracking/identity.js
    payload.session_id = await canonicalVisitorId(supabase, site.id, payload.session_id); // an alias of a merged visit

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

    // Deploy-order safety: until 17-form-versions.sql has run, form_key / form_version_id do not exist. Every read and
    // write below then retries without them, so tracking never stops (the rows just get no identity / version).
    const missingCol = (e) => !!e && /form_key|form_version_id/.test(e.message || "");
    const findExisting = (cols) =>
      supabase.from("form_engagement").select(cols).eq("session_id", payload.session_id).eq("page_path", payload.page_path).eq("form_index", payload.form_index).maybeSingle();
    let { data: existing, error: findError } = await findExisting("id, status, field_timings, last_activity_at, viewed_at, form_key, form_version_id");
    if (missingCol(findError)) ({ data: existing } = await findExisting("id, status, field_timings, last_activity_at, viewed_at"));

    // Status only ever moves forward — viewed < started < submitted/abandoned
    // — so an out-of-order retry (e.g. a "started" arriving after
    // "abandoned" already landed because of network reordering) can't
    // regress a finished row back to an earlier state. A same-rank resend
    // (e.g. another "started" while already started) passes through fine —
    // that's the normal case for a field-timing flush, which doesn't change
    // status at all.
    const RANK = { viewed: 0, started: 1, submitted: 2, abandoned: 2 };
    if (existing && RANK[payload.status] < RANK[existing.status]) {
      // never move the status back; but error counts sent with an older status are still real: keep them
      if (payload.field_errors_delta) {
        await supabase.from("form_engagement").update({ field_timings: mergeFieldTimings(existing.field_timings, undefined, payload.field_errors_delta) }).eq("id", existing.id);
      }
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

    // Places the row in its form's version once its field list is known (mds/migrations/17-form-versions.sql). After the
    // response: the tracker never waits for it. A failure only leaves the row unversioned (it still counts in "All").
    const placeVersion = (rowId) =>
      after(async () => {
        const { error } = await supabase.rpc("jh_place_form_version", { p_row: rowId });
        if (error) console.error("🔴 FORM VERSION PLACE ERROR:", error.message);
      });

    if (!existing) {
      const row = {
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
        field_timings: mergeFieldTimings(null, payload.field_timings_delta, payload.field_errors_delta),
        form_fields: payload.form_fields ?? null,
        form_key: formKey,
        onscreen_before_start_ms: payload.status === "started" ? payload.onscreen_before_start_ms : null,
        last_activity_at: resolvedActivityAt,
        first_input_at: payload.status === "started" ? resolvedActivityAt : null,
        ended_at: endedAt,
      };
      let { data: inserted, error: insertError } = await supabase.from("form_engagement").insert(row).select("id").single();
      if (missingCol(insertError)) {
        delete row.form_key;
        ({ data: inserted, error: insertError } = await supabase.from("form_engagement").insert(row).select("id").single());
      }
      if (insertError) console.error("🔴 FORM ENGAGEMENT INSERT ERROR:", insertError.message);
      else if (payload.form_fields && inserted?.id && "form_key" in row) placeVersion(inserted.id);
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
      if (payload.field_timings_delta || payload.field_errors_delta) update.field_timings = mergeFieldTimings(existing.field_timings, payload.field_timings_delta, payload.field_errors_delta);
      if (payload.form_fields) update.form_fields = payload.form_fields;
      if ("form_key" in existing && !existing.form_key) update.form_key = formKey; // the first identity sticks
      if (payload.status === "started" && existing.status === "viewed") {
        update.first_input_at = resolvedActivityAt;
        if (payload.onscreen_before_start_ms !== null) update.onscreen_before_start_ms = payload.onscreen_before_start_ms;
      }
      if (isTerminal) update.ended_at = endedAt;

      const { error: updateError } = await supabase.from("form_engagement").update(update).eq("id", existing.id);
      if (updateError) console.error("🔴 FORM ENGAGEMENT UPDATE ERROR:", updateError.message);
      else if (payload.form_fields && "form_version_id" in existing && !existing.form_version_id) placeVersion(existing.id);
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (err) {
    console.error("FORM ENGAGEMENT TRACK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: corsHeaders() });
  }
}
