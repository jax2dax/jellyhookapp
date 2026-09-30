// lib/actions/leadOriginBreakdown.action.ts
// "Which channel actually produced converted leads" — same first-touch
// classification as referrerBreakdown.action.ts, but restricted to
// visitors who have at least one form_submissions row. A lead counts once
// under the source of their first-ever session, same reasoning as there.
//
// Always returns a fixed number of slots (TOTAL_SLOTS) for the radar chart
// to stay visually stable: real sources (sorted by lead count) fill in
// first, DEFAULT_PLACEHOLDERS fill any remaining slots at 0 so the radar
// never looks sparse with just one real axis. A placeholder whose name
// matches a real source is never duplicated — it just becomes that real
// slot. When real distinct sources exceed TOTAL_SLOTS, only the top
// TOTAL_SLOTS by lead count are shown.
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { classifyReferrer } from "@/lib/analytics/classifyReferrer";

export interface LeadOriginSlice {
  source: string;
  leads: number;
  isPlaceholder: boolean;
}

export interface LeadOriginBreakdownResult {
  slices: LeadOriginSlice[];
  totalLeads: number;
}

const DEFAULT_PLACEHOLDERS = ["Direct", "Facebook", "Instagram", "Google", "LinkedIn", "TikTok"];
const TOTAL_SLOTS = 6;

export async function getLeadOriginBreakdown(siteId: string): Promise<LeadOriginBreakdownResult> {
  const supabase = await createSupabaseClient();

  const { data: submissionRows, error: subError } = await supabase.from("form_submissions").select("visitor_id").eq("site_id", siteId);
  if (subError) {
    console.error("[getLeadOriginBreakdown] submissions fetch error:", subError.message);
    throw new Error(`Failed to fetch submissions: ${subError.message}`);
  }

  const convertedVisitorIds = Array.from(new Set((submissionRows ?? []).map((r) => r.visitor_id).filter(Boolean)));

  if (convertedVisitorIds.length === 0) {
    return { slices: DEFAULT_PLACEHOLDERS.map((source) => ({ source, leads: 0, isPlaceholder: true })), totalLeads: 0 };
  }

  const { data: sessionRows, error: sessError } = await supabase
    .from("sessions")
    .select("visitor_id, started_at, referrer, utm_source")
    .eq("site_id", siteId)
    .in("visitor_id", convertedVisitorIds)
    .order("started_at", { ascending: true });

  if (sessError) {
    console.error("[getLeadOriginBreakdown] sessions fetch error:", sessError.message);
    throw new Error(`Failed to fetch sessions: ${sessError.message}`);
  }

  const firstSessionByVisitor = new Map<string, { referrer: string | null; utm_source: string | null }>();
  for (const row of sessionRows ?? []) {
    if (!row.visitor_id || firstSessionByVisitor.has(row.visitor_id)) continue; // ascending — first hit per visitor IS earliest
    firstSessionByVisitor.set(row.visitor_id, { referrer: row.referrer, utm_source: row.utm_source });
  }

  const counts = new Map<string, number>();
  for (const session of firstSessionByVisitor.values()) {
    const label = classifyReferrer(session);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const real: LeadOriginSlice[] = Array.from(counts.entries())
    .map(([source, leads]) => ({ source, leads, isPlaceholder: false }))
    .sort((a, b) => b.leads - a.leads);

  if (real.length >= TOTAL_SLOTS) {
    return { slices: real.slice(0, TOTAL_SLOTS), totalLeads: convertedVisitorIds.length };
  }

  const usedLabels = new Set(real.map((r) => r.source));
  const placeholders: LeadOriginSlice[] = DEFAULT_PLACEHOLDERS.filter((p) => !usedLabels.has(p))
    .slice(0, TOTAL_SLOTS - real.length)
    .map((source) => ({ source, leads: 0, isPlaceholder: true }));

  return { slices: [...real, ...placeholders], totalLeads: convertedVisitorIds.length };
}
