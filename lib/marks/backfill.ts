// lib/marks/backfill.ts
// Checking a mark against PAST leads, in the background (v3, mds/build/marks/when-marks-run.md). Before v3 a mark was
// checked against every lead of the site inside the save: the person waited, and on a big site the save could fail
// (crowd test v1, variant 7). Now:
//   - the save only records what to check (startBackfill): which past leads (the person's choice), and a new run number;
//   - a runner (runBackfill) checks them newest first, 100 leads at a time, with the same checker as new leads
//     (evaluate.ts evaluateLeads, only this mark), and records how far it got after every chunk, so it can stop
//     anywhere and continue later;
//   - one runner per mark (a lease of 90 s, freed by itself if the runner dies);
//   - the hook lane goes first: a runner stops when its site has new leads waiting (lib/notifications/check.ts) and
//     continues later, so past leads never slow a Slack message;
//   - it is started right after the save (after()), continued by the drainer (app/api/jobs/drain, every few seconds)
//     and by the leads page while it shows progress (markProgress).
// A rule edit makes a new version: the old results are deleted at once, and a runner still busy with the old version
// deletes the chunk it was writing and follows the new one. Needs migration 33; before it, the callers fall back to
// evaluateMark (the old check inside the save).
import "server-only";
import { meteredAdmin } from "@/lib/db/admin";
import { evaluateLeads } from "./evaluate";
import { metered, newMeter } from "@/lib/metrics/meter";
import { recordRun } from "@/lib/metrics/runs";
import type { MarkCheck } from "./coverage";

const admin = meteredAdmin();

const CHUNK = 100;
const LEASE_MS = 90_000;
const MAX_FAILURES = 5;
/** a short pause between chunks, so a big check of past leads leaves room for everything else on the database */
const PAUSE_MS = 150;

const log = (msg: string, extra: Record<string, unknown> = {}) => console.error("[marks backfill] " + msg, extra);

/** The v3 columns are not there yet (migration 33 not run). */
export const v3Missing = (msg: string | undefined) => !!msg && /rule_version|checked_from|off_since|backfill_/.test(msg);
export class V3MissingError extends Error {}

export const CHECK_COLS = "rule_version, checked_from, off_since, backfill_state, backfill_run, backfill_from, backfill_until, backfill_cursor_at, backfill_cursor_id, backfill_total, backfill_done, backfill_lease, backfill_failures, backfill_error";

/** A mark row's checks, for the screens (null before migration 33). */
export function checkOf(r: Record<string, unknown>): MarkCheck | null {
  if (!("rule_version" in r)) return null;
  return {
    from: (r.checked_from as string) ?? null,
    offSince: (r.off_since as string) ?? null,
    state: (r.backfill_state as MarkCheck["state"]) ?? null,
    until: (r.backfill_until as string) ?? null,
    cursorAt: (r.backfill_cursor_at as string) ?? null,
    total: (r.backfill_total as number) ?? null,
    done: (r.backfill_done as number) ?? 0,
    error: (r.backfill_error as string) ?? null,
  };
}

/** How many leads of the site were sent at or after `from` (all when null), up to now. */
export async function countLeadsSince(siteId: string, from: string | null): Promise<number> {
  let q = admin.from("form_submissions").select("id", { count: "exact", head: true }).eq("site_id", siteId);
  if (from) q = q.gte("submitted_at", from);
  const { count, error } = await q;
  if (error) throw new Error("count: " + error.message);
  return count ?? 0;
}

/**
 * Records a new check of the mark's past leads (sent at or after `from`; null = all) and returns how many there are.
 * `newVersion`: the rule changed, so the old results are deleted first and the count starts from 0. `from` "none" (a
 * time equal to now) gives an empty check: only new leads. The mark must be on; nothing runs here: call runBackfill
 * (after the response) to start it. Throws V3MissingError before migration 33.
 */
export async function startBackfill(siteId: string, markId: string, from: string | null, newVersion: boolean): Promise<number> {
  const { data: m, error } = await admin.from("marks").select("rule_version, backfill_run").eq("id", markId).eq("site_id", siteId).maybeSingle();
  if (error) throw v3Missing(error.message) ? new V3MissingError(error.message) : new Error(error.message);
  if (!m) throw new Error("mark not found");
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (newVersion) {
    const { error: delErr } = await admin.from("lead_marks").delete().eq("mark_id", markId);
    if (delErr) throw new Error("lead_marks delete: " + delErr.message);
    Object.assign(patch, { rule_version: (m.rule_version as number) + 1, match_count: 0, evaluated_at: now });
  }
  const empty = !!from && Date.parse(from) >= Date.now() - 1000;
  const total = empty ? 0 : await countLeadsSince(siteId, from);
  Object.assign(patch, {
    checked_from: from,
    off_since: null,
    backfill_state: total ? "running" : "done",
    backfill_run: (m.backfill_run as number) + 1,
    backfill_from: from,
    backfill_until: now,
    backfill_cursor_at: null,
    backfill_cursor_id: null,
    backfill_total: total,
    backfill_done: 0,
    backfill_failures: 0,
    backfill_error: null,
  });
  const { error: upErr } = await admin.from("marks").update(patch).eq("id", markId);
  if (upErr) throw new Error(upErr.message);
  return total;
}

/** Turned off: new leads are not checked from now, and a check of past leads still running stops where it is. */
export async function stopChecks(markId: string): Promise<void> {
  const { error } = await admin.from("marks").update({ off_since: new Date().toISOString() }).eq("id", markId);
  if (error) throw v3Missing(error.message) ? new V3MissingError(error.message) : new Error(error.message);
  await admin.from("marks").update({ backfill_state: "stopped", backfill_lease: null }).eq("id", markId).eq("backfill_state", "running");
}

/** The rule changed while the mark is off: old results go, nothing is checked until it is turned on. */
export async function clearResults(markId: string): Promise<void> {
  const { data: m, error } = await admin.from("marks").select("rule_version").eq("id", markId).maybeSingle();
  if (error) throw v3Missing(error.message) ? new V3MissingError(error.message) : new Error(error.message);
  await admin.from("lead_marks").delete().eq("mark_id", markId);
  await admin.from("marks").update({ rule_version: ((m?.rule_version as number) ?? 1) + 1, match_count: 0, evaluated_at: new Date().toISOString(), backfill_state: null, backfill_total: null, backfill_done: 0 }).eq("id", markId);
}

type State = { site_id: string; active: boolean; rule_version: number; backfill_state: string | null; backfill_run: number; backfill_from: string | null; backfill_until: string | null; backfill_cursor_at: string | null; backfill_cursor_id: string | null; backfill_done: number; backfill_failures: number };
const STATE_COLS = "site_id, active, rule_version, backfill_state, backfill_run, backfill_from, backfill_until, backfill_cursor_at, backfill_cursor_id, backfill_done, backfill_failures";

/** The site has new leads waiting in the hook lane: past leads wait. */
async function laneBusy(siteId: string): Promise<boolean> {
  const { data, error } = await admin.from("check_jobs").select("lead_id").eq("site_id", siteId).lte("run_after", new Date().toISOString()).limit(1);
  return !error && !!data?.length;
}

/**
 * Continues the mark's check of past leads for at most `budgetMs`, if nobody else is running it. Never throws: a failed
 * chunk is recorded (after 5 in a row the check is marked failed) and tried again by the next call.
 */
export async function runBackfill(markId: string, budgetMs: number): Promise<void> {
  const nowIso = () => new Date().toISOString();
  const claim = await admin
    .from("marks")
    .update({ backfill_lease: new Date(Date.now() + LEASE_MS).toISOString() })
    .eq("id", markId)
    .eq("backfill_state", "running")
    .or(`backfill_lease.is.null,backfill_lease.lt.${nowIso()}`)
    .select(STATE_COLS)
    .maybeSingle();
  if (claim.error || !claim.data) return;
  let s = claim.data as unknown as State;
  const siteId = s.site_id;
  const meter = newMeter();
  const t0 = Date.now();
  let checked = 0;
  let error: string | null = null;
  const release = () => admin.from("marks").update({ backfill_lease: null }).eq("id", markId);
  try {
    await metered(meter, async () => {
      while (Date.now() - t0 < budgetMs) {
        if (s.backfill_state !== "running" || !s.active) return;
        if (await laneBusy(siteId)) return;
        // the next chunk: newest first, below the cursor, within [from, until]
        let q = admin.from("form_submissions").select("id, submitted_at").eq("site_id", siteId);
        if (s.backfill_from) q = q.gte("submitted_at", s.backfill_from);
        if (s.backfill_until) q = q.lte("submitted_at", s.backfill_until);
        if (s.backfill_cursor_at && s.backfill_cursor_id) q = q.or(`submitted_at.lt.${s.backfill_cursor_at},and(submitted_at.eq.${s.backfill_cursor_at},id.lt.${s.backfill_cursor_id})`);
        const { data: rows, error: readErr } = await q.order("submitted_at", { ascending: false }).order("id", { ascending: false }).limit(CHUNK);
        if (readErr) throw new Error("leads: " + readErr.message);
        if (!rows?.length) {
          // done: the exact count, and a new stamp so the leads page reads the badges again
          const { count } = await admin.from("lead_marks").select("lead_id", { count: "exact", head: true }).eq("mark_id", markId);
          await admin.from("marks").update({ backfill_state: "done", backfill_lease: null, match_count: count ?? null, evaluated_at: nowIso() }).eq("id", markId).eq("backfill_run", s.backfill_run);
          return;
        }
        const ids = rows.map((r) => r.id as string);
        await evaluateLeads(siteId, ids, { only: [markId], strict: true });
        checked += ids.length;
        const last = rows[rows.length - 1];
        // moved on while this chunk ran? (an edit or a new choice): drop what this chunk wrote for an old rule, follow the new run
        const { data: now, error: nowErr } = await admin.from("marks").select(STATE_COLS).eq("id", markId).maybeSingle();
        if (nowErr || !now) throw new Error("mark: " + (nowErr?.message ?? "gone"));
        const fresh = now as unknown as State;
        if (fresh.backfill_run !== s.backfill_run) {
          if (fresh.rule_version !== s.rule_version) await admin.from("lead_marks").delete().eq("mark_id", markId).in("lead_id", ids);
          s = fresh;
          continue;
        }
        const done = s.backfill_done + ids.length;
        await admin
          .from("marks")
          .update({ backfill_cursor_at: last.submitted_at, backfill_cursor_id: last.id, backfill_done: done, backfill_failures: 0, backfill_error: null, backfill_lease: new Date(Date.now() + LEASE_MS).toISOString() })
          .eq("id", markId)
          .eq("backfill_run", s.backfill_run);
        s = { ...fresh, backfill_cursor_at: last.submitted_at as string, backfill_cursor_id: last.id as string, backfill_done: done };
        await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    const failures = s.backfill_failures + 1;
    log("chunk failed", { mark: markId.slice(0, 8), failures, error });
    await admin
      .from("marks")
      .update({ backfill_failures: failures, backfill_error: error.slice(0, 300), ...(failures >= MAX_FAILURES ? { backfill_state: "failed" } : {}) })
      .eq("id", markId)
      .eq("backfill_run", s.backfill_run);
  } finally {
    await release();
  }
  // one record per run of the runner, as before for a mark saved (kind mark_apply): leads checked, time, database work
  if (checked || error) await recordRun({ site_id: siteId, kind: "mark_apply", leads: checked, marks: 1, total_ms: Date.now() - t0, error }, meter);
}

/** Continues the checks of past leads nobody is running (all sites, or one), for at most `budgetMs` in all. */
export async function continueBackfills(budgetMs: number, siteId?: string): Promise<number> {
  const t0 = Date.now();
  let q = admin.from("marks").select("id").eq("backfill_state", "running").or(`backfill_lease.is.null,backfill_lease.lt.${new Date().toISOString()}`).limit(5);
  if (siteId) q = q.eq("site_id", siteId);
  const { data, error } = await q;
  if (error || !data?.length) return 0;
  let n = 0;
  for (const m of data) {
    const left = budgetMs - (Date.now() - t0);
    if (left < 2000) break;
    await runBackfill(m.id as string, left);
    n++;
  }
  return n;
}
