// jh-marks/v2/check.ts
// Does one lead match a v2 mark, and why? Pure: it works on the lead's JOURNEY (built by lib/marks/journey.ts from the
// same rows the lead page uses), so a mark sees exactly the numbers the visit chart shows. Rules: ./rule.ts.
//
// Order of work (cheap first; the first false stops the lead):
//   1. answers (one lookup each)  2. form activity  3. visit blocks, the simplest first.
// Visits: only those that started at or before the form was sent; in the visit it was sent in, only the pages opened
// at or before sending. Visit numbers count from the visitor's first visit ever (1 = first).
// "then" blocks: tried against every later visit, with backtracking (if the first matching visit leaves no later visit
// for the rest of the chain, the next matching visit is tried).
import { answerRange, matchChoice, matchNumber, pickedValues, rawKeyOf } from "../../lib/forms/answers";
import { channelOf, type VisitSource } from "../../lib/acquisition/channel";
import { fmtSec, type AnswerCond, type Block, type FormCond, type MarkRuleV2, type NumCond, type PageCond, type PageGroup, type PageStep, type RootWhich, type SessionCond, type ThenWhich } from "./rule";

// ── the journey (one lead, up to sending) ────────────────────────────────────

export interface JPage {
  path: string;
  enteredAt: number;
  /** null while still open */
  ms: number | null;
  /** share of the page seen (0-100), null when the screen height was never recorded */
  seenPct: number | null;
  /** heading key -> ms on screen (lib/tracking/headingTime.js); null before heading time was recorded */
  headings: Map<string, number> | null;
  /** all time on headings of this page view (headings and above the first one; not "passing through") */
  headingTotalMs: number;
}

export interface JSession {
  id: string;
  /** 1 = the visitor's first visit ever */
  number: number;
  startedAt: number;
  /** visit length; for the visit the form was sent in, up to sending. null when unknown */
  ms: number | null;
  referrer: string | null;
  utmSource: string | null;
  /** everything the landing link said (utm_*, click id, landing page), for "came from this ad" */
  src?: VisitSource;
  pages: JPage[];
}

export interface JFieldTiming {
  firstFocusAt: number | null;
  firstKeyAt: number | null;
  focusedMs: number | null;
  edits: number;
  errors: number;
  filled: boolean | null;
}

export interface JForm {
  viewedAt: number | null;
  firstInputAt: number | null;
  endedAt: number | null;
  /** the form's fields (keys) when known */
  fieldKeys: string[] | null;
  timings: Record<string, JFieldTiming>;
  /** opened another page or was away 10 s or more between the first key and sending; null when unknown */
  leftWhileFilling: boolean | null;
}

export interface Journey {
  leadId: string;
  submittedAt: number;
  convertingSessionId: string | null;
  /** visits up to sending, oldest first */
  sessions: JSession[];
  device: string | null;
  /** form_submissions.raw_data */
  answers: Record<string, unknown>;
  /** the form they sent, when its activity was recorded */
  form: JForm | null;
}

export interface CheckResult {
  match: boolean;
  /** short evidence for the badge ("Budget: $1k-$5k", "visit 3: /pricing 40 s") */
  parts: string[];
}

// ── numbers ──────────────────────────────────────────────────────────────────

export function holds(value: number | null | undefined, n: NumCond): boolean {
  if (value === null || value === undefined || !Number.isFinite(value)) return false;
  switch (n.op) {
    case ">=":
      return value >= n.a;
    case ">":
      return value > n.a;
    case "<=":
      return value <= n.a;
    case "<":
      return value < n.a;
    case "=":
      return value === n.a;
    case "between":
      return value >= n.a && value <= (n.b ?? n.a);
  }
}
const sec = (ms: number | null | undefined) => (ms === null || ms === undefined ? null : ms / 1000);
const secTxt = (ms: number) => fmtSec(Math.round(ms / 1000));

// ── answers and form ─────────────────────────────────────────────────────────

function answerHolds(c: AnswerCond, answers: Record<string, unknown>): string | null {
  const raw = answers[rawKeyOf(c.field)];
  const shown = typeof raw === "string" ? raw.slice(0, 40) : "";
  switch (c.kind) {
    case "number": {
      const r = answerRange(raw, c.options);
      const ok = c.n.op === "between" ? matchNumber(r, "between", c.n.a, c.n.b) : matchNumber(r, c.n.op, c.n.a);
      // the visible text of a picked option reads better than its value ("$1k-$5k", not "tier_2")
      const label = c.options?.find((o) => typeof raw === "string" && o.v.toLowerCase() === raw.trim().toLowerCase())?.l;
      return ok ? `${c.name}: ${label || shown}` : null;
    }
    case "choice": {
      const hit = matchChoice(raw, c.values, c.options);
      return (c.op === "is" ? hit : !hit && pickedValues(raw).length > 0) ? `${c.name}: ${shown}` : null;
    }
    case "multi":
      return matchChoice(raw, c.values, c.options) ? `${c.name}: ${shown}` : null;
    case "yesno": {
      const checked = pickedValues(raw).length > 0;
      return checked === c.checked ? `${c.name}: ${c.checked ? "yes" : "no"}` : null;
    }
    case "text": {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (c.op === "empty") return text ? null : `${c.name}: empty`;
      if (c.op === "notEmpty") return text ? `${c.name} filled` : null;
      return text.toLowerCase().includes((c.value ?? "").toLowerCase()) ? `${c.name} mentions "${c.value}"` : null;
    }
  }
}

function formHolds(c: FormCond, j: Journey): string | null {
  const f = j.form;
  if (c.kind === "fieldEmpty") {
    const raw = j.answers[rawKeyOf(c.field)];
    const empty = typeof raw !== "string" || !raw.trim();
    return empty === c.value ? `${c.name} ${c.value ? "left empty" : "filled"}` : null;
  }
  if (!f) return null; // no form activity recorded: nothing about how it was filled can be proven
  switch (c.kind) {
    case "fillTime": {
      const ms = f.firstInputAt !== null && f.endedAt !== null ? f.endedAt - f.firstInputAt : null;
      return holds(sec(ms), c.n) ? `filled in ${secTxt(ms!)}` : null;
    }
    case "timeToStart": {
      const ms = f.viewedAt !== null && f.firstInputAt !== null ? f.firstInputAt - f.viewedAt : null;
      return holds(sec(ms), c.n) ? `started after ${secTxt(ms!)}` : null;
    }
    case "emptyFields": {
      if (!f.fieldKeys) return null;
      const empty = f.fieldKeys.filter((k) => f.timings[k]?.filled !== true).length;
      return holds(empty, c.n) ? `${empty} fields empty` : null;
    }
    case "errors": {
      const n = Object.values(f.timings).reduce((s, t) => s + (t.errors || 0), 0);
      return holds(n, c.n) ? `${n} form errors` : null;
    }
    case "leftWhileFilling":
      return f.leftWhileFilling === c.value ? (c.value ? "left the form while filling" : "filled it in one go") : null;
    case "fieldHesitation": {
      const t = f.timings[c.field];
      const ms = t && t.firstFocusAt !== null && t.firstKeyAt !== null ? t.firstKeyAt - t.firstFocusAt : null;
      return holds(sec(ms), c.n) ? `${secTxt(ms!)} before typing in ${c.name}` : null;
    }
    case "fieldTime": {
      const ms = f.timings[c.field]?.focusedMs ?? null;
      return holds(sec(ms), c.n) ? `${secTxt(ms!)} in ${c.name}` : null;
    }
    case "fieldEdits": {
      const n = f.timings[c.field]?.edits ?? 0;
      return holds(n, c.n) ? `${c.name} changed ${n}x` : null;
    }
  }
}

// ── pages and visits ─────────────────────────────────────────────────────────

const pathFits = (s: PageStep, p: JPage) => (s.match === "startsWith" ? p.path.toLowerCase().startsWith(s.path.toLowerCase()) : p.path === s.path);

/** One page condition on one page view ("views" is checked on the visit, see stepAny). */
function pageCondHolds(c: PageCond, p: JPage): boolean {
  switch (c.kind) {
    case "time":
      return holds(sec(p.ms), c.n);
    case "seen":
      return holds(p.seenPct, c.n);
    case "views":
      return true;
    case "heading": {
      if (!p.headings) return false; // recorded before time per heading existed: cannot tell
      const ms = p.headings.get(c.heading.key) ?? 0;
      if (c.state === "notSeen") return ms <= 0;
      return ms > 0 && (!c.n || holds(sec(ms), c.n));
    }
    case "headingShare": {
      if (!p.headings || p.headingTotalMs <= 0) return false;
      return holds((100 * (p.headings.get(c.heading.key) ?? 0)) / p.headingTotalMs, c.n);
    }
  }
}

const stepFits = (s: PageStep, p: JPage) => pathFits(s, p) && s.conds.every((c) => pageCondHolds(c, p));

/** The page views that make a page group true, or null. */
function groupHolds(g: PageGroup, pages: JPage[]): JPage[] | null {
  if (g.order === "any") {
    const used: JPage[] = [];
    for (const s of g.steps) {
      const views = s.conds.find((c) => c.kind === "views");
      if (views && views.kind === "views" && !holds(pages.filter((p) => pathFits(s, p)).length, views.n)) return null;
      const hit = pages.find((p) => stepFits(s, p));
      if (!hit) return null;
      used.push(hit);
    }
    return used;
  }
  // a sequence: step i on page index k, step i+1 right after it ("next") or anywhere later ("later"); backtracking
  const walk = (i: number, after: number): JPage[] | null => {
    if (i === g.steps.length) return [];
    const s = g.steps[i];
    for (let k = after + 1; k < pages.length; k++) {
      if (i > 0 && s.link === "next" && k !== after + 1) break;
      if (!stepFits(s, pages[k])) continue;
      const rest = walk(i + 1, k);
      if (rest) return [pages[k], ...rest];
    }
    return null;
  };
  return walk(0, -1);
}

function sessionCondHolds(c: SessionCond, s: JSession, j: Journey): boolean {
  switch (c.kind) {
    case "duration":
      return holds(sec(s.ms), c.n);
    case "pages":
      return holds(s.pages.length, c.n);
    case "heading": {
      const recorded = s.pages.some((p) => p.headings);
      if (!recorded) return false;
      const ms = s.pages.reduce((n, p) => n + (p.headings?.get(c.heading.key) ?? 0), 0);
      if (c.state === "notSeen") return ms <= 0;
      return ms > 0 && (!c.n || holds(sec(ms), c.n));
    }
    case "headingShare": {
      const total = s.pages.reduce((n, p) => n + p.headingTotalMs, 0);
      if (total <= 0) return false;
      return holds((100 * s.pages.reduce((n, p) => n + (p.headings?.get(c.heading.key) ?? 0), 0)) / total, c.n);
    }
    case "source": {
      const from = `${s.referrer ?? ""} ${s.utmSource ?? ""}`.toLowerCase();
      return from.includes(c.value);
    }
    case "device":
      return (j.device ?? "").toLowerCase() === c.value;
    case "channel": {
      const ch = channelOf(s.src ?? { referrer: s.referrer, utm_source: s.utmSource, utm_medium: null, utm_campaign: null });
      const has = (v: string | null, want?: string) => !want || (v ?? "").toLowerCase().includes(want.toLowerCase());
      if (c.platform && ch.platform.toLowerCase() !== c.platform.toLowerCase()) return false;
      if (c.paid === "paid" && !ch.paid) return false;
      if (c.paid === "free" && ch.paid) return false;
      return has(ch.campaign, c.campaign) && has(ch.ad, c.ad);
    }
  }
}

/** A rough cost, so cheap blocks are checked first. */
function cost(b: Block): number {
  const steps = b.pages?.steps.length ?? 0;
  return b.session.length + steps * (b.pages?.order === "sequence" ? 4 : 2) + b.then.reduce((n, t) => n + 5 + cost(t), 0) + (b.which.kind === "any" || b.which.kind === "every" || b.which.kind === "later" ? 3 : 0);
}

function whichFits(w: RootWhich | ThenWhich, s: JSession, j: Journey, parent: JSession | null): boolean {
  if (parent && s.number <= parent.number) return false; // a "then" visit is always after its parent's
  switch (w.kind) {
    case "converting":
    case "last":
      return s.id === convertingId(j);
    case "first":
      return s.number === 1;
    case "nth":
      return holds(s.number, w.n);
    case "any":
    case "every":
    case "later":
      return true;
  }
}

/** The visit the form was sent in (the last visit up to sending when its id is unknown). */
function convertingId(j: Journey): string | null {
  if (j.convertingSessionId && j.sessions.some((s) => s.id === j.convertingSessionId)) return j.convertingSessionId;
  return j.sessions.length ? j.sessions[j.sessions.length - 1].id : null;
}

/** Is block b true on visit s (and are its "then" blocks true on later visits)? Returns the evidence, or null. */
function blockOn(b: Block, s: JSession, j: Journey): string[] | null {
  if (!b.session.every((c) => sessionCondHolds(c, s, j))) return null;
  let pages: JPage[] = [];
  if (b.pages) {
    const hit = groupHolds(b.pages, s.pages);
    if (!hit) return null;
    pages = hit;
  }
  const parts = [`visit ${s.number}` + (pages.length ? ": " + pages.map((p) => p.path + (p.ms !== null ? " " + secTxt(p.ms) : "")).join(" > ") : "")];
  for (const t of [...b.then].sort((x, y) => cost(x) - cost(y))) {
    let found: string[] | null = null;
    for (const later of j.sessions) {
      if (!whichFits(t.which, later, j, s)) continue;
      found = blockOn(t, later, j);
      if (found) break;
    }
    if (!found) return null;
    parts.push(...found);
  }
  return parts;
}

function rootHolds(b: Block, j: Journey): string[] | null {
  const candidates = j.sessions.filter((s) => whichFits(b.which, s, j, null));
  if (b.which.kind === "every") {
    if (!candidates.length) return null;
    const all: string[] = [];
    for (const s of candidates) {
      const r = blockOn(b, s, j);
      if (!r) return null;
      all.push(...r);
    }
    return [`every visit (${candidates.length})`];
  }
  for (const s of candidates) {
    const r = blockOn(b, s, j);
    if (r) return r;
  }
  return null;
}

/** Does this lead match the mark? Pure. */
export function checkLead(rule: MarkRuleV2, j: Journey): CheckResult {
  const parts: string[] = [];
  for (const c of rule.answers) {
    const r = answerHolds(c, j.answers);
    if (!r) return { match: false, parts: [] };
    parts.push(r);
  }
  for (const c of rule.form) {
    const r = formHolds(c, j);
    if (!r) return { match: false, parts: [] };
    parts.push(r);
  }
  for (const b of [...rule.blocks].sort((x, y) => cost(x) - cost(y))) {
    const r = rootHolds(b, j);
    if (!r) return { match: false, parts: [] };
    parts.push(...r);
  }
  return { match: true, parts: [...new Set(parts)].slice(0, 6) };
}

/** What the mark needs loaded: lets the server skip reading visits or form activity it does not use. */
export function needs(rule: MarkRuleV2): { visits: boolean; form: boolean } {
  return { visits: rule.blocks.length > 0, form: rule.form.some((c) => c.kind !== "fieldEmpty") };
}
