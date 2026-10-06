// components/charts/visitsOverTime.tsx
// "Visits over time": sessions started per interval, with two options:
//   - Unique visitors: a person counts once per bar (per hour on 24 h, per
//     day on 7 days...), however many sessions they started in it.
//   - Split by referrer / device / country: each bar becomes a stacked bar,
//     one coloured part per group, with a legend and a tooltip that names
//     every colour. The 7 biggest groups keep their own colour, the rest are
//     "Other". A group keeps its colour across every bar, and when Unique is
//     switched on or off (the server ranks groups by sessions, not by the
//     unique count). See mds/documentation/dashboard-2026-10-06.md.
//
// Bucket labels are formatted HERE, in the browser, never on the server:
// the server action only returns each bucket's boundary as an ISO instant
// plus the window's granularity (hour/day/week/month). The viewer's own
// `getTimezoneOffset()` is sent along so day/week buckets align to the
// viewer's local midnight.
'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Users } from 'lucide-react';
import { InfoTip } from '@/components/InfoTip';
import {
  getVisitsOverTime,
  type VisitsOverTimeResult,
  type VisitsWindowPreset,
  type VisitsBucketGranularity,
  type VisitsSplit,
  type VisitsSeries,
} from '@/lib/actions/visitsOverTime.action';

const WINDOW_OPTIONS: { value: VisitsWindowPreset; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '1m', label: 'Last Month' },
  { value: '3m', label: 'Last 3 Months' },
  { value: 'all', label: 'All Time' },
];

const SPLIT_OPTIONS: { value: VisitsSplit; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'referrer', label: 'Referrer' },
  { value: 'device', label: 'Device' },
  { value: 'country', label: 'Country' },
];

/** Group colours, by rank. Readable in light and dark mode; "Other" is always grey. */
const PALETTE = ['#3b82f6', '#22c55e', '#eab308', '#ec4899', '#8b5cf6', '#f97316', '#06b6d4'];
const OTHER_COLOR = '#9ca3af';
const colorOf = (s: VisitsSeries, i: number) => (s.key === '__other__' ? OTHER_COLOR : PALETTE[i % PALETTE.length]);

/**
 * One rule per granularity, decided once for the whole result, never
 * re-derived per bucket from bucket size.
 */
function formatBucketLabel(startIso: string, endIso: string, granularity: VisitsBucketGranularity): string {
  const start = new Date(startIso);
  if (granularity === 'hour') return start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (granularity === 'day') return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (granularity === 'week') {
    const end = new Date(new Date(endIso).getTime() - 1);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${end.toLocaleDateString('en-US', { day: 'numeric' })}`;
  }
  return start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

type Row = { label: string; visits: number; isLast: boolean } & Record<string, number | string | boolean>;

/** Recharts clones this element and adds active / payload / label. */
function VisitsTooltip({ active, payload, label, series, unique }: { active?: boolean; payload?: { payload: Row }[]; label?: string; series: VisitsSeries[]; unique: boolean }) {
  const noun = unique ? 'visitor' : 'visit';
    if (!active || !payload?.length) return null;
    const row = payload[0].payload;
    const total = row.visits;
    return (
      <div className="rounded-lg border bg-card px-3 py-2 text-sm text-card-foreground shadow-md">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-muted-foreground">
          <span className="text-base font-bold text-foreground">{total}</span> {noun}
          {total !== 1 ? 's' : ''}
        </p>
        {series.length > 0 && total > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs">
            {series.map((s, i) => {
              const n = Number(row[s.key] ?? 0);
              if (!n) return null;
              return (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf(s, i) }} />
                  <span className="flex-1 truncate">{s.label}</span>
                  <span className="tabular-nums text-foreground">{n}</span>
                  <span className="w-10 text-right tabular-nums text-muted-foreground">{Math.round((n / total) * 100)}%</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
}

export function VisitsOverTimeChart({ siteId, defaultWindow = '7d' }: { siteId: string; defaultWindow?: VisitsWindowPreset }) {
  const [selectedWindow, setSelectedWindow] = React.useState<VisitsWindowPreset>(defaultWindow);
  const [unique, setUnique] = React.useState(false);
  const [split, setSplit] = React.useState<VisitsSplit>('none');
  const [data, setData] = React.useState<VisitsOverTimeResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the loading state while the new window/options load
    setLoading(true);
    // Read here, inside the effect, never during render: the server-rendered
    // pass has no browser timezone at all.
    const tzOffsetMinutes = new Date().getTimezoneOffset();
    getVisitsOverTime(siteId, selectedWindow, tzOffsetMinutes, { unique, split })
      .then((result) => {
        if (!live) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        console.error('[VisitsOverTimeChart] fetch error:', err);
        if (live) setError('Failed to load visit data.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [siteId, selectedWindow, unique, split]);

  const series = React.useMemo(() => data?.series ?? [], [data]);
  const rows = React.useMemo<Row[]>(() => {
    if (!data) return [];
    return data.buckets.map((b, idx) => {
      const row: Row = { label: formatBucketLabel(b.bucketStart, b.bucketEnd, data.granularity), visits: b.visits, isLast: idx === data.buckets.length - 1 };
      for (const s of data.series) row[s.key] = b.parts?.[s.key] ?? 0;
      return row;
    });
  }, [data]);
  const stacked = !!data && data.split !== 'none' && series.length > 0;

  if (loading && !data) {
    return (
      <Card className="w-full">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="flex animate-pulse items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading visits…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card className="w-full">
        <CardContent className="flex h-64 items-center justify-center text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-4 w-4 text-muted-foreground" /> Visits Over Time
              <InfoTip label="About Visits Over Time">
                Each bar is one period (an hour on Last 24 Hours, a day on 7 days and a month, a week on 3 months). By default it counts every session that
                started in that period. <b>Unique visitors</b> counts each person once per bar, however many sessions they started in it. <b>Split by</b> colours
                each bar by where people came from (referrer), their device or their country: hover a bar to see every colour and its share. The 7 biggest
                groups get their own colour; the rest are Other.
              </InfoTip>
              {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Updating" />}
            </CardTitle>
            <CardDescription className="mt-0.5">
              {unique ? 'Different visitors per period' : 'Number of sessions started'}
              {data && data.split !== 'none' ? `, by ${data.split}` : ''}.
            </CardDescription>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedWindow(opt.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                selectedWindow === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
            Unique visitors
          </label>
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Split bars by">
            <span className="text-muted-foreground">Split by</span>
            {SPLIT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={split === opt.value}
                onClick={() => setSplit(opt.value)}
                className={`rounded-md px-2 py-0.5 font-medium transition-colors ${split === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        {rows.length === 0 || data?.totalVisits === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No visits in this period.</div>
        ) : (
          <>
            <div className="mt-2 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<VisitsTooltip series={series} unique={!!data?.unique} />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                  {stacked ? (
                    series.map((s, i) => (
                      <Bar key={s.key} dataKey={s.key} name={s.label} stackId="split" fill={colorOf(s, i)} radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                    ))
                  ) : (
                    <Bar dataKey="visits" radius={[4, 4, 0, 0]}>
                      {rows.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="var(--primary)" opacity={entry.isLast ? 1 : 0.55} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {stacked && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
                {series.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(s, i) }} />
                    <span>{s.label}</span>
                    <span className="text-muted-foreground">{s.total}</span>
                  </li>
                ))}
              </ul>
            )}
            {data?.capped && <p className="mt-2 text-[11px] text-muted-foreground">This window has more than 100,000 sessions; the first 100,000 are counted.</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
