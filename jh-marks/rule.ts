// jh-marks/rule.ts
// A mark is a named set of conditions a lead must meet ("Pricing reader": saw /pricing for 30 s or more). This file is the
// mark's own small language, the one the chip builder edits: what it can say, how it is checked (validateRule), how it
// becomes a Hook query (compileRule, entity "lead", output ids) and how it reads in plain English (describeRule).
// Pure, no database. Design: mds/build/marks/marks.md.
//
// The model, as the builder draws it:
//   - a ROW is one requirement. Its cards are pages; conditions joined onto a card (time, read %, times) are about
//     that same page. A row in "any order" means every card's page was seen; "in this order" means seen one after the
//     other in the same visit.
//   - LEAD chips are about the lead as a whole (visits, pages, source, device, form time, read every page, total time).
//   - Every row and every lead chip must be true.
//   - scope: which visits count. "any" = every visit up to sending the form; "converting" = only the visit it was sent
//     in; "all" = each visit up to sending must meet every page row (lead chips then use "any").
// Nothing after the form was sent counts: a mark means "what they did before contacting you", so a badge never
// changes after the fact (founder decision 2026-10-15).
import { normalizeSpec } from "../jh-ai/normalize";
import type { HookSpec } from "../jh-hook/types";

export type Scope = "any" | "all" | "converting";
export type PageMatch = "exact" | "startsWith";

export interface PageCard {
  id: string;
  path: string;
  match: PageMatch;
  /** stayed at least this long on one view of the page */
  minSeconds?: number | null;
  /** read (saw on screen) at least this share of the page, in one view */
  minReadPct?: number | null;
  /** viewed at least this many times */
  minTimes?: number | null;
  /** where the views are counted: across all visits (default) or within one visit */
  timesIn?: "visits" | "visit";
}

export interface PageRow {
  id: string;
  order: "any" | "sequence";
  cards: PageCard[];
}

export type LeadChip =
  | { id: string; kind: "visits"; min: number }
  | { id: string; kind: "pages"; min: number }
  | { id: string; kind: "readEvery"; minPct: number }
  | { id: string; kind: "totalTime"; minSeconds: number }
  | { id: string; kind: "source"; value: string }
  | { id: string; kind: "device"; value: "desktop" | "mobile" }
  | { id: string; kind: "formTime"; op: "under" | "over"; seconds: number };

export interface MarkRule {
  v: 1;
  scope: Scope;
  rows: PageRow[];
  lead: LeadChip[];
}

export const MARK_LIMIT = 5; // marks per person per site (founder decision 2026-10-15)
export const MAX_ROWS = 6;
export const MAX_CARDS = 4;
export const MAX_LEAD_CHIPS = 8;

export const emptyRule = (): MarkRule => ({ v: 1, scope: "any", rows: [], lead: [] });

// ── checking ─────────────────────────────────────────────────────────────────

export class RuleError extends Error {}

let seq = 0;
/** A short id for a new row, card or chip (unique enough within one rule). */
export const newId = (p = "x") => p + Date.now().toString(36).slice(-4) + (++seq).toString(36);

const int = (v: unknown, lo: number, hi: number, what: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new RuleError(`${what} must be between ${lo} and ${hi}.`);
  return Math.round(n);
};
const optInt = (v: unknown, lo: number, hi: number, what: string): number | null => (v === null || v === undefined || v === "" ? null : int(v, lo, hi, what));

/** Cleans a page path: must start with "/", no query string or hash, at most 200 characters. */
export function cleanPath(p: unknown): string {
  if (typeof p !== "string") throw new RuleError("A page needs an address like /pricing.");
  let s = p.trim();
  try {
    if (/^https?:\/\//i.test(s)) s = new URL(s).pathname; // pasted a full address
  } catch {
    /* keep as typed */
  }
  s = s.split("?")[0].split("#")[0];
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 200) throw new RuleError("That page address is too long.");
  return s;
}

/** Checks and cleans a rule from anywhere (the builder, the AI, the database). Throws RuleError with a message for people. */
export function validateRule(x: unknown): MarkRule {
  const r = x as Partial<MarkRule> | null;
  if (!r || typeof r !== "object") throw new RuleError("The mark is empty.");
  const scope: Scope = r.scope === "all" || r.scope === "converting" ? r.scope : "any";
  const rowsIn = Array.isArray(r.rows) ? r.rows : [];
  const leadIn = Array.isArray(r.lead) ? r.lead : [];
  if (rowsIn.length > MAX_ROWS) throw new RuleError(`At most ${MAX_ROWS} page rows.`);
  if (leadIn.length > MAX_LEAD_CHIPS) throw new RuleError(`At most ${MAX_LEAD_CHIPS} lead conditions.`);
  const rows: PageRow[] = rowsIn
    .map((row) => {
      const cardsIn = Array.isArray(row?.cards) ? row.cards : [];
      if (cardsIn.length > MAX_CARDS) throw new RuleError(`At most ${MAX_CARDS} pages in one row.`);
      const order = row?.order === "sequence" && cardsIn.length > 1 ? "sequence" : "any";
      const cards: PageCard[] = cardsIn.map((c) => {
        const minTimes = order === "sequence" ? null : optInt(c?.minTimes, 1, 100, "Times");
        return {
          id: typeof c?.id === "string" && c.id ? c.id.slice(0, 40) : newId("c"),
          path: cleanPath(c?.path),
          match: c?.match === "startsWith" ? "startsWith" : "exact",
          minSeconds: optInt(c?.minSeconds, 1, 86_400, "Time on the page (seconds)"),
          minReadPct: optInt(c?.minReadPct, 1, 100, "Read %"),
          minTimes: minTimes && minTimes > 1 ? minTimes : null,
          timesIn: c?.timesIn === "visit" ? "visit" : "visits",
        };
      });
      return { id: typeof row?.id === "string" && row.id ? row.id.slice(0, 40) : newId("r"), order, cards } as PageRow;
    })
    .filter((row) => row.cards.length > 0);
  const lead: LeadChip[] = leadIn.map((c): LeadChip => {
    const id = typeof c?.id === "string" && c.id ? c.id.slice(0, 40) : newId("l");
    switch (c?.kind) {
      case "visits":
        return { id, kind: "visits", min: int(c.min, 1, 100, "Visits") };
      case "pages":
        return { id, kind: "pages", min: int(c.min, 1, 500, "Pages") };
      case "readEvery":
        return { id, kind: "readEvery", minPct: int(c.minPct, 1, 100, "Read %") };
      case "totalTime":
        return { id, kind: "totalTime", minSeconds: int(c.minSeconds, 1, 86_400, "Time on the site (seconds)") };
      case "source": {
        const v = typeof c.value === "string" ? c.value.trim().toLowerCase().slice(0, 60) : "";
        if (!v) throw new RuleError("Came from needs a source, like google.");
        return { id, kind: "source", value: v };
      }
      case "device":
        return { id, kind: "device", value: c.value === "mobile" ? "mobile" : "desktop" };
      case "formTime":
        return { id, kind: "formTime", op: c.op === "over" ? "over" : "under", seconds: int(c.seconds, 1, 3600, "Form time (seconds)") };
      default:
        throw new RuleError("Unknown condition.");
    }
  });
  if (!rows.length && !lead.length) throw new RuleError("Add at least one condition.");
  return { v: 1, scope, rows, lead };
}

// ── compiling to Hook ───────────────────────────────────────────────────────

type J = Record<string, unknown>;

/** The Hook query a mark runs: every lead that meets the rule. Built with Hook's own normalizer, so it is a valid spec. */
export function compileRule(rule: MarkRule): HookSpec {
  let n = 0;
  const id = () => "m" + ++n;
  const field = (f: string, op: string, value?: unknown): J => ({ id: id(), kind: "field", field: f, op, ...(value !== undefined ? { value } : {}) });
  const related = (relation: string, where: J[], measure?: { agg: string; field?: string }, op?: string, value?: unknown): J => ({
    id: id(), kind: "related", relation, where, ...(measure ? { measure, op, value } : {}),
  });
  const group = (mode: "and" | "or", where: J[], not = false): J => ({ id: id(), kind: "group", mode, ...(not ? { not: true } : {}), where });

  const leadScope = rule.scope === "converting" ? "converting" : "any";
  const pagesRel = leadScope === "converting" ? "visitPagesBeforeSubmit" : "pagesBeforeSubmit";

  // conditions of one card, on a page view
  const cardWhere = (c: PageCard): J[] => [
    field("page", c.match === "startsWith" ? "startsWith" : "=", c.path),
    ...(c.minSeconds ? [field("visitDuration", ">=", c.minSeconds * 1000)] : []),
    ...(c.minReadPct ? [field("seenPct", ">=", c.minReadPct)] : []),
  ];
  // page views reached through a visit (not through the lead's own "before sending" relations) must also be before sending
  const before = (): J => field("beforeSending", "isTrue");
  // a sequence: card 1, then (later in the same visit, still before sending) card 2, then card 3...
  const chain = (cards: PageCard[]): J[] => {
    const [first, ...rest] = cards;
    return [...cardWhere(first), ...(rest.length ? [related("pagesAfter", [before(), ...chain(rest)])] : [])];
  };

  // one row, checked from the lead (scope any / converting)
  const rowFromLead = (row: PageRow): J[] => {
    if (row.order === "sequence") return [related(pagesRel, chain(row.cards))];
    return row.cards.map((c) => {
      if (c.minTimes && c.minTimes > 1) {
        if (c.timesIn === "visit") {
          const inVisit = related("pageViews", [before(), ...cardWhere(c)], { agg: "count" }, ">=", c.minTimes);
          return leadScope === "converting" ? related("session", [inVisit]) : related("visitsBeforeSubmit", [inVisit]);
        }
        return related(pagesRel, cardWhere(c), { agg: "count" }, ">=", c.minTimes);
      }
      return related(pagesRel, cardWhere(c));
    });
  };
  // one row, checked inside one visit (scope all)
  const rowInVisit = (row: PageRow): J[] => {
    if (row.order === "sequence") return [related("pageViews", [before(), ...chain(row.cards)])];
    return row.cards.map((c) => (c.minTimes && c.minTimes > 1 ? related("pageViews", [before(), ...cardWhere(c)], { agg: "count" }, ">=", c.minTimes) : related("pageViews", [before(), ...cardWhere(c)])));
  };

  const where: J[] = [];
  if (rule.scope === "all" && rule.rows.length) {
    // no visit up to sending fails the rows: NOT (a visit where NOT (rows))
    where.push(group("and", [related("visitsBeforeSubmit", [group("and", rule.rows.flatMap(rowInVisit), true)])], true));
  } else {
    for (const row of rule.rows) where.push(...rowFromLead(row));
  }

  for (const c of rule.lead) {
    switch (c.kind) {
      case "visits":
        where.push(related("visitsBeforeSubmit", [], { agg: "count" }, ">=", c.min));
        break;
      case "pages":
        where.push(related(pagesRel, [], { agg: "count" }, ">=", c.min));
        break;
      case "readEvery":
        // at least one measured page, and no measured page read less than the share
        where.push(related(pagesRel, [field("seenPct", ">=", c.minPct)]));
        where.push(group("and", [related(pagesRel, [field("seenPct", "<", c.minPct)])], true));
        break;
      case "totalTime":
        where.push(related(pagesRel, [], { agg: "sum", field: "visitDuration" }, ">=", c.minSeconds * 1000));
        break;
      case "source": {
        const from = group("or", [field("referrer", "contains", c.value), field("utmSource", "contains", c.value)]);
        where.push(leadScope === "converting" ? related("session", [from]) : related("visitsBeforeSubmit", [from]));
        break;
      }
      case "device":
        where.push(related("visitor", [field("device", "=", c.value)]));
        break;
      case "formTime":
        where.push(related("submittedForm", [field("fillTime", c.op === "under" ? "<=" : ">=", c.seconds * 1000)]));
        break;
    }
  }
  return normalizeSpec({ entity: "lead", where, output: { kind: "ids" } });
}

// ── plain English ────────────────────────────────────────────────────────────

export const fmtSeconds = (s: number) => (s < 60 ? s + " s" : Math.floor(s / 60) + "m" + (s % 60 ? " " + (s % 60) + "s" : ""));
const pageName = (c: PageCard) => (c.match === "startsWith" ? "any page under " + c.path : c.path);
const times = (n: number) => (n === 2 ? "twice" : n + " times");

export function describeCard(c: PageCard, inSequence = false): string {
  const parts: string[] = [];
  if (c.minSeconds) parts.push("stayed " + fmtSeconds(c.minSeconds) + " or more");
  if (c.minReadPct) parts.push("read " + c.minReadPct + "% or more of it");
  let s = "saw " + pageName(c);
  if (!inSequence && c.minTimes && c.minTimes > 1) s += " " + times(c.minTimes) + " or more" + (c.timesIn === "visit" ? " in one visit" : "");
  if (parts.length) s += " (" + parts.join(", ") + ")";
  return s;
}

export function describeChip(c: LeadChip): string {
  switch (c.kind) {
    case "visits":
      return c.min === 1 ? "visited" : "visited " + c.min + " or more times";
    case "pages":
      return "saw " + c.min + " or more pages";
    case "readEvery":
      return "read " + c.minPct + "% or more of every page";
    case "totalTime":
      return "spent " + fmtSeconds(c.minSeconds) + " or more on the site";
    case "source":
      return "came from " + c.value;
    case "device":
      return "used a " + (c.value === "mobile" ? "phone" : "computer");
    case "formTime":
      return "filled the form in " + (c.op === "under" ? "under " : "over ") + fmtSeconds(c.seconds);
  }
}

export function describeRow(row: PageRow): string {
  if (row.order === "sequence") return row.cards.map((c, i) => (i === 0 ? describeCard(c, true) : "then " + describeCard(c, true).replace(/^saw /, ""))).join(", ") + ", in one visit";
  return row.cards.map((c) => describeCard(c)).join(", and ");
}

const SCOPE_WORDS: Record<Scope, string> = {
  any: "Before sending the form",
  converting: "In the visit they sent the form",
  all: "In every visit before sending the form",
};

/** One sentence per requirement, for the "Reads as" line and the mark's stored description of itself. */
export function describeRule(rule: MarkRule): string {
  const parts = [...rule.rows.map(describeRow), ...rule.lead.map(describeChip)];
  if (!parts.length) return "";
  const head = rule.scope === "all" && rule.rows.length ? SCOPE_WORDS.all : SCOPE_WORDS[rule.scope === "converting" ? "converting" : "any"];
  return head + ", they " + (parts.length === 1 ? parts[0] : parts.slice(0, -1).join("; ") + "; and " + parts[parts.length - 1]) + ".";
}

// ── colours and templates ────────────────────────────────────────────────────

/** Eight colours that read on light and dark backgrounds. */
export const MARK_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#64748b"] as const;

export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return MARK_COLORS[h % MARK_COLORS.length];
}

export interface MarkTemplate {
  key: string;
  name: string;
  description: string;
  rule: MarkRule;
  /** the template needs a page address of this site before it can be turned on */
  needsPath?: boolean;
}

export const TEMPLATES: MarkTemplate[] = [
  {
    key: "high-intent",
    name: "General high intent",
    description: "Read most of every page they opened, across at least two pages. People who read this carefully usually came for a reason.",
    rule: { v: 1, scope: "any", rows: [], lead: [{ id: "t1", kind: "readEvery", minPct: 80 }, { id: "t2", kind: "pages", min: 2 }] },
  },
  {
    key: "pricing",
    name: "Pricing reader",
    description: "Spent real time on the pricing page before contacting you.",
    rule: { v: 1, scope: "any", rows: [{ id: "t1", order: "any", cards: [{ id: "t2", path: "/pricing", match: "exact", minSeconds: 30 }] }], lead: [] },
    needsPath: true,
  },
  {
    key: "came-back",
    name: "Came back",
    description: "Visited more than once before contacting you: they thought about it.",
    rule: { v: 1, scope: "any", rows: [], lead: [{ id: "t1", kind: "visits", min: 2 }] },
  },
];
