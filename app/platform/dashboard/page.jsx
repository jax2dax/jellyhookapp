import Link from "next/link";
import { ArrowRight, Eye, Flame, Percent, UserCheck, Users } from "lucide-react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getPageViewsLast24h, getTotalSessions, getRecentActivity, getLeads } from "@/lib/actions/supabase.actions";
import { getSitePagesOverview } from "@/lib/actions/pagesOverview.action";
import { getIntentFailureAnalysis } from "@/lib/actions/intentFailure.action";
import { getUniqueConversionRate } from "@/lib/actions/uniqueConversionRate.action";
import { VisitsOverTimeChart } from "@/components/charts/visitsOverTime";
import { PageViewsBar } from "@/components/charts/pageViewsBar";
import { NewReachChart } from "@/components/charts/NewReachChart";
import { ConversionsAreaChart } from "@/components/charts/ConversionsAreaChart";
import { FramePlatePreviewCard } from "@/components/dashboard/FramePlatePreviewCard";
import { ActiveNowTile } from "@/components/dashboard/ActiveNowTile";
import { LiveTicker } from "@/components/dashboard/LiveTicker";
import { StatTile } from "@/components/StatTile";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/leadFormat";
import { LocalDate } from "@/components/LocalDate";
import { MainChart } from "@/main-chart";

export default async function OverviewPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  const [pageViews24h, totalSessions, recentActivity, leads, pages, health, uniqueConversion] = await Promise.all([
    getPageViewsLast24h(site.id),
    getTotalSessions(site.id),
    getRecentActivity(site.id),
    getLeads(site.id),
    getSitePagesOverview(site.id),
    getIntentFailureAnalysis(site.id).catch((err) => {
      console.error("[dashboard] getIntentFailureAnalysis failed:", err);
      return null;
    }),
    getUniqueConversionRate(site.id),
  ]);

  const totalLeads = leads.length;

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
        <ActiveNowTile siteId={site.id} />
        <StatTile compact icon={Eye} label="Page Views (24h)" value={pageViews24h} sub="in the last day" />
        <StatTile compact icon={Users} label="Total Sessions" value={totalSessions} sub="all time" />
        <StatTile compact icon={UserCheck} label="Total Leads" value={totalLeads} sub="form submissions all time" />
        <StatTile
          compact
          icon={Percent}
          label="Conversion Rate"
          value={`${uniqueConversion.rate.toFixed(1)}%`}
          sub={`${uniqueConversion.uniqueConvertingVisitors} of ${uniqueConversion.uniqueVisitors} unique visitors`}
        />
      </div>

      {/* ── Main chart: sessions online over time ───────────────────── */}
      <div className="mb-6">
        <MainChart siteId={site.id} />
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

      {/* ── New Reach + Conversions minis — full versions live on /platform/conversions ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NewReachChart siteId={site.id} mini />
        <ConversionsAreaChart siteId={site.id} mini />
      </div>

      {/* ── Pages overview: how many people are looking at each page ── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Pages</CardTitle>
          <CardDescription>How many people are looking at each page, all time.</CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No page views recorded yet.</div>
          ) : (
            // Side by side on wide screens instead of stacked — the bar
            // chart and the table show the same data two ways, so putting
            // one above the other doubled the vertical space this card
            // needed for no real benefit.
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PageViewsBar data={pages.slice(0, 10)} />
              {/* Capped instead of growing with every page the site has —
                  scrolls internally past this height rather than pushing
                  everything below it down the page. */}
              <div className="max-h-80 overflow-y-auto lg:max-h-[22rem]">
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── FramePlate preview: shortcut ad for the full lead-session chart ── */}
      <FramePlatePreviewCard siteId={site.id} leads={leads.map((l) => ({ visitor_id: l.visitor_id, name: l.name, email: l.email }))} />

      {/* ── Live ticker ─────────────────────────────────────────────── */}
      <LiveTicker siteId={site.id} initialRows={recentActivity} />

      <p className="mt-6 text-xs text-muted-foreground">Site created <LocalDate value={site.created_at} /></p>
    </div>
  );
}
