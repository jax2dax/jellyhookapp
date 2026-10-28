// lib/marks/queue.ts
// The background queue for the marks no live hook uses (migration 34, mds/build/marks/queue-and-cap.md).
// Before (v2): right after a site's hook lane released its lease, the same request checked the lead against every other
// mark. In a burst that work ran at the same time as the next leads' hooks, on the same database, and with 5 heavy marks
// it stopped the database (mds/crowd-test/v2/run-2026-10-28-heavy-marks.md). Now:
//   - the hook lane (lib/notifications/check.ts) only puts the lead in mark_jobs;
//   - runMarkQueue checks waiting leads 25 at a time against the other marks, but only while the site has no lead waiting
//     for its hooks, and only as far as the minute's mark budget allows (./work.ts); the rest waits for the next run;
//   - it is run after the hook lane (same request, after the lease), by the drainer, and when the leads page is opened;
//   - a failed batch is tried again later (1 min, 5 min, 30 min), so a badge is late, never silently missing.
// Before migration 34 the lane checks the other marks itself, as in v2.
import "server-only";
import { meteredAdmin } from "@/lib/db/admin";
import { evaluateLeads } from "./evaluate";
import { takeMarkWork } from "./work";
import { metered, newMeter } from "@/lib/metrics/meter";
import { recordRun } from "@/lib/metrics/runs";

const admin = meteredAdmin();

const BATCH = 25;
/** a claimed batch is invisible to other runners this long (a runner that dies frees it by itself) */
const CLAIM_MS = 120_000;
const RETRY_MS = [60_000, 5 * 60_000, 30 * 60_000];
const MAX_ATTEMPTS = 6;

const log = (msg: string, extra: Record<string, unknown> = {}) => console.error("[marks queue] " + msg, extra);

/** The mark_jobs table is not there yet (migration 34 not run). */
export const queueMissing = (msg: string | undefined) => !!msg && /mark_jobs/.test(msg);

/** Puts leads in the queue. Returns false before migration 34 (the caller then checks the marks itself). */
export async function enqueueMarks(siteId: string, leadIds: string[]): Promise<boolean> {
  if (!leadIds.length) return true;
  const { error } = await admin.from("mark_jobs").upsert(leadIds.map((lead_id) => ({ lead_id, site_id: siteId, run_after: new Date().toISOString(), attempts: 0 })), { onConflict: "lead_id" });
  if (!error) return true;
  if (!queueMissing(error.message)) log("enqueue failed", { site: siteId.slice(0, 8), error: error.message });
  return false;
}

async function laneBusy(siteId: string): Promise<boolean> {
  const { data, error } = await admin.from("check_jobs").select("lead_id").eq("site_id", siteId).lte("run_after", new Date().toISOString()).limit(1);
  return !error && !!data?.length;
}

/** The marks that are on and no live hook uses: what the queue checks. */
async function otherMarks(siteId: string): Promise<{ except: string[]; count: number } | null> {
  const [rules, marks] = await Promise.all([admin.from("notification_rules").select("mark_ids").eq("site_id", siteId).eq("active", true), admin.from("marks").select("id").eq("site_id", siteId).eq("kind", "lead").eq("active", true)]);
  if (rules.error || marks.error) return null;
  const hook = new Set((rules.data ?? []).flatMap((r) => (r.mark_ids as string[] | null) ?? []));
  return { except: [...hook], count: (marks.data ?? []).filter((m) => !hook.has(m.id as string)).length };
}

/**
 * Checks the site's queued leads against its other marks for at most `budgetMs`, giving way to the hook lane and to
 * the mark budget. Never throws. Returns how many leads were checked.
 */
export async function runMarkQueue(siteId: string, budgetMs: number): Promise<number> {
  const t0 = Date.now();
  let done = 0;
  try {
    const marks = await otherMarks(siteId);
    if (!marks) return 0;
    while (Date.now() - t0 < budgetMs) {
      if (await laneBusy(siteId)) break;
      const now = new Date().toISOString();
      const { data: due, error } = await admin.from("mark_jobs").select("lead_id").eq("site_id", siteId).lte("run_after", now).order("created_at").limit(BATCH);
      if (error || !due?.length) break;
      // nothing to check (every mark is used by a hook, or none is on): the jobs are done
      if (!marks.count) {
        await admin.from("mark_jobs").delete().in("lead_id", due.map((j) => j.lead_id as string));
        continue;
      }
      // as many leads as the minute's budget allows (each costs one check per mark)
      const granted = await takeMarkWork(siteId, due.length * marks.count);
      const n = Math.floor(granted / marks.count);
      if (!n) break; // the budget of this minute is used: the rest waits for a later run
      // claim them: a runner elsewhere that read the same rows gets none of the ones claimed here
      const { data: claimed } = await admin
        .from("mark_jobs")
        .update({ run_after: new Date(Date.now() + CLAIM_MS).toISOString() })
        .in("lead_id", due.slice(0, n).map((j) => j.lead_id as string))
        .lte("run_after", now)
        .select("lead_id, attempts");
      const ids = (claimed ?? []).map((j) => j.lead_id as string);
      if (!ids.length) continue;
      const meter = newMeter();
      const t1 = Date.now();
      try {
        const checked = await metered(meter, () => evaluateLeads(siteId, ids, { except: marks.except, strict: true }));
        await admin.from("mark_jobs").delete().in("lead_id", ids);
        done += ids.length;
        if (checked) await recordRun({ site_id: siteId, kind: "other_marks", leads: ids.length, marks: checked, total_ms: Date.now() - t1 }, meter);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("check failed", { site: siteId.slice(0, 8), leads: ids.length, error: msg });
        await recordRun({ site_id: siteId, kind: "other_marks", leads: ids.length, marks: 0, total_ms: Date.now() - t1, error: msg }, meter);
        for (const j of claimed ?? []) {
          const attempts = (j.attempts as number) + 1;
          // after the last try the job stays, parked far in the future, for a look by hand
          const wait = attempts >= MAX_ATTEMPTS ? 3650 * 86_400_000 : RETRY_MS[Math.min(attempts - 1, RETRY_MS.length - 1)];
          await admin.from("mark_jobs").update({ attempts, last_error: msg.slice(0, 300), run_after: new Date(Date.now() + wait).toISOString() }).eq("lead_id", j.lead_id);
        }
        break;
      }
    }
  } catch (e) {
    log("run failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
  }
  return done;
}

/** For the drainer: sites with queued leads that are due, a few at a time, for at most `budgetMs` in all. */
export async function continueMarkQueues(budgetMs: number, maxSites = 4): Promise<number> {
  const t0 = Date.now();
  const { data, error } = await admin.from("mark_jobs").select("site_id").lte("run_after", new Date().toISOString()).order("created_at").limit(200);
  if (error || !data?.length) return 0;
  let n = 0;
  for (const s of [...new Set(data.map((r) => r.site_id as string))].slice(0, maxSites)) {
    const left = budgetMs - (Date.now() - t0);
    if (left < 2000) break;
    n += await runMarkQueue(s, left);
  }
  return n;
}
