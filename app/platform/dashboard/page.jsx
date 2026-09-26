import Link from "next/link";
import { Activity, ArrowRight, Eye, Flame, Globe, Percent, Smartphone, UserCheck, Users } from "lucide-react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import {
  getActiveVisitors,
  getPageViewsLast24h,
  getTotalSessions,
  getRecentActivity,
  getDeviceBreakdown,
  getCountryBreakdown,
  getLeads,
} from "@/lib/actions/supabase.actions";
import { getSitePagesOverview } from "@/lib/actions/pagesOverview.action";
import { getIntentFailureAnalysis } from "@/lib/actions/intentFailure.action";
import { VisitsOverTimeChart } from "@/components/charts/visitsOverTime";
import { PageViewsBar } from "@/components/charts/pageViewsBar";
import { FramePlatePreviewCard } from "@/components/dashboard/FramePlatePreviewCard";
import { LiveTicker } from "@/components/dashboard/LiveTicker";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration, formatDate } from "@/lib/leadFormat";

export default async function OverviewPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  const [activeNow, pageViews24h, totalSessions, recentActivity, deviceBreakdown, countryBreakdown, leads, pages, health] = await Promise.all([
    getActiveVisitors(site.id),
    getPageViewsLast24h(site.id),
    getTotalSessions(site.id),
    getRecentActivity(site.id),
    getDeviceBreakdown(site.id),
    getCountryBreakdown(site.id),
    getLeads(site.id),
    getSitePagesOverview(site.id),
    getIntentFailureAnalysis(site.id).catch((err) => {
      console.error("[dashboard] getIntentFailureAnalysis failed:", err);
      return null;
    }),
  ]);

  const totalLeads = leads.length;
  const conversionRate = totalSessions > 0 ? (totalLeads / totalSessions) * 100 : 0;
  const totalDeviceCount = deviceBreakdown.reduce((sum, d) => sum + d.count, 0);
  const totalCountrySessions = countryBreakdown.reduce((sum, c) => sum + c.sessions, 0);

  const previewVisitorIds = Array.from(new Set(leads.map((l) => l.visitor_id).filter(Boolean)));

  const healthPages = health?.pages ?? [];
  const avgHealthScore = healthPages.length ? healthPages.reduce((s, p) => s + p.intentFailureScore, 0) / healthPages.length : null;
  const pagesNeedingAttention = health ? healthPages.filter((p) => p.intentFailureScore > health.adaptive_threshold) : [];

  return (
    <div className="min-h-screen bg-background p-6">
      {/* ── Site header ─────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{site.name || site.domain || "Overview"}</h1>
          <p className="text-sm text-muted-foreground">{site.domain}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={site.is_active ? "default" : "outline"}>{site.is_active ? "Tracking Active" : "Tracking Paused"}</Badge>
        </div>
      </div>

      {/* ── Key stats ───────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={Activity} label="Active Now" value={activeNow} sub="visitors on site right now" />
        <StatTile icon={Eye} label="Page Views (24h)" value={pageViews24h} sub="in the last day" />
        <StatTile icon={Users} label="Total Sessions" value={totalSessions} sub="all time" />
        <StatTile icon={UserCheck} label="Total Leads" value={totalLeads} sub="form submissions all time" />
        <StatTile icon={Percent} label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} sub="leads / sessions" />
      </div>

      {/* ── Visits over time + Site health ─────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VisitsOverTimeChart siteId={site.id} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-muted-foreground" /> Site Health
            </CardTitle>
            <CardDescription>How well pages are holding visitors&apos; attention.</CardDescription>
          </CardHeader>
          <CardContent>
            {!health || healthPages.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No page data yet.</div>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-foreground">{Math.round((1 - (avgHealthScore ?? 0)) * 100)}</span>
                  <span className="text-sm text-muted-foreground">/ 100 avg health</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pagesNeedingAttention.length > 0
                    ? `${pagesNeedingAttention.length} page${pagesNeedingAttention.length === 1 ? "" : "s"} need attention`
                    : "No pages currently flagged"}
                </p>
                <Link href="/platform/intent" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  View full analysis <ArrowRight className="h-3 w-3" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Pages overview: how many people are looking at each page ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Pages</CardTitle>
          <CardDescription>How many people are looking at each page — all time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {pages.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No page views recorded yet.</div>
          ) : (
            <>
              <PageViewsBar data={pages.slice(0, 10)} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Unique Visitors</TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                    <TableHead className="text-right">Avg Scroll</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((p) => (
                    <TableRow key={p.page_path}>
                      <TableCell className="text-foreground">{p.page_path}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.views}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.uniqueVisitors}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatDuration(p.avgTimeMs)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.avgScrollPct != null ? `${p.avgScrollPct}%` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Device + Country breakdown ─────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Smartphone className="h-4 w-4 text-muted-foreground" /> Devices
            </CardTitle>
            <CardDescription>Visitors by device type.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {deviceBreakdown.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No device data yet.</div>
            ) : (
              deviceBreakdown
                .sort((a, b) => b.count - a.count)
                .map((d) => {
                  const pct = totalDeviceCount ? Math.round((d.count / totalDeviceCount) * 100) : 0;
                  return (
                    <div key={d.device_type} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-sm text-foreground capitalize">{d.device_type}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-muted-foreground" /> Top Countries
            </CardTitle>
            <CardDescription>Sessions by country.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {countryBreakdown.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No location data yet.</div>
            ) : (
              countryBreakdown.slice(0, 5).map((c) => {
                const pct = totalCountrySessions ? Math.round((c.sessions / totalCountrySessions) * 100) : 0;
                return (
                  <div key={c.country} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-sm text-foreground">{c.country}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{c.sessions}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── FramePlate preview: shortcut ad for the full lead-session chart ── */}
      <FramePlatePreviewCard siteId={site.id} visitorIds={previewVisitorIds} />

      {/* ── Live ticker ─────────────────────────────────────────────── */}
      <LiveTicker siteId={site.id} initialRows={recentActivity} />

      <p className="mt-6 text-xs text-muted-foreground">Site created {formatDate(site.created_at)}</p>
    </div>
  );
}
