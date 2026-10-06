// lib/analytics/visitsAggregate.ts
// The counting behind "Visits over time" (lib/actions/visitsOverTime.action.ts),
// pure so it is tested on its own (lib/analytics/visitsAggregate.test.ts):
//   - buckets of equal length from the window start;
//   - unique: a visitor counts once PER BUCKET, under the group of their
//     FIRST session in that bucket (so a stack still adds up to the total);
//   - split: groups ranked by sessions in the whole window (never by the
//     unique count, so colours don't move when unique is toggled); the top
//     `top` keep keys g0..g(top-1), the rest share "__other__".

export interface AggSession {
  id: string;
  startedAt: string | null;
  visitorId: string | null;
  group: string;
}

export interface AggBucket {
  bucketStart: string;
  bucketEnd: string;
  visits: number;
  parts?: Record<string, number>;
}

export interface AggSeries {
  key: string;
  label: string;
  total: number;
}

export const OTHER_KEY = "__other__";

export function aggregateVisits(
  sessions: AggSession[],
  opts: { start: Date; end: Date; bucketMs: number; bucketCount: number; unique: boolean; split: boolean; top: number },
): { buckets: AggBucket[]; series: AggSeries[]; total: number } {
  const { start, end, bucketMs, bucketCount, unique, split, top } = opts;

  const keyOf = new Map<string, string>();
  let series: AggSeries[] = [];
  if (split) {
    const totals = new Map<string, number>();
    for (const s of sessions) totals.set(s.group, (totals.get(s.group) ?? 0) + 1);
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const head = ranked.slice(0, top);
    const rest = ranked.slice(top);
    head.forEach(([label], i) => keyOf.set(label, `g${i}`));
    series = head.map(([label, total], i) => ({ key: `g${i}`, label, total }));
    if (rest.length) {
      for (const [label] of rest) keyOf.set(label, OTHER_KEY);
      series.push({ key: OTHER_KEY, label: `Other (${rest.length})`, total: rest.reduce((a, [, n]) => a + n, 0) });
    }
  }

  const buckets: AggBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bs = new Date(start.getTime() + i * bucketMs);
    const be = new Date(Math.min(bs.getTime() + bucketMs, end.getTime()));
    buckets.push({ bucketStart: bs.toISOString(), bucketEnd: be.toISOString(), visits: 0, ...(split ? { parts: {} } : {}) });
  }

  // oldest first, so the first session of a visitor in a bucket is the one counted
  const ordered = [...sessions].sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
  const seen = buckets.map(() => new Set<string>());
  for (const s of ordered) {
    if (!s.startedAt) continue;
    const idx = Math.min(Math.floor((new Date(s.startedAt).getTime() - start.getTime()) / bucketMs), buckets.length - 1);
    if (idx < 0 || idx >= buckets.length) continue;
    if (unique) {
      const who = s.visitorId ?? `session:${s.id}`; // no visitor id: can't be merged with anyone
      if (seen[idx].has(who)) continue;
      seen[idx].add(who);
    }
    const b = buckets[idx];
    b.visits += 1;
    if (b.parts) {
      const key = keyOf.get(s.group) ?? OTHER_KEY;
      b.parts[key] = (b.parts[key] ?? 0) + 1;
    }
  }
  return { buckets, series, total: buckets.reduce((a, b) => a + b.visits, 0) };
}
