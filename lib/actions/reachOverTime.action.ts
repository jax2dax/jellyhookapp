// lib/actions/reachOverTime.action.ts
// "New Reach" — unique NEW visitors gained over time, bucketed by
// visitors.first_seen. A returning visitor never counts again here; that's
// the whole point of "new" — see conversionsOverTime.action.ts for the
// conversions-side counterpart.
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { buildBuckets, bucketIndexFor, type Bucket } from "@/lib/analytics/bucketRange";
import { requireSiteAccess } from "@/lib/actions/siteAccess";

export interface ReachBucket extends Bucket {
  newVisitors: number;
}

export interface ReachOverTimeResult {
  rangeStart: string;
  rangeEnd: string;
  buckets: ReachBucket[];
  totalNewVisitors: number;
}

/**
 * @param startIso null/undefined = from this site's very first visitor (all time)
 * @param endIso   null/undefined = now
 */
export async function getNewReachOverTime(siteId: string, startIso?: string | null, endIso?: string | null): Promise<ReachOverTimeResult> {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();
  const now = new Date();

  let startDate: Date;
  if (startIso) {
    startDate = new Date(startIso);
  } else {
    const { data: earliest } = await supabase.from("visitors").select("first_seen").eq("site_id", siteId).order("first_seen", { ascending: true }).limit(1).maybeSingle();
    startDate = earliest?.first_seen ? new Date(earliest.first_seen) : new Date(now.getTime() - 90 * 86_400_000);
  }
  const endDate = endIso ? new Date(endIso) : now;

  const { data: rows, error } = await supabase.from("visitors").select("first_seen").eq("site_id", siteId).gte("first_seen", startDate.toISOString()).lte("first_seen", endDate.toISOString());

  if (error) {
    console.error("[getNewReachOverTime] fetch error:", error.message);
    throw new Error(`Failed to fetch visitors: ${error.message}`);
  }

  const bucketShells = buildBuckets(startDate, endDate);
  const buckets: ReachBucket[] = bucketShells.map((b) => ({ ...b, newVisitors: 0 }));

  for (const row of rows ?? []) {
    if (!row.first_seen) continue;
    const idx = bucketIndexFor(new Date(row.first_seen).getTime(), startDate, bucketShells);
    if (idx >= 0) buckets[idx].newVisitors += 1;
  }

  return {
    rangeStart: startDate.toISOString(),
    rangeEnd: endDate.toISOString(),
    buckets,
    totalNewVisitors: rows?.length ?? 0,
  };
}
