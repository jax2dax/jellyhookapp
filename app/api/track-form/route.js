import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    // NO Access-Control-Allow-Credentials header — omitting it is correct
    // credentials: omit on client + no allow-credentials on server = works with wildcard *
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}
export async function POST(req) {
  try {
    const supabase = createSupabaseClient();

    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
    }

    console.log("FORM TRACK HIT — payload:", JSON.stringify(payload, null, 2));

    const apiKey = req.headers.get("x-api-key") || payload?.api_key || null;
    console.log("FORM API KEY:", apiKey);

    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 400, headers: corsHeaders() });
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("id, is_active")
      .eq("api_key", apiKey)
      .single();

    console.log("FORM SITE:", site, "ERROR:", siteError);

    if (!site || siteError) {
      console.log("FORM: site not found or error");
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    if (!site.is_active) {
      console.log("FORM: site inactive, dropping");
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    // Dedup check
    if (payload.email) {
      const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
      const { data: dupe } = await supabase
        .from("form_submissions")
        .select("id")
        .eq("site_id", site.id)
        .eq("visitor_id", payload.visitor_id)
        .eq("email", payload.email)
        .gte("submitted_at", sixtySecondsAgo)
        .single();

      if (dupe) {
        console.log("FORM: duplicate submission dropped");
        return NextResponse.json({ success: true }, { headers: corsHeaders() });
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from("form_submissions")
      .insert({
        site_id: site.id,
        visitor_id: payload.visitor_id || null,
        session_id: payload.session_id || null,
        page_url: payload.page_url || null,
        page_path: payload.page_path || null,
        name: payload.name || null,
        email: payload.email || null,
        phone: payload.phone || null,
        confidence: payload.confidence || "low",
        raw_data: payload.raw_data || {},
        submitted_at: new Date().toISOString(),
      })
      .select();

    console.log("FORM INSERT RESULT:", inserted, "ERROR:", insertError);

    if (insertError) {
      console.error("FORM INSERT ERROR:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });

  } catch (err) {
    console.error("FORM TRACK ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}