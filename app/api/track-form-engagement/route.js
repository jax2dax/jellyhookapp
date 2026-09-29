// api/track-form-engagement/route.js
//
// Receives viewed/started/submitted/abandoned status updates for one
// (page_view, form) pair — see mds/database.md's form_engagement section and
// public/tracker.js's "FORM ENGAGEMENT TRACKING" block for the full model.
// Upserts on (page_view_id, form_index) so the same row evolves through its
// status instead of accumulating one row per moment.
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}

const VALID_STATUSES = new Set(["viewed", "started", "submitted", "abandoned"]);

export async function POST(req) {
  try {
    const supabase = createSupabaseClient();

    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
    }

    const apiKey = req.headers.get("x-api-key") || payload?.api_key || null;
    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 400, headers: corsHeaders() });
    }
    if (!payload.page_view_id || payload.form_index == null || !VALID_STATUSES.has(payload.status)) {
      return NextResponse.json({ success: true }, { headers: corsHeaders() }); // malformed — drop silently, same as other tracker endpoints
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("id, is_active")
      .eq("api_key", apiKey)
      .single();

    if (!site || siteError || !site.is_active) {
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    const { data: existing } = await supabase
      .from("form_engagement")
      .select("id, status")
      .eq("page_view_id", payload.page_view_id)
      .eq("form_index", payload.form_index)
      .maybeSingle();

    // Status only ever moves forward — viewed < started < submitted/abandoned
    // — so an out-of-order retry (e.g. a "started" arriving after
    // "abandoned" already landed because of network reordering) can't
    // regress a finished row back to an earlier state.
    const RANK = { viewed: 0, started: 1, submitted: 2, abandoned: 2 };
    if (existing && RANK[payload.status] < RANK[existing.status]) {
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    const now = new Date().toISOString();
    const isTerminal = payload.status === "submitted" || payload.status === "abandoned";

    if (!existing) {
      const { error: insertError } = await supabase.from("form_engagement").insert({
        site_id: site.id,
        visitor_id: payload.visitor_id || null,
        session_id: payload.session_id || null,
        page_view_id: payload.page_view_id,
        page_path: payload.page_path || null,
        form_index: payload.form_index,
        status: payload.status,
        last_field_type: payload.last_field_type || null,
        last_field_key: payload.last_field_key || null,
        form_top_y: payload.form_top_y ?? null,
        form_bottom_y: payload.form_bottom_y ?? null,
        first_input_at: payload.status === "started" ? now : null,
        ended_at: isTerminal ? now : null,
      });
      if (insertError) console.error("🔴 FORM ENGAGEMENT INSERT ERROR:", insertError.message);
    } else {
      const update = { status: payload.status };
      if (payload.last_field_type) update.last_field_type = payload.last_field_type;
      if (payload.last_field_key !== undefined) update.last_field_key = payload.last_field_key || null;
      if (payload.form_top_y != null) update.form_top_y = payload.form_top_y;
      if (payload.form_bottom_y != null) update.form_bottom_y = payload.form_bottom_y;
      if (payload.status === "started" && existing.status === "viewed") update.first_input_at = now;
      if (isTerminal) update.ended_at = now;

      const { error: updateError } = await supabase.from("form_engagement").update(update).eq("id", existing.id);
      if (updateError) console.error("🔴 FORM ENGAGEMENT UPDATE ERROR:", updateError.message);
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });
  } catch (err) {
    console.error("FORM ENGAGEMENT TRACK ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}
