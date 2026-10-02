// lib/actions/mainChart.action.ts
// Raw rows for the main chart (main-chart/): online spans and marker-layer
// events (id, time, label). Every bucket, peak, pixel column and marker
// position is computed in the browser, so panning, zooming and switching
// intervals never cost a request. See main-chart/docs/data-flow.md for
// which query runs when.
//
// Spans come from `page_views` (entered_at/left_at), not `sessions`
// (started_at/ended_at). A session can stay open across a visitor leaving
// the site entirely and coming back later — see mds/database.md's
// `sessions` note on "away" gaps — so sourcing from sessions would count
// someone as online during time they were genuinely gone. A page_view is
// open only while a page is actually on screen, which is exactly "online"
// means here. See main-chart/overview.md, "Online means a page is
// actually open," for the full reasoning and the one caveat (a crashed
// tab can still read as open for a little while).
"use server";

import { createClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/server";
import { requireSiteAccess } from "@/lib/actions/siteAccess";
import type { MarkerLayer, MarkerPayload, SpanPayload } from "@/main-chart/types";

// site_members is service-role only under RLS (see mds/database.md). Only
// ever queried here AFTER requireSiteAccess, and only for the one site.
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// PostgREST returns at most 1000 rows per request by default, silently.
// Every range query here pages through until a short page comes back.
const PAGE_SIZE = 1000;

// A page_view still open at time X began at most this long before X.
// Bounds the carry-in query to an index range instead of the site's whole
// history. A page_view this long-lived (someone just leaving one page open
// and never navigating) is unusual but not impossible — unlike a session,
// nothing automatically closes it just for being old on its own — so this
// stays generous rather than tuned tight to a typical visit length.
const CARRY_IN_LOOKBACK_MS = 24 * 60 * 60 * 1000;

const ID_BATCH = 100; // keeps the `id=in.(...)` query string well under URL length limits

type Row = { id: string; entered_at: string | null; left_at: string | null };

/**
 * serverNow rides along with every response. The tracker stamps page views
 * with the SERVER's clock, so the browser uses it to (a) know its own
 * clock's offset and draw "now" where the data actually is, and (b) ask
 * the next live poll for "entered since <server time>" instead of trusting
 * a browser clock that might be minutes off.
 */
export interface SpanResponse {
  payload: SpanPayload;
  serverNow: number;
}
export interface MarkerResponse {
  payload: MarkerPayload;
  serverNow: number;
}

export interface LiveResponse extends SpanResponse {
  markers: Partial<Record<MarkerLayer, MarkerPayload>>;
}

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseClient>>;
type DbError = { message: string; code?: string };
type RangeQuery<T> = { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: DbError | null }> };

function toPayload(rows: Row[]): SpanPayload {
  const payload: SpanPayload = { ids: [], starts: [], ends: [] };
  for (const r of rows) {
    if (!r.entered_at) continue;
    payload.ids.push(r.id);
    payload.starts.push(Date.parse(r.entered_at));
    payload.ends.push(r.left_at ? Date.parse(r.left_at) : null);
  }
  return payload;
}

async function fetchAllPages<T = Row>(label: string, build: (supabase: SupabaseClient) => RangeQuery<T>): Promise<T[]> {
  const supabase = await createSupabaseClient();
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await build(supabase).range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error(`[mainChart] ${label} failed:`, error.message);
      throw new Error(`Failed to load ${label}: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

// ── Marker layers ────────────────────────────────────────────────────────

type ConversionRow = { id: string; submitted_at: string | null; name: string | null; email: string | null };

function conversionsPayload(rows: ConversionRow[]): MarkerPayload {
  const payload: MarkerPayload = { ids: [], times: [], labels: [] };
  for (const r of rows) {
    if (!r.submitted_at) continue;
    payload.ids.push(r.id);
    payload.times.push(Date.parse(r.submitted_at));
    payload.labels.push(r.name || r.email || null);
  }
  return payload;
}

/** form_submissions in [from, to) by submitted_at (always the server's clock at insert, see app/api/track-form). */
function conversionsBetween(siteId: string, fromIso: string, toIso: string | null) {
  return fetchAllPages<ConversionRow>("conversions", (s) => {
    let q = s.from("form_submissions").select("id, submitted_at, name, email").eq("site_id", siteId).gte("submitted_at", fromIso);
    if (toIso) q = q.lt("submitted_at", toIso);
    return q.order("submitted_at").order("id");
  });
}

type MemberRow = { id: string; user_email: string | null; role: string | null; created_at: string | null; joined_at?: string | null };

/**
 * Active team members of this site, timed by when they JOINED. joined_at
 * is set when an invite is accepted (site-management.actions.js's
 * acceptInvite); rows without it fall back to created_at, which is the real
 * join time for owners and directly-added members, but the invite-SENT
 * time for invites accepted before joined_at existed. Works before the
 * joined_at column is added too (see mds/database.md for the SQL).
 */
async function teamJoins(siteId: string): Promise<MarkerPayload> {
  const select = (columns: string) => supabaseAdmin.from("site_members").select(columns).eq("site_id", siteId).eq("status", "active").returns<MemberRow[]>();
  let { data, error } = await select("id, user_email, role, created_at, joined_at");
  if (error && (error.code === "42703" || /joined_at/.test(error.message))) {
    // joined_at column not added yet: same query without it.
    ({ data, error } = await select("id, user_email, role, created_at"));
  }
  if (error) {
    console.error("[mainChart] team joins failed:", error.message);
    throw new Error(`Failed to load team joins: ${error.message}`);
  }
  const payload: MarkerPayload = { ids: [], times: [], labels: [] };
  for (const r of (data ?? []) as MemberRow[]) {
    const at = r.joined_at || r.created_at;
    if (!at) continue;
    payload.ids.push(r.id);
    payload.times.push(Date.parse(at));
    payload.labels.push(`${r.user_email || "Owner"}${r.role === "owner" && r.user_email ? " (owner)" : ""}`);
  }
  return payload;
}

/**
 * A marker layer's events for [fromMs, toMs). Team joins ignore the range:
 * a team is a handful of rows, so the whole list is returned at once.
 */
export async function getMarkerEvents(siteId: string, layer: MarkerLayer, fromMs: number, toMs: number): Promise<MarkerResponse> {
  await requireSiteAccess(siteId);
  const serverNow = Date.now();
  if (layer === "teamJoins") return { payload: await teamJoins(siteId), serverNow };
  const rows = await conversionsBetween(siteId, new Date(fromMs).toISOString(), new Date(toMs).toISOString());
  return { payload: conversionsPayload(rows), serverNow };
}

/**
 * When this site's first and most recent page views started. The first is
 * live mode's left edge; the latest decides how far the chart zooms out
 * when it opens, so a quiet site doesn't open on an empty hour. Null when
 * there has never been a single page view.
 */
export async function getActivityBounds(siteId: string): Promise<{ firstActivityAt: number | null; lastActivityAt: number | null; serverNow: number }> {
  await requireSiteAccess(siteId);
  const serverNow = Date.now();
  const supabase = await createSupabaseClient();
  const edge = (ascending: boolean) =>
    supabase.from("page_views").select("entered_at").eq("site_id", siteId).not("entered_at", "is", null).order("entered_at", { ascending }).limit(1).maybeSingle();
  const [first, last] = await Promise.all([edge(true), edge(false)]);
  const error = first.error || last.error;
  if (error) {
    console.error("[mainChart] getActivityBounds failed:", error.message);
    throw new Error(`Failed to load page views: ${error.message}`);
  }
  return {
    firstActivityAt: first.data?.entered_at ? Date.parse(first.data.entered_at) : null,
    lastActivityAt: last.data?.entered_at ? Date.parse(last.data.entered_at) : null,
    serverNow,
  };
}

/**
 * Every page view that STARTED in [fromMs, toMs), plus every page view that
 * started up to CARRY_IN_LOOKBACK_MS before fromMs and was still open at
 * fromMs. Together: everything needed to draw [fromMs, toMs) correctly.
 */
export async function getOnlineSpans(siteId: string, fromMs: number, toMs: number): Promise<SpanResponse> {
  await requireSiteAccess(siteId);
  // Taken BEFORE querying: anything touched after this moment is
  // guaranteed to be picked up by the next live poll.
  const serverNow = Date.now();
  const from = new Date(fromMs).toISOString();
  const to = new Date(toMs).toISOString();
  const lookback = new Date(fromMs - CARRY_IN_LOOKBACK_MS).toISOString();

  const [inRange, carryIn] = await Promise.all([
    fetchAllPages("spans", (s) =>
      s.from("page_views").select("id, entered_at, left_at").eq("site_id", siteId).gte("entered_at", from).lt("entered_at", to).order("entered_at").order("id")
    ),
    fetchAllPages("carry-in", (s) =>
      s
        .from("page_views")
        .select("id, entered_at, left_at")
        .eq("site_id", siteId)
        .gte("entered_at", lookback)
        .lt("entered_at", from)
        .or(`left_at.gte."${from}",left_at.is.null`)
        .order("entered_at")
        .order("id")
    ),
  ]);
  return { payload: toPayload([...carryIn, ...inRange]), serverNow };
}

/**
 * Live refresh. Two things can change after a span was loaded:
 *   - any page view that started since `touchedSinceMs` — a new visitor,
 *     or an existing one navigating to another page;
 *   - a page view we hold as open (no left_at yet) that has since closed,
 *     either because the visitor actually left that page (a real close
 *     event arrives, usually within seconds) or because the stale-session
 *     sweep backdated left_at for a crashed tab. Either way, the only way
 *     to find out is to re-read it, so every open id is re-read on every
 *     poll — there's no "touched at" column on page_views to filter by,
 *     the way sessions has last_activity_at.
 * Marker layers that are switched on ride along in this SAME call, so
 * turning markers on never adds a server call per poll. Each layer passes
 * its own "since" (new conversions submitted since then); the team list is
 * tiny and re-read whole.
 */
export async function getLiveSpanUpdates(
  siteId: string,
  touchedSinceMs: number,
  openIds: string[],
  markerSince: Partial<Record<MarkerLayer, number>> = {}
): Promise<LiveResponse> {
  await requireSiteAccess(siteId);
  const serverNow = Date.now();
  const since = new Date(touchedSinceMs).toISOString();

  const touched = fetchAllPages("touched", (s) =>
    s.from("page_views").select("id, entered_at, left_at").eq("site_id", siteId).gte("entered_at", since).order("entered_at").order("id")
  );

  const batches: Promise<Row[]>[] = [];
  for (let i = 0; i < openIds.length; i += ID_BATCH) {
    const ids = openIds.slice(i, i + ID_BATCH);
    batches.push(fetchAllPages("open-ids", (s) => s.from("page_views").select("id, entered_at, left_at").eq("site_id", siteId).in("id", ids).order("id")));
  }

  const markerJobs = (Object.entries(markerSince) as [MarkerLayer, number][]).map(async ([layer, sinceMs]): Promise<[MarkerLayer, MarkerPayload]> => {
    if (layer === "teamJoins") return [layer, await teamJoins(siteId)];
    return [layer, conversionsPayload(await conversionsBetween(siteId, new Date(sinceMs).toISOString(), null))];
  });

  const [touchedRows, markerResults, ...openRows] = await Promise.all([touched, Promise.all(markerJobs), ...batches]);
  return { payload: toPayload([...touchedRows, ...openRows.flat()]), serverNow, markers: Object.fromEntries(markerResults) };
}
