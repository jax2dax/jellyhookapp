// app/platform/acquisition/page.tsx
// Acquisition: Overview (where leads come from, by platform, campaign and ad, credited to the last non-direct visit or
// first touch, with radars), Ads (the Ads library: tag, video, thumbnail per ad, used in Slack) and Set up ad tracking
// (the templates for Meta / Google / TikTok). The tab is ?tab= (components/nav/navRegistry.ts). Plan:
// mds/build/acquisition/plan.md.
import type { Metadata } from "next";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { AcquisitionView } from "@/components/acquisition/AcquisitionView";
import { AdsLibrary } from "@/components/acquisition/AdsLibrary";
import { TrackingSetup } from "@/components/acquisition/TrackingSetup";
import { navFor, resolveTab } from "@/components/nav/navRegistry";
import { listAds } from "@/lib/actions/ads.action";

export const metadata: Metadata = { title: "Acquisition" };
export const dynamic = "force-dynamic";

export default async function AcquisitionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthUser();
  await requireSite(user.id);
  const sp = (await searchParams) ?? {};
  const tab = resolveTab(navFor("/platform/acquisition")!, typeof sp.tab === "string" ? sp.tab : null, {});
  if (tab === "setup")
    return (
      <div className="p-6 pt-4">
        <TrackingSetup />
      </div>
    );
  if (tab === "ads") {
    const r = await listAds();
    return <div className="p-6 pt-4">{r.ok ? <AdsLibrary ads={r.ads} ready={r.ready} /> : <p className="text-sm text-red-600">{r.error}</p>}</div>;
  }
  return (
    <div className="space-y-4 p-6 pt-4">
      <p className="text-sm text-muted-foreground">Which platforms, campaigns and ads bring your leads, and your best ones.</p>
      <AcquisitionView />
    </div>
  );
}
