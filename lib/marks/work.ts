// lib/marks/work.ts
// The cap on mark work (migration 34, mds/build/marks/queue-and-cap.md). Work = lead checks: one lead checked against one
// mark. Each minute has a budget per site and one for the whole database. Background work (the queue of other marks,
// lib/marks/queue.ts, and past leads, ./backfill.ts) takes from it and stops when it is used; the hook lane is never held
// back but is counted, so a burst of new leads leaves less for the background that minute.
// Why: on Nano (free) 5 heavy marks checked on every lead of a burst stopped the database
// (mds/crowd-test/v2/run-2026-10-28-heavy-marks.md). The numbers are starting points, to be set from the next runs.
import "server-only";
import { meteredAdmin } from "@/lib/db/admin";

const admin = meteredAdmin();

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : d);
/** lead checks per site per minute (JELLYHOOK_MARK_WORK_SITE) */
export const SITE_CAP = num(process.env.JELLYHOOK_MARK_WORK_SITE, 300);
/** lead checks per minute for all sites together (JELLYHOOK_MARK_WORK_ALL) */
export const ALL_CAP = num(process.env.JELLYHOOK_MARK_WORK_ALL, 1200);

let missing = false;

/**
 * Takes up to `want` lead checks from this minute's budget; returns how many were granted. `force` (the hook lane):
 * always granted, only counted. Before migration 34 (or if the budget cannot be read) everything is granted: the cap
 * never stops work because of its own failure, as before it existed.
 */
export async function takeMarkWork(siteId: string, want: number, force = false): Promise<number> {
  if (want <= 0) return 0;
  if (missing) return want;
  const { data, error } = await admin.rpc("jh_take_mark_work", { p_site: siteId, p_want: want, p_site_cap: SITE_CAP, p_all_cap: ALL_CAP, p_force: force });
  if (error) {
    if (/jh_take_mark_work|mark_work/.test(error.message)) missing = true;
    else console.error("[marks] work budget unavailable", { site: siteId.slice(0, 8), error: error.message });
    return want;
  }
  return typeof data === "number" ? data : want;
}
