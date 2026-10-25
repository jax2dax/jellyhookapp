import { Suspense } from "react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { ReferrerDonutChart } from "@/components/charts/ReferrerDonutChart";
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

        {/* the converted leads first: it is what people open this page for; the charts follow */}
        <div className="mb-6">
          <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">Loading conversions…</div>}>
            <ConvertedLeadsExplorer siteId={site.id} />
          </Suspense>
        </div>

        {/* the Leads Origin radar moved to the Acquisition page (2026-10-24); the Referrers ring hides itself when there is little to show */}
        <div className="mb-6">
          <ReferrerDonutChart siteId={site.id} />
        </div>


    </div>
  );
}
