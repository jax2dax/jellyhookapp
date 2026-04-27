//   platform/dashboard/page.jsx   **This is the file you gave me , and I want to integrate it with native dashboard from shadcn 
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import {
  getActiveVisitors,
  getPageViewsLast24h,
  getTotalSessions,
  getTopPages,
  getRecentActivity,
} from "@/lib/actions/supabase.actions";
import SiteSelector from "@/components/SiteSelector";
export default async function OverviewPage() {
  // Auth + site required for this page
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  // Fetch all overview data in parallel
  const [activeNow, pageViews24h, totalSessions, topPages, recentActivity] =
    await Promise.all([
      getActiveVisitors(site.id),
      getPageViewsLast24h(site.id),
      getTotalSessions(site.id),
      getTopPages(site.id),
      getRecentActivity(site.id),
    ]);

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#ddd", background: "#0a0a0a", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontSize: 18, marginBottom: 24 }}>Overview</h1>

      {/* STAT CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Active Now", value: activeNow, color: "#4ade80" },
          { label: "Page Views (24h)", value: pageViews24h, color: "#7dd3fc" },
          { label: "Total Sessions", value: totalSessions, color: "#c4b5fd" },
        ].map((card) => (
          <div key={card.label} style={{
            padding: 20,
            background: "#111",
            border: "1px solid #1a1a1a",
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: "bold", color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>
          <SiteSelector />
      {/* TOP PAGES */}
      <h2 style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Top Pages (7d)</h2>
      <div style={{ border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden", marginBottom: 32 }}>
        {topPages.length === 0 && (
          <div style={{ padding: 16, color: "#333" }}>No data yet.</div>
        )}
        {topPages.map((p) => (
          <div key={p.page_path} style={{
            display: "flex", justifyContent: "space-between",
            padding: "8px 16px", borderBottom: "1px solid #1a1a1a",
          }}>
            <span style={{ color: "#7dd3fc" }}>{p.page_path}</span>
            <span style={{ color: "#555" }}>{p.views} views</span>
          </div>
        ))}
      </div>

      {/* LIVE FEED */}
      <h2 style={{ fontSize: 13, color: "#888", marginBottom: 12 }}>Live Activity</h2>
      <div style={{ border: "1px solid #1a1a1a", borderRadius: 6, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
          padding: "6px 16px", background: "#111", color: "#555", fontSize: 11,
          borderBottom: "1px solid #1a1a1a",
        }}>
          <div>Page</div><div>Visitor</div><div>Entered</div><div>Scroll</div>
        </div>
        {recentActivity.map((row) => (
          <div key={row.id} style={{
            display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
            padding: "7px 16px", borderBottom: "1px solid #111", fontSize: 12,
          }}>
            <span style={{ color: "#7dd3fc" }}>{row.page_path}</span>
            <span style={{ color: "#555" }}>{row.visitor_id?.slice(0, 8)}...</span>
            <span>{row.entered_at ? new Date(row.entered_at).toLocaleTimeString() : "—"}</span>
            <span>{row.scroll_depth != null ? `${Math.round(row.scroll_depth * 100)}%` : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// ** confirm there are no bugs and then we move on into changing this manual side bar to shadcns sidebar-8 
/* 

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default function Page() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-vertical:h-4 data-vertical:self-auto"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Build Your Application
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
            <div className="aspect-video rounded-xl bg-muted/50" />
          </div>
          <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
*/ 