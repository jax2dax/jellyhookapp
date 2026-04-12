'use server';

import { createSupabaseClient } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type WindowPreset = '3d' | '7d' | '1m' | '3m' | 'all';

export interface ConversionBucket {
  /** ISO string of the bucket's START boundary — used as the chart X key */
  bucketStart: string;
  /** ISO string of the bucket's END boundary */
  bucketEnd: string;
  /**
   * Human-readable label for the X axis tick.
   * e.g. "Apr 1", "Mar 7–11", "Jan"
   * Computed server-side so the frontend never has to re-derive it.
   */
  label: string;
  /** Number of form_submissions whose created_at falls inside this bucket */
  conversions: number;
}

export interface ConversionRateResult {
  /**
   * The resolved window preset that was used.
   * For 'all', startDate/endDate are the actual first/last submission timestamps.
   */
  window: WindowPreset;

  /** Actual query start (ISO) */
  windowStart: string;
  /** Actual query end — always "now" except for 'all' */
  windowEnd: string;

  /**
   * Ordered array of time buckets, oldest → newest.
   * The last bucket represents the most recent period (≈ "now").
   */
  buckets: ConversionBucket[];

  // ── Summary stats (used by the stat cards below the chart) ──────────────
  /** Total conversions in the selected window */
  totalConversions: number;
  /** Average conversions per bucket */
  avgPerBucket: number;
  /**
   * Growth ratio: lastBucket.conversions / firstBucket.conversions.
   * null when there are fewer than 2 buckets or firstBucket.conversions === 0.
   * > 1 means growth (green), < 1 means decline (red).
   */
  growthRatio: number | null;
  /** Conversions in the very first bucket of the window */
  firstBucketConversions: number | null;
  /** Conversions in the very last (most recent) bucket of the window */
  lastBucketConversions: number | null;
  /** The all-time total conversions for this site (regardless of window) */
  allTimeTotal: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a short label for a bucket depending on its size.
 * bucketMs is the duration of each bucket in milliseconds.
 */
function formatLabel(start: Date, bucketMs: number): string {
  const DAY = 86_400_000;

  if (bucketMs <= DAY) {
    // Hour-level buckets → "Apr 1 14:00"
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' '
      + start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  if (bucketMs <= DAY * 2) {
    // 1-day buckets → "Apr 1"
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (bucketMs <= DAY * 8) {
    // Multi-day buckets → "Mar 7–11"
    const end = new Date(start.getTime() + bucketMs - 1);
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('en-US', { day: 'numeric' });
    return `${s}–${e}`;
  }

  // Month-level or larger → "March" or "Mar '24"
  return start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/**
 * Given a window preset and optional all-time earliest submission date,
 * returns { startDate, endDate, bucketMs, bucketCount }.
 *
 * Bucket strategy per window:
 *  3d  → 6 buckets of 12h each
 *  7d  → 7 buckets of 1 day each
 *  1m  → ~8 buckets of ~4 days each   (28 days / 8 = 3.5d → round to 4d)
 *  3m  → 12 buckets of ~7 days each
 *  all → 12 buckets spanning the full range
 */
function resolveWindow(
  preset: WindowPreset,
  earliestSubmission: Date | null,
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
      const start = earliestSubmission ?? new Date(now.getTime() - 90 * DAY);
      const rangeMs = now.getTime() - start.getTime();
      const bucketMs = Math.max(DAY, Math.ceil(rangeMs / 12));
      const bucketCount = Math.ceil(rangeMs / bucketMs);
      return { startDate: start, endDate, bucketMs, bucketCount };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVER ACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getConversionRateData
 *
 * Fetches form_submissions for a site and buckets them into time intervals
 * suitable for the ConversionRateChart bar chart component.
 *
 * @param siteId   - UUID of the site
 * @param window   - Time window preset: '3d' | '7d' | '1m' | '3m' | 'all'
 * @returns        ConversionRateResult
 */
export async function getConversionRateData(
  siteId: string,
  window: WindowPreset = '7d',
): Promise<ConversionRateResult> {
  console.log('[getConversionRateData] Start', { siteId, window });

  // ✅ createSupabaseClient is async — must be awaited
  const supabase = await createSupabaseClient();

  const now = new Date();

  // ── Step 1: Get all-time total AND the earliest submission date ──────────
  // We need the earliest date to handle the 'all' window correctly.
  // We also grab the total for the stat card regardless of window.
  const { data: allTimeRows, error: allTimeError } = await supabase
    .from('form_submissions')
    .select('created_at')
    .eq('site_id', siteId)
    .order('created_at', { ascending: true });

  if (allTimeError) {
    console.error('[getConversionRateData] All-time fetch error:', allTimeError);
    throw new Error(`Failed to fetch submissions: ${allTimeError.message}`);
  }

  const allTimeTotal = allTimeRows?.length ?? 0;
  const earliestSubmission =
    allTimeRows && allTimeRows.length > 0 ? new Date(allTimeRows[0].created_at) : null;

  console.log(`[getConversionRateData] All-time total: ${allTimeTotal}, earliest: ${earliestSubmission?.toISOString() ?? 'none'}`);

  // ── Step 2: Resolve time window boundaries + bucket size ─────────────────
  const { startDate, endDate, bucketMs, bucketCount } = resolveWindow(window, earliestSubmission, now);

  console.log(`[getConversionRateData] Window: ${startDate.toISOString()} → ${endDate.toISOString()}, bucketMs=${bucketMs}, bucketCount=${bucketCount}`);

  // ── Step 3: Fetch submissions inside the window ───────────────────────────
  // We only select created_at because that's all we need for bucketing.
  const { data: windowRows, error: windowError } = await supabase
    .from('form_submissions')
    .select('created_at')
    .eq('site_id', siteId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true });

  if (windowError) {
    console.error('[getConversionRateData] Window fetch error:', windowError);
    throw new Error(`Failed to fetch windowed submissions: ${windowError.message}`);
  }

  const submissions = windowRows ?? [];
  console.log(`[getConversionRateData] ${submissions.length} submissions in window`);

  // ── Step 4: Build bucket array ────────────────────────────────────────────
  // Pre-allocate buckets so every slot exists even if count = 0.
  const buckets: ConversionBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(startDate.getTime() + i * bucketMs);
    const bucketEnd = new Date(Math.min(bucketStart.getTime() + bucketMs, endDate.getTime()));
    buckets.push({
      bucketStart: bucketStart.toISOString(),
      bucketEnd: bucketEnd.toISOString(),
      label: formatLabel(bucketStart, bucketMs),
      conversions: 0,
    });
  }

  // ── Step 5: Assign each submission to its bucket ─────────────────────────
  for (const row of submissions) {
    const ts = new Date(row.created_at).getTime();
    const offsetMs = ts - startDate.getTime();
    // Calculate which bucket index this falls into
    const bucketIndex = Math.min(
      Math.floor(offsetMs / bucketMs),
      buckets.length - 1, // clamp to last bucket for items exactly at endDate
    );
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].conversions += 1;
    }
  }

  // ── Step 6: Compute summary stats ────────────────────────────────────────
  const totalConversions = submissions.length;
  const avgPerBucket = buckets.length > 0 ? totalConversions / buckets.length : 0;

  const firstBucketConversions = buckets.length > 0 ? buckets[0].conversions : null;
  const lastBucketConversions = buckets.length > 0 ? buckets[buckets.length - 1].conversions : null;

  // growthRatio: lastBucket / firstBucket
  // null if either is 0 or buckets < 2 (avoids divide-by-zero and misleading 0/0)
  let growthRatio: number | null = null;
  if (
    buckets.length >= 2 &&
    firstBucketConversions !== null &&
    lastBucketConversions !== null &&
    firstBucketConversions > 0
  ) {
    growthRatio = lastBucketConversions / firstBucketConversions;
  }

  console.log('[getConversionRateData] Success', {
    totalConversions,
    avgPerBucket: avgPerBucket.toFixed(2),
    growthRatio,
    buckets: buckets.length,
  });

  return {
    window,
    windowStart: startDate.toISOString(),
    windowEnd: endDate.toISOString(),
    buckets,
    totalConversions,
    avgPerBucket,
    growthRatio,
    firstBucketConversions,
    lastBucketConversions,
    allTimeTotal,
  };
}