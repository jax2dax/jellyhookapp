// api/track/route.js
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
      // const { data: existingSession } = await supabase
      //   .from("sessions")
      //   .select("id")
      //   .eq("session_id", event.session_id)
      //   .limit(1).maybeSingle()    //.single();
      /////////////////////with this 
      // SESSION (CORRECT — INACTIVITY BASED)
// ─── SESSION ───────────────────────────────────────────────
// session_start → insert one row, only fires on first visit
// session_end   → update that row with ended_at timestamp
// page_view_*   → update last_activity_at only, never insert
// This means sessions table has exactly 1 row per site visit

// if (event.type === "session_start") {
//   // Check if session already exists (dedup — tracker might retry)
//   const { data: existing } = await supabase
//     .from("sessions")
//     .select("id")
//     .eq("session_id", event.session_id)
//     .eq("site_id", site.id)
//     .maybeSingle();

//   if (!existing) {
//     const { error } = await supabase.from("sessions").insert({
//       session_id: event.session_id,
//       visitor_id: event.visitor_id,
//       site_id: site.id,
//       started_at: new Date(),
//       last_activity_at: new Date(),
//       referrer: event.referrer || null,
//       country: country || null,
//       timezone: event.timezone || null,
//     });
//     if (error) console.error("🔴 SESSION INSERT ERROR:", error.message);
//     else console.log("✅ SESSION CREATED:", event.session_id);
//   } else {
//     console.log("🔵 SESSION ALREADY EXISTS (dedup):", event.session_id);
//   }
// }   //with this 
if (event.type === "session_start") {
  // TIMEOUT = 3 minutes of inactivity = session is considered closed
  const TIMEOUT_MS = 3 * 60 * 1000;
  const timeoutThreshold = new Date(Date.now() - TIMEOUT_MS).toISOString();

  // Step 1 — check if THIS exact session_id already exists (same tab, page nav dedup)
  const { data: exactMatch } = await supabase
    .from("sessions")
    .select("id, last_activity_at, ended_at")
    .eq("session_id", event.session_id)
    .eq("site_id", site.id)
    .maybeSingle();

  if (exactMatch) {
    // Same session_id already in DB — this is a dedup (tracker retried or reloaded)
    // Just refresh last_activity_at and clear ended_at if it was closed
    const { error } = await supabase
      .from("sessions")
      .update({ last_activity_at: new Date(), ended_at: null })
      .eq("id", exactMatch.id);
    if (error) console.error("🔴 SESSION REFRESH ERROR:", error.message);
    else console.log("🔵 SESSION REFRESHED (same session_id):", event.session_id);
    // Skip to page view processing
  } else {
    // Step 2 — no exact match, check if visitor has an OPEN session within timeout window
    // An open session = ended_at is null AND last_activity_at is within 3 minutes
    const { data: openSession } = await supabase
      .from("sessions")
      .select("id, session_id, last_activity_at")
      .eq("visitor_id", event.visitor_id)
      .eq("site_id", site.id)
      .is("ended_at", null)
      .gte("last_activity_at", timeoutThreshold)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openSession) {
      // Visitor came back within 3 min — close old session, open new one
      // We close the old one because the session_id changed (new sessionStorage)
      // meaning the user opened a new tab or cleared storage
      const { error: closeError } = await supabase
        .from("sessions")
        .update({ ended_at: new Date(), last_activity_at: new Date() })
        .eq("id", openSession.id);
      if (closeError) console.error("🔴 OLD SESSION CLOSE ERROR:", closeError.message);
      else console.log("🟡 OLD SESSION CLOSED (new tab detected):", openSession.session_id);
    } else {
      // Step 3 — check if there's a stale open session older than timeout, close it
      const { data: staleSession } = await supabase
        .from("sessions")
        .select("id, session_id")
        .eq("visitor_id", event.visitor_id)
        .eq("site_id", site.id)
        .is("ended_at", null)
        .lt("last_activity_at", timeoutThreshold)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (staleSession) {
        // Lazy close — visitor was gone longer than 3 min, close the old session
        const { error: staleError } = await supabase
          .from("sessions")
          .update({ ended_at: new Date(Date.now() - TIMEOUT_MS) })
          .eq("id", staleSession.id);
        if (staleError) console.error("🔴 STALE SESSION CLOSE ERROR:", staleError.message);
        else console.log("🟡 STALE SESSION LAZILY CLOSED:", staleSession.session_id);
      }
    }

    // Step 4 — insert fresh session
    const { error: insertError } = await supabase.from("sessions").insert({
      session_id: event.session_id,
      visitor_id: event.visitor_id,
      site_id: site.id,
      started_at: new Date(),
      last_activity_at: new Date(),
      referrer: event.referrer || null,
      country: country || null,
      timezone: event.timezone || null,
    });
    if (insertError) console.error("🔴 SESSION INSERT ERROR:", insertError.message);
    else console.log("✅ SESSION CREATED:", event.session_id);
  }
}
//////////////////////////////////////////////////////////////IK THIS Is a lo t 
if (event.type === "session_end") {
  // Guard: never close a session that started less than 5 seconds ago
  // This prevents beforeunload firing on the same page that just created the session
  // (happens on full page reloads, 404s, and some Next.js navigation edge cases)
  const { data: sessionToClose } = await supabase
    .from("sessions")
    .select("id, started_at")
    .eq("session_id", event.session_id)
    .eq("site_id", site.id)
    .maybeSingle();

  if (!sessionToClose) {
    console.log("🟡 SESSION END: session not found, skipping:", event.session_id);
  } else {
    const ageMs = Date.now() - new Date(sessionToClose.started_at).getTime();
    if (ageMs < 5000) {
      // Session is younger than 5 seconds — this is a false close from beforeunload
      // firing immediately after session_start on the same page load
      console.log("🟡 SESSION END IGNORED (too young, age=" + ageMs + "ms):", event.session_id);
    } else {
      const { error } = await supabase
        .from("sessions")
        .update({
          ended_at: new Date(),
          last_activity_at: new Date(),
        })
        .eq("id", sessionToClose.id);
      if (error) console.error("🔴 SESSION END ERROR:", error.message);
      else console.log("✅ SESSION CLOSED (age=" + ageMs + "ms):", event.session_id);
    }
  }
}

if (event.type === "page_view_start" || event.type === "page_view_end") {
  // Page navigation — just keep last_activity_at fresh, never insert
  await supabase
    .from("sessions")
    .update({ last_activity_at: new Date() })
    .eq("session_id", event.session_id)
    .eq("site_id", site.id);
}
// ───────────────────────────────────────────────────────────
//////////////////////////////////////////////////////////////

      // if (!existingSession) {
      //   await supabase.from("sessions").insert({
      //     session_id: event.session_id,
      //     visitor_id: event.visitor_id,
      //     site_id: site.id,
      //     started_at: new Date(),
      //     last_activity_at: new Date(),
      //     referrer: event.referrer || null,
      //     country: country || null,
      //     timezone: event.timezone || null,
      //   });
      // } else {
      //   const sessionUpdates = { last_activity_at: new Date() };
      //   if (event.type === "page_view_end") sessionUpdates.ended_at = new Date();
      //   await supabase
      //     .from("sessions")
      //     .update(sessionUpdates)
      //     .eq("id", existingSession.id);
      // } //replaced with above

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