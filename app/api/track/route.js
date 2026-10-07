// api/track/route.js
//
// The tracker's main ingestion endpoint: sessions, page views, clicks,
// heartbeats and tracking-health reports. Rewritten 2026-10-07; the audit and
// every decision behind it are in mds/audit/tracker-backend-audit-2026-10-07.md
// and mds/developers/ingestion.md.
//
// Order of work for one request:
//   1. cheap rejects (size, JSON, bots) before touching the database
//   2. find the site by key (current key, or previous key during a rotation)
//   3. decide: is this event from the site's own host? (lib/tracking/verification.js)
//   4. write, event by event, with one visitor upsert per request
//   5. usage counters + housekeeping AFTER the response (after())
//
// Service role, not the Clerk-JWT client: every request here is an anonymous
// visitor on a CUSTOMER's site, never someone logged in to Jellyhook. The key
// check in step 2 is the authorization, before any write.
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolvePendingCountries } from "@/lib/resolvePendingCountries";
import { sweepIfDue } from "@/lib/tracking/sweep";
import { hashIp, countryNameFromCode } from "@/lib/tracking/ip";
import { deviceClassFromWidth } from "@/lib/tracking/structure";
import { emptyUsage, bump } from "@/lib/tracking/usage";
import {
  CORS, MAX_BODY_BYTES, MAX_EVENTS_PER_REQUEST,
  cleanId, cleanStr, cleanNum, cleanTime,
  authorizeRequest, applySiteEffects, flushUsage, clientIp, markHealthEvent,
} from "@/lib/tracking/server";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

const BOT_PATTERNS = /bot|crawl|spider|slurp|mediapartners|googlebot|bingbot|yandex|baidu|duckduck|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegram|applebot|semrush|ahrefs|mj12bot|dotbot|petalbot/i;
const isBot = (ua) => !ua || BOT_PATTERNS.test(ua);

const EVENT_TYPES = new Set(["session_start", "session_end", "page_view_start", "page_view_end", "heartbeat", "click", "health"]);
const MAX_DURATION_MS = 24 * 3600_000;
const MAX_CLICK_NAME = 80;

const ok = () => NextResponse.json({ success: true }, { headers: CORS });

export async function POST(req) {
  const supabase = supabaseAdmin;
  const usage = emptyUsage();
  let siteId = null;
  const now = Date.now();

  try {
    const len = Number(req.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413, headers: CORS });

    let events;
    try {
      events = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
    }
    if (!Array.isArray(events)) return NextResponse.json({ error: "Events must be array" }, { status: 400, headers: CORS });
    events = events.filter((e) => e && typeof e === "object" && EVENT_TYPES.has(e.type)).slice(0, MAX_EVENTS_PER_REQUEST);
    if (events.length === 0) return ok();

    const userAgent = events[0].user_agent || req.headers.get("user-agent") || "";
    if (isBot(userAgent)) return ok(); // silent drop, never reaches the database

    const apiKey = req.headers.get("x-api-key") || events[0].api_key || null;
    if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 400, headers: CORS });

    const auth = await authorizeRequest(supabase, { apiKey, event: events[0], headers: req.headers, now });
    if (!auth.site || !auth.key.ok) return NextResponse.json({ error: "Invalid site" }, { status: 403, headers: CORS });
    const { site, key, decision, host } = auth;
    siteId = site.id;

    bump(usage, "requests");
    bump(usage, "bytes_in", len);

    // TEMPORARY DEBUG (remove when the ghost-visitor question is settled): set JH_DEBUG_TRACK=1 in
    // .env.local and restart. One line per event, showing exactly WHO sent it: the browser's Origin
    // (with port), the page URL, the visitor / session / page view ids, and what the server decided.
    if (process.env.JH_DEBUG_TRACK === "1") {
      for (const e of events) {
        console.log(
          `[track-debug] ${e.type} | origin=${req.headers.get("origin")} | page=${e.page_url || e.page_path || "-"} | visitor=${String(e.visitor_id).slice(0, 8)} session=${String(e.session_id).slice(0, 8)} pv=${String(e.page_view_id || "-").slice(0, 8)} | host=${host} decision=${decision.reason} accept=${decision.accept}`
        );
      }
    }

    const effects = await applySiteEffects(supabase, { site, key, decision, host, now });
    if (!decision.accept || !effects.verifiedOk) {
      // Silent: the tracker must never error on a customer's page. The reason
      // is visible to the owner in Settings (unmatched host, claim expired).
      bump(usage, "dropped", events.length);
      after(() => flushUsage(supabase, siteId, usage, now));
      return ok();
    }

    // ── per-request context ───────────────────────────────────────────────
    const ip = clientIp(req.headers);
    const ipHash = hashIp(ip);
    const country = countryNameFromCode(req.headers.get("x-vercel-ip-country"));
    // The raw IP is only kept when nothing else can give us a country, and is
    // erased by resolvePendingCountries as soon as the lookup is done.
    const ipForLookup = !country && ip !== "unknown" ? ip : null;

    const visitorsSeen = new Set();
    const nowIso = new Date(now).toISOString();

    for (const event of events) {
      const visitorId = cleanId(event.visitor_id);
      const sessionId = cleanId(event.session_id);
      if (!visitorId || !sessionId) {
        bump(usage, "dropped");
        continue;
      }
      bump(usage, "events");

      // ── VISITOR: one upsert + one conditional touch per visitor per request ──
      if (!visitorsSeen.has(visitorId)) {
        visitorsSeen.add(visitorId);
        const first = event.type === "session_start" && event.is_first_visit === true;
        const insertRow = {
          site_id: site.id,
          visitor_id: visitorId,
          ip_address: ipForLookup,
          ip_hash: ipHash,
          first_seen: nowIso,
          last_seen: nowIso,
          device_type: cleanStr(event.device_type, 20),
        };
        if (first) {
          insertRow.first_referrer = cleanStr(event.referrer, 500);
          insertRow.first_utm_source = cleanStr(event.utm_source, 200);
          insertRow.first_utm_medium = cleanStr(event.utm_medium, 200);
          insertRow.first_utm_campaign = cleanStr(event.utm_campaign, 200);
          insertRow.first_landing_path = cleanStr(event.page_path, 500);
          insertRow.first_touch_at = nowIso;
        }
        const { error: vErr } = await supabase.from("visitors").upsert(insertRow, { onConflict: "site_id,visitor_id", ignoreDuplicates: true });
        if (vErr) console.error("[track] visitor upsert error:", vErr.message);

        // Touch last_seen at most once a minute, backfill device_type / ip_hash if missing.
        const touch = { last_seen: nowIso };
        const dt = cleanStr(event.device_type, 20);
        if (dt) touch.device_type = dt;
        if (ipHash) touch.ip_hash = ipHash;
        if (ipForLookup) touch.ip_address = ipForLookup; // re-armed for the lookup of this visitor's next session
        await supabase
          .from("visitors")
          .update(touch)
          .eq("site_id", site.id)
          .eq("visitor_id", visitorId)
          .lt("last_seen", new Date(now - 60_000).toISOString());

        // A visitor's first touch, if their very first event arrived out of
        // order (a page view before the session start): fill it once.
        if (first) {
          await supabase
            .from("visitors")
            .update({
              first_referrer: cleanStr(event.referrer, 500),
              first_utm_source: cleanStr(event.utm_source, 200),
              first_utm_medium: cleanStr(event.utm_medium, 200),
              first_utm_campaign: cleanStr(event.utm_campaign, 200),
              first_landing_path: cleanStr(event.page_path, 500),
              first_touch_at: nowIso,
            })
            .eq("site_id", site.id)
            .eq("visitor_id", visitorId)
            .is("first_touch_at", null);
        }
      }

      // ── SESSION START ────────────────────────────────────────────────────
      // A session is one continuous visit: it ends only by 30 minutes of
      // idle, never because a tab closed or a page changed. So a start for an
      // id we already have is a repeat (another window joining the same
      // session, a retry): it just marks the session alive again. Another
      // open session of the same visitor is NEVER closed from here.
      if (event.type === "session_start") {
        bump(usage, "session_starts");
        const { data: existing } = await supabase.from("sessions").select("id, site_id").eq("session_id", sessionId).maybeSingle();
        if (existing) {
          if (existing.site_id === site.id) {
            await supabase.from("sessions").update({ last_activity_at: nowIso, ended_at: null }).eq("id", existing.id);
          }
        } else {
          const { error } = await supabase.from("sessions").insert({
            session_id: sessionId,
            visitor_id: visitorId,
            site_id: site.id,
            started_at: nowIso,
            last_activity_at: nowIso,
            referrer: cleanStr(event.referrer, 500),
            country: country, // null when unknown: backfilled by resolvePendingCountries
            timezone: cleanStr(event.timezone, 100),
            utm_source: cleanStr(event.utm_source, 200),
            utm_medium: cleanStr(event.utm_medium, 200),
            utm_campaign: cleanStr(event.utm_campaign, 200),
          });
          // 23505: two windows started the same session at once. Harmless.
          if (error && error.code !== "23505") console.error("[track] session insert error:", error.message);
        }
        continue;
      }

      // ── SESSION END (idle split from the tracker, or an old tracker's unload) ──
      if (event.type === "session_end") {
        bump(usage, "session_ends");
        const { data: sessionToClose } = await supabase.from("sessions").select("id, started_at, ended_at").eq("session_id", sessionId).eq("site_id", site.id).maybeSingle();
        if (!sessionToClose || sessionToClose.ended_at) continue;

        const startedMs = new Date(sessionToClose.started_at).getTime();
        // "ended N ms ago" is measured against the server's own clock, so a visitor's wrong
        // computer clock cannot skew it. (ended_at is what older trackers sent.)
        const agoMs = cleanNum(event.ended_ago_ms, 0, 48 * 3600_000);
        const reported = agoMs !== null ? new Date(now - agoMs) : cleanTime(event.ended_at, now);
        // Old trackers sent a session_end on every page unload. A session that
        // young is a navigation, not a visit ending.
        if (!reported && now - startedMs < 5000) continue;
        const endedAt = reported && reported.getTime() >= startedMs ? reported : new Date(now);

        const { error } = await supabase.from("sessions").update({ ended_at: endedAt.toISOString(), last_activity_at: endedAt.toISOString() }).eq("id", sessionToClose.id).is("ended_at", null);
        if (error) {
          console.error("[track] session end error:", error.message);
          continue;
        }
        // Close what the session still had open, dated to the session's end.
        const { data: openPageViews } = await supabase.from("page_views").select("id, entered_at").eq("session_id", sessionId).is("left_at", null);
        for (const pv of openPageViews ?? []) {
          const timeOnPage = Math.max(0, endedAt.getTime() - new Date(pv.entered_at).getTime());
          await supabase.from("page_views").update({ left_at: endedAt.toISOString(), time_on_page: timeOnPage }).eq("id", pv.id);
        }
        const { data: openForms } = await supabase.from("form_engagement").select("id, last_activity_at, viewed_at").eq("session_id", sessionId).in("status", ["viewed", "started"]);
        for (const f of openForms ?? []) {
          await supabase.from("form_engagement").update({ status: "abandoned", ended_at: f.last_activity_at || f.viewed_at }).eq("id", f.id);
        }
        continue;
      }

      // ── HEARTBEAT: "this visit is still going", nothing else ─────────────
      if (event.type === "heartbeat") {
        await supabase.from("sessions").update({ last_activity_at: nowIso, ended_at: null }).eq("session_id", sessionId).eq("site_id", site.id);
        continue;
      }

      // ── PAGE VIEW START ──────────────────────────────────────────────────
      if (event.type === "page_view_start") {
        bump(usage, "page_view_starts");
        const pageViewId = cleanId(event.page_view_id);
        if (!pageViewId) continue;

        // Any page view proves the visit is alive. This also reopens a session
        // an idle sweep closed a moment too early.
        await supabase.from("sessions").update({ last_activity_at: nowIso, ended_at: null }).eq("session_id", sessionId).eq("site_id", site.id);

        const viewportWidth = cleanNum(event.viewport_width, 1, 20000);
        const deviceClass = deviceClassFromWidth(viewportWidth);
        const pagePath = cleanStr(event.page_path, 500) || "";
        const structureId = await latestStructureId(supabase, site.id, pagePath, deviceClass);

        const row = {
          page_view_id: pageViewId,
          session_id: sessionId,
          visitor_id: visitorId,
          site_id: site.id,
          page_url: cleanStr(event.page_url, 1000) || "",
          page_path: pagePath,
          page_title: cleanStr(event.page_title, 300) || "",
          entered_at: nowIso,
          page_height: cleanNum(event.page_height, 0, 10_000_000),
          entry_scroll_depth: cleanNum(event.entry_scroll, 0, 1),
          viewport_height: cleanNum(event.viewport_height, 0, 100000),
          viewport_width: viewportWidth,
          device_class: deviceClass,
          structure_id: structureId,
        };
        const { error } = await supabase.from("page_views").insert(row);
        if (error) {
          if (error.code === "23505") {
            // The end arrived first and made a placeholder row: fill in what only the start knows.
            await supabase
              .from("page_views")
              .update({ page_url: row.page_url, page_path: row.page_path, page_title: row.page_title, viewport_width: row.viewport_width, device_class: row.device_class, structure_id: row.structure_id, entry_scroll_depth: row.entry_scroll_depth })
              .eq("page_view_id", pageViewId)
              .eq("site_id", site.id);
          } else {
            console.error("[track] page_view insert error:", error.message);
          }
        }
        continue;
      }

      // ── PAGE VIEW END ────────────────────────────────────────────────────
      if (event.type === "page_view_end") {
        bump(usage, "page_view_ends");
        const pageViewId = cleanId(event.page_view_id);
        if (!pageViewId) continue;

        const duration = cleanNum(event.duration, 0, MAX_DURATION_MS) ?? 0;
        const endAgoMs = cleanNum(event.ended_ago_ms, 0, 48 * 3600_000);
        const leftAt = endAgoMs !== null ? new Date(now - endAgoMs) : (cleanTime(event.left_at, now) ?? new Date(now));
        const update = {
          time_on_page: duration,
          scroll_depth: cleanNum(event.scroll_depth, 0, 1) ?? 0,
          left_at: leftAt.toISOString(),
        };
        const maxScroll = cleanNum(event.max_scroll_depth, 0, 1);
        if (maxScroll !== null) update.max_scroll_depth = maxScroll;
        const maxAt = cleanTime(event.max_scroll_reached_at, now);
        if (maxAt) update.max_scroll_reached_at = maxAt.toISOString();
        // null means "never revisited": a real value, so it is sent as null, not left out.
        if (event.revisit_start_scroll !== undefined) update.revisit_start_scroll_depth = cleanNum(event.revisit_start_scroll, 0, 1);
        const vh = cleanNum(event.viewport_height, 0, 100000);
        if (vh !== null) update.viewport_height = vh;
        const ph = cleanNum(event.page_height, 0, 10_000_000);
        if (ph !== null) update.page_height = ph;

        const { data: updated, error } = await supabase.from("page_views").update(update).eq("page_view_id", pageViewId).eq("site_id", site.id).select("id");
        if (error) {
          console.error("[track] page_view_end update error:", error.message);
        } else if (!updated || updated.length === 0) {
          // The start never arrived (or is still in flight): keep the data as a placeholder row.
          const { error: insErr } = await supabase.from("page_views").insert({
            page_view_id: pageViewId,
            session_id: sessionId,
            visitor_id: visitorId,
            site_id: site.id,
            page_url: "",
            page_path: "",
            page_title: "",
            entered_at: new Date(leftAt.getTime() - duration).toISOString(),
            ...update,
          });
          if (insErr && insErr.code !== "23505") console.error("[track] page_view_end placeholder error:", insErr.message);
        }

        // Only moves the activity clock of a session that is still open.
        await supabase.from("sessions").update({ last_activity_at: nowIso }).eq("session_id", sessionId).eq("site_id", site.id).is("ended_at", null);
        continue;
      }

      // ── CLICK on an element the owner marked with data-track-click ───────
      if (event.type === "click") {
        const name = cleanStr(event.name, MAX_CLICK_NAME);
        if (!name) continue;
        bump(usage, "clicks");
        const pagePath = cleanStr(event.page_path, 500);
        const { error } = await supabase.from("click_events").insert({
          site_id: site.id,
          visitor_id: visitorId,
          session_id: sessionId,
          page_view_id: cleanId(event.page_view_id),
          page_path: pagePath,
          name,
          clicked_at: nowIso,
        });
        if (error) console.error("[track] click insert error:", error.message);
        else await markHealthEvent(supabase, site.id, pagePath, "click_attr", now);
        continue;
      }

      // ── HEALTH: what the tracker SAW on this page (not events: nothing is counted) ──
      if (event.type === "health") {
        await recordHealthReport(supabase, site.id, event, nowIso);
        continue;
      }
    }

    after(() => flushUsage(supabase, siteId, usage, now));
    // Housekeeping rides on real traffic; a slow provider never delays a visitor.
    after(() => resolvePendingCountries(supabase));
    after(() => sweepIfDue(supabase));

    return ok();
  } catch (err) {
    console.error("[track] error:", err);
    if (siteId) after(() => flushUsage(supabase, siteId, { ...usage, dropped: usage.dropped + 1 }, now));
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: CORS });
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Newest known structure version for a page, remembered for a minute per server instance. */
const structureCache = new Map();
const STRUCTURE_CACHE_MS = 60_000;

async function latestStructureId(supabase, siteId, pagePath, deviceClass) {
  if (!pagePath) return null;
  const k = `${siteId}|${deviceClass}|${pagePath}`;
  const hit = structureCache.get(k);
  if (hit && Date.now() - hit.at < STRUCTURE_CACHE_MS) return hit.id;
  const { data } = await supabase
    .from("page_structure_versions")
    .select("id")
    .eq("site_id", siteId)
    .eq("page_path", pagePath)
    .eq("device_class", deviceClass)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = data?.id ?? null;
  if (structureCache.size > 2000) structureCache.clear();
  structureCache.set(k, { id, at: Date.now() });
  return id;
}

/**
 * The tracker reports what it found: marked forms, marked fields, marked
 * click targets, and the wrong places it found the attributes. Stored
 * per page; "working" is proven separately by a real event
 * (markHealthEvent) so a page showing "found" but never "working" is exactly
 * the misinstalled case the Settings card is there to catch.
 */
async function recordHealthReport(supabase, siteId, event, nowIso) {
  const pagePath = cleanStr(event.page_path, 500) || "/";
  const report = event.report && typeof event.report === "object" ? event.report : {};
  const rows = [];
  for (const checkKey of ["conversion_form", "field_attr", "click_attr", "iframe_forms"]) {
    const d = report[checkKey];
    if (!d || typeof d !== "object") continue;
    // Only small numbers and short strings are kept.
    const details = {};
    for (const [k, v] of Object.entries(d).slice(0, 12)) {
      if (typeof v === "number" && Number.isFinite(v)) details[k] = v;
      else if (typeof v === "string") details[k] = v.slice(0, 120);
      else if (Array.isArray(v)) details[k] = v.slice(0, 5).map((x) => String(x).slice(0, 80));
    }
    rows.push({ site_id: siteId, page_path: pagePath, check_key: checkKey, details, last_seen_at: nowIso });
  }
  if (rows.length === 0) return;
  const { error } = await supabase.from("tracking_health").upsert(rows, { onConflict: "site_id,page_path,check_key", ignoreDuplicates: false });
  if (error) console.error("[track] health upsert error:", error.message);
}
