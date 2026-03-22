import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    }
  });
}

export async function POST(req) {
  try {
    const supabase = createSupabaseClient();

    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return NextResponse.json({ error: "No API key" }, { status: 400 });
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (!site || siteError) {
      return NextResponse.json({ error: "Invalid site" }, { status: 403 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown";

    const events = await req.json();

    for (const event of events) {

      // await supabase.from("visitors").upsert({
      //   visitor_id: event.visitor_id,
      //   site_id: site.id,
      //   ip_address: ip,
      //   last_seen: new Date(),
      //   first_seen: new Date(),
      // });
      // //replaced by
      // check if visitor exists
const { data: existingVisitor } = await supabase
  .from("visitors")
  .select("id, first_seen")
  .eq("visitor_id", event.visitor_id)
  .eq("site_id", site.id)
  .single();

if (!existingVisitor) {
  // ✅ FIRST TIME VISIT
  await supabase.from("visitors").insert({
    visitor_id: event.visitor_id,
    site_id: site.id,
    ip_address: ip,
    first_seen: new Date(),
    last_seen: new Date(),
    device_type: event.device_type || null,
    language: event.language || null,
  });
} else {
  // ✅ RETURNING VISITOR
  await supabase
    .from("visitors")
    .update({
      last_seen: new Date(),
    })
    .eq("id", existingVisitor.id);
}

      await supabase.from("sessions").upsert({
        session_id: event.session_id,
        visitor_id: event.visitor_id,
        site_id: site.id,
        last_activity_at: new Date(),
        referrer: event.referrer,
      });

      // if (event.type === "page_view_start") {
      //   await supabase.from("page_views").insert({
      //     page_view_id: event.page_view_id,
      //     session_id: event.session_id,
      //     visitor_id: event.visitor_id,
      //     site_id: site.id,
      //     page_url: event.page_url,
      //     page_path: event.page_path,
      //     page_title: event.page_title,
      //     entered_at: new Date(),
      //   });
      // }
      sendEvent({
  type: "page_view_start",
  visitor_id,
  session_id,
  page_view_id,
  page_url: window.location.href,
  page_path: window.location.pathname,
  page_title: document.title,
  referrer: document.referrer,
  language: navigator.language,
  user_agent: navigator.userAgent,
  device_type: getDeviceType(),
});

      if (event.type === "page_view_end") {
        await supabase
          .from("page_views")
          .update({
            time_on_page: event.duration,
            scroll_depth: event.scroll_depth,
            left_at: new Date(),
          })
          .eq("page_view_id", event.page_view_id);
      }
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        }
      }
    );

  } catch (err) {
    console.error("TRACK ERROR:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}