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

export async function POST(req) {
  try {
    const supabase = createSupabaseClient();

    let payload;
    try {
      payload = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
    }

    console.log("STRUCTURE HIT — payload:", JSON.stringify(payload, null, 2));

    const apiKey = payload?.api_key || req.headers.get("x-api-key") || null;
    console.log("STRUCTURE API KEY:", apiKey);

    if (!apiKey) return NextResponse.json({ success: true }, { headers: corsHeaders() });

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("id, is_active")
      .eq("api_key", apiKey)
      .single();

    console.log("STRUCTURE SITE:", site, "SITE ERROR:", siteError);

    if (!site || !site.is_active) return NextResponse.json({ success: true }, { headers: corsHeaders() });

    if (!payload.structures || payload.structures.length === 0) {
      return NextResponse.json({ success: true }, { headers: corsHeaders() });
    }

    const rows = payload.structures.map((s) => ({
      site_id: site.id,
      page_path: payload.page_path || "",
      page_height: payload.page_height || 0,
      header_index: s.header_index,
      header_text: s.header_text,
      header_tag: s.header_tag,
      position_y: s.position_y,
    }));

    console.log("STRUCTURE ROWS:", JSON.stringify(rows, null, 2));

    const { data: upserted, error: upsertError } = await supabase
      .from("page_structure")
      .upsert(rows, {
        onConflict: "site_id,page_path,header_index",
        ignoreDuplicates: false,
      })
      .select();

    console.log("STRUCTURE UPSERT RESULT:", upserted, "ERROR:", upsertError);

    if (upsertError) {
      console.error("STRUCTURE UPSERT ERROR:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });

  } catch (err) {
    console.error("STRUCTURE TRACK ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}