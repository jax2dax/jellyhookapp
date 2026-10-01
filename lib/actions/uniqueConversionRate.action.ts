// lib/actions/uniqueConversionRate.action.ts
// The dashboard's Conversion Rate stat, redefined: unique converting
// visitors / unique visitors — a person counts once on each side no matter
// how many sessions or submissions they racked up. The old metric
// (form_submissions rows / sessions rows) double-counted anyone who
// submitted more than once or visited more than once, which isn't what
// "conversion rate" should mean.
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { requireSiteAccess } from "@/lib/actions/siteAccess";

export interface UniqueConversionRateResult {
  uniqueVisitors: number;
  uniqueConvertingVisitors: number;
  rate: number; // 0-100
}

export async function getUniqueConversionRate(siteId: string): Promise<UniqueConversionRateResult> {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();

  const [{ count: uniqueVisitors, error: visitorsError }, { data: submissionRows, error: submissionsError }] = await Promise.all([
    supabase.from("visitors").select("id", { count: "exact", head: true }).eq("site_id", siteId),
    supabase.from("form_submissions").select("visitor_id").eq("site_id", siteId),
  ]);

  if (visitorsError) console.error("[getUniqueConversionRate] visitors error:", visitorsError.message);
  if (submissionsError) console.error("[getUniqueConversionRate] submissions error:", submissionsError.message);

  const uniqueConvertingVisitors = new Set((submissionRows ?? []).map((r) => r.visitor_id).filter(Boolean)).size;
  const totalUniqueVisitors = uniqueVisitors ?? 0;
  const rate = totalUniqueVisitors > 0 ? (uniqueConvertingVisitors / totalUniqueVisitors) * 100 : 0;

  return { uniqueVisitors: totalUniqueVisitors, uniqueConvertingVisitors, rate };
}
