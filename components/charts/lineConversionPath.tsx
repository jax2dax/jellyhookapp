'use client';
import * as React from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Lock, Unlock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { getConversionPaths } from '@/lib/actions/conversionPath.action';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ------------------------------------------------------------------
// Local type definitions
// ------------------------------------------------------------------
interface PageViewRelative {
  relativeTimeSec: number;
  pagePath: string;
  enteredAt: Date;
}

interface LeadPathData {
  leadId: string;
  leadName?: string;
  leadEmail?: string;
  conversionTime: Date;
  session: any;
  pageViews: PageViewRelative[];
}

interface ConversionPathsResult {
  globalMinX: number;
  globalMaxX: number;
  uniquePagePaths: string[];
  leads: LeadPathData[];
}

// ------------------------------------------------------------------
// Demo data
// ------------------------------------------------------------------
const DEMO_DATA: ConversionPathsResult = {
  globalMinX: -360,
  globalMaxX: 30,
  uniquePagePaths: ['/', '/pricing', '/signup', '/docs', '/contact', '/checkout', '/about'],
  leads: [
    {
      leadId: 'demo1',
      leadName: 'Alice',
      leadEmail: 'alice@example.com',
      conversionTime: new Date('2026-04-05T10:00:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -240, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -180, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -120, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: -30, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo2',
      leadName: 'Bob',
      leadEmail: 'bob@example.com',
      conversionTime: new Date('2026-04-05T11:30:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -60, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -45, pagePath: '/docs', enteredAt: new Date() },
        { relativeTimeSec: -20, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo3',
      leadName: 'Charlie',
      leadEmail: 'charlie@example.com',
      conversionTime: new Date('2026-04-05T09:15:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -300, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -250, pagePath: '/contact', enteredAt: new Date() },
        { relativeTimeSec: -200, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -150, pagePath: '/docs', enteredAt: new Date() },
        { relativeTimeSec: -80, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -10, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo4',
      leadName: 'Diana',
      leadEmail: 'diana@example.com',
      conversionTime: new Date('2026-04-05T12:05:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -180, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -150, pagePath: '/about', enteredAt: new Date() },
        { relativeTimeSec: -100, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -50, pagePath: '/signup', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
    {
      leadId: 'demo5',
      leadName: 'Ethan',
      leadEmail: 'ethan@example.com',
      conversionTime: new Date('2026-04-05T08:45:00Z'),
      session: {},
      pageViews: [
        { relativeTimeSec: -360, pagePath: '/', enteredAt: new Date() },
        { relativeTimeSec: -300, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -240, pagePath: '/docs', enteredAt: new Date() },
        { relativeTimeSec: -180, pagePath: '/about', enteredAt: new Date() },
        { relativeTimeSec: -120, pagePath: '/pricing', enteredAt: new Date() },
        { relativeTimeSec: -60, pagePath: '/checkout', enteredAt: new Date() },
        { relativeTimeSec: 0, pagePath: '/signup', enteredAt: new Date() },
      ],
    },
  ],
};

// ------------------------------------------------------------------
// Custom Tooltip
// ------------------------------------------------------------------
const CustomTooltip = ({ active, payload, label, formatXAxis, uniquePagePaths }: any) => {
  if (!active || !payload || !payload.length) return null;
  const timeStr = formatXAxis(label);

  // Show all leads at this time point
  const visibleLeads = payload.filter((p: any) => p.value !== null && p.value !== undefined);

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1 max-w-[220px]">
      <p className="font-semibold border-b pb-1 mb-1">{timeStr}</p>
      {visibleLeads.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground truncate">{p.name}:</span>
          <span className="font-medium">{uniquePagePaths[p.value] ?? '?'}</span>
        </div>
      ))}
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------
interface ConversionPathsChartProps {
  siteId?: string;
  formSubmissionIds?: string[];
  startDate?: Date;
  endDate?: Date;
  useDemo?: boolean;
  permission?: number;
}

export function ConversionPathsChart({
  siteId,
  formSubmissionIds,
  startDate,
  endDate,
  useDemo = true,
  permission = 0,
}: ConversionPathsChartProps) {
  const [chartData, setChartData] = React.useState<ConversionPathsResult | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [beforeSeconds, setBeforeSeconds] = React.useState<number>(120);
  const [afterSeconds, setAfterSeconds] = React.useState<number>(30);
  const [intervalSeconds, setIntervalSeconds] = React.useState<number>(10);
  const [isLocked, setIsLocked] = React.useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<Set<string>>(new Set());

  // ── pageToIndex: page path → Y axis integer ──────────────────────────────
  const pageToIndex = React.useMemo(() => {
    if (!chartData) return new Map<string, number>();
    const map = new Map<string, number>();
    chartData.uniquePagePaths.forEach((path, idx) => map.set(path, idx));
    return map;
  }, [chartData]);

  // ── PATH FREQUENCY MATRIX ─────────────────────────────────────────────────
  // ====================== PATH FREQUENCY MATRIX ======================
// REPLACE the entire pathFrequency useMemo in lineConversionPath.tsx
// Find: const pathFrequency = React.useMemo(() => {
// Replace the whole block with this:

const pathFrequency = React.useMemo(() => {
  if (!chartData) return [];

  const map = new Map<string, number>();

  chartData.leads.forEach((lead) => {
    // Step 1: only use page views that happened AT OR BEFORE conversion (relativeTimeSec <= 0)
    const preConversion = lead.pageViews
      .filter((pv) => pv.relativeTimeSec <= 0)
      .sort((a, b) => a.relativeTimeSec - b.relativeTimeSec); // oldest first

    // Step 2: collapse consecutive duplicate pages
    const cleanPath: string[] = [];
    for (const pv of preConversion) {
      if (cleanPath[cleanPath.length - 1] !== pv.pagePath) {
        cleanPath.push(pv.pagePath);
      }
    }

    // Step 3: take last 3 unique pages leading into conversion
    const last3 = cleanPath.slice(-3);
    if (last3.length === 0) return;

    const key = last3.join(' → ');
    map.set(key, (map.get(key) || 0) + 1);
  });

  const totalLeads = chartData.leads.length;
  if (totalLeads === 0) return [];

  return Array.from(map.entries())
    .map(([path, freq]) => ({
      path,
      frequency: freq,
      percent: Math.round((freq / totalLeads) * 100),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);
}, [chartData]);

  // ── allSeries: one entry per lead, with STEPPED points ───────────────────
  // FIX: we build "step" points so the line holds at a page until the next page.
  // Without this, sparse timestamps render as isolated dots.
  const allSeries = React.useMemo(() => {
    if (!chartData) return [];
    return chartData.leads.map((lead, leadIdx) => {
      const rawPoints = lead.pageViews.map((pv) => ({
        x: pv.relativeTimeSec,
        y: pageToIndex.get(pv.pagePath) ?? 0,
      }));
      rawPoints.sort((a, b) => a.x - b.x);

      // Insert a "hold" point just before each transition so the line
      // looks like a horizontal shelf at the current page until the user moves.
      const stepped: { x: number; y: number }[] = [];
      rawPoints.forEach((pt, i) => {
        stepped.push(pt);
        if (i < rawPoints.length - 1) {
          // One tick before the next point, stay at the current Y
          stepped.push({ x: rawPoints[i + 1].x - 0.5, y: pt.y });
        }
      });

      return {
        leadId: lead.leadId,
        leadName: lead.leadName || `Lead ${leadIdx + 1}`,
        leadEmail: lead.leadEmail,
        data: stepped,
      };
    });
  }, [chartData, pageToIndex]);

  // ── Filter by selection ───────────────────────────────────────────────────
  const seriesData = React.useMemo(
    () => allSeries.filter((s) => selectedLeadIds.has(s.leadId)),
    [allSeries, selectedLeadIds]
  );

  // ── FIX: Merge all series into ONE flat data array for <LineChart> ────────
  // Recharts cannot compute the X axis domain from per-Line data props.
  // We must give a single merged dataset to <LineChart data={...}>.
  // Each row is keyed by leadId: { x: -240, demo1: 0, demo2: null, ... }
  const mergedChartData = React.useMemo(() => {
    if (!seriesData.length) return [];
    const xSet = new Set<number>();
    seriesData.forEach((s) => s.data.forEach((pt) => xSet.add(pt.x)));
    const xTicks = Array.from(xSet).sort((a, b) => a - b);

    return xTicks.map((x) => {
      const row: Record<string, number | null> = { x };
      seriesData.forEach((s) => {
        const pt = s.data.find((p) => p.x === x);
        row[s.leadId] = pt !== undefined ? pt.y : null;
      });
      return row;
    });
  }, [seriesData]);

  // ── Stroke helpers ────────────────────────────────────────────────────────
  const strokeOpacity = React.useMemo(() => {
    const count = seriesData.length;
    return count === 0 ? 0.8 : Math.max(0.2, 0.8 / Math.sqrt(count));
  }, [seriesData.length]);

  const getStrokeWidth = (count: number) => {
    if (count < 3) return 6;
    if (count < 6) return 4;
    if (count < 12) return 3;
    if (count < 20) return 2;
    return 1;
  };
  const strokeWidth = getStrokeWidth(seriesData.length);

  // ── Data loading ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    async function loadRealData() {
      setLoading(true);
      try {
        const result = await getConversionPaths({
          siteId: siteId!,
          formSubmissionIds,
          startDate,
          endDate,
          beforeSeconds,
          afterSeconds,
        });
        setChartData(result);
        setSelectedLeadIds(new Set(result.leads.map((l) => l.leadId)));
      } catch (err) {
        console.error('Real data fetch failed:', err);
        setChartData(DEMO_DATA);
        setSelectedLeadIds(new Set(DEMO_DATA.leads.map((l) => l.leadId)));
      } finally {
        setLoading(false);
      }
    }

    if (!useDemo) {
      loadRealData();
    } else {
      setTimeout(() => {
        setChartData(DEMO_DATA);
        setSelectedLeadIds(new Set(DEMO_DATA.leads.map((l) => l.leadId)));
        setLoading(false);
      }, 300);
    }
  }, [useDemo, siteId, formSubmissionIds, startDate, endDate, beforeSeconds, afterSeconds]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleToggleLock = () => setIsLocked(!isLocked);

  const handleBeforeChange = (value: number[]) => {
    if (isLocked) return;
    setBeforeSeconds(value[0]);
  };

  const handleAfterChange = (value: number[]) => {
    if (isLocked) return;
    setAfterSeconds(value[0]);
  };

  const handleIntervalChange = (value: number[]) => {
    if (isLocked) return;
    setIntervalSeconds(value[0]);
  };

  const handleLeadToggle = (leadId: string) => {
    const newSet = new Set(selectedLeadIds);
    if (newSet.has(leadId)) newSet.delete(leadId);
    else newSet.add(leadId);
    setSelectedLeadIds(newSet);
  };

  const handleSelectAll = () => {
    if (allSeries.length === selectedLeadIds.size) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(allSeries.map((s) => s.leadId)));
    }
  };

  const formatXAxis = (sec: number): string => {
    if (sec === 0) return 'Conversion';
    const absSec = Math.abs(sec);
    if (absSec < 60) return `${sec}s`;
    const mins = Math.floor(absSec / 60);
    const remainSec = absSec % 60;
    return `${sec < 0 ? '-' : ''}${mins}:${remainSec.toString().padStart(2, '0')}`;
  };

  // ── Early returns ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex justify-center items-center h-[400px]">
          <div className="animate-pulse text-muted-foreground">Loading conversion paths...</div>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || allSeries.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center text-muted-foreground">
          No conversion path data available.
        </CardContent>
      </Card>
    );
  }

  // Y axis: one tick per unique page path
  const yAxisTicks = chartData.uniquePagePaths.map((_, idx) => idx);
  const yAxisTickFormatter = (idx: number) => chartData.uniquePagePaths[idx] || '';

  // X axis: explicit ticks spaced by intervalSeconds across the window
  const xMin = -Math.abs(beforeSeconds);
  const xMax = afterSeconds;
  const xTicks: number[] = [];
  for (let t = xMin; t <= xMax; t += intervalSeconds) {
    xTicks.push(Math.round(t));
  }
  if (!xTicks.includes(0)) xTicks.push(0);
  xTicks.sort((a, b) => a - b);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Conversion Paths</CardTitle>
            <CardDescription>
              Each coloured line represents a lead&apos;s journey until form submission (time 0).
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleLock}
            title={isLocked ? 'Unlock to adjust' : 'Lock controls'}
          >
            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
        </div>

        {/* Control panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4 p-4 bg-muted/20 rounded-lg">
          <div className="space-y-2">
            <label className="text-sm font-medium">Before conversion (seconds)</label>
            <Slider
              value={[beforeSeconds]}
              min={10}
              max={600}
              step={5}
              onValueChange={handleBeforeChange}
              disabled={isLocked}
            />
            <p className="text-xs text-muted-foreground">{beforeSeconds}s before conversion</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">After conversion (seconds)</label>
            <Slider
              value={[afterSeconds]}
              min={0}
              max={120}
              step={5}
              onValueChange={handleAfterChange}
              disabled={isLocked}
            />
            <p className="text-xs text-muted-foreground">{afterSeconds}s after conversion</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">X‑axis tick interval (seconds)</label>
            <Slider
              value={[intervalSeconds]}
              min={5}
              max={120}
              step={5}
              onValueChange={handleIntervalChange}
              disabled={isLocked}
            />
            <p className="text-xs text-muted-foreground">Every {intervalSeconds}s</p>
          </div>
        </div>

        {/* Lead selection table */}
        <div className="mt-6 border rounded-md">
          <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
            <Checkbox
              checked={allSeries.length > 0 && selectedLeadIds.size === allSeries.length}
              onCheckedChange={handleSelectAll}
              id="select-all"
            />
            <label htmlFor="select-all" className="text-sm font-medium">
              Select All
            </label>
          </div>
          <div className="max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">Show</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSeries.map((series) => (
                  <TableRow key={series.leadId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeadIds.has(series.leadId)}
                        onCheckedChange={() => handleLeadToggle(series.leadId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{series.leadName}</TableCell>
                    <TableCell>{series.leadEmail || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {/*
              FIX 1: data={mergedChartData} goes on LineChart, NOT on each <Line>.
              Recharts needs a single dataset here to correctly compute the X axis scale.
              Without this, every line collapses to a single point.
            */}
            <LineChart
              data={mergedChartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
                strokeDasharray="3 3"
                vertical={false}
              />

              {/*
                FIX 2: domain is explicit [xMin, xMax] so the axis doesn't collapse.
                ticks is our pre-computed array so spacing is correct.
              */}
              <XAxis
                dataKey="x"
                type="number"
                domain={[xMin, xMax]}
                ticks={xTicks}
                tickFormatter={formatXAxis}
                label={{ value: 'Time (relative to conversion)', position: 'bottom', offset: 0 }}
                stroke="hsl(var(--border))"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />

              {/*
                FIX 3: domain is [0, uniquePagePaths.length - 1] so ALL page paths
                get their own Y slot. Previously only "/" showed because the domain
                wasn't covering all indices.
              */}
              <YAxis
                type="number"
                domain={[0, chartData.uniquePagePaths.length - 1]}
                ticks={yAxisTicks}
                tickFormatter={yAxisTickFormatter}
                width={120}
                label={{ value: 'Page', angle: -90, position: 'insideLeft' }}
                stroke="hsl(var(--border))"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />

              <Tooltip
                content={(props) => (
                  <CustomTooltip
                    {...props}
                    formatXAxis={formatXAxis}
                    uniquePagePaths={chartData.uniquePagePaths}
                  />
                )}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value: string) => <span className="text-xs">{value}</span>}
              />

              {/*
                FIX 4: dataKey={series.leadId} — each Line reads its own column
                from mergedChartData (e.g. "demo1", "demo2").
                Previously all lines used dataKey="y" which doesn't exist in
                the merged row format, so nothing rendered.

                connectNulls={true} draws through gaps (when a lead has no data
                at a given X tick).
                type="monotone" with the stepped pre-processing gives clean lines.
              */}
              {seriesData.map((series, idx) => (
                <Line
                  key={series.leadId}
                  dataKey={series.leadId}
                  name={series.leadName}
                  stroke={`hsl(${(idx * 137) % 360}, 70%, 50%)`}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  dot={false}
                  activeDot={{ r: 4 }}
                  type="linear"
                  connectNulls={true}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {seriesData.length} lead{seriesData.length !== 1 ? 's' : ''} displayed.
          Stroke width: {strokeWidth}px, opacity: {strokeOpacity.toFixed(2)}.
        </p>

        {/* PATH FREQUENCY MATRIX */}
        <div className="mt-12 border-t pt-8">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Best Converting Flows
              <span className="text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                ELITE
              </span>
            </h3>
            <p className="text-sm text-muted-foreground">Last 3 pages before form submission</p>
          </div>
          <div className="w-full sm:w-1/2">
            {pathFrequency.length > 0 ? (
              permission >= 2 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pathFrequency.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium font-mono text-sm">{item.path}</TableCell>
                        <TableCell className="text-right font-medium">{item.frequency}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                            {item.percent}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-xl border bg-muted/30 p-6 flex flex-col items-center text-center">
                  <p className="text-sm text-muted-foreground mb-1">Most common closing flow</p>
                  <p className="text-xl font-semibold font-mono">{pathFrequency[0].path}</p>
                  <p className="text-4xl font-bold text-emerald-600 mt-2">{pathFrequency[0].percent}%</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    of all {chartData.leads.length} leads ended here
                  </p>
                  <Button
                    className="mt-6"
                    onClick={() => alert('Upgrade to ELITE to unlock all 5 flows')}
                  >
                    Unlock full 5 flows in ELITE tier
                  </Button>
                  <p className="text-xs text-muted-foreground mt-4">
                    Replicate winning sequences in ads • landing pages • emails
                  </p>
                </div>
              )
            ) : (
              <p className="text-muted-foreground text-center py-8">No paths yet</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}