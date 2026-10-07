// app/dev/usage/page.tsx
// Developer page: what a site really "burns" per event, what that costs the
// database, and how to set event limits from it. Replaces the event-limit
// number that used to be shown in Settings.
//
// Access: in development anyone signed in; in production only the Clerk user
// ids listed in the DEV_USAGE_USER_IDS environment variable (comma separated),
// everyone else gets a 404. The numbers are per site (the site you have
// selected); the table sizes are database-wide aggregates, never row data.
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getUserSite } from "@/lib/actions/permission.actions";
import { sumUsage, bytesPerRow, visitorsPerSession, storagePerEvent, queriesPerEvent } from "@/lib/tracking/costModel";
import { usageDaysAgo } from "@/lib/tracking/usage";
import { UsageLab } from "@/components/dev/UsageLab";

export const dynamic = "force-dynamic";

const DAYS = 30;
const COLUMN_TABLES = ["visitors", "page_views", "sessions", "sites", "click_events", "page_structure_versions"];

export default async function UsagePage() {
  const { userId } = await auth();
  if (!userId) notFound();
  const allowed = (process.env.DEV_USAGE_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (process.env.NODE_ENV === "production" && !allowed.includes(userId)) notFound();

  const site = (await getUserSite(userId)) as { id?: string; domain?: string; __pendingInvite?: boolean } | null;
  if (!site || site.__pendingInvite || !site.id) {
    return <div className="p-8 text-sm">No site selected.</div>;
  }

  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const since = usageDaysAgo(DAYS);

  const [usageRes, storageRes, columnRes] = await Promise.all([
    admin.from("site_usage_daily").select("*").eq("site_id", site.id).gte("day", since).order("day", { ascending: false }),
    admin.rpc("jh_storage_report"),
    admin.rpc("jh_column_report", { p_tables: COLUMN_TABLES }),
  ]);

  const days = (usageRes.data ?? []) as Array<Record<string, number | string>>;
  const storage = (storageRes.data ?? []) as Array<{ table_name: string; approx_rows: number | string; total_bytes: number | string; table_bytes: number | string; index_bytes: number | string }>;
  const columns = (columnRes.data ?? []) as Array<{ table_name: string; column_name: string; avg_bytes: number; null_fraction: number }>;

  const totals = sumUsage(days);
  const perRow = bytesPerRow(storage);
  const model = storagePerEvent(totals, perRow, visitorsPerSession(storage));

  return (
    <UsageLab
      domain={site.domain ?? ""}
      days={days.map((d) => ({
        day: String(d.day),
        requests: Number(d.requests) || 0,
        events: Number(d.events) || 0,
        session_starts: Number(d.session_starts) || 0,
        page_view_starts: Number(d.page_view_starts) || 0,
        page_view_ends: Number(d.page_view_ends) || 0,
        clicks: Number(d.clicks) || 0,
        forms: Number(d.forms) || 0,
        engagement: Number(d.engagement) || 0,
        structure: Number(d.structure) || 0,
        dropped: Number(d.dropped) || 0,
        bytes_in: Number(d.bytes_in) || 0,
      }))}
      totals={totals}
      model={model}
      queriesPerEvent={queriesPerEvent(totals)}
      storage={storage.map((r) => ({ table_name: r.table_name, approx_rows: Number(r.approx_rows), total_bytes: Number(r.total_bytes), table_bytes: Number(r.table_bytes), index_bytes: Number(r.index_bytes) }))}
      columns={columns}
      storageAvailable={!storageRes.error}
      usageAvailable={!usageRes.error}
    />
  );
}
