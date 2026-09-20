// lib/actions/visitsOverTime.action.ts
// Sessions bucketed into time intervals — the "how many visits is this site
// getting" line/bar chart on the dashboard. Mirrors the bucketing strategy in
// rateConversion.action.ts (same window presets, same label format) so the
// two charts read consistently, just plotted from `sessions` instead of
// `form_submissions`.
'use server';

import { createSupabaseClient } from '@/lib/supabase/server';

export type VisitsWindowPreset = '3d' | '7d' | '1m' | '3m' | 'all';

export interface VisitsBucket {
  bucketStart: string;
  bucketEnd: string;
  label: string;
  visits: number;
}

export interface VisitsOverTimeResult {
  window: VisitsWindowPreset;
  windowStart: string;
  windowEnd: string;
  buckets: VisitsBucket[];
  totalVisits: number;
  avgPerBucket: number;
  allTimeTotal: number;
}

function formatLabel(start: Date, bucketMs: number): string {
  const DAY = 86_400_000;

  if (bucketMs <= DAY) {
    return (
      start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' +
      start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  }
  if (bucketMs <= DAY * 2) {
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (bucketMs <= DAY * 8) {
    const end = new Date(start.getTime() + bucketMs - 1);
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('en-US', { day: 'numeric' });
    return `${s}–${e}`;
  }
  return start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function resolveWindow(
  preset: VisitsWindowPreset,
  earliestSession: Date | null,
  now: Date,
): { startDate: Date; endDate: Date; bucketMs: number; bucketCount: number } {
  const DAY = 86_400_000;
  const HOUR = 3_600_000;
  const endDate = now;

  switch (preset) {
    case '3d':
      return { startDate: new Date(now.getTime() - 3 * DAY), endDate, bucketMs: 12 * HOUR, bucketCount: 6 };
    case '7d':
      return { startDate: new Date(now.getTime() - 7 * DAY), endDate, bucketMs: DAY, bucketCount: 7 };
    case '1m':
      return { startDate: new Date(now.getTime() - 28 * DAY), endDate, bucketMs: 4 * DAY, bucketCount: 7 };
    case '3m':
      return { startDate: new Date(now.getTime() - 91 * DAY), endDate, bucketMs: 7 * DAY, bucketCount: 13 };
    case 'all': {
      const start = earliestSession ?? new Date(now.getTime() - 90 * DAY);
      const rangeMs = Math.max(now.getTime() - start.getTime(), DAY);
      const bucketMs = Math.max(DAY, Math.ceil(rangeMs / 12));
      const bucketCount = Math.ceil(rangeMs / bucketMs);
      return { startDate: start, endDate, bucketMs, bucketCount };
    }
  }
}

export async function getVisitsOverTime(siteId: string, window: VisitsWindowPreset = '7d'): Promise<VisitsOverTimeResult> {
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

  const { startDate, endDate, bucketMs, bucketCount } = resolveWindow(window, earliestSession, now);

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
    buckets.push({
      bucketStart: bucketStart.toISOString(),
      bucketEnd: bucketEnd.toISOString(),
      label: formatLabel(bucketStart, bucketMs),
      visits: 0,
    });
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
    buckets,
    totalVisits,
    avgPerBucket,
    allTimeTotal,
  };
}
