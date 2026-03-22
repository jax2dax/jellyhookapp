import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key",
  };
}
export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

// export async function POST(req) {
//   try {
//     const supabase = createSupabaseClient();

//     const apiKey = req.headers.get("x-api-key");

//     if (!apiKey) {
//       return NextResponse.json({ error: "No API key" }, { status: 400 });
//     }

//     const { data: site, error: siteError } = await supabase
//       .from("sites")
//       .select("*")
//       .eq("api_key", apiKey)
//       .single();

//     if (!site || siteError) {
//       return NextResponse.json({ error: "Invalid site" }, { status: 403 });
//     }

//     const ip =
//       req.headers.get("x-forwarded-for")?.split(",")[0] ||
//       "unknown";

//     const events = await req.json();

//     for (const event of events) {

//       // await supabase.from("visitors").upsert({
//       //   visitor_id: event.visitor_id,
//       //   site_id: site.id,
//       //   ip_address: ip,
//       //   last_seen: new Date(),
//       //   first_seen: new Date(),
//       // });
//       // //replaced by
//       // check if visitor exists
// const { data: existingVisitor } = await supabase
//   .from("visitors")
//   .select("id, first_seen")
//   .eq("visitor_id", event.visitor_id)
//   .eq("site_id", site.id)
//   .single();

// if (!existingVisitor) {
//   // ✅ FIRST TIME VISIT
//   await supabase.from("visitors").insert({
//     visitor_id: event.visitor_id,
//     site_id: site.id,
//     ip_address: ip,
//     first_seen: new Date(),
//     last_seen: new Date(),
//     device_type: event.device_type || null,
//     language: event.language || null,
//   });
// } else {
//   // ✅ RETURNING VISITOR
//   await supabase
//     .from("visitors")
//     .update({
//       last_seen: new Date(),
//     })
//     .eq("id", existingVisitor.id);
// }

//       await supabase.from("sessions").upsert({
//         session_id: event.session_id,
//         visitor_id: event.visitor_id,
//         site_id: site.id,
//         last_activity_at: new Date(),
//         referrer: event.referrer,
//       });

//       // if (event.type === "page_view_start") {
//       //   await supabase.from("page_views").insert({
//       //     page_view_id: event.page_view_id,
//       //     session_id: event.session_id,
//       //     visitor_id: event.visitor_id,
//       //     site_id: site.id,
//       //     page_url: event.page_url,
//       //     page_path: event.page_path,
//       //     page_title: event.page_title,
//       //     entered_at: new Date(),
//       //   });
//       // }
//       sendEvent({
//   type: "page_view_start",
//   visitor_id,
//   session_id,
//   page_view_id,
//   page_url: window.location.href,
//   page_path: window.location.pathname,
//   page_title: document.title,
//   referrer: document.referrer,
//   language: navigator.language,
//   user_agent: navigator.userAgent,
//   device_type: getDeviceType(),
// });

//       if (event.type === "page_view_end") {
//         await supabase
//           .from("page_views")
//           .update({
//             time_on_page: event.duration,
//             scroll_depth: event.scroll_depth,
//             left_at: new Date(),
//           })
//           .eq("page_view_id", event.page_view_id);
//       }
//     }

//     return NextResponse.json(
//       { success: true },
//       {
//         headers: {
//           "Access-Control-Allow-Origin": "*",
//         }
//       }
//     );

//   } catch (err) {
//     console.error("TRACK ERROR:", err);
//     return NextResponse.json({ error: "Server error" }, { status: 500 });
//   }
// } //replaced by

export async function POST(req) {
  try {
    console.log("TRACK HIT");

    const supabase = createSupabaseClient();

    const apiKey = req.headers.get("x-api-key");
    console.log("API KEY:", apiKey);

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    console.log("SITE:", site, siteError);

    if (!site || siteError) {
      return NextResponse.json(
        { error: "Invalid site" },
        { status: 403, headers: corsHeaders() }
      );
    }

    let events;

    try {
      events = await req.json();
    } catch (e) {
      console.log("JSON ERROR:", e);
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400, headers: corsHeaders() }
      );
    }

    console.log("EVENTS:", events);

    if (!Array.isArray(events)) {
      return NextResponse.json(
        { error: "Events must be array" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown";

    for (const event of events) {
      console.log("EVENT:", event);

      // TEMP SAFE INSERT (no logic yet)
      // =========================
// VISITOR (SAFE)
// =========================
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
  });
} else {
  await supabase
    .from("visitors")
    .update({ last_seen: new Date() })
    .eq("id", existingVisitor.id);
}

// =========================
// SESSION
// =========================
await supabase.from("sessions").upsert({
  session_id: event.session_id,
  visitor_id: event.visitor_id,
  site_id: site.id,
  last_activity_at: new Date(),
  referrer: event.referrer || null,
});

// =========================
// PAGE VIEW START
// =========================
if (event.type === "page_view_start") {
  const { data, error } = await supabase.from("page_views").insert({
    page_view_id: event.page_view_id || crypto.randomUUID(),
    session_id: event.session_id,
    visitor_id: event.visitor_id,
    site_id: site.id,
    page_url: event.page_url || "",
    page_path: event.page_path || "",
    page_title: event.page_title || "",
    entered_at: new Date(),
  });

  console.log("PAGE VIEW INSERT:", { data, error });
}

// =========================
// PAGE VIEW END
// =========================
if (event.type === "page_view_end") {
  await supabase
    .from("page_views")
    .update({
      time_on_page: event.duration || 0,
      scroll_depth: event.scroll_depth || 0,
      left_at: new Date(),
    })
    .eq("page_view_id", event.page_view_id);
}
      //deleted bs of causeing error
      // if (error) {
      //   console.log("DB ERROR:", error);
      //   throw error;
      // }
    }

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders() }
    );

  } catch (err) {
    console.error("TRACK ERROR FULL:", err);

    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: corsHeaders() }
    );
  }
}