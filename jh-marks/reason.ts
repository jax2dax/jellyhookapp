// jh-marks/reason.ts
// Why a lead has a mark, in a few words a salesperson reads in one glance: "/pricing: 2 views, longest 3m 10s, read
// 100%", "came 3 times", "from google". Hook decides WHETHER a lead has the mark (rule.ts compileRule); this only
// describes the evidence, from the lead's own rows. Pure. Same "before sending" and scope rules as rule.ts.
//
// The read share is the same formula as Hook's pageView.seenPct (jh-hook/engine/sqlmap.ts): the part of the page that
// was on screen at least once, as a share of the page. Empty when the screen height was never recorded.
import { fmtSeconds, type LeadChip, type MarkRule, type PageCard } from "./rule";

export interface ReasonPage {
  session_id: string;
  page_path: string | null;
  entered_at: string;
  left_at: string | null;
  page_height: number | null;
  viewport_height: number | null;
  entry_scroll_depth: number | null;
  max_scroll_depth: number | null;
  revisit_start_scroll_depth: number | null;
}

export interface ReasonInput {
  submittedAt: string;
  sessionId: string;
  /** the visitor's page views (any time: the ones after sending are dropped here) */
  pages: ReasonPage[];
  sessions: { session_id: string; started_at: string; referrer: string | null; utm_source: string | null }[];
  device: string | null;
  /** time to fill the form they sent, when known */
  fillMs: number | null;
}

/** Hook's seenPct, in JS. null when the page or screen height is unknown. */
export function seenPct(p: Pick<ReasonPage, "page_height" | "viewport_height" | "entry_scroll_depth" | "max_scroll_depth" | "revisit_start_scroll_depth">): number | null {
  const ph = Number(p.page_height);
  const vh = Number(p.viewport_height);
  if (!(vh > 0 && ph > 0)) return null;
  const v = Math.min(1, vh / ph);
  const top = (s: number) => s * (1 - v);
  const entry = p.entry_scroll_depth ?? 0;
  const seenTop = top(Math.min(entry, p.revisit_start_scroll_depth ?? p.entry_scroll_depth ?? 0));
  const seenBottom = Math.min(1, top(p.max_scroll_depth ?? p.entry_scroll_depth ?? 0) + v);
  return Math.round(100 * (seenBottom - seenTop) * 1e4) / 1e4;
}

const dur = (p: ReasonPage) => (p.left_at ? Math.max(0, Date.parse(p.left_at) - Date.parse(p.entered_at)) : null);
const matches = (c: PageCard, path: string | null) => !!path && (c.match === "startsWith" ? path.toLowerCase().startsWith(c.path.toLowerCase()) : path === c.path);
const pct = (n: number | null) => (n === null ? null : Math.round(n) + "%");
const secs = (ms: number) => fmtSeconds(Math.round(ms / 1000));

function cardFits(c: PageCard, p: ReasonPage): boolean {
  if (!matches(c, p.page_path)) return false;
  const d = dur(p);
  if (c.minSeconds && (d === null || d < c.minSeconds * 1000)) return false;
  const r = seenPct(p);
  if (c.minReadPct && (r === null || r < c.minReadPct)) return false;
  return true;
}

/** "/pricing: 2 views, longest 40 s, read 100%" (about the views that fit the card; all views of the page if none fit) */
function describeViews(c: PageCard, views: ReasonPage[]): string {
  const fit = views.filter((p) => cardFits(c, p));
  const use = fit.length ? fit : views.filter((p) => matches(c, p.page_path));
  const longest = Math.max(0, ...use.map((p) => dur(p) ?? 0));
  const read = use.map(seenPct).filter((x): x is number => x !== null);
  const bits = [use.length + (use.length === 1 ? " view" : " views")];
  if (longest > 0) bits.push("longest " + secs(longest));
  if (read.length) bits.push("read " + pct(Math.max(...read)));
  return (c.match === "startsWith" ? c.path + "…" : c.path) + ": " + bits.join(", ");
}

function chipReason(c: LeadChip, input: ReasonInput, pages: ReasonPage[], visits: ReasonInput["sessions"]): string | null {
  switch (c.kind) {
    case "visits":
      return visits.length + (visits.length === 1 ? " visit" : " visits");
    case "pages":
      return pages.length + " pages";
    case "readEvery": {
      const r = pages.map(seenPct).filter((x): x is number => x !== null);
      return r.length ? "read at least " + pct(Math.min(...r)) + " of every page" : null;
    }
    case "totalTime":
      return secs(pages.reduce((n, p) => n + (dur(p) ?? 0), 0)) + " on the site";
    case "source": {
      const s = visits.find((v) => (v.utm_source ?? "").toLowerCase().includes(c.value) || (v.referrer ?? "").toLowerCase().includes(c.value));
      return s ? "from " + c.value : null;
    }
    case "device":
      return input.device === "mobile" ? "on a phone" : "on a computer";
    case "formTime":
      return input.fillMs !== null ? "form filled in " + secs(input.fillMs) : null;
  }
}

/** Short phrases, in the rule's order. Empty when there is nothing to show (a mark made in Hook has no rule). */
export function reasonFor(rule: MarkRule | null, input: ReasonInput): string[] {
  if (!rule) return [];
  const sent = Date.parse(input.submittedAt);
  const sending = rule.scope === "converting";
  const before = input.pages.filter((p) => Date.parse(p.entered_at) <= sent).sort((a, b) => Date.parse(a.entered_at) - Date.parse(b.entered_at));
  const pages = sending ? before.filter((p) => p.session_id === input.sessionId) : before;
  const visits = input.sessions.filter((s) => Date.parse(s.started_at) <= sent && (!sending || s.session_id === input.sessionId));
  const out: string[] = [];
  for (const row of rule.rows) {
    if (row.order === "sequence") {
      out.push(row.cards.map((c) => c.path).join(" → ") + " in one visit");
      continue;
    }
    for (const c of row.cards) out.push(describeViews(c, pages));
  }
  for (const c of rule.lead) {
    const r = chipReason(c, input, pages, visits);
    if (r) out.push(r);
  }
  return out;
}
