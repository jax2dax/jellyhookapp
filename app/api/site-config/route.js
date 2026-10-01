// api/site-config/route.js
// Lightweight public endpoint — returns only non-sensitive config the tracker needs.
// No auth required — the api_key in the query string IS the credential.
// Only returns specify_form boolean, nothing else.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role — see app/api/track/route.js's header comment for why.
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // Cache for 60 seconds — site config rarely changes, avoids hammering DB on every page load
    "Cache-Control": "public, max-age=60",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const apiKey = searchParams.get("key");

    if (!apiKey) {
      // Return safe default — global mode — so tracker never fails silently
      return NextResponse.json({ specify_form: false }, { headers: corsHeaders() });
    }

    const supabase = supabaseAdmin;

    const { data: site, error } = await supabase
      .from("sites")
      .select("specify_form, is_active")
      .eq("api_key", apiKey)
      .single();

    if (error || !site || !site.is_active) {
      // Site not found or inactive — return safe default
      return NextResponse.json({ specify_form: false }, { headers: corsHeaders() });
    }

    return NextResponse.json(
      { specify_form: site.specify_form ?? false },
      { headers: corsHeaders() }
    );

  } catch (err) {
    console.error("[site-config] Error:", err);
    // Always return a usable default — never break the tracker
    return NextResponse.json({ specify_form: false }, { headers: corsHeaders() });
  }
}