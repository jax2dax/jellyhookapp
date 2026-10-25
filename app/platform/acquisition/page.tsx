// app/platform/acquisition/page.tsx
// Acquisition (rebuilt 2026-10-24): where leads come from, by platform, campaign and ad, with the credit given to the
// last non-direct visit (or first touch). The old "sessions by referrer" page and the conversions page's Leads Origin
// radar are replaced by this. Body: components/acquisition/AcquisitionView.tsx. Plan: mds/build/acquisition/plan.md.
import type { Metadata } from "next";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { AcquisitionView } from "@/components/acquisition/AcquisitionView";

export const metadata: Metadata = { title: "Acquisition" };

export default async function AcquisitionPage() {
  const user = await getAuthUser();
  await requireSite(user.id);
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Acquisition</h1>
        <p className="text-sm text-muted-foreground">Which platforms, campaigns and ads bring your leads, and your best ones.</p>
      </div>
      <AcquisitionView />
    </div>
  );
}
