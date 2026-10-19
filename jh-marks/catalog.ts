// jh-marks/catalog.ts
// The marks library ("Browse"): marks published for anyone to add. For now only Jellyhook publishes (this file);
// later people publish their own (a database table with the same shape). Grouped by category, and by type (only LEAD
// marks are built). Two ways to take one (lib/actions/marks.action.ts addFromLibrary):
//   - "Add to marks": a COPY. It becomes the person's own mark, editable; later changes here do not reach it.
//   - "Use mark": CONNECTED (plug icon). It stays this published mark: changes here apply to it. The person chooses
//     only its page variables (e.g. their pricing page is /plans) and whether it is on.
// A publisher may LOCK a mark (`locked`): the formula is hidden and only the page variables can be changed. None is
// locked today.
//
// Each entry is a function of its page variables and the site's statistics (`make`), so the same published mark fits
// every site. `note` says plainly where it approximates the idea. Design: mds/build/marks/marks.md, "Library".
import { normalizeSpec } from "../jh-ai/normalize";
import type { HookSpec } from "../jh-hook/types";
import { validateRule, type MarkRule } from "./rule";

export type MarkKind = "lead" | "session" | "form" | "visitor";
export const KIND_LABEL: Record<MarkKind, string> = { lead: "Lead marks", session: "Session marks", form: "Form marks", visitor: "Anonymous visitor marks" };

export interface CatalogCategory {
  key: string;
  name: string;
  blurb: string;
}

/** A value of the mark that each person can change: a page the mark names, or a number in its formula. */
export interface MarkVar {
  key: string;
  label: string;
  /** page: an address like /pricing. seconds / count / percent: a number. */
  type: "page" | "seconds" | "count" | "percent";
  /** the publisher's default. "" on a number = not set (the mark then uses its own rule, e.g. this site's normal). */
  default: string;
}

/** A number value of a mark, with its default when the person left it empty. */
const num = (ctx: { vars: Record<string, string> }, vs: MarkVar[], key: string): number | null => {
  const raw = ctx.vars[key]?.trim() ?? vs.find((x) => x.key === key)?.default ?? "";
  const n = Number(raw);
  return raw !== "" && Number.isFinite(n) ? n : null;
};

/** What `make` may use from the site's statistics (lib/stats/siteStats.ts), in ms; null when not enough data. */
export interface StatsInput {
  sessionHighMs: number | null;
}

export interface MakeContext {
  vars: Record<string, string>;
  stats: StatsInput;
}

export interface CatalogMark {
  key: string;
  category: string;
  kind: MarkKind;
  name: string;
  /** the purpose, in plain words (becomes the mark's purpose) */
  purpose: string;
  color: string;
  vars?: MarkVar[];
  /** builds the mark for one site: a chip rule (editable in the builder) or a Hook query */
  make: (ctx: MakeContext) => { rule: MarkRule } | { spec: HookSpec };
  /** what it checks, in plain words, for the marks written as a Hook query (a chip rule reads itself) */
  reads?: string;
  /** where it approximates the idea, said plainly (shown on the card) */
  note?: string;
  /** published with the formula hidden */
  locked?: boolean;
  /** stored, hidden for now (founder decision 2026-10-16) */
  author: string;
}

export const CATEGORIES: CatalogCategory[] = [
  { key: "starters", name: "Starters pack", blurb: "Good first marks for any lead site." },
  { key: "pricing", name: "Pricing", blurb: "Leads who looked hard at the price." },
  { key: "nurturing", name: "Nurturing seekers", blurb: "Leads who needed time, or found the form hard." },
  { key: "uncertain", name: "Uncertain converters", blurb: "Leads who hesitated before contacting you." },
];

// ── tiny builders for Hook queries (entity lead, output ids) ──
type J = Record<string, unknown>;
let n = 0;
const id = () => "k" + ++n;
const f = (field: string, op: string, value?: unknown): J => ({ id: id(), kind: "field", field, op, ...(value !== undefined ? { value } : {}) });
const rel = (relation: string, where: J[], count?: [string, number]): J => ({ id: id(), kind: "related", relation, where, ...(count ? { measure: { agg: "count" }, op: count[0], value: count[1] } : {}) });
const none = (where: J[]): J => ({ id: id(), kind: "group", mode: "and", not: true, where });
const leads = (where: J[]): { spec: HookSpec } => ({ spec: normalizeSpec({ entity: "lead", where, output: { kind: "ids" } }) });
const rule = (r: Omit<MarkRule, "v">): { rule: MarkRule } => ({ rule: validateRule({ v: 1, ...r }) });
const page = (ctx: MakeContext, vs: MarkVar[], key: string) => ctx.vars[key]?.trim() || vs.find((x) => x.key === key)?.default || "/";
const N = (ctx: MakeContext, vs: MarkVar[], key: string, fallback: number) => num(ctx, vs, key) ?? fallback;
const V = (key: string, label: string, type: MarkVar["type"], def: string): MarkVar => ({ key, label, type, default: def });

/** Until a site has enough visits for its own normal (jh-stats/typical.ts), "long" means 5 minutes. */
export const FALLBACK_SESSION_HIGH_MS = 300_000;

// Purposes are written about the lead, in plain words, like "Carefully analyzed the price and decided it is not worth it".
const HA = [V("seconds", "Longer than (s)", "seconds", "")];
const VI = [V("seconds", "Form filled in under (s)", "seconds", "20")];
const HI = [V("readPct", "Read at least (%)", "percent", "80"), V("pages", "Pages", "count", "2")];
const CB = [V("visits", "Visits", "count", "2")];
const PR = [V("pricing", "Pricing page", "page", "/pricing"), V("seconds", "Time on it (s)", "seconds", "30")];
const RE = [V("times", "Times away", "count", "2")];
const EX = [V("times", "Times away", "count", "2"), V("visits", "In visits", "count", "2")];
const CC = [V("pages", "Other pages", "count", "3")];

export const CATALOG: CatalogMark[] = [
  // ── Starters pack ──
  {
    key: "high-activity",
    category: "starters",
    kind: "lead",
    name: "High activity",
    purpose: "Stayed far longer than a normal visitor and went through the site in depth.",
    color: "#22c55e",
    vars: HA,
    make: (ctx) => leads([rel("session", [f("duration", ">", Math.round((num(ctx, HA, "seconds") !== null ? num(ctx, HA, "seconds")! * 1000 : ctx.stats.sessionHighMs) ?? FALLBACK_SESSION_HIGH_MS))])]),
    reads: "Their visit (the one they contacted you in) was longer than the time set here, or than a normal visit on your site when no time is set.",
    note: "With no time set: longer than your site's normal visit (typical time before converting, outliers left out, + 1 standard deviation). Until there are 20 visits: 5 minutes.",
    author: "Jellyhook",
  },
  {
    key: "fast-converters",
    category: "starters",
    kind: "lead",
    name: "Very interested",
    purpose: "Knew what they wanted: filled in the form quickly, without hesitating.",
    color: "#3b82f6",
    vars: VI,
    make: (ctx) => rule({ scope: "any", rows: [], lead: [{ id: "a", kind: "formTime", op: "under", seconds: Math.max(1, N(ctx, VI, "seconds", 20)) }] }),
    note: "Under 2 seconds would only catch autofill and paste, so the default is 20.",
    author: "Jellyhook",
  },
  {
    key: "hero-cta",
    category: "starters",
    kind: "lead",
    name: "Landing page converters",
    purpose: "Went from the first page they saw straight to contacting you, with no detours.",
    color: "#f59e0b",
    make: () => leads([rel("visitPagesBeforeSubmit", [f("isLanding", "isTrue"), rel("nextPage", [f("isConversionPage", "isTrue")])])]),
    reads: "In the visit they contacted you in, the page they landed on led straight to the page where they sent the form.",
    note: "Button clicks are not used yet.",
    author: "Jellyhook",
  },
  {
    key: "high-intent",
    category: "starters",
    kind: "lead",
    name: "General high intent",
    purpose: "Read nearly everything they opened, carefully, across several pages.",
    color: "#14b8a6",
    vars: HI,
    make: (ctx) => rule({ scope: "any", rows: [], lead: [{ id: "a", kind: "readEvery", minPct: Math.min(100, Math.max(1, N(ctx, HI, "readPct", 80))) }, { id: "b", kind: "pages", min: Math.max(1, N(ctx, HI, "pages", 2)) }] }),
    author: "Jellyhook",
  },
  {
    key: "came-back",
    category: "starters",
    kind: "lead",
    name: "Came back",
    purpose: "Thought it over: left, then returned before contacting you.",
    color: "#a855f7",
    vars: CB,
    make: (ctx) => rule({ scope: "any", rows: [], lead: [{ id: "a", kind: "visits", min: Math.max(1, N(ctx, CB, "visits", 2)) }] }),
    author: "Jellyhook",
  },

  // ── Pricing ──
  {
    key: "pricing-reader",
    category: "pricing",
    kind: "lead",
    name: "Pricing reader",
    purpose: "Looked carefully at the price before deciding to contact you.",
    color: "#ec4899",
    vars: PR,
    make: (ctx) => rule({ scope: "any", rows: [{ id: "r", order: "any", cards: [{ id: "c", path: page(ctx, PR, "pricing"), match: "exact", minSeconds: Math.max(1, N(ctx, PR, "seconds", 30)) }] }], lead: [] }),
    author: "Jellyhook",
  },

  // ── Nurturing seekers ──
  {
    key: "form-hurdle",
    category: "nurturing",
    kind: "lead",
    name: "Form was a hurdle",
    purpose: "Started the form, gave up on it, then returned to send one later: something in the form made them stop.",
    color: "#64748b",
    make: () => leads([rel("visitsBeforeSubmit", [rel("forms", [f("status", "=", "abandoned")])])]),
    reads: "In a visit before contacting you, they started a form and left it unfinished.",
    author: "Jellyhook",
  },
  {
    key: "researchers",
    category: "nurturing",
    kind: "lead",
    name: "Researchers",
    purpose: "Looked at the form, left and came back more than once, comparing options before contacting you.",
    color: "#0ea5e9",
    vars: RE,
    make: (ctx) => leads([rel("session", [rel("forms", [f("awaysAfterSeen", ">=", Math.max(1, N(ctx, RE, "times", 2)))])])]),
    reads: "In the visit they contacted you in, after seeing the form they left the site and came back at least the number of times set here (each time 10 s or more away).",
    note: "Away means 10 seconds or more between leaving one page and opening the next.",
    author: "Jellyhook",
  },
  {
    key: "extensive-researchers",
    category: "nurturing",
    kind: "lead",
    name: "Extensive researchers",
    purpose: "Spread their comparison over several visits, seeing the form and leaving more than once, before contacting you.",
    color: "#6366f1",
    vars: EX,
    make: (ctx) => leads([rel("visitsBeforeSubmit", [rel("forms", [f("awaysAfterSeen", ">=", Math.max(1, N(ctx, EX, "times", 2)))])], [">=", Math.max(1, N(ctx, EX, "visits", 2))])]),
    reads: "In at least the number of visits set here, after seeing the form they left the site and came back at least the number of times set here (each time 10 s or more away).",
    author: "Jellyhook",
  },

  // ── Uncertain converters ──
  {
    key: "hesitant-converters",
    category: "uncertain",
    kind: "lead",
    name: "Hesitant converters",
    purpose: "Began the form, stepped away in the middle of it, then came back and sent it.",
    color: "#f97316",
    make: () => leads([rel("submittedForm", [f("leftWhileFilling", "isTrue")])]),
    reads: "While filling the form they sent, they opened another page or left the site for 10 s or more, and came back to send it.",
    author: "Jellyhook",
  },
  {
    key: "convinced-by-content",
    category: "uncertain",
    kind: "lead",
    name: "Convinced by the content",
    purpose: "Saw the form, then read more of your pages without leaving, and were convinced enough to send it.",
    color: "#84cc16",
    vars: CC,
    make: (ctx) => leads([rel("submittedForm", [f("pagesSeenToSent", ">=", Math.max(1, N(ctx, CC, "pages", 3)))]), rel("session", [none([rel("awayGaps", [])])])]),
    reads: "After seeing the form they sent, they opened at least the number of other pages set here before sending it, and never left the site in that visit.",
    note: "No time away means no gap of 15 s or more between two pages (the same rule as the visit chart).",
    author: "Jellyhook",
  },
  {
    key: "saw-form-came-back",
    category: "uncertain",
    kind: "lead",
    name: "Saw a form, came back later",
    purpose: "Saw the form but did not start it, then returned in a later visit to send one.",
    color: "#eab308",
    make: () => leads([rel("visitsBeforeSubmit", [rel("forms", [f("status", "=", "viewed")])])]),
    reads: "In a visit before contacting you, they saw a form and did not start it.",
    note: "It does not check it was the same form.",
    author: "Jellyhook",
  },
];

export const catalogMark = (key: string | null | undefined) => (key ? CATALOG.find((m) => m.key === key) ?? null : null);

/** A short fingerprint of what a published mark does (not of the site's numbers): a new one means "updated". */
export function catalogVersion(m: CatalogMark): string {
  // ids inside a query are generated per call: leave them out so the same mark always has the same fingerprint
  const s = JSON.stringify(m.make({ vars: {}, stats: { sessionHighMs: 1 } }), (k, val) => (k === "id" ? undefined : val)) + m.purpose + m.name;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
