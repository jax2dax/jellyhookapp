// app/admin/sites/[id]/page.tsx
// One site in the founder's control room (components/admin/SiteView.tsx). Founder only (404 for anyone else).
import type { Metadata } from "next";
import { founderOrNotFound, loadOverview, loadSite, periodDays } from "@/lib/admin/data";
import { allocate, pricesFromEnv } from "@/lib/metrics/costs";
import { SiteView } from "@/components/admin/SiteView";

export const metadata: Metadata = { title: "Site · Control room", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ControlRoomSitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await founderOrNotFound();
  const { id } = await params;
  const days = periodDays((await searchParams)?.days);
  const [data, all] = await Promise.all([loadSite(id, days), loadOverview(days)]);
  if (!data.ready) return <p className="p-6 text-sm text-red-600">{data.error}</p>;
  // its share of the plans needs every site's work
  const monthlyUsd = all.ready ? (allocate(all.sites, pricesFromEnv(), days).bySite.get(id)?.monthlyUsd ?? null) : null;
  return <SiteView data={data} days={days} monthlyUsd={monthlyUsd} base={`/admin/sites/${id}`} />;
}
