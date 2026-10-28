// lib/privacy/retention.ts
// Each site keeps its visit and lead data for sites.retention_months (6, 13 by default, or 25; null keeps everything).
// The drainer (lib/notifications/check.ts drain) calls continueRetention every minute; a site is swept at most once a
// day, in batches (jh_purge_site, migration 35) so the free database never does one large delete. A site with a backlog
// is not marked done and comes back on the next run. Before migration 35 the column is missing and this does nothing.
import "server-only";
import { meteredAdmin } from "@/lib/db/admin";

const admin = meteredAdmin();

export const RETENTION_CHOICES = [6, 13, 25] as const;
export const DEFAULT_RETENTION_MONTHS = 13;
const BATCH = 5000;
const DAY_MS = 24 * 3600_000;

/** The date before which a site's data is deleted, for a retention of `months`. */
export function retentionCutoff(months: number, now = new Date()): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/** Sweeps the sites that are due, within `budgetMs`. Returns how many rows were deleted. */
export async function continueRetention(budgetMs: number): Promise<number> {
  if (budgetMs < 1000) return 0;
  const t0 = Date.now();
  const dayAgo = new Date(Date.now() - DAY_MS).toISOString();
  const { data, error } = await admin
    .from("sites")
    .select("id, retention_months, purged_at")
    .not("retention_months", "is", null)
    .is("deleted_at", null)
    .or(`purged_at.is.null,purged_at.lt.${dayAgo}`)
    .limit(5);
  if (error || !data) return 0;
  let total = 0;
  for (const site of data) {
    if (Date.now() - t0 > budgetMs) break;
    const cutoff = retentionCutoff(Number(site.retention_months)).toISOString();
    const { data: n, error: e } = await admin.rpc("jh_purge_site", { p_site: site.id, p_before: cutoff, p_batch: BATCH });
    if (e) {
      console.error("[retention] purge error:", e.message);
      continue;
    }
    total += Number(n) || 0;
    // under a full batch everywhere: this site is clean until tomorrow
    if ((Number(n) || 0) < BATCH) await admin.from("sites").update({ purged_at: new Date().toISOString() }).eq("id", site.id);
  }
  return total;
}
