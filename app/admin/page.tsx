// app/admin/page.tsx
// The founder's control room: every site on Jellyhook, its traffic, leads, marks and hooks, how fast leads reach Slack,
// the work it all causes and what it costs (components/admin/ControlRoomView.tsx). Only the founder may open it
// (lib/admin/data.ts founderOrNotFound): anyone else gets a 404. ?days=1|7|30. Design: mds/build/control-room.md.
import type { Metadata } from "next";
import { founderOrNotFound, loadOverview, periodDays } from "@/lib/admin/data";
import { pricesFromEnv } from "@/lib/metrics/costs";
import { ControlRoomView } from "@/components/admin/ControlRoomView";

export const metadata: Metadata = { title: "Control room", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ControlRoomPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await founderOrNotFound();
  const days = periodDays((await searchParams)?.days);
  const data = await loadOverview(days);
  if (!data.ready) return <p className="p-6 text-sm text-red-600">{data.error}</p>;
  return <ControlRoomView data={data} days={days} prices={pricesFromEnv()} />;
}
