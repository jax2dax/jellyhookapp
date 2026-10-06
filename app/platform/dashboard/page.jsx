import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getRecentActivity, getLeads } from "@/lib/actions/supabase.actions";
import { getSitePagesOverview } from "@/lib/actions/pagesOverview.action";
import { VisitsOverTimeChart } from "@/components/charts/visitsOverTime";
import { PageViewsBar } from "@/components/charts/pageViewsBar";
import { NewReachChart } from "@/components/charts/NewReachChart";
import { ConversionsAreaChart } from "@/components/charts/ConversionsAreaChart";
import { FramePlatePreviewCard } from "@/components/dashboard/FramePlatePreviewCard";
import { ActiveNowTile } from "@/components/dashboard/ActiveNowTile";
import { LiveTicker } from "@/components/dashboard/LiveTicker";
import { WindowStatTile } from "@/components/dashboard/WindowStatTile";
import { HookShortcutCard } from "@/components/dashboard/HookShortcutCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDuration } from "@/lib/leadFormat";
import { LocalDate } from "@/components/LocalDate";
import { MainChart } from "@/main-chart";

export default async function OverviewPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  // The top tiles load their own numbers per time window (WindowStatTile);
  // only the data the rest of the page renders on the server is read here.
  const [recentActivity, leads, pages] = await Promise.all([getRecentActivity(site.id), getLeads(site.id), getSitePagesOverview(site.id)]);

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

      {/* ── Key stats: each tile has its own time window and the change vs the window before ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
        <ActiveNowTile siteId={site.id} />
        <WindowStatTile
          siteId={site.id}
          metric="pageViews"
          icon="eye"
          label="Page Views"
          noun="page views"
          info="Every page opened on your site in the chosen window. The arrow compares with the same length of time just before it."
        />
        <WindowStatTile
          siteId={site.id}
          metric="sessions"
          icon="users"
          label="Sessions"
          noun="sessions"
          info="Visits to your site that started in the chosen window (one visit can include many pages). The arrow compares with the window just before."
        />
        <WindowStatTile
          siteId={site.id}
          metric="leads"
          icon="userCheck"
          label="Leads"
          noun="form submissions"
          info="Forms submitted in the chosen window: every submission counts, including repeat ones from the same person. The arrow compares with the window just before."
        />
        <WindowStatTile
          siteId={site.id}
          metric="conversionRate"
          icon="percent"
          label="Conversion Rate"
          noun="conversions"
          info="Different people who submitted a form, divided by different people who visited, in the chosen window. Each person counts once. The change is in percentage points."
        />
      </div>

      {/* ── Main chart: sessions online over time ───────────────────── */}
      <div className="mb-6">
        <MainChart siteId={site.id} />
      </div>

      {/* ── Visits over time + the Hook shortcut (replaced Site Health) ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VisitsOverTimeChart siteId={site.id} />
        </div>
        <HookShortcutCard />
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
