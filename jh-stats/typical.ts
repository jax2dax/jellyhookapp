// jh-stats/typical.ts
// "What is normal on this site" for a duration (session length, time on a form...), robust to odd values. Founder's
// method (2026-10-16): not the plain median, not the plain mean. Put the values in a FREQUENCY TABLE of ranges, find
// the range most values fall in, keep the ranges joined to it that still hold a real share of values, and drop the
// rest (a couple of 100 s sessions far from a crowd at 30-40 s are outliers, not "normal"). Then the mean and standard
// deviation of what is kept: typical = mean +/- 1 SD.
// Pure. Used by per-site statistics (lib/stats/siteStats.ts) and by marks that compare a lead to the site's normal.

/** Range edges in seconds. Narrow where durations crowd (seconds), wider as they grow (minutes, hours). */
export const EDGES_S = [0, 5, 10, 15, 20, 30, 40, 50, 60, 90, 120, 180, 240, 300, 420, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200, 14400, Infinity];

/** A range joins the crowd while it holds at least this share of the busiest range's count. */
export const KEEP_SHARE = 0.15;
/** Below this many values there is no "normal" yet. */
export const MIN_VALUES = 20;

export interface Bin {
  fromS: number;
  toS: number;
  count: number;
  kept: boolean;
}

export interface Typical {
  /** values in total, and the ones kept as "normal" */
  n: number;
  kept: number;
  /** ms */
  mean: number;
  sd: number;
  low: number;
  high: number;
  bins: Bin[];
}

/** values in ms. null when there are fewer than MIN_VALUES. */
export function typicalRange(valuesMs: number[]): Typical | null {
  const vals = valuesMs.filter((v) => Number.isFinite(v) && v >= 0);
  if (vals.length < MIN_VALUES) return null;
  const bins: Bin[] = EDGES_S.slice(0, -1).map((fromS, i) => ({ fromS, toS: EDGES_S[i + 1], count: 0, kept: false }));
  const binOf = (ms: number) => {
    const s = ms / 1000;
    const i = EDGES_S.findIndex((e, k) => s >= e && s < EDGES_S[k + 1]);
    return i < 0 ? bins.length - 1 : i;
  };
  for (const v of vals) bins[binOf(v)].count++;
  // the busiest range, then grow outwards while the neighbours still hold a real share of values
  let mode = 0;
  bins.forEach((b, i) => {
    if (b.count > bins[mode].count) mode = i;
  });
  const floor = Math.max(1, bins[mode].count * KEEP_SHARE);
  let lo = mode;
  let hi = mode;
  while (lo > 0 && bins[lo - 1].count >= floor) lo--;
  while (hi < bins.length - 1 && bins[hi + 1].count >= floor) hi++;
  for (let i = lo; i <= hi; i++) bins[i].kept = true;
  const kept = vals.filter((v) => bins[binOf(v)].kept);
  const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
  const sd = Math.sqrt(kept.reduce((a, b) => a + (b - mean) ** 2, 0) / kept.length);
  return { n: vals.length, kept: kept.length, mean, sd, low: Math.max(0, mean - sd), high: mean + sd, bins };
}
