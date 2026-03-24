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
    console.log("TRACK HIT");

    const supabase = createSupabaseClient();

    // Parse body first — needed for beacon fallback api_key extraction
    let events;
    try {
      events = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
    }

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "Events must be array" }, { status: 400, headers: corsHeaders() });
    }

    // Header auth (fetch keepalive path) — body fallback (sendBeacon path)
    // Both paths always include api_key in body, so this is always reliable
    const apiKey = req.headers.get("x-api-key") || events?.[0]?.api_key || null;

    console.log("API KEY:", apiKey);

    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 400, headers: corsHeaders() });
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    console.log("SITE:", site, siteError);

    if (!site || siteError) {
      return NextResponse.json({ error: "Invalid site" }, { status: 403, headers: corsHeaders() });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    for (const event of events) {
      console.log("EVENT:", event);

      // VISITOR
      const { data: existingVisitor } = await supabase
        .from("visitors")
        .select("id")
        .eq("visitor_id", event.visitor_id)
        .eq("site_id", site.id)
        .single();

      if (!existingVisitor) {
        await supabase.from("visitors").insert({
          visitor_id: event.visitor_id,
          site_id: site.id,
          ip_address: ip,
          first_seen: new Date(),
          last_seen: new Date(),
          device_type: event.device_type || null,
        });
      } else {
        await supabase
          .from("visitors")
          .update({ last_seen: new Date() })
          .eq("id", existingVisitor.id);
      }

      // SESSION
      await supabase.from("sessions").upsert({
        session_id: event.session_id,
        visitor_id: event.visitor_id,
        site_id: site.id,
        last_activity_at: new Date(),
        referrer: event.referrer || null,
      });

      // PAGE VIEW START
      if (event.type === "page_view_start") {
        const { data: existing } = await supabase
          .from("page_views")
          .select("id")
          .eq("page_view_id", event.page_view_id)
          .single();

        if (!existing) {
          await supabase.from("page_views").insert({
            page_view_id: event.page_view_id,
            session_id: event.session_id,
            visitor_id: event.visitor_id,
            site_id: site.id,
            page_url: event.page_url || "",
            page_path: event.page_path || "",
            page_title: event.page_title || "",
            entered_at: new Date(),
          });
        }
      }

      // PAGE VIEW END
      if (event.type === "page_view_end") {
        const { data: existing } = await supabase
          .from("page_views")
          .select("id")
          .eq("page_view_id", event.page_view_id)
          .single();

        if (existing) {
          await supabase
            .from("page_views")
            .update({
              time_on_page: event.duration || 0,
              scroll_depth: event.scroll_depth || 0,
              left_at: new Date(),
            })
            .eq("page_view_id", event.page_view_id);
        } else {
          // Beacon arrived before start (race condition on very fast exits)
          await supabase.from("page_views").insert({
            page_view_id: event.page_view_id,
            session_id: event.session_id,
            visitor_id: event.visitor_id,
            site_id: site.id,
            page_url: "",
            page_path: "",
            page_title: "",
            entered_at: new Date(Date.now() - (event.duration || 0)),
            left_at: new Date(),
            time_on_page: event.duration || 0,
            scroll_depth: event.scroll_depth || 0,
          });
        }
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() });

  } catch (err) {
    console.error("TRACK ERROR FULL:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}