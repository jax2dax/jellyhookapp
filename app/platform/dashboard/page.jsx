import { Activity, Eye, Users } from "lucide-react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import {
  getActiveVisitors,
  getPageViewsLast24h,
  getTotalSessions,
  getTopPages,
  getRecentActivity,
} from "@/lib/actions/supabase.actions";
import { StatTile } from "@/components/StatTile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function OverviewPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  const [activeNow, pageViews24h, totalSessions, topPages, recentActivity] = await Promise.all([
    getActiveVisitors(site.id),
    getPageViewsLast24h(site.id),
    getTotalSessions(site.id),
    getTopPages(site.id),
    getRecentActivity(site.id),
  ]);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Overview</h1>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile icon={Activity} label="Active Now" value={activeNow} sub="visitors on site right now" />
        <StatTile icon={Eye} label="Page Views (24h)" value={pageViews24h} sub="in the last day" />
        <StatTile icon={Users} label="Total Sessions" value={totalSessions} sub="all time" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Top Pages (7d)</CardTitle>
          <CardDescription>Most-viewed pages on your site over the last 7 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {topPages.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No data yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPages.map((p) => (
                  <TableRow key={p.page_path}>
                    <TableCell className="text-foreground">{p.page_path}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.views} views</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live Activity</CardTitle>
          <CardDescription>Recent page views across your site.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Entered</TableHead>
                  <TableHead className="text-right">Scroll</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivity.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-foreground">{row.page_path}</TableCell>
                    <TableCell className="text-muted-foreground">{row.visitor_id?.slice(0, 8)}...</TableCell>
                    <TableCell className="text-muted-foreground">{row.entered_at ? new Date(row.entered_at).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{row.scroll_depth != null ? `${Math.round(row.scroll_depth * 100)}%` : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
