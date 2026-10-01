import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { ConversionRateChart } from "@/components/charts/conversionRate";
import { ReachConversionsSection } from "@/components/charts/ReachConversionsSection";
import { ReferrerDonutChart } from "@/components/charts/ReferrerDonutChart";
import { LeadOriginRadarChart } from "@/components/charts/LeadOriginRadarChart";
import { ConvertedLeadsExplorer } from "@/components/leads/ConvertedLeadsExplorer";

export default async function ConversionsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Conversion Paths</h1>

        <div className="mb-6">
          <ReachConversionsSection siteId={site.id} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReferrerDonutChart siteId={site.id} />
          <LeadOriginRadarChart siteId={site.id} />
        </div>

        <div className="mb-6">
          <ConversionRateChart siteId={site.id} />
        </div>

        <ConvertedLeadsExplorer siteId={site.id} />

    </div>
  );
}
