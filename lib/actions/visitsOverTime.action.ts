// lib/actions/visitsOverTime.action.ts
// Sessions bucketed into time intervals — the "how many visits is this site
// getting" bar chart on the dashboard.
//
// Bucket EDGES are computed here (server-side, where the `sessions` query
// runs), but bucket LABELS are not: this is a server action, so it has no
// idea what timezone the viewer is actually in (on Vercel it runs in
// whatever timezone the server process happens to be, not the browser's).
// The caller passes its own `getTimezoneOffset()` so day/week buckets can
// be aligned to the VIEWER's local midnight, and the caller formats the
// label text itself from `bucketStart` using its own locale functions,
// which naturally run in the browser's real timezone. See
// components/charts/visitsOverTime.tsx.
'use server';

import { createSupabaseClient } from '@/lib/supabase/server';
import { requireSiteAccess } from '@/lib/actions/siteAccess';

export type VisitsWindowPreset = '24h' | '7d' | '1m' | '3m' | 'all';
export type VisitsBucketGranularity = 'hour' | 'day' | 'week' | 'month';

export interface VisitsBucket {
  bucketStart: string;
  bucketEnd: string;
  visits: number;
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
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * The real UTC instant corresponding to local midnight, in the viewer's own
 * timezone, for the day `d` falls in. `tzOffsetMinutes` is the browser's own
 * `Date.prototype.getTimezoneOffset()` (minutes to ADD to local time to get
 * UTC). A plain offset, not a full IANA timezone: a DST change inside the
 * window can shift a later bucket by an hour, the same accepted
 * simplification `main-chart/engine/intervals.ts` makes for the same reason.
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
      // Rolling, not day-aligned — "last 24 hours" means the 24 hours up to
      // right now, not today-plus-yesterday.
      return { startDate: new Date(now.getTime() - 24 * HOUR), endDate, bucketMs: HOUR, bucketCount: 24, granularity: 'hour' };
    case '7d':
      // 6 full local days plus today (so far) = 7 buckets.
      return { startDate: new Date(todayLocalMidnight.getTime() - 6 * DAY), endDate, bucketMs: DAY, bucketCount: 7, granularity: 'day' };
    case '1m':
      // 29 full local days plus today (so far) = 30 daily buckets.
      return { startDate: new Date(todayLocalMidnight.getTime() - 29 * DAY), endDate, bucketMs: DAY, bucketCount: 30, granularity: 'day' };
    case '3m':
      // 12 full local weeks plus the current week (so far) = 13 weekly buckets.
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

export async function getVisitsOverTime(siteId: string, window: VisitsWindowPreset = '7d', tzOffsetMinutes = 0): Promise<VisitsOverTimeResult> {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();
  const now = new Date();

  const { data: allTimeRows, error: allTimeError } = await supabase
    .from('sessions')
    .select('started_at')
    .eq('site_id', siteId)
    .order('started_at', { ascending: true });

  if (allTimeError) {
    console.error('[getVisitsOverTime] all-time fetch error:', allTimeError.message);
    throw new Error(`Failed to fetch sessions: ${allTimeError.message}`);
  }

  const allTimeTotal = allTimeRows?.length ?? 0;
  const earliestSession = allTimeRows && allTimeRows.length > 0 ? new Date(allTimeRows[0].started_at) : null;

  const { startDate, endDate, bucketMs, bucketCount, granularity } = resolveWindow(window, earliestSession, now, tzOffsetMinutes);

  const { data: windowRows, error: windowError } = await supabase
    .from('sessions')
    .select('started_at')
    .eq('site_id', siteId)
    .gte('started_at', startDate.toISOString())
    .lte('started_at', endDate.toISOString());

  if (windowError) {
    console.error('[getVisitsOverTime] window fetch error:', windowError.message);
    throw new Error(`Failed to fetch windowed sessions: ${windowError.message}`);
  }

  const sessions = windowRows ?? [];

  const buckets: VisitsBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(startDate.getTime() + i * bucketMs);
    const bucketEnd = new Date(Math.min(bucketStart.getTime() + bucketMs, endDate.getTime()));
    buckets.push({ bucketStart: bucketStart.toISOString(), bucketEnd: bucketEnd.toISOString(), visits: 0 });
  }

  for (const row of sessions) {
    if (!row.started_at) continue;
    const ts = new Date(row.started_at).getTime();
    const offsetMs = ts - startDate.getTime();
    const bucketIndex = Math.min(Math.floor(offsetMs / bucketMs), buckets.length - 1);
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].visits += 1;
    }
  }

  const totalVisits = sessions.length;
  const avgPerBucket = buckets.length > 0 ? totalVisits / buckets.length : 0;

  return {
    window,
    windowStart: startDate.toISOString(),
    windowEnd: endDate.toISOString(),
    granularity,
    buckets,
    totalVisits,
    avgPerBucket,
    allTimeTotal,
  };
}
