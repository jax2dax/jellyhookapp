import { Suspense } from "react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { ReachConversionsSection } from "@/components/charts/ReachConversionsSection";
import { ReferrerDonutChart } from "@/components/charts/ReferrerDonutChart";
import { LeadOriginRadarChart } from "@/components/charts/LeadOriginRadarChart";
import { ConvertedLeadsExplorer } from "@/components/leads/ConvertedLeadsExplorer";

export default async function ConversionsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Conversions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Each card shows the path a lead actually took, start of session through the moment they converted.</p>
      </header>

        <div className="mb-6">
          <Suspense fallback={null}>
            <ReachConversionsSection siteId={site.id} />
          </Suspense>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReferrerDonutChart siteId={site.id} />
          <LeadOriginRadarChart siteId={site.id} />
        </div>

        <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Loading conversions…</div>}>
          <ConvertedLeadsExplorer siteId={site.id} />
        </Suspense>

    </div>
  );
}
