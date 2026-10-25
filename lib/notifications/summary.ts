// lib/notifications/summary.ts
// The visit summary and page summaries for hook messages (mds/build/notifications/session-summary.md). For the leads of
// one hook run that go to Slack or a webhook with a summary or pages asked for: their visitors' visits are read in one
// batch (sessions, page views, page structure), rebuilt exactly as the lead page does (lib/leadSessions/transform.js),
// and put in words by lib/leadSessions/story.ts. The visit with the form is cut at the form, so the summary is what they
// did before contacting you. Never throws for one lead: a lead whose data cannot be read gets no summary.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSessionsRaw, truncateSessionToSubmission } from "@/lib/leadSessions/transform";
import { fetchStructureRows } from "@/lib/leadSessions/structureRows";
import { pageSummary, sessionStoryVersion } from "@/lib/leadSessions/story";
import { resolveViewportHeightPx } from "@/framePlate/theme/deviceThemes";
import type { SessionRaw } from "@/framePlate/types";
import type { MessageOptions, PageSummaryLine, SummaryVersion } from "./message";

let adminClient: SupabaseClient | null = null;
const admin = () => (adminClient ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!));

/** Rows per request (PostgREST returns at most 1,000) and at most this many requests per table, so one visitor with a
 *  huge history cannot hold a hook run. Past it, the newest rows are kept. */
const PAGE = 1000;
const MAX_PAGES = 5;

export interface SummaryLead {
  id: string;
  visitor_id: string | null;
  session_id: string | null;
  submitted_at: string;
}
export interface SummaryWant {
  key: string; // rule id + "|" + lead id
  leadId: string;
  options: MessageOptions;
}
export type LeadSummary = { summary: { version: SummaryVersion; lines: string[] } | null; pages: PageSummaryLine[] | null };

/** Whether a hook's options need the lead's visits at all. */
export const wantsSummary = (o: MessageOptions) => o.summary !== "off" || o.pages.length > 0;

/** Newest first in pages of PAGE, then oldest first; at most MAX_PAGES requests. */
async function rows(db: SupabaseClient, table: "sessions" | "page_views", siteId: string, visitors: string[], timeCol: string, until: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await db.from(table).select("*").eq("site_id", siteId).in("visitor_id", visitors).lte(timeCol, until).order(timeCol, { ascending: false }).range(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error(table + ": " + error.message);
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }
  return out.reverse();
}

/**
 * The visit with the form, cut at the form. A form page still open (the visitor is on it, its end not reported yet)
 * ends at the submission: its heading times are the snapshot sent with the form (lib/tracking/pageSnapshot.js).
 */
function cutAtForm(s: SessionRaw, submittedAt: string): SessionRaw | null {
  const cut = truncateSessionToSubmission(s, { session_id: s.id, submitted_at: submittedAt }) as SessionRaw | null;
  if (!cut) return null;
  const last = cut.visits[cut.visits.length - 1];
  if (last.isOpen && Date.parse(last.leftAt) > Date.parse(submittedAt) && Date.parse(submittedAt) >= Date.parse(last.enteredAt)) {
    const visits = [...cut.visits.slice(0, -1), { ...last, leftAt: submittedAt, isOpen: false }];
    return { ...cut, visits, endedAt: submittedAt };
  }
  return cut;
}

/**
 * Summaries for each wanted rule and lead, keyed by want.key. Leads without visits, or whose visits cannot be read,
 * are left out (their messages go without a summary). `db` is the service-role client (a stand-in in tests).
 */
export async function buildSummaries(siteId: string, leads: SummaryLead[], wants: SummaryWant[], db: SupabaseClient = admin()): Promise<Map<string, LeadSummary>> {
  const out = new Map<string, LeadSummary>();
  const need = wants.filter((w) => wantsSummary(w.options));
  if (!need.length) return out;
  const byId = new Map(leads.map((l) => [l.id, l]));
  const wanted = [...new Set(need.map((w) => w.leadId))].map((id) => byId.get(id)).filter((l): l is SummaryLead => !!l && !!l.visitor_id);
  if (!wanted.length) return out;
  const visitors = [...new Set(wanted.map((l) => l.visitor_id as string))];
  const until = new Date(Math.max(...wanted.map((l) => Date.parse(l.submitted_at)).filter(Number.isFinite)) + 1000).toISOString();

  const [sessions, pageViews] = await Promise.all([rows(db, "sessions", siteId, visitors, "started_at", until), rows(db, "page_views", siteId, visitors, "entered_at", until)]);
  const paths = [...new Set(pageViews.map((v) => v.page_path as string).filter(Boolean))];
  const structure = await fetchStructureRows(db, siteId, paths);

  // each visitor's visits, as the lead page builds them
  const visitsOf = new Map<string, SessionRaw[]>();
  for (const visitor of visitors) {
    const mine = (r: Record<string, unknown>) => r.visitor_id === visitor;
    const subs = wanted.filter((l) => l.visitor_id === visitor).map((l) => ({ session_id: l.session_id, submitted_at: l.submitted_at }));
    visitsOf.set(visitor, buildSessionsRaw({ sessions: sessions.filter(mine), pageViews: pageViews.filter(mine), submissions: subs, pageStructure: structure }) as SessionRaw[]);
  }

  for (const w of need) {
    try {
      const lead = byId.get(w.leadId);
      if (!lead?.visitor_id) continue;
      const all = visitsOf.get(lead.visitor_id) ?? [];
      const sent = Date.parse(lead.submitted_at);
      // the visit with the form: its own session, else the last one that started before the form
      let i = lead.session_id ? all.findIndex((s) => s.id === lead.session_id) : -1;
      if (i < 0) i = all.map((s) => Date.parse(s.startedAt) <= sent).lastIndexOf(true);
      if (i < 0) continue;
      const formVisit = cutAtForm(all[i], lead.submitted_at);
      if (!formVisit) continue;
      const device = (pageViews.find((v) => v.session_id === formVisit.id)?.device_type as string) ?? null;
      const vh = resolveViewportHeightPx(undefined, device);
      const summary = w.options.summary === "off" ? null : { version: w.options.summary, lines: sessionStoryVersion(formVisit, i + 1, w.options.summary, vh).map((s) => s.text) };
      const scopeVisits = w.options.pageScope === "converting" ? [formVisit] : [...all.slice(0, i), formVisit];
      const pages = w.options.pages.length ? w.options.pages.map((path) => ({ path, scope: w.options.pageScope, text: pageSummary(path, scopeVisits, vh) })) : null;
      out.set(w.key, { summary, pages });
    } catch (e) {
      console.error("[notifications] summary failed for one lead", { lead: w.leadId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

/** buildSummaries within `budgetMs`. Past it, or on any failure, an empty map: the messages go without summaries. */
export async function summariesWithin(budgetMs: number, siteId: string, leads: SummaryLead[], wants: SummaryWant[], db?: SupabaseClient): Promise<Map<string, LeadSummary>> {
  if (!wants.some((w) => wantsSummary(w.options))) return new Map();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<"late">((resolve) => (timer = setTimeout(() => resolve("late"), budgetMs)));
  try {
    const r = await Promise.race([buildSummaries(siteId, leads, wants, db ?? admin()), late]);
    if (r === "late") {
      console.error("[notifications] summary skipped: over " + budgetMs + " ms", { site: siteId.slice(0, 8), leads: wants.length });
      return new Map();
    }
    return r;
  } catch (e) {
    console.error("[notifications] summary skipped", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}
