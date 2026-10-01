// lib/actions/conversionsOverTime.action.ts
// "Conversions" over time, deduped per visitor PER BUCKET — one person
// submitting the same form 3 times inside one bucket counts once in that
// bucket, matching how a lead actually converts (once, from that visitor's
// perspective), not once per form_submissions row. The same visitor
// converting again in a LATER bucket is a separate real event and counts
// again there — this is a time series, not a single all-time dedup count
// (see uniqueConversionRate.action.ts for the all-time version used by the
// dashboard's Conversion Rate stat).
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { buildBuckets, bucketIndexFor, type Bucket } from "@/lib/analytics/bucketRange";
import { requireSiteAccess } from "@/lib/actions/siteAccess";

export interface ConversionBucket extends Bucket {
  uniqueConversions: number;
}

export interface ConversionsOverTimeResult {
  rangeStart: string;
  rangeEnd: string;
  buckets: ConversionBucket[];
  totalUniqueConversions: number;
}

export async function getUniqueConversionsOverTime(siteId: string, startIso?: string | null, endIso?: string | null): Promise<ConversionsOverTimeResult> {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();
  const now = new Date();

  let startDate: Date;
  if (startIso) {
    startDate = new Date(startIso);
  } else {
    const { data: earliest } = await supabase.from("form_submissions").select("submitted_at").eq("site_id", siteId).order("submitted_at", { ascending: true }).limit(1).maybeSingle();
    startDate = earliest?.submitted_at ? new Date(earliest.submitted_at) : new Date(now.getTime() - 90 * 86_400_000);
  }
  const endDate = endIso ? new Date(endIso) : now;

  const { data: rows, error } = await supabase
    .from("form_submissions")
    .select("visitor_id, submitted_at")
    .eq("site_id", siteId)
    .gte("submitted_at", startDate.toISOString())
    .lte("submitted_at", endDate.toISOString());

  if (error) {
    console.error("[getUniqueConversionsOverTime] fetch error:", error.message);
    throw new Error(`Failed to fetch submissions: ${error.message}`);
  }

  const bucketShells = buildBuckets(startDate, endDate);
  const buckets: ConversionBucket[] = bucketShells.map((b) => ({ ...b, uniqueConversions: 0 }));
  const seenPerBucket: Set<string>[] = buckets.map(() => new Set());

  for (const row of rows ?? []) {
    if (!row.submitted_at) continue;
    const idx = bucketIndexFor(new Date(row.submitted_at).getTime(), startDate, bucketShells);
    if (idx < 0) continue;
    const key = row.visitor_id || `anon-${row.submitted_at}`;
    if (seenPerBucket[idx].has(key)) continue;
    seenPerBucket[idx].add(key);
    buckets[idx].uniqueConversions += 1;
  }

  const totalUniqueConversions = buckets.reduce((sum, b) => sum + b.uniqueConversions, 0);

  return {
    rangeStart: startDate.toISOString(),
    rangeEnd: endDate.toISOString(),
    buckets,
    totalUniqueConversions,
  };
}
