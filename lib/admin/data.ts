// lib/admin/data.ts
// What the founder's control room (app/admin) reads, server only. Who may open it: in production only the Clerk user
// ids in DEV_USAGE_USER_IDS (comma separated), the same list as /dev/usage; in development anyone signed in. Everyone
// else gets a 404, so the page does not reveal it exists. The numbers come from the database reports of migration 29
// (jh_admin_sites, jh_admin_daily, jh_admin_now, jh_admin_latency), each one query for every site, and from
// jh_storage_report (migration 07). Design: mds/build/control-room.md.
import "server-only";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** The founder's user id, or a 404 for anyone else. */
export async function founderOrNotFound(): Promise<string> {
  const { userId } = await auth();
  if (!userId) notFound();
  const allowed = (process.env.DEV_USAGE_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (process.env.NODE_ENV === "production" && !allowed.includes(userId)) notFound();
  return userId;
}

export const PERIODS = [
  [1, "24 hours"],
  [7, "7 days"],
  [30, "30 days"],
] as const;
export const periodDays = (raw: unknown) => {
  const n = Number(raw);
  return PERIODS.some(([d]) => d === n) ? n : 7;
};

/** One site, as jh_admin_sites returns it (numbers already numbers). */
export interface SiteRow {
  site_id: string;
  domain: string | null;
  name: string | null;
  created_at: string;
  verified: boolean;
  is_active: boolean;
  last_event_at: string | null;
  members: number;
  requests: number;
  events: number;
  visits: number;
  page_views: number;
  forms: number;
  dropped: number;
  bytes_in: number;
  server_ms: number;
  db_calls: number;
  db_ms: number;
  db_rows: number;
  leads: number;
  leads_total: number;
  marks: number;
  marks_on: number;
  hooks: number;
  hooks_live: number;
  sent: number;
  failed: number;
  slack_p50_ms: number | null;
  slack_p95_ms: number | null;
  slack_max_ms: number | null;
  runs: number;
  run_leads: number;
  run_ms: number;
  run_p95_ms: number | null;
  run_wait_p95_ms: number | null;
  run_db_calls: number;
  run_db_ms: number;
  run_db_rows: number;
  run_errors: number;
  applies: number;
  apply_ms: number;
  apply_db_rows: number;
}

export interface DayRow {
  day: string;
  events: number;
  visits: number;
  page_views: number;
  forms: number;
  server_ms: number;
  db_calls: number;
  db_ms: number;
  runs: number;
  run_leads: number;
  run_ms: number;
  run_p95_ms: number | null;
  run_db_calls: number;
  sent: number;
  slack_p95_ms: number | null;
}

export interface NowRow {
  people: number;
  queue_leads: number;
  queue_oldest_ms: number | null;
  queue_parked: number;
  pending_messages: number;
  failed_messages_24h: number;
  runs_last_hour: number;
  run_errors_24h: number;
}

export interface LatencyRow {
  sent: number;
  slack_p50_ms: number | null;
  slack_p95_ms: number | null;
  slack_max_ms: number | null;
  over_30s: number;
  runs: number;
  run_p50_ms: number | null;
  run_p95_ms: number | null;
  run_max_ms: number | null;
}

/** Postgres bigint and numeric arrive as strings or numbers: every field that looks numeric becomes a number. */
function numbers<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && !k.endsWith("_id") && k !== "day" ? Number(v) : v;
  return out as T;
}

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const notReady = (msg: string) => /jh_admin_|pipeline_runs|does not exist|schema cache/.test(msg);

export type Overview =
  | { ready: true; sites: SiteRow[]; daily: DayRow[]; now: NowRow; latency: LatencyRow; storage: { table_name: string; approx_rows: number; total_bytes: number }[] }
  | { ready: false; error: string };

export async function loadOverview(days: number): Promise<Overview> {
  const [sites, daily, now, latency, storage] = await Promise.all([
    db.rpc("jh_admin_sites", { p_since: since(days) }),
    db.rpc("jh_admin_daily", { p_site: null, p_days: Math.max(days, 7) }),
    db.rpc("jh_admin_now"),
    db.rpc("jh_admin_latency", { p_since: since(days) }),
    db.rpc("jh_storage_report"),
  ]);
  const err = sites.error ?? daily.error ?? now.error ?? latency.error;
  if (err) return { ready: false, error: notReady(err.message) ? "The control room needs mds/migrations/29-control-room.sql. Run it in Supabase, then reload." : err.message };
  return {
    ready: true,
    sites: (sites.data ?? []).map((r: Record<string, unknown>) => numbers<SiteRow>(r)),
    daily: (daily.data ?? []).map((r: Record<string, unknown>) => numbers<DayRow>(r)),
    now: numbers<NowRow>((now.data ?? [])[0] ?? {}),
    latency: numbers<LatencyRow>((latency.data ?? [])[0] ?? {}),
    storage: ((storage.data ?? []) as Record<string, unknown>[]).map((r) => numbers<{ table_name: string; approx_rows: number; total_bytes: number }>(r)),
  };
}

export interface RunRow {
  id: number;
  kind: "leads" | "mark_apply";
  leads: number;
  marks: number;
  hooks: number;
  fires: number;
  deliveries: number;
  wait_ms: number | null;
  marks_ms: number | null;
  hooks_ms: number | null;
  total_ms: number;
  db_calls: number;
  db_ms: number;
  db_rows: number;
  error: string | null;
  created_at: string;
}

export type SiteDetail =
  | {
      ready: true;
      site: SiteRow;
      daily: DayRow[];
      runs: RunRow[];
      marks: { id: string; name: string; active: boolean; rule: unknown; source: string | null; created_by_email: string | null }[];
      hooks: { id: string; name: string; active: boolean; mark_ids: string[]; channel_ids: string[] }[];
    }
  | { ready: false; error: string };

export async function loadSite(siteId: string, days: number): Promise<SiteDetail> {
  const [sites, daily, runs, marks, hooks] = await Promise.all([
    db.rpc("jh_admin_sites", { p_since: since(days) }),
    db.rpc("jh_admin_daily", { p_site: siteId, p_days: Math.max(days, 7) }),
    db.from("pipeline_runs").select("*").eq("site_id", siteId).order("created_at", { ascending: false }).limit(50),
    db.from("marks").select("id, name, active, rule, source, created_by_email").eq("site_id", siteId).eq("kind", "lead").order("created_at"),
    db.from("notification_rules").select("id, name, active, mark_ids, channel_ids").eq("site_id", siteId).order("created_at"),
  ]);
  const err = sites.error ?? daily.error ?? runs.error;
  if (err) return { ready: false, error: notReady(err.message) ? "The control room needs mds/migrations/29-control-room.sql. Run it in Supabase, then reload." : err.message };
  const site = (sites.data ?? []).map((r: Record<string, unknown>) => numbers<SiteRow>(r)).find((s: SiteRow) => s.site_id === siteId);
  if (!site) return { ready: false, error: "No such site (or it was deleted)." };
  return {
    ready: true,
    site,
    daily: (daily.data ?? []).map((r: Record<string, unknown>) => numbers<DayRow>(r)),
    runs: ((runs.data ?? []) as Record<string, unknown>[]).map((r) => numbers<RunRow>(r)),
    marks: (marks.data ?? []) as SiteDetail extends { ready: true; marks: infer M } ? M : never,
    hooks: (hooks.data ?? []) as SiteDetail extends { ready: true; hooks: infer H } ? H : never,
  };
}
