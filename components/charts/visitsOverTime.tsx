// components/charts/visitsOverTime.tsx
// "How many visits is this site getting" — sessions per interval. Same
// window-preset UX and visual language as ConversionRateChart so the two
// live comfortably on the same dashboard.
'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Users } from 'lucide-react';
import { getVisitsOverTime, VisitsOverTimeResult, VisitsWindowPreset } from '@/lib/actions/visitsOverTime.action';

const WINDOW_OPTIONS: { value: VisitsWindowPreset; label: string }[] = [
  { value: '3d', label: 'Last 3 Days' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '1m', label: 'Last Month' },
  { value: '3m', label: 'Last 3 Months' },
  { value: 'all', label: 'All Time' },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-md px-3 py-2 text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-muted-foreground mt-0.5">
        <span className="font-bold text-foreground text-base">{value}</span> visit{value !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export function VisitsOverTimeChart({ siteId, defaultWindow = '7d' }: { siteId: string; defaultWindow?: VisitsWindowPreset }) {
  const [selectedWindow, setSelectedWindow] = React.useState<VisitsWindowPreset>(defaultWindow);
  const [data, setData] = React.useState<VisitsOverTimeResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setError(null);
      const result = await getVisitsOverTime(siteId, selectedWindow);
      setData(result);
    } catch (err) {
      console.error('[VisitsOverTimeChart] fetch error:', err);
      setError('Failed to load visit data.');
    } finally {
      setLoading(false);
    }
  }, [siteId, selectedWindow]);

  React.useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const chartBuckets = React.useMemo(() => {
    if (!data) return [];
    return data.buckets.map((b, idx) => ({ label: b.label, visits: b.visits, isLast: idx === data.buckets.length - 1 }));
  }, [data]);

  if (loading && !data) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading visits…</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-64 text-destructive text-sm">{error}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Visits Over Time
            </CardTitle>
            <CardDescription className="mt-0.5">Sessions started per interval.</CardDescription>
          </div>
        </div>

        <div className="flex gap-1 mt-3 flex-wrap">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedWindow(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedWindow === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {chartBuckets.length === 0 || data?.totalVisits === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No visits in this period.</div>
        ) : (
          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartBuckets} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
                <Bar dataKey="visits" radius={[4, 4, 0, 0]}>
                  {chartBuckets.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="var(--primary)" opacity={entry.isLast ? 1 : 0.55} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
