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

/** A page the mark names, which each site sets for itself. */
export interface MarkVar {
  key: string;
  label: string;
  /** the publisher's default */
  default: string;
}

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
const v = (ctx: MakeContext, m: { vars?: MarkVar[] }, key: string) => ctx.vars[key]?.trim() || m.vars?.find((x) => x.key === key)?.default || "/";

/** Until a site has enough visits for its own normal (jh-stats/typical.ts), "long" means 5 minutes. */
export const FALLBACK_SESSION_HIGH_MS = 300_000;

export const CATALOG: CatalogMark[] = [
  // ── Starters pack ──
  {
    key: "high-activity",
    reads: "Their visit (the one they contacted you in) was longer than a normal visit on your site.",
    category: "starters",
    kind: "lead",
    name: "High activity",
    purpose: "Their visit was much longer than is normal on your site: a serious, well-informed lead.",
    color: "#22c55e",
    make: (ctx) => leads([rel("session", [f("duration", ">", Math.round(ctx.stats.sessionHighMs ?? FALLBACK_SESSION_HIGH_MS))])]),
    note: "Longer than your site's normal visit (typical time before converting, outliers left out, + 1 standard deviation). Until there are 20 visits: 5 minutes.",
    author: "Jellyhook",
  },
  {
    key: "fast-converters",
    category: "starters",
    kind: "lead",
    name: "Very interested",
    purpose: "Filled the form quickly and without hesitation: they knew what they wanted.",
    color: "#3b82f6",
    make: () => rule({ scope: "any", rows: [], lead: [{ id: "a", kind: "formTime", op: "under", seconds: 20 }] }),
    note: "Form filled in under 20 s (2 s would only catch autofill and paste).",
    author: "Jellyhook",
  },
  {
    key: "hero-cta",
    reads: "In the visit they contacted you in, the page they landed on led straight to the page where they sent the form.",
    category: "starters",
    kind: "lead",
    name: "Landing page converters",
    purpose: "Went straight from the page they landed on to the page where they contacted you.",
    color: "#f59e0b",
    make: () => leads([rel("visitPagesBeforeSubmit", [f("isLanding", "isTrue"), rel("nextPage", [f("isConversionPage", "isTrue")])])]),
    note: "The page they landed on led straight to the page they sent the form on. Button clicks are not used yet.",
    author: "Jellyhook",
  },
  {
    key: "high-intent",
    category: "starters",
    kind: "lead",
    name: "General high intent",
    purpose: "Read most of every page they opened, across at least two pages. People who read this carefully came for a reason.",
    color: "#14b8a6",
    make: () => rule({ scope: "any", rows: [], lead: [{ id: "a", kind: "readEvery", minPct: 80 }, { id: "b", kind: "pages", min: 2 }] }),
    author: "Jellyhook",
  },
  {
    key: "came-back",
    category: "starters",
    kind: "lead",
    name: "Came back",
    purpose: "Visited more than once before contacting you: they thought about it.",
    color: "#a855f7",
    make: () => rule({ scope: "any", rows: [], lead: [{ id: "a", kind: "visits", min: 2 }] }),
    author: "Jellyhook",
  },

  // ── Pricing ──
  {
    key: "pricing-reader",
    category: "pricing",
    kind: "lead",
    name: "Pricing reader",
    purpose: "Spent real time on your pricing page before contacting you: the price is on their mind.",
    color: "#ec4899",
    vars: [{ key: "pricing", label: "Pricing page", default: "/pricing" }],
    make(ctx) {
      return rule({ scope: "any", rows: [{ id: "r", order: "any", cards: [{ id: "c", path: v(ctx, this, "pricing"), match: "exact", minSeconds: 30 }] }], lead: [] });
    },
    author: "Jellyhook",
  },

  // ── Nurturing seekers ──
  {
    key: "form-hurdle",
    reads: "In a visit before contacting you, they started a form and left it unfinished.",
    category: "nurturing",
    kind: "lead",
    name: "Form was a hurdle",
    purpose: "Started a form, left it unfinished, and came back to send one later: something in the form held them back.",
    color: "#64748b",
    make: () => leads([rel("visitsBeforeSubmit", [rel("forms", [f("status", "=", "abandoned")])])]),
    author: "Jellyhook",
  },
  {
    key: "researchers",
    reads: "In the visit they contacted you in, after seeing the form they left the site and came back at least twice (each time 10 s or more away).",
    category: "nurturing",
    kind: "lead",
    name: "Researchers",
    purpose: "After seeing the form, left the site and came back at least twice in that visit, then contacted you: they compared before deciding.",
    color: "#0ea5e9",
    // the sending visit: a form there, after it was seen 2+ times away for 10 s or more
    make: () => leads([rel("session", [rel("forms", [f("awaysAfterSeen", ">=", 2)])])]),
    author: "Jellyhook",
  },
  {
    key: "extensive-researchers",
    reads: "In at least two visits, after seeing the form they left the site and came back at least twice (each time 10 s or more away).",
    category: "nurturing",
    kind: "lead",
    name: "Extensive researchers",
    purpose: "Did that in two or more visits: saw the form, left and came back at least twice, before finally contacting you.",
    color: "#6366f1",
    make: () => leads([rel("visitsBeforeSubmit", [rel("forms", [f("awaysAfterSeen", ">=", 2)])], [">=", 2])]),
    author: "Jellyhook",
  },

  // ── Uncertain converters ──
  {
    key: "hesitant-converters",
    reads: "While filling the form they sent, they opened another page or left the site for 10 s or more, and came back to send it.",
    category: "uncertain",
    kind: "lead",
    name: "Hesitant converters",
    purpose: "Started the form, went to another page or left the site in the middle of it, and still sent it in that visit.",
    color: "#f97316",
    make: () => leads([rel("submittedForm", [f("leftWhileFilling", "isTrue")])]),
    author: "Jellyhook",
  },
  {
    key: "convinced-by-content",
    reads: "After seeing the form they sent, they opened at least 3 other pages before sending it, and never left the site in that visit.",
    category: "uncertain",
    kind: "lead",
    name: "Convinced by the content",
    purpose: "Saw the form, then read at least 3 other pages without leaving the site, and came back to send it: your pages convinced them.",
    color: "#84cc16",
    make: () => leads([rel("submittedForm", [f("pagesSeenToSent", ">=", 3)]), rel("session", [none([rel("awayGaps", [])])])]),
    note: "No time away in that visit means no gap of 15 s or more between two pages (the same rule as the visit chart).",
    author: "Jellyhook",
  },
  {
    key: "saw-form-came-back",
    reads: "In a visit before contacting you, they saw a form and did not start it.",
    category: "uncertain",
    kind: "lead",
    name: "Saw a form, came back later",
    purpose: "Saw a form without starting it, and sent one in a later visit: they needed time to decide.",
    color: "#eab308",
    make: () => leads([rel("visitsBeforeSubmit", [rel("forms", [f("status", "=", "viewed")])])]),
    note: "A form seen but not started in any visit before sending; it does not check it was the same form.",
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
