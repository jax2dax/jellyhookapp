import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getLeads } from "@/lib/actions/supabase.actions";
import { VisitsOverTimeChart } from "@/components/charts/visitsOverTime";
import { ReachConversionsSection } from "@/components/charts/ReachConversionsSection";
import { ActiveNowTile } from "@/components/dashboard/ActiveNowTile";
import { WindowStatTile } from "@/components/dashboard/WindowStatTile";
import { SalesSection } from "@/components/dashboard/SalesSection";
import { Badge } from "@/components/ui/badge";
import { LocalDate } from "@/components/LocalDate";
import { OnlineChart } from "@/main-chart";

export default async function OverviewPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  // The top tiles load their own numbers per time window (WindowStatTile);
  // only the data the rest of the page renders on the server is read here.
  const leads = await getLeads(site.id);

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
          allowAll
          noun="page views"
          info="Every page opened on your site in the chosen window. The arrow compares with the same length of time just before it."
        />
        <WindowStatTile
          siteId={site.id}
          metric="sessions"
          icon="users"
          label="Sessions"
          allowAll
          noun="sessions"
          info="Visits to your site that started in the chosen window (one visit can include many pages). The arrow compares with the window just before."
        />
        <WindowStatTile
          siteId={site.id}
          metric="leads"
          icon="userCheck"
          label="Leads"
          allowAll
          noun="form submissions"
          info="Forms submitted in the chosen window: every submission counts, including repeat ones from the same person. The arrow compares with the window just before."
        />
        <WindowStatTile
          siteId={site.id}
          metric="conversionRate"
          icon="percent"
          label="Conversion Rate"
          allowAll
          noun="conversions"
          info="Different people who submitted a form, divided by different people who visited, in the chosen window. Each person counts once. The change is in percentage points."
        />
      </div>

      {/* ── Reach & Conversions: new visitors and unique conversions, merged by default (Separate and Split on the
          switch). It lived on /platform/conversions; the two minis that used to sit here are gone. ── */}
      <div className="mb-6">
        <ReachConversionsSection siteId={site.id} defaultView="merged" />
      </div>

      {/* ── Sales first: hooked leads, marks, latest leads (components/dashboard/SalesSection.tsx) ── */}
      <SalesSection leads={leads} />

      {/* ── Main charts: pages online (open page views, dips when a page closes) and sessions online (start to last
          seen, does not dip when someone leaves and comes back in the same session) ── */}
      <div className="mb-6">
        <OnlineChart siteId={site.id} />
      </div>

      {/* ── Visits over time (the Hook shortcut went with the query builder, hidden 2026-10-24) ── */}
      <div className="mb-6">
        <VisitsOverTimeChart siteId={site.id} />
      </div>


      {/* Removed 2026-10-24 (founder): the Pages card (views per page) and the Lead footprints card. */}

      {/* The live ticker was removed 2026-10-24 (founder): it re-listed old page views and polled the server. */}

      <p className="mt-6 text-xs text-muted-foreground">Site created <LocalDate value={site.created_at} /></p>
    </div>
  );
}
