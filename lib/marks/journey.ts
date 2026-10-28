// lib/marks/journey.ts
// Builds each lead's JOURNEY (jh-marks/v2/check.ts) from the database and checks a v2 mark against it. Server only,
// service role. The same rows the lead page reads: visits, page views (time, share seen, time per heading), the form's
// answers and how it was filled. Only what happened up to sending the form.
//
// Cost: leads are read in pages of 1,000; answers are checked first (no extra read); visits are read only when the mark
// has visit conditions, and only for the leads still in the running, 100 visitors at a time, so memory stays small on a
// big site. Page views (most of the rows) only for the visit the form was sent in, then for the other visits a lead
// still needs once its visits are known (pagesToRead). Design: mds/build/marks/marks-v2-plan.md, the short-cut:
// mds/build/marks/when-marks-run.md section 8.
import "server-only";
import { meteredAdmin } from "@/lib/db/admin";
import { checkLead, needs, pagesToRead, type Journey } from "@/jh-marks/v2/check";
import { buildJourney, type LeadRow } from "@/jh-marks/v2/journey";
import type { MarkRuleV2 } from "@/jh-marks/v2/rule";

const admin = meteredAdmin();

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

type Row = Record<string, unknown>;
const push = (m: Map<string, Row[]>, k: string, r: Row) => m.set(k, [...(m.get(k) ?? []), r]);

const PAGE_COLS = "visitor_id, session_id, page_path, entered_at, left_at, page_height, viewport_height, entry_scroll_depth, max_scroll_depth, revisit_start_scroll_depth, heading_time";

/** The rows journeys are built from, for one chunk of visitors. Page views only for the visits in `pagesRead`. */
interface Rows {
  sessionsByVisitor: Map<string, Row[]>;
  pagesBySession: Map<string, Row[]>;
  pagesRead: Set<string>;
  device: Map<string, string | null>;
  formBySession: Map<string, Row[]>;
  until: string;
}

/** Some visits' page views up to `until`, 200 visits a request (page_views_session_entered_idx). */
async function readPages(siteId: string, rows: Rows, sessionIds: string[]): Promise<void> {
  const ids = sessionIds.filter((s) => !rows.pagesRead.has(s));
  const got = await Promise.all(chunks(ids, 200).map((c) => allRows((from, to) => admin.from("page_views").select(PAGE_COLS).eq("site_id", siteId).in("session_id", c).lte("entered_at", rows.until).order("entered_at").order("page_view_id").range(from, to))));
  for (const p of got.flat()) push(rows.pagesBySession, p.session_id as string, p);
  for (const s of ids) rows.pagesRead.add(s);
}

/**
 * Visits, devices and sent forms for a set of leads (one chunk of visitors), and the page views of the visits the forms
 * were sent in, in one round of requests. The page views of their other visits are read later, only for the leads and
 * visits a mark still needs (jh-marks/v2/check.ts pagesToRead). Before (crowd test v3) every page view of every visitor
 * was read: a visitor's 20th visit read all 20 visits' pages for a mark about the visit the form was sent in.
 */
async function readRows(siteId: string, leads: LeadRow[], want: { visits: boolean; form: boolean }): Promise<Rows> {
  const visitors = [...new Set(leads.map((l) => l.visitor_id).filter((v): v is string => !!v))];
  const sent = [...new Set(leads.map((l) => l.session_id).filter((v): v is string => !!v))];
  // nothing after the latest sending in this group can count: read only up to it
  const until = new Date(Math.max(...leads.map((l) => t(l.submitted_at)))).toISOString();
  const rows: Rows = { sessionsByVisitor: new Map(), pagesBySession: new Map(), pagesRead: new Set(), device: new Map(), formBySession: new Map(), until };
  const visits = want.visits && visitors.length > 0;
  const [ss, vs, fs] = await Promise.all([
    visits ? visitRows(siteId, visitors, until) : [],
    visits ? allRows((from, to) => admin.from("visitors").select("visitor_id, device_type").eq("site_id", siteId).in("visitor_id", visitors).range(from, to)) : [],
    want.form ? Promise.all(chunks(sent, 200).map((c) => allRows((from, to) => admin.from("form_engagement").select("session_id, page_path, viewed_at, first_input_at, ended_at, form_fields, field_timings").eq("site_id", siteId).eq("status", "submitted").in("session_id", c).order("id").range(from, to)))).then((x) => x.flat()) : [],
    visits ? readPages(siteId, rows, sent) : null,
  ]);
  for (const s of ss) push(rows.sessionsByVisitor, s.visitor_id as string, s);
  for (const v of vs) rows.device.set(v.visitor_id as string, (v.device_type as string) ?? null);
  for (const f of fs) push(rows.formBySession, f.session_id as string, f);
  return rows;
}

const journeyOf = (l: LeadRow, r: Rows): Journey =>
  buildJourney(l, l.visitor_id ? r.sessionsByVisitor.get(l.visitor_id) ?? [] : [], r.pagesBySession, l.visitor_id ? r.device.get(l.visitor_id) ?? null : null, l.session_id ? r.formBySession.get(l.session_id) ?? [] : []);

/**
 * The leads (all of the site's, or the given ones) that match a v2 mark, with the evidence for each.
 * Answers are checked before anything else is read; visits only for the leads still in the running.
 */
export async function matchV2(siteId: string, rule: MarkRuleV2, onlyLeads?: string[]): Promise<Map<string, string[]>> {
  return (await matchV2Many(siteId, [{ id: "mark", rule }], onlyLeads)).get("mark") ?? new Map();
}

/**
 * Several v2 marks against the same leads, reading the leads and their visits ONCE for all of them. Before (crowd test
 * v1, mds/crowd-test/v1/summary.md D7) every mark read the leads' history itself: about 8 database calls per mark per
 * batch, one after another. Each mark's answers are still checked first, and visits or form activity are read only when
 * some mark needs them, only for the leads still in the running for some mark, 100 visitors at a time.
 * Returns, per mark id, the matching leads with their evidence. The result for a mark is the same as checking it alone.
 */
export async function matchV2Many(siteId: string, marks: { id: string; rule: MarkRuleV2 }[], onlyLeads?: string[]): Promise<Map<string, Map<string, string[]>>> {
  const out = new Map(marks.map((m) => [m.id, new Map<string, string[]>()]));
  if (!marks.length) return out;
  const leads = await readLeads(siteId, onlyLeads);
  if (!leads.length) return out;
  const bare = (l: LeadRow): Journey => ({ leadId: l.id, submittedAt: t(l.submitted_at), convertingSessionId: l.session_id, sessions: [], device: null, answers: (l.raw_data as Record<string, unknown>) ?? {}, form: null });

  // per mark: answers first; a mark that needs nothing more is decided here
  const pending = new Map<string, Set<string>>(); // mark id -> leads that still need their journey
  let wantVisits = false;
  let wantForm = false;
  for (const m of marks) {
    const answersOnly: MarkRuleV2 = { v: 2, blocks: [], answers: m.rule.answers, form: [] };
    const pass = m.rule.answers.length ? leads.filter((l) => checkLead(answersOnly, bare(l)).match) : leads;
    if (!pass.length) continue;
    const want = needs(m.rule);
    // "left while filling" needs the visit's pages
    const visits = want.visits || m.rule.form.some((c) => c.kind === "leftWhileFilling");
    if (!visits && !want.form) {
      for (const l of pass) {
        const r = checkLead(m.rule, bare(l));
        if (r.match) out.get(m.id)!.set(l.id, r.parts);
      }
      continue;
    }
    pending.set(m.id, new Set(pass.map((l) => l.id)));
    wantVisits ||= visits;
    wantForm ||= want.form;
  }
  if (!pending.size) return out;

  // one read of the journeys for every lead some mark still needs, 100 visitors at a time
  const needed = leads.filter((l) => [...pending.values()].some((s) => s.has(l.id)));
  const byVisitor = new Map<string, LeadRow[]>();
  for (const l of needed) {
    const k = l.visitor_id ?? "lead:" + l.id;
    byVisitor.set(k, [...(byVisitor.get(k) ?? []), l]);
  }
  for (const group of chunks([...byVisitor.values()], VISITOR_CHUNK)) {
    const ls = group.flat();
    const rows = await readRows(siteId, ls, { visits: wantVisits, form: wantForm });
    // per lead and mark: decided from what is read, or waiting for some visits' page views (jh-marks/v2/check.ts
    // pagesToRead: the lead's visits without their pages already rule many leads out)
    const waiting = new Map<LeadRow, string[]>();
    const more = new Set<string>();
    for (const l of ls) {
      const j = journeyOf(l, rows);
      for (const m of marks) {
        if (!pending.get(m.id)?.has(l.id)) continue;
        const need = pagesToRead(m.rule, j);
        if (!need) continue;
        const missing = [...need].filter((s) => !rows.pagesRead.has(s));
        if (missing.length) {
          missing.forEach((s) => more.add(s));
          waiting.set(l, [...(waiting.get(l) ?? []), m.id]);
          continue;
        }
        const r = checkLead(m.rule, j);
        if (r.match) out.get(m.id)!.set(l.id, r.parts);
      }
    }
    if (!more.size) continue;
    await readPages(siteId, rows, [...more]);
    for (const [l, ids] of waiting) {
      const j = journeyOf(l, rows);
      for (const id of ids) {
        const r = checkLead(marks.find((m) => m.id === id)!.rule, j);
        if (r.match) out.get(id)!.set(l.id, r.parts);
      }
    }
  }
  return out;
}
