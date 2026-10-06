// lib/actions/dashboardStats.action.ts
// The dashboard's top tiles, per time window: page views, sessions, form
// submissions (leads) and the conversion rate, for the last 24 hours, 7 days
// or 30 days (or all time), each with the same number for the window right
// before it, so the tile can show "50% fewer than the previous 24 hours".
//
// Counts use PostgREST's exact count (head: true): unlike reading rows,
// they are never cut off at PostgREST's silent 1,000-row limit. Distinct
// visitor counts (conversion rate) page through visitor ids instead.
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { requireSiteAccess } from "@/lib/actions/siteAccess";

export type StatWindow = "24h" | "7d" | "30d" | "all";
export type StatMetric = "pageViews" | "sessions" | "leads" | "conversionRate";

export interface WindowStat {
  metric: StatMetric;
  window: StatWindow;
  current: number;
  /** The same number for the window just before; null for "all". */
  previous: number | null;
  /** Conversion rate only: "3 of 40 visitors". */
  detail?: string;
}

const MS: Record<Exclude<StatWindow, "all">, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 };
const PAGE = 1000;
const MAX_ROWS = 200_000; // safety cap for the distinct-visitor scan

type Supabase = Awaited<ReturnType<typeof createSupabaseClient>>;

const SOURCE: Record<Exclude<StatMetric, "conversionRate">, { table: string; column: string }> = {
  pageViews: { table: "page_views", column: "entered_at" },
  sessions: { table: "sessions", column: "started_at" },
  leads: { table: "form_submissions", column: "submitted_at" },
};

async function countIn(supabase: Supabase, siteId: string, table: string, column: string, from?: string, to?: string): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).eq("site_id", siteId);
  if (from) q = q.gte(column, from);
  if (to) q = q.lt(column, to);
  const { count, error } = await q;
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

/** Distinct visitor ids in a table/time range, paging past the 1,000-row limit. */
async function distinctVisitors(supabase: Supabase, siteId: string, table: string, column: string, from?: string, to?: string): Promise<Set<string>> {
  const out = new Set<string>();
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    let q = supabase.from(table).select("visitor_id").eq("site_id", siteId).not("visitor_id", "is", null);
    if (from) q = q.gte(column, from);
    if (to) q = q.lt(column, to);
    const { data, error } = await q.order(column, { ascending: true }).range(offset, offset + PAGE - 1);
    if (error) throw new Error(`${table} visitors: ${error.message}`);
    for (const r of data ?? []) if (r.visitor_id) out.add(String(r.visitor_id));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function rateIn(supabase: Supabase, siteId: string, from?: string, to?: string): Promise<{ rate: number; converting: number; visitors: number }> {
  // all time: every known visitor; a window: visitors who had a session in it
  const visitors = from
    ? (await distinctVisitors(supabase, siteId, "sessions", "started_at", from, to)).size
    : await countIn(supabase, siteId, "visitors", "first_seen");
  const converting = (await distinctVisitors(supabase, siteId, "form_submissions", "submitted_at", from, to)).size;
  return { rate: visitors > 0 ? Math.min(100, (converting / visitors) * 100) : 0, converting, visitors };
}

export async function getWindowStat(siteId: string, metric: StatMetric, window: StatWindow): Promise<WindowStat> {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();
  const now = Date.now();
  const cur = window === "all" ? null : { from: new Date(now - MS[window]).toISOString(), to: new Date(now).toISOString() };
  const prev = window === "all" ? null : { from: new Date(now - 2 * MS[window]).toISOString(), to: cur!.from };

  if (metric === "conversionRate") {
    const [c, p] = await Promise.all([rateIn(supabase, siteId, cur?.from, cur?.to), prev ? rateIn(supabase, siteId, prev.from, prev.to) : Promise.resolve(null)]);
    return { metric, window, current: c.rate, previous: p ? p.rate : null, detail: `${c.converting} of ${c.visitors} visitors` };
  }
  const s = SOURCE[metric];
  const [c, p] = await Promise.all([
    countIn(supabase, siteId, s.table, s.column, cur?.from, cur?.to),
    prev ? countIn(supabase, siteId, s.table, s.column, prev.from, prev.to) : Promise.resolve(null),
  ]);
  return { metric, window, current: c, previous: p };
}
