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
//
// Attribution model (2026-10-14), the chart's switch:
//   first        the source of the visitor's very FIRST visit ("where do people discover me?")
//   lastNonDirect the source of the LAST visit that came from somewhere (search, social, an ad, a tagged link) before
//                they converted, skipping Direct visits; Direct only when every visit was Direct ("what brought them
//                back to act?"). For visitors who did not convert: their last non-direct visit so far.
// Source names are normalized first (fb / Facebook / facebook.com = Facebook): lib/analytics/classifyReferrer.js.
// Public explanation: /docs/concepts/referrers-attribution.
"use server";

import { createSupabaseClient } from "@/lib/supabase/server";
import { classifyReferrer } from "@/lib/analytics/classifyReferrer";
import { lastNonDirectLabel } from "@/lib/analytics/attribution";
import { requireSiteAccess } from "@/lib/actions/siteAccess";

export interface LeadOriginSlice {
  source: string;
  leads: number;
  /** unique visitors whose FIRST visit came from this source (all visitors, not only leads) */
  visitors: number;
  isPlaceholder: boolean;
}

export interface LeadOriginBreakdownResult {
  slices: LeadOriginSlice[];
  totalLeads: number;
  /** unique visitors counted in the visitor shape */
  totalVisitors: number;
  model: AttributionModel;
}

export type AttributionModel = "first" | "lastNonDirect";

const DEFAULT_PLACEHOLDERS = ["Direct", "Facebook", "Instagram", "Google", "LinkedIn", "TikTok"];
const TOTAL_SLOTS = 6;

/** Every visitor's first-touch source, counted. Uses the first-touch columns on visitors; visitors seen before those were
 * recorded (first_touch_at null) are left out rather than guessed as Direct. */
async function visitorOrigins(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, siteId: string): Promise<{ counts: Map<string, number>; total: number }> {
  const { data, error } = await supabase.from("visitors").select("first_utm_source, first_referrer, first_touch_at").eq("site_id", siteId).not("first_touch_at", "is", null).limit(50_000);
  const counts = new Map<string, number>();
  if (error) {
    console.error("[getLeadOriginBreakdown] visitors fetch error:", error.message);
    return { counts, total: 0 };
  }
  for (const v of data ?? []) {
    const label = classifyReferrer({ utm_source: v.first_utm_source, referrer: v.first_referrer });
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { counts, total: (data ?? []).length };
}

type SessionSource = { visitor_id: string | null; started_at: string; referrer: string | null; utm_source: string | null };

/** Every visitor's LAST non-direct source, from their sessions (the most recent 50,000 sessions of the site). */
async function visitorOriginsLastNonDirect(supabase: Awaited<ReturnType<typeof createSupabaseClient>>, siteId: string): Promise<{ counts: Map<string, number>; total: number }> {
  const { data, error } = await supabase.from("sessions").select("visitor_id, started_at, referrer, utm_source").eq("site_id", siteId).order("started_at", { ascending: false }).limit(50_000);
  const counts = new Map<string, number>();
  if (error) {
    console.error("[getLeadOriginBreakdown] sessions (visitors) fetch error:", error.message);
    return { counts, total: 0 };
  }
  const byVisitor = new Map<string, SessionSource[]>();
  for (const row of (data ?? []) as SessionSource[]) {
    if (!row.visitor_id) continue;
    const list = byVisitor.get(row.visitor_id) ?? [];
    list.push(row);
    byVisitor.set(row.visitor_id, list);
  }
  for (const list of byVisitor.values()) {
    list.reverse(); // newest-first from the query -> oldest first
    const label = lastNonDirectLabel(list);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return { counts, total: byVisitor.size };
}

export async function getLeadOriginBreakdown(siteId: string, model: AttributionModel = "first"): Promise<LeadOriginBreakdownResult> {
  await requireSiteAccess(siteId);
  const supabase = await createSupabaseClient();
  const visitorsP = model === "lastNonDirect" ? visitorOriginsLastNonDirect(supabase, siteId) : visitorOrigins(supabase, siteId);

  const { data: submissionRows, error: subError } = await supabase.from("form_submissions").select("visitor_id, submitted_at").eq("site_id", siteId);
  if (subError) {
    console.error("[getLeadOriginBreakdown] submissions fetch error:", subError.message);
    throw new Error(`Failed to fetch submissions: ${subError.message}`);
  }

  const convertedVisitorIds = Array.from(new Set((submissionRows ?? []).map((r) => r.visitor_id).filter(Boolean)));

  const vis = await visitorsP;
  if (convertedVisitorIds.length === 0) {
    // no leads yet: the axes are the top visitor sources (if any), so the visitor shape is still visible
    const top = Array.from(vis.counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOTAL_SLOTS).map(([source, visitors]) => ({ source, leads: 0, visitors, isPlaceholder: false }));
    const fill = DEFAULT_PLACEHOLDERS.filter((p) => !top.some((t) => t.source === p)).slice(0, TOTAL_SLOTS - top.length).map((source) => ({ source, leads: 0, visitors: vis.counts.get(source) ?? 0, isPlaceholder: true }));
    return { slices: [...top, ...fill], totalLeads: 0, totalVisitors: vis.total, model };
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

  // a lead counts once: the person (visitor), under the source the chosen model gives
  const sessionsByVisitor = new Map<string, SessionSource[]>();
  for (const row of (sessionRows ?? []) as SessionSource[]) {
    if (!row.visitor_id) continue;
    const list = sessionsByVisitor.get(row.visitor_id) ?? [];
    list.push(row); // ascending by started_at
    sessionsByVisitor.set(row.visitor_id, list);
  }
  const firstSubmitAt = new Map<string, number>();
  for (const sub of submissionRows ?? []) {
    if (!sub.visitor_id || !sub.submitted_at) continue;
    const t = new Date(sub.submitted_at).getTime();
    const prev = firstSubmitAt.get(sub.visitor_id);
    if (prev === undefined || t < prev) firstSubmitAt.set(sub.visitor_id, t);
  }

  const counts = new Map<string, number>();
  for (const [visitorId, list] of sessionsByVisitor) {
    let label: string;
    if (model === "lastNonDirect") {
      // only the visits up to the (first) conversion count: what came after it did not bring them to convert
      const until = firstSubmitAt.get(visitorId);
      const before = until === undefined ? list : list.filter((s) => new Date(s.started_at).getTime() <= until);
      label = lastNonDirectLabel(before.length ? before : list.slice(0, 1));
    } else {
      label = classifyReferrer(list[0]);
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const real: LeadOriginSlice[] = Array.from(counts.entries())
    .map(([source, leads]) => ({ source, leads, visitors: vis.counts.get(source) ?? 0, isPlaceholder: false }))
    .sort((a, b) => b.leads - a.leads);

  if (real.length >= TOTAL_SLOTS) {
    return { slices: real.slice(0, TOTAL_SLOTS), totalLeads: convertedVisitorIds.length, totalVisitors: vis.total, model };
  }

  const usedLabels = new Set(real.map((r) => r.source));
  // remaining axes: the biggest visitor sources that produced no lead yet (more useful than fixed names), then placeholders
  const visitorOnly: LeadOriginSlice[] = Array.from(vis.counts.entries())
    .filter(([source]) => !usedLabels.has(source))
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOTAL_SLOTS - real.length)
    .map(([source, visitors]) => ({ source, leads: 0, visitors, isPlaceholder: false }));
  for (const v of visitorOnly) usedLabels.add(v.source);
  const placeholders: LeadOriginSlice[] = DEFAULT_PLACEHOLDERS.filter((p) => !usedLabels.has(p))
    .slice(0, TOTAL_SLOTS - real.length - visitorOnly.length)
    .map((source) => ({ source, leads: 0, visitors: 0, isPlaceholder: true }));

  return { slices: [...real, ...visitorOnly, ...placeholders], totalLeads: convertedVisitorIds.length, totalVisitors: vis.total, model };
}
