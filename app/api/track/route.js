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

// Free, no API key, 1000 req/min — returns null on localhost (correct behavior)
async function getCountryFromIp(ip) {
  if (!ip || ip === "unknown" || ip === "127.0.0.1" || ip === "::1") return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country`, {
      signal: AbortSignal.timeout(2000),
    });
    const data = await res.json();
    return data.status === "success" ? data.country : null;
  } catch {
    return null;
  }
}

// Bot detection — filter before any DB writes
const BOT_PATTERNS = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu|duckduck|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegram|applebot|semrush|ahrefs|mj12bot|dotbot|petalbot/i;

function isBot(userAgent) {
  if (!userAgent) return true; // no UA = bot
  return BOT_PATTERNS.test(userAgent);
}

export async function POST(req) {
  try {
    const supabase = createSupabaseClient();

    let events;
    try {
      events = await req.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: corsHeaders() });
    }

    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "Events must be array" }, { status: 400, headers: corsHeaders() });
    }

    // Bot check — kill the request before touching DB
    const userAgent = events?.[0]?.user_agent || req.headers.get("user-agent") || "";
    if (isBot(userAgent)) {
      return NextResponse.json({ success: true }, { headers: corsHeaders() }); // silent drop
    }

    const apiKey = req.headers.get("x-api-key") || events?.[0]?.api_key || null;

    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 400, headers: corsHeaders() });
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (!site || siteError) {
      return NextResponse.json({ error: "Invalid site" }, { status: 403, headers: corsHeaders() });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Resolve country once per request
    const country = await getCountryFromIp(ip);

    for (const event of events) {

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
      const { data: existingSession } = await supabase
        .from("sessions")
        .select("id")
        .eq("session_id", event.session_id)
        .single();

      if (!existingSession) {
        await supabase.from("sessions").insert({
          session_id: event.session_id,
          visitor_id: event.visitor_id,
          site_id: site.id,
          started_at: new Date(),
          last_activity_at: new Date(),
          referrer: event.referrer || null,
          country: country || null,
          timezone: event.timezone || null,
        });
      } else {
        const sessionUpdates = { last_activity_at: new Date() };
        if (event.type === "page_view_end") sessionUpdates.ended_at = new Date();
        await supabase
          .from("sessions")
          .update(sessionUpdates)
          .eq("id", existingSession.id);
      }

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
    console.error("TRACK ERROR:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}