//components/charts/conversionRate.tsx
'use client';

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Users, BarChart2, Activity } from 'lucide-react';
import { getConversionRateData, WindowPreset, ConversionRateResult } from '@/lib/actions/rateConversion.action';

// ─────────────────────────────────────────────────────────────────────────────
// POLL INTERVALS (ms) — adjust per plan tier before enabling live fetch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How often (in ms) to re-fetch the chart data from Supabase.
 *
 * FREE tier  → poll every 5 minutes (data is stale, no live feature)
 * PRO  tier  → poll every 60 seconds
 * ELITE tier → poll every 15 seconds (near-realtime)
 *
 * To wire up plan checks later, replace the single constant below with:
 *   const POLL_INTERVAL = plan === 'elite' ? 15_000 : plan === 'pro' ? 60_000 : 300_000;
 */
const POLL_INTERVAL_FREE  = 5 * 60_000;   // 5 min  — FREE
const POLL_INTERVAL_PRO   = 60_000;        // 60 sec — PRO
const POLL_INTERVAL_ELITE = 15_000;        // 15 sec — ELITE

// ── Change this single line when plan gating is wired up ────────────────────
// For now defaults to FREE so no hammering on the DB.
const ACTIVE_POLL_INTERVAL = POLL_INTERVAL_FREE;

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_OPTIONS: { value: WindowPreset; label: string }[] = [
  { value: '3d',  label: 'Last 3 Days' },
  { value: '7d',  label: 'Last 7 Days' },
  { value: '1m',  label: 'Last Month'  },
  { value: '3m',  label: 'Last 3 Months' },
  { value: 'all', label: 'All Time'    },
];

/** Human-readable growth label per window */
const GROWTH_LABEL: Record<WindowPreset, string> = {
  '3d':  '3-Day',
  '7d':  'Weekly',
  '1m':  'Monthly',
  '3m':  'Quarterly',
  'all': 'All-Time',
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const value: number = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground mt-0.5">
        <span className="font-bold text-foreground text-base">{value}</span>{' '}
        conversion{value !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface ConversionRateChartProps {
  siteId: string;
  /** Numeric plan level — 0=free, 1=pro, 2=elite. Used to pick poll interval. */
  planLevel?: number;
  /** Default window shown on mount */
  defaultWindow?: WindowPreset;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ConversionRateChart({
  siteId,
  planLevel = 0,
  defaultWindow = '7d',
}: ConversionRateChartProps) {
  const [selectedWindow, setSelectedWindow] = React.useState<WindowPreset>(defaultWindow);
  const [data, setData] = React.useState<ConversionRateResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [lastFetched, setLastFetched] = React.useState<Date | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // ── Derive correct poll interval from planLevel ────────────────────────────
  // Wire plan checks here: planLevel comes from the parent server component.
  const pollInterval =
    planLevel >= 2
      ? POLL_INTERVAL_ELITE
      : planLevel >= 1
      ? POLL_INTERVAL_PRO
      : POLL_INTERVAL_FREE;

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = React.useCallback(async () => {
    try {
      setError(null);
      const result = await getConversionRateData(siteId, selectedWindow);
      setData(result);
      setLastFetched(new Date());
    } catch (err) {
      console.error('[ConversionRateChart] fetch error:', err);
      setError('Failed to load conversion data.');
    } finally {
      setLoading(false);
    }
  }, [siteId, selectedWindow]);

  // Initial fetch + re-fetch when window changes
  React.useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Continuous live polling — interval governed by plan tier
  React.useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData();
    }, pollInterval);
    return () => clearInterval(intervalId);
  }, [fetchData, pollInterval]);

  // ── Chart data formatted for Recharts ─────────────────────────────────────
  const chartBuckets = React.useMemo(() => {
    if (!data) return [];
    return data.buckets.map((b, idx) => ({
      label: b.label,
      conversions: b.conversions,
      isLast: idx === data.buckets.length - 1,
    }));
  }, [data]);

  // ── Growth card derivations ───────────────────────────────────────────────
  const growthRatio = data?.growthRatio ?? null;
  const growthPercent =
    growthRatio !== null ? ((growthRatio - 1) * 100).toFixed(1) : null;
  const isGrowthPositive = growthRatio !== null && growthRatio >= 1;
  const isGrowthNeutral = growthRatio === null;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — LOADING
  // ─────────────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-80">
          <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading conversions…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-80 text-destructive text-sm">
          {error}
        </CardContent>
      </Card>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — MAIN
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Main chart card ─────────────────────────────────────────────── */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Conversion Rate Over Time</CardTitle>
              <CardDescription className="mt-0.5">
                Form submissions per interval · refreshes every{' '}
                {pollInterval >= 60_000
                  ? `${pollInterval / 60_000}m`
                  : `${pollInterval / 1000}s`}
              </CardDescription>
            </div>

            {/* Last-fetched indicator + manual refresh */}
            <div className="flex items-center gap-2">
              {lastFetched && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Updated {lastFetched.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh now"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* ── Window selector ────────────────────────────────────────── */}
          <div className="flex gap-1 mt-3 flex-wrap">
            {WINDOW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedWindow(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedWindow === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {chartBuckets.length === 0 || data?.totalConversions === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              No conversions in this period.
            </div>
          ) : (
            <div className="h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartBuckets}
                  margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
                  barCategoryGap="25%"
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.6}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                  />
                  <Bar dataKey="conversions" radius={[4, 4, 0, 0]}>
                    {chartBuckets.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        // Highlight the most-recent bar slightly
                        fill={
                          entry.isLast
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--primary) / 0.55)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Stat cards row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

        {/* Growth card */}
        <Card className={`col-span-2 sm:col-span-2 border ${
          isGrowthNeutral
            ? ''
            : isGrowthPositive
            ? 'border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20'
            : 'border-red-500/30 bg-red-50/40 dark:bg-red-950/20'
        }`}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide">
              {GROWTH_LABEL[selectedWindow]} Conversion Growth
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-2">
              {isGrowthNeutral ? (
                <>
                  <Minus className="h-5 w-5 text-muted-foreground mb-0.5" />
                  <span className="text-2xl font-bold text-muted-foreground">—</span>
                  <span className="text-xs text-muted-foreground mb-1">not enough data</span>
                </>
              ) : isGrowthPositive ? (
                <>
                  <TrendingUp className="h-5 w-5 text-emerald-600 mb-0.5 shrink-0" />
                  <span className="text-2xl font-bold text-emerald-600">
                    +{growthPercent}%
                  </span>
                  <span className="text-xs text-muted-foreground mb-1">
                    ({data?.firstBucketConversions} → {data?.lastBucketConversions})
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-5 w-5 text-red-500 mb-0.5 shrink-0" />
                  <span className="text-2xl font-bold text-red-500">
                    {growthPercent}%
                  </span>
                  <span className="text-xs text-muted-foreground mb-1">
                    ({data?.firstBucketConversions} → {data?.lastBucketConversions})
                  </span>
                </>
              )}
            </div>
            {!isGrowthNeutral && (
              <p className="text-xs text-muted-foreground mt-1">
                First interval vs most recent interval
              </p>
            )}
          </CardContent>
        </Card>

        {/* Window total */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide flex items-center gap-1">
              <Activity className="h-3 w-3" /> In Window
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{data?.totalConversions ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              conversions in selected range
            </p>
          </CardContent>
        </Card>

        {/* Avg per bucket */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide flex items-center gap-1">
              <BarChart2 className="h-3 w-3" /> Avg / Interval
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">
              {data ? data.avgPerBucket.toFixed(1) : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              avg conversions per bucket
            </p>
          </CardContent>
        </Card>

        {/* All-time total — spans full row on mobile */}
        <Card className="col-span-2 sm:col-span-4">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="text-xs font-medium uppercase tracking-wide flex items-center gap-1">
              <Users className="h-3 w-3" /> All-Time Total Conversions
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex items-center gap-4">
            <p className="text-3xl font-bold">{data?.allTimeTotal ?? 0}</p>
            <p className="text-sm text-muted-foreground">
              total form submissions ever recorded for this site
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}