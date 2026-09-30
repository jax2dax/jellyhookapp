// lib/actions/referrerBreakdown.action.ts
// "How were our unique visitors actually acquired" — each visitor is
// counted ONCE, under the source of their EARLIEST session (first touch),
// not once per session. A visitor who came back later via a different
// link doesn't get re-attributed or double-counted — the channel that
// actually brought them in the door the first time is what marketing
// needs credit for.
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { classifyReferrer } from "@/lib/analytics/classifyReferrer";

export interface ReferrerSlice {
  source: string;
  uniqueVisitors: number;
}

export interface ReferrerBreakdownResult {
  slices: ReferrerSlice[];
  totalUniqueVisitors: number;
}

export async function getReferrerBreakdown(siteId: string): Promise<ReferrerBreakdownResult> {
  const supabase = await createSupabaseClient();

  const { data: rows, error } = await supabase
    .from("sessions")
    .select("visitor_id, started_at, referrer, utm_source")
    .eq("site_id", siteId)
    .order("started_at", { ascending: true });

  if (error) {
    console.error("[getReferrerBreakdown] fetch error:", error.message);
    throw new Error(`Failed to fetch sessions: ${error.message}`);
  }

  const firstSessionByVisitor = new Map<string, { referrer: string | null; utm_source: string | null }>();
  for (const row of rows ?? []) {
    if (!row.visitor_id || firstSessionByVisitor.has(row.visitor_id)) continue; // rows are ascending — first hit per visitor IS the earliest
    firstSessionByVisitor.set(row.visitor_id, { referrer: row.referrer, utm_source: row.utm_source });
  }

  const counts = new Map<string, number>();
  for (const session of firstSessionByVisitor.values()) {
    const label = classifyReferrer(session);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const slices = Array.from(counts.entries())
    .map(([source, uniqueVisitors]) => ({ source, uniqueVisitors }))
    .sort((a, b) => b.uniqueVisitors - a.uniqueVisitors);

  return { slices, totalUniqueVisitors: firstSessionByVisitor.size };
}
