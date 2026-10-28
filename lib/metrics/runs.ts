// lib/metrics/runs.ts
// One row per piece of background work, for the control room (pipeline_runs, migration 29):
//   kind "leads"       a batch of new leads checked by the site's lane (lib/notifications/check.ts): marks, then hooks
//   kind "mark_apply"  a mark applied to every lead of the site after it was saved (lib/marks/evaluate.ts evaluateMark)
//   kind "other_marks" v2: the marks no live hook uses, checked for a lane's leads after the lane is released (migration 32)
// with how long each step took and the database work it did (lib/metrics/meter.ts). Writing never throws and is not
// itself counted; before migration 29 it does nothing.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Meter } from "./meter";

let client: SupabaseClient | null = null;
const db = () => (client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!));

export interface Run {
  site_id: string;
  kind: "leads" | "mark_apply" | "other_marks";
  /** leads in the batch (leads), or leads that have the mark after applying it (mark_apply) */
  leads: number;
  /** marks checked (leads), or 1 (mark_apply) */
  marks?: number;
  /** live hooks compared (leads) */
  hooks?: number;
  /** notifications made (leads) */
  fires?: number;
  /** Slack and webhook messages queued (leads) */
  deliveries?: number;
  /** how long the oldest lead of the batch waited in the queue (ms) */
  wait_ms?: number | null;
  marks_ms?: number | null;
  hooks_ms?: number | null;
  total_ms: number;
  error?: string | null;
}

export async function recordRun(run: Run, m: Meter): Promise<void> {
  try {
    const { error } = await db()
      .from("pipeline_runs")
      .insert({ ...run, db_calls: m.calls, db_ms: Math.round(m.ms), db_rows: m.rows, error: run.error ? run.error.slice(0, 300) : null });
    if (error && !/pipeline_runs/.test(error.message)) console.error("[metrics] run not recorded:", error.message);
  } catch (e) {
    console.error("[metrics] run not recorded:", e instanceof Error ? e.message : String(e));
  }
}
