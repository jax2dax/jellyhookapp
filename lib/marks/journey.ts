// lib/marks/journey.ts
// Builds each lead's JOURNEY (jh-marks/v2/check.ts) from the database and checks a v2 mark against it. Server only,
// service role. The same rows the lead page reads: visits, page views (time, share seen, time per heading), the form's
// answers and how it was filled. Only what happened up to sending the form.
//
// Cost: leads are read in pages of 1,000; answers are checked first (no extra read); visits and page views are read
// only when the mark has visit conditions, and only for the leads still in the running, 100 visitors at a time, so
// memory stays small on a big site. Design: mds/build/marks/marks-v2-plan.md.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { checkLead, needs, type Journey } from "@/jh-marks/v2/check";
import { buildJourney, type LeadRow } from "@/jh-marks/v2/journey";
import type { MarkRuleV2 } from "@/jh-marks/v2/rule";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const LEAD_PAGE = 1000;
const VISITOR_CHUNK = 100;

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const t = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);



/**
 * Every row of a query. Supabase's API returns at most 1,000 rows per request and silently ignores a bigger limit, so
 * a long history (a visitor's 20th visit) used to lose its newest page views, the visit the form was sent in
 * (2026-10-24). Pages of 1,000 until a short page.
 */
async function allRows(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += LEAD_PAGE) {
    const { data, error } = await page(from, from + LEAD_PAGE - 1);
    if (error) throw new Error("journey: " + error.message);
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < LEAD_PAGE) return out;
  }
}

const VISIT_COLS = "visitor_id, session_id, started_at, ended_at, last_activity_at, referrer, utm_source, utm_medium, utm_campaign";

/** A set of visitors' visits up to `until`, with the ad fields of migration 24 when the database has them. */
async function visitRows(siteId: string, visitors: string[], until: string): Promise<Record<string, unknown>[]> {
  const read = (cols: string) => allRows((from, to) => admin.from("sessions").select(cols).eq("site_id", siteId).in("visitor_id", visitors).lte("started_at", until).order("started_at").order("session_id").range(from, to));
  // newest columns first; an older database (before migrations 25, 24) is read with fewer
  for (const extra of [", utm_content, utm_term, click_id, landing_path, ad_name, campaign_id", ", utm_content, utm_term, click_id, landing_path", ""]) {
    try {
      return await read(VISIT_COLS + extra);
    } catch (e) {
      if (!(e instanceof Error && /utm_content|utm_term|click_id|landing_path|ad_name|campaign_id/.test(e.message)) || !extra) throw e;
    }
  }
  return [];
}

/** Reads the leads to check: all of the site's, or the given ones. */
async function readLeads(siteId: string, onlyLeads?: string[]): Promise<LeadRow[]> {
  const cols = "id, visitor_id, session_id, submitted_at, raw_data";
  if (onlyLeads) {
    const out: LeadRow[] = [];
    for (const c of chunks(onlyLeads, 200)) {
      const { data, error } = await admin.from("form_submissions").select(cols).eq("site_id", siteId).in("id", c);
      if (error) throw new Error("leads: " + error.message);
      out.push(...((data ?? []) as LeadRow[]));
    }
    return out;
  }
  const out: LeadRow[] = [];
  for (let from = 0; ; from += LEAD_PAGE) {
    const { data, error } = await admin.from("form_submissions").select(cols).eq("site_id", siteId).order("submitted_at").range(from, from + LEAD_PAGE - 1);
    if (error) throw new Error("leads: " + error.message);
    out.push(...((data ?? []) as LeadRow[]));
    if (!data || data.length < LEAD_PAGE) return out;
  }
}

/** Visits, page views, devices and sent forms for a set of leads (one chunk of visitors). */
async function journeys(siteId: string, leads: LeadRow[], want: { visits: boolean; form: boolean }): Promise<Journey[]> {
  const visitors = [...new Set(leads.map((l) => l.visitor_id).filter((v): v is string => !!v))];
  const sessionsByVisitor = new Map<string, Record<string, unknown>[]>();
  const pagesBySession = new Map<string, Record<string, unknown>[]>();
  const device = new Map<string, string | null>();
  if (want.visits && visitors.length) {
    // nothing after the latest sending in this group can count: read only up to it
    const until = new Date(Math.max(...leads.map((l) => t(l.submitted_at)))).toISOString();
    const [ss, pv, vs] = await Promise.all([
      visitRows(siteId, visitors, until),
      allRows((from, to) => admin.from("page_views").select("visitor_id, session_id, page_path, entered_at, left_at, page_height, viewport_height, entry_scroll_depth, max_scroll_depth, revisit_start_scroll_depth, heading_time").eq("site_id", siteId).in("visitor_id", visitors).lte("entered_at", until).order("entered_at").order("page_view_id").range(from, to)),
      allRows((from, to) => admin.from("visitors").select("visitor_id, device_type").eq("site_id", siteId).in("visitor_id", visitors).range(from, to)),
    ]);
    for (const s of ss) {
      const list = sessionsByVisitor.get(s.visitor_id as string) ?? [];
      list.push(s);
      sessionsByVisitor.set(s.visitor_id as string, list);
    }
    for (const p of pv) {
      const list = pagesBySession.get(p.session_id as string) ?? [];
      list.push(p);
      pagesBySession.set(p.session_id as string, list);
    }
    for (const v of vs) device.set(v.visitor_id as string, (v.device_type as string) ?? null);
  }

  const formBySession = new Map<string, Record<string, unknown>[]>();
  if (want.form) {
    const sessionIds = [...new Set(leads.map((l) => l.session_id).filter((v): v is string => !!v))];
    for (const c of chunks(sessionIds, 200)) {
      const data = await allRows((from, to) => admin.from("form_engagement").select("session_id, page_path, viewed_at, first_input_at, ended_at, form_fields, field_timings").eq("site_id", siteId).eq("status", "submitted").in("session_id", c).order("id").range(from, to));
      for (const f of data) {
        const list = formBySession.get(f.session_id as string) ?? [];
        list.push(f);
        formBySession.set(f.session_id as string, list);
      }
    }
  }

  return leads.map((l) =>
    buildJourney(l, l.visitor_id ? sessionsByVisitor.get(l.visitor_id) ?? [] : [], pagesBySession, l.visitor_id ? device.get(l.visitor_id) ?? null : null, l.session_id ? formBySession.get(l.session_id) ?? [] : []),
  );
}

/**
 * The leads (all of the site's, or the given ones) that match a v2 mark, with the evidence for each.
 * Answers are checked before anything else is read; visits only for the leads still in the running.
 */
export async function matchV2(siteId: string, rule: MarkRuleV2, onlyLeads?: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  let leads = await readLeads(siteId, onlyLeads);
  if (rule.answers.length) {
    const answersOnly: MarkRuleV2 = { v: 2, blocks: [], answers: rule.answers, form: [] };
    leads = leads.filter((l) => checkLead(answersOnly, { leadId: l.id, submittedAt: t(l.submitted_at), convertingSessionId: l.session_id, sessions: [], device: null, answers: (l.raw_data as Record<string, unknown>) ?? {}, form: null }).match);
  }
  if (!leads.length) return out;
  const want = needs(rule);
  // "left while filling" needs the visit's pages
  const wantVisits = want.visits || rule.form.some((c) => c.kind === "leftWhileFilling");
  if (!wantVisits && !want.form) {
    for (const l of leads) {
      const r = checkLead(rule, { leadId: l.id, submittedAt: t(l.submitted_at), convertingSessionId: l.session_id, sessions: [], device: null, answers: (l.raw_data as Record<string, unknown>) ?? {}, form: null });
      if (r.match) out.set(l.id, r.parts);
    }
    return out;
  }
  // 100 visitors at a time
  const byVisitor = new Map<string, LeadRow[]>();
  for (const l of leads) {
    const k = l.visitor_id ?? "lead:" + l.id;
    byVisitor.set(k, [...(byVisitor.get(k) ?? []), l]);
  }
  for (const group of chunks([...byVisitor.values()], VISITOR_CHUNK)) {
    const js = await journeys(siteId, group.flat(), { visits: wantVisits, form: want.form });
    for (const j of js) {
      const r = checkLead(rule, j);
      if (r.match) out.set(j.leadId, r.parts);
    }
  }
  return out;
}
