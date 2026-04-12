//components/charts/lineConversionPath.tsx
'use client';
/*
and lib.analytics, there might be more on the page commented out lib fetch  */
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
// Demo data (extended)
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
// Custom Tooltip (shadcn style)
// ------------------------------------------------------------------
const CustomTooltip = ({ active, payload, label, formatXAxis, uniquePagePaths }: any) => {
  if (!active || !payload || !payload.length) return null;
  const timeStr = formatXAxis(label);
  const pagePath = uniquePagePaths[payload[0]?.value] || 'Unknown';
  return (
    <div className="rounded-lg border bg-background p-2 shadow-md text-sm">
      <p className="font-medium">{timeStr}</p>
      <p className="text-muted-foreground">Page: {pagePath}</p>
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component — FINAL CLEAN VERSION (no type errors)
// ------------------------------------------------------------------
interface ConversionPathsChartProps {
  siteId?: string;
  formSubmissionIds?: string[];
  startDate?: Date;
  endDate?: Date;
  useDemo?: boolean;
  permission?: number;           // 0 = Free/PRO, 2 = ELITE
}

export function ConversionPathsChart({
  siteId,
  formSubmissionIds,
  startDate,
  endDate,
  useDemo = true,
  permission = 0,                // ← default to free tier (shows teaser)
}: ConversionPathsChartProps) {
  // ---------- State ----------
  const [chartData, setChartData] = React.useState<ConversionPathsResult | null>(null);
  const [loading, setLoading] = React.useState(true);

  // User controls
  const [beforeSeconds, setBeforeSeconds] = React.useState<number | 'auto'>(120);
  const [afterSeconds, setAfterSeconds] = React.useState<number>(30);
  const [intervalSeconds, setIntervalSeconds] = React.useState<number>(10);
  const [isLocked, setIsLocked] = React.useState(false);

  // Lead selection
  const [selectedLeadIds, setSelectedLeadIds] = React.useState<Set<string>>(new Set());

  // ---------- Derived data ----------
  const pageToIndex = React.useMemo(() => {
    if (!chartData) return new Map<string, number>();
    const map = new Map<string, number>();
    chartData.uniquePagePaths.forEach((path: string, idx: number) => map.set(path, idx));
    return map;
  }, [chartData]);

  // ====================== PATH FREQUENCY MATRIX (Last 3 pages) ======================
  const pathFrequency = React.useMemo(() => {
    if (!chartData) return [];

    const map = new Map<string, number>();

    chartData.leads.forEach((lead) => {
      let path = lead.pageViews.map((pv) => pv.pagePath);

      // Collapse consecutive duplicate pages (cleaner funnel)
      const cleanPath: string[] = [];
      for (const p of path) {
        if (cleanPath[cleanPath.length - 1] !== p) cleanPath.push(p);
      }
      path = cleanPath;

      // Last 3 pages before conversion
      const last3 = path.length >= 3 ? path.slice(-3) : path;
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

  // All possible series (unfiltered)
  const allSeries = React.useMemo(() => {
    if (!chartData) return [];
    return chartData.leads.map((lead: LeadPathData, leadIdx: number) => {
      const points = lead.pageViews.map((pv: PageViewRelative) => ({
        x: pv.relativeTimeSec,
        y: pageToIndex.get(pv.pagePath) ?? 0,
        pagePath: pv.pagePath,
      }));
      points.sort((a, b) => a.x - b.x);
      return {
        leadId: lead.leadId,
        leadName: lead.leadName || `Lead ${leadIdx + 1}`,
        leadEmail: lead.leadEmail,
        data: points,
      };
    });
  }, [chartData, pageToIndex]);

  // Filter by selected leads
  const seriesData = React.useMemo(() => {
    return allSeries.filter((series) => selectedLeadIds.has(series.leadId));
  }, [allSeries, selectedLeadIds]);

  // Opacity based on number of selected leads
  const strokeOpacity = React.useMemo(() => {
    const count = seriesData.length;
    if (count === 0) return 0.8;
    return Math.max(0.2, 0.8 / Math.sqrt(count));
  }, [seriesData.length]);

  // Dynamic stroke width based on selected lead count
  const getStrokeWidth = (count: number): number => {
    if (count < 3) return 6;
    if (count < 6) return 4;
    if (count < 12) return 3;
    if (count < 20) return 1;
    return 0.6;
  };
  const strokeWidth = getStrokeWidth(seriesData.length);

  // ---------- Data loading (demo or real) ----------
  React.useEffect(() => {
    // For now, using demo data:
    setTimeout(() => {
      setChartData(DEMO_DATA);
      setSelectedLeadIds(new Set(DEMO_DATA.leads.map((l) => l.leadId)));
      setLoading(false);
    }, 300);
    
    // ------------------------------------------------------------------
// REAL BACKEND FETCH (uncomment when ready)
// ------------------------------------------------------------------
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
    setSelectedLeadIds(new Set(result.leads.map(l => l.leadId)));
  } catch (err) {
    console.error('Real data fetch failed:', err);
    // Fallback to demo if needed
    setChartData(DEMO_DATA);
    setSelectedLeadIds(new Set(DEMO_DATA.leads.map(l => l.leadId)));
  } finally {
    setLoading(false);
  }
}

if (!useDemo) {
  loadRealData();
} else {
  // Demo mode
  setTimeout(() => {
    setChartData(DEMO_DATA);
    setSelectedLeadIds(new Set(DEMO_DATA.leads.map(l => l.leadId)));
    setLoading(false);
  }, 300);
}
     
  }, [useDemo, siteId, formSubmissionIds, startDate, endDate, beforeSeconds, afterSeconds]);
  

  // ---------- Handlers ----------
  const handleToggleLock = () => setIsLocked(!isLocked);

  const handleBeforeChange = (value: number[]) => {
    if (isLocked) return;
    setBeforeSeconds(value[0]);
    if (chartData) {
      const newMin = typeof beforeSeconds === 'number' ? -Math.abs(value[0]) : chartData.globalMinX;
      setChartData({ ...chartData, globalMinX: newMin });
    }
  };

  const handleAfterChange = (value: number[]) => {
    if (isLocked) return;
    setAfterSeconds(value[0]);
    if (chartData) setChartData({ ...chartData, globalMaxX: value[0] });
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

  // Format X axis
  const formatXAxis = (sec: number): string => {
    if (sec === 0) return 'Conversion';
    const absSec = Math.abs(sec);
    if (absSec < 60) return `${sec}s`;
    const mins = Math.floor(absSec / 60);
    const remainSec = absSec % 60;
    return `${sec < 0 ? '-' : ''}${mins}:${remainSec.toString().padStart(2, '0')}`;
  };

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

  const yAxisTicks: number[] = chartData.uniquePagePaths.map((_: string, idx: number) => idx);
  const yAxisTickFormatter = (idx: number): string => chartData.uniquePagePaths[idx] || '';

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
              value={[typeof beforeSeconds === 'number' ? beforeSeconds : 120]}
              min={10}
              max={600}
              step={5}
              onValueChange={handleBeforeChange}
              disabled={isLocked}
            />
            <p className="text-xs text-muted-foreground">
              {typeof beforeSeconds === 'number' ? `${beforeSeconds}s before conversion` : 'Auto (full session)'}
            </p>
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
            <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.5} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={[chartData.globalMinX, chartData.globalMaxX]}
                tickFormatter={formatXAxis}
                tickCount={Math.min(10, Math.ceil((chartData.globalMaxX - chartData.globalMinX) / intervalSeconds))}
                label={{ value: 'Time (relative to conversion)', position: 'bottom', offset: 0 }}
                 stroke="hsl(var(--border))"
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
              />
              <YAxis
                dataKey="y"
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

              {seriesData.map((series, idx) => (
                <Line
                  key={series.leadId}
                  data={series.data}
                  dataKey="y"
                  name={series.leadName}
                  stroke={`hsl(${(idx * 137) % 360}, 70%, 50%)`}
                  strokeWidth={strokeWidth}
                  strokeOpacity={strokeOpacity}
                  dot={false}
                  activeDot={{ r: 4 }}
                  type="monotone"
                  connectNulls={false}
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

        {/* PATH FREQUENCY MATRIX — THE MONEY FEATURE */}
        <div className="mt-12 border-t pt-8">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              Best Converting Flows
              <span className="text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">ELITE</span>
            </h3>
            <p className="text-sm text-muted-foreground">Last 3 pages before form submission</p>
          </div>
                <div className='w-full sm:w-1/2'>
          {pathFrequency.length > 0 ? (
            permission >= 2 ? (
              // ELITE — full ranked list
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
                      <TableCell className="font-medium font-mono text-sm">
                        {item.path}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.frequency}
                      </TableCell>
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
              // PRO / lower — teaser (only top 1)
              <div className="rounded-xl border bg-muted/30 p-6 flex flex-col items-center text-center ">
                <p className="text-sm text-muted-foreground mb-1">Most common closing flow</p>
                <p className="text-xl font-semibold font-mono">
                  {pathFrequency[0].path}
                </p>
                <p className="text-4xl font-bold text-emerald-600 mt-2">
                  {pathFrequency[0].percent}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  of all {chartData.leads.length} leads ended here
                </p>
                <Button
                  className="mt-6"
                  onClick={() => {
                    // TODO: replace with your upgrade modal / Stripe link
                    alert('Upgrade to ELITE to unlock all 5 flows');
                  }}
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