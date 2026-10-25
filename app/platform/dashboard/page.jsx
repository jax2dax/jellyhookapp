import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getLeads } from "@/lib/actions/supabase.actions";
import { VisitsOverTimeChart } from "@/components/charts/visitsOverTime";
import { ReachConversionsSection } from "@/components/charts/ReachConversionsSection";
import { ActiveNowTile } from "@/components/dashboard/ActiveNowTile";
import { WindowStatTile } from "@/components/dashboard/WindowStatTile";
import { SalesSection } from "@/components/dashboard/SalesSection";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { LocalDate } from "@/components/LocalDate";
import { OnlineChart } from "@/main-chart";

// The dashboard, top to bottom (renovated 2026-10-25 for sales teams):
//   the site and its tracking status; five numbers; who to call (hooked leads, marks, latest leads); traffic.
export default async function OverviewPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  // The top tiles load their own numbers per time window (WindowStatTile);
  // only the data the rest of the page renders on the server is read here.
  const leads = await getLeads(site.id);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-[1400px]">
        {/* ── The site and its tracking status ── */}
        <DashboardHeader name={site.name} domain={site.domain} active={!!site.is_active} />

        {/* ── Key numbers: each tile has its own time window and the change vs the window before ── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ActiveNowTile siteId={site.id} />
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
            label="Conversion rate"
            allowAll
            noun="conversions"
            info="Different people who submitted a form, divided by different people who visited, in the chosen window. Each person counts once. The change is in percentage points."
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
            metric="pageViews"
            icon="eye"
            label="Page views"
            allowAll
            noun="page views"
            info="Every page opened on your site in the chosen window. The arrow compares with the same length of time just before it."
          />
        </div>

        {/* ── Who to call: hooked leads, marks, latest leads (components/dashboard/SalesSection.tsx) ── */}
        <SalesSection leads={leads} />

        {/* ── Traffic: new visitors and conversions, who is on the site, visits over time ── */}
        <section aria-labelledby="traffic" className="mt-10 space-y-6">
          <div>
            <h2 id="traffic" className="text-sm font-semibold text-foreground">
              Traffic
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Who came to the site, who converted, and who is on it now.</p>
          </div>

          {/* Reach & Conversions: new visitors and unique conversions, merged by default (Separate and Split on the switch) */}
          <ReachConversionsSection siteId={site.id} defaultView="merged" />

          {/* pages online (open page views, dips when a page closes) and sessions online (start to last seen) */}
          <OnlineChart siteId={site.id} />

          {/* visits over time (the Hook shortcut went with the query builder, hidden 2026-10-24) */}
          <VisitsOverTimeChart siteId={site.id} />
        </section>

        {/* Removed 2026-10-24 (founder): the Pages card (views per page), the Lead footprints card and the live ticker. */}

        <p className="mt-8 text-xs text-muted-foreground">
          Site created <LocalDate value={site.created_at} />
        </p>
      </div>
    </div>
  );
}
