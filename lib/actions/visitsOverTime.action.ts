// lib/actions/visitsOverTime.action.ts
// Sessions bucketed into time intervals: the "Visits over time" bar chart
// on the dashboard. Two options on top of the plain count (see
// mds/documentation/dashboard-2026-10-06.md):
//
//   unique   a visitor counts once PER BUCKET: 3 sessions from the same
//            person between 2:00 and 3:00 = 1 in the 2:00 bar; 2 more
//            between 3:00 and 4:00 = 1 in the 3:00 bar.
//   split    each bar divided by referrer, device or country (stacked).
//            The 7 biggest groups in the window keep their own colour,
//            the rest are "Other". Groups are ranked by sessions in the
//            window, independent of `unique`, so a group keeps the same
//            colour when unique is switched on or off.
//
// With unique + split, a visitor counts once in a bucket, under the group
// of their FIRST session in that bucket, so every stack still adds up to
// the unique total.
//
// Bucket EDGES are computed here (server-side), but bucket LABELS are not:
// this is a server action, so it has no idea what timezone the viewer is
// in. The caller passes its own `getTimezoneOffset()` so day/week buckets
// align to the VIEWER's local midnight, and formats labels itself. See
// components/charts/visitsOverTime.tsx.
//
// Rows are read in pages of 1,000 (PostgREST silently stops at 1,000 rows
// per request), so busy sites are counted in full up to MAX_ROWS.
'use server';

import { createSupabaseClient } from '@/lib/supabase/server';
import { requireSiteAccess } from '@/lib/actions/siteAccess';
import { classifyReferrer } from '@/lib/analytics/classifyReferrer';
import { aggregateVisits } from '@/lib/analytics/visitsAggregate';

export type VisitsWindowPreset = '24h' | '7d' | '1m' | '3m' | 'all';
export type VisitsBucketGranularity = 'hour' | 'day' | 'week' | 'month';
export type VisitsSplit = 'none' | 'referrer' | 'device' | 'country';

export interface VisitsOptions {
  unique?: boolean;
  split?: VisitsSplit;
}

export interface VisitsBucket {
  bucketStart: string;
  bucketEnd: string;
  visits: number;
  /** Only when split is not "none": group key -> count. Sums to `visits`. */
  parts?: Record<string, number>;
}

export interface VisitsSeries {
  key: string;
  label: string;
  /** Sessions in this group over the whole window (the ranking). */
  total: number;
}

export interface VisitsOverTimeResult {
  window: VisitsWindowPreset;
  windowStart: string;
  windowEnd: string;
  granularity: VisitsBucketGranularity;
  buckets: VisitsBucket[];
  totalVisits: number;
  avgPerBucket: number;
  allTimeTotal: number;
  unique: boolean;
  split: VisitsSplit;
  /** Groups in colour order (biggest first; "Other" last when present). Empty when split is "none". */
  series: VisitsSeries[];
  /** true when the window had more sessions than MAX_ROWS (counts are then partial). */
  capped: boolean;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;
const PAGE = 1000;
const MAX_ROWS = 100_000;
const TOP_GROUPS = 7;

/**
 * The real UTC instant corresponding to local midnight, in the viewer's own
 * timezone, for the day `d` falls in. `tzOffsetMinutes` is the browser's own
 * `Date.prototype.getTimezoneOffset()`. A plain offset, not a full IANA
 * timezone: a DST change inside the window can shift a later bucket by an
 * hour, the same accepted simplification `main-chart/engine/intervals.ts` makes.
 */
function localMidnightFloor(d: Date, tzOffsetMinutes: number): Date {
  const naiveLocalMs = d.getTime() - tzOffsetMinutes * 60_000;
  const flooredNaiveMs = Math.floor(naiveLocalMs / DAY) * DAY;
  return new Date(flooredNaiveMs + tzOffsetMinutes * 60_000);
}

function resolveWindow(
  preset: VisitsWindowPreset,
  earliestSession: Date | null,
  now: Date,
  tzOffsetMinutes: number,
): { startDate: Date; endDate: Date; bucketMs: number; bucketCount: number; granularity: VisitsBucketGranularity } {
  const endDate = now;
  const todayLocalMidnight = localMidnightFloor(now, tzOffsetMinutes);
  switch (preset) {
    case '24h':
      // Rolling: the 24 hours up to right now, one bar per hour.
      return { startDate: new Date(now.getTime() - 24 * HOUR), endDate, bucketMs: HOUR, bucketCount: 24, granularity: 'hour' };
    case '7d':
      return { startDate: new Date(todayLocalMidnight.getTime() - 6 * DAY), endDate, bucketMs: DAY, bucketCount: 7, granularity: 'day' };
    case '1m':
      return { startDate: new Date(todayLocalMidnight.getTime() - 29 * DAY), endDate, bucketMs: DAY, bucketCount: 30, granularity: 'day' };
    case '3m':
      return { startDate: new Date(todayLocalMidnight.getTime() - 12 * 7 * DAY), endDate, bucketMs: 7 * DAY, bucketCount: 13, granularity: 'week' };
    case 'all': {
      const start = earliestSession ? localMidnightFloor(earliestSession, tzOffsetMinutes) : new Date(todayLocalMidnight.getTime() - 90 * DAY);
      const rangeMs = Math.max(now.getTime() - start.getTime(), DAY);
      const bucketMs = Math.max(DAY, Math.ceil(rangeMs / 12));
      const bucketCount = Math.ceil(rangeMs / bucketMs);
      const granularity: VisitsBucketGranularity = bucketMs <= DAY ? 'day' : bucketMs <= 8 * DAY ? 'week' : 'month';
      return { startDate: start, endDate, bucketMs, bucketCount, granularity };
    }
  }
}

type SessionRow = { id: string; started_at: string | null; visitor_id: string | null; referrer: string | null; utm_source: string | null; country: string | null };

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function getVisitsOverTime(
  siteId: string,
  window: VisitsWindowPreset = '7d',
  tzOffsetMinutes = 0,
  options: VisitsOptions = {},
): Promise<VisitsOverTimeResult> {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();
  const now = new Date();
  const unique = !!options.unique;
  const split: VisitsSplit = options.split && ['referrer', 'device', 'country'].includes(options.split) ? options.split : 'none';

  // all-time count (exact, never capped) + the first session (for "all")
  const [{ count: allTimeCount, error: countError }, { data: firstRows, error: firstError }] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('site_id', siteId),
    supabase.from('sessions').select('started_at').eq('site_id', siteId).not('started_at', 'is', null).order('started_at', { ascending: true }).limit(1),
  ]);
  if (countError || firstError) {
    const msg = countError?.message ?? firstError?.message;
    console.error('[getVisitsOverTime] all-time fetch error:', msg);
    throw new Error(`Failed to fetch sessions: ${msg}`);
  }
  const earliestSession = firstRows?.[0]?.started_at ? new Date(firstRows[0].started_at) : null;
  const { startDate, endDate, bucketMs, bucketCount, granularity } = resolveWindow(window, earliestSession, now, tzOffsetMinutes);

  // the window's sessions, paged past the 1,000-row limit
  const sessions: SessionRow[] = [];
  let capped = false;
  for (let offset = 0; ; offset += PAGE) {
    if (offset >= MAX_ROWS) {
      capped = true;
      break;
    }
    const { data, error } = await supabase
      .from('sessions')
      .select('id, started_at, visitor_id, referrer, utm_source, country')
      .eq('site_id', siteId)
      .gte('started_at', startDate.toISOString())
      .lte('started_at', endDate.toISOString())
      .order('started_at', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error('[getVisitsOverTime] window fetch error:', error.message);
      throw new Error(`Failed to fetch windowed sessions: ${error.message}`);
    }
    sessions.push(...((data ?? []) as SessionRow[]));
    if (!data || data.length < PAGE) break;
  }

  // the group each session belongs to (only when splitting)
  let groupOf: (s: SessionRow) => string = () => '';
  if (split === 'referrer') {
    groupOf = (s) => classifyReferrer({ utm_source: s.utm_source, referrer: s.referrer });
  } else if (split === 'country') {
    groupOf = (s) => s.country || 'Unknown';
  } else if (split === 'device') {
    const ids = [...new Set(sessions.map((s) => s.visitor_id).filter((v): v is string => !!v))];
    const device = new Map<string, string>();
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await supabase.from('visitors').select('visitor_id, device_type').eq('site_id', siteId).in('visitor_id', ids.slice(i, i + 300));
      if (error) throw new Error(`Failed to fetch devices: ${error.message}`);
      for (const v of data ?? []) if (v.device_type && !device.has(v.visitor_id)) device.set(v.visitor_id, titleCase(String(v.device_type)));
    }
    groupOf = (s) => (s.visitor_id && device.get(s.visitor_id)) || 'Unknown';
  }

  // count: buckets, unique-per-bucket, split groups (pure, tested: lib/analytics/visitsAggregate.test.ts)
  const { buckets, series, total: totalVisits } = aggregateVisits(
    sessions.map((r) => ({ id: r.id, startedAt: r.started_at, visitorId: r.visitor_id, group: split === 'none' ? '' : groupOf(r) })),
    { start: startDate, end: endDate, bucketMs, bucketCount, unique, split: split !== 'none', top: TOP_GROUPS },
  );

  return {
    window,
    windowStart: startDate.toISOString(),
    windowEnd: endDate.toISOString(),
    granularity,
    buckets,
    totalVisits,
    avgPerBucket: buckets.length > 0 ? totalVisits / buckets.length : 0,
    allTimeTotal: allTimeCount ?? 0,
    unique,
    split,
    series,
    capped,
  };
}
