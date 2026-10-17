// lib/stats/siteStats.ts
// Per-site "normal" (founder, 2026-10-16): typical session time, three ways, so a mark can compare a lead to THIS site
// and not to a fixed number. Computed with jh-stats/typical.ts (frequency table, outliers dropped, mean +/- 1 SD),
// saved in site_stats and refreshed at most once a day, on first use. Server only. Later: more measures for site
// health (form time, pages per visit...), same table.
//
//   all               every visit of the last 180 days
//   beforeConversion  the same, without visits that started after the visitor's first form (those are noise:
//                     someone coming back to a page after contacting you is not researching any more)
//   converting        only the visits in which a form was sent
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { typicalRange, type Typical } from "@/jh-stats/typical";
import { pgHookDb } from "@/lib/hook/pgDb";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const MAX_AGE_MS = 24 * 3600_000;

export interface SiteStats {
  sessionDuration: { all: Typical | null; beforeConversion: Typical | null; converting: Typical | null };
  computedAt: string;
}

export async function computeSiteStats(siteId: string): Promise<SiteStats> {
  const rows = (await pgHookDb.query(
    `WITH s AS (
       SELECT x.session_id, x.visitor_id, x.started_at,
              EXTRACT(EPOCH FROM (COALESCE(x.ended_at, x.last_activity_at) - x.started_at)) * 1000 AS ms
       FROM public.sessions x WHERE x.site_id = $1 AND x.started_at > now() - interval '180 days'
     ), first_sent AS (
       SELECT visitor_id, min(submitted_at) AS t FROM public.form_submissions WHERE site_id = $1 GROUP BY visitor_id
     ), sent AS (
       SELECT DISTINCT session_id FROM public.form_submissions WHERE site_id = $1
     )
     SELECT s.ms::float8 AS ms,
            (f.t IS NULL OR s.started_at <= f.t) AS before_conversion,
            EXISTS (SELECT 1 FROM sent WHERE sent.session_id = s.session_id) AS converting
     FROM s LEFT JOIN first_sent f ON f.visitor_id = s.visitor_id
     WHERE s.ms > 0
     LIMIT 50000`,
    [siteId],
  )) as { ms: number; before_conversion: boolean; converting: boolean }[];
  return {
    sessionDuration: {
      all: typicalRange(rows.map((r) => Number(r.ms))),
      beforeConversion: typicalRange(rows.filter((r) => r.before_conversion).map((r) => Number(r.ms))),
      converting: typicalRange(rows.filter((r) => r.converting).map((r) => Number(r.ms))),
    },
    computedAt: new Date().toISOString(),
  };
}

/** The site's statistics: the saved ones when fresh, else computed now and saved. Never throws (null on failure). */
export async function getSiteStats(siteId: string): Promise<SiteStats | null> {
  try {
    const { data } = await admin.from("site_stats").select("stats, computed_at").eq("site_id", siteId).maybeSingle();
    if (data && Date.now() - Date.parse(data.computed_at as string) < MAX_AGE_MS) return data.stats as SiteStats;
    const fresh = await computeSiteStats(siteId);
    await admin.from("site_stats").upsert({ site_id: siteId, stats: fresh, computed_at: fresh.computedAt });
    return fresh;
  } catch (e) {
    console.error("[site-stats] unavailable", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
