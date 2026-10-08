// jh-ai/examples.ts
// Question -> Hook query pairs. They do two jobs:
//   1. the ones marked fewShot are shown to the model in every request (they are part of the cached prompt);
//   2. ALL of them are the test set: `npm run test:ai` proves each expected query is valid and compiles, and
//      `npm run ai:eval` (needs a key) measures how often the real model produces the same query.
// Queries are written WITHOUT ids and without "v": the translator adds both (jh-ai/normalize.ts).
// Keep fixed "today" and "pages" so the expected answers do not depend on the calendar or on a site.
import type { HookSpec } from "../jh-hook/types";

export const EVAL_TODAY = "2026-10-08";
export const EVAL_PAGES = ["/", "/pricing", "/features", "/contact", "/blog/launch", "/about"];

type Json = Record<string, unknown>;
const f = (field: string, op: string, value?: unknown, value2?: unknown): Json => ({ kind: "field", field, op, ...(value !== undefined ? { value } : {}), ...(value2 !== undefined ? { value2 } : {}) });
const rel = (relation: string, where: Json[] = [], measure?: Json, op?: string, value?: unknown, value2?: unknown): Json => ({
  kind: "related", relation, where, ...(measure ? { measure } : {}), ...(op ? { op } : {}), ...(value !== undefined ? { value } : {}), ...(value2 !== undefined ? { value2 } : {}),
});
const grp = (mode: "and" | "or", where: Json[], not = false): Json => ({ kind: "group", mode, where, ...(not ? { not: true } : {}) });
const dur = (amount: number, unit: string) => ({ amount, unit });
const ago = (n: number, unit: string) => ({ ago: n, unit });
const count = { agg: "count" };
const q = (entity: string, where: Json[], output: Json): Json => ({ entity, where, output });
const by = (field: string, extra: Json = {}): Json => ({ kind: "groupBy", field, measure: count, ...extra });
const hook = (spec: Json) => ({ hook: spec });

export type Expect =
  | { status: "ok"; spec: Json }
  | { status: "clarify" }
  | { status: "unsupported" };

export interface Example {
  id: string;
  question: string;
  expect: Expect;
  fewShot?: boolean;
  /** For adjusting an existing query. */
  current?: Json;
  /** Other queries that are equally correct (same meaning, written differently). */
  alt?: Json[];
}

const ok = (spec: Json): Expect => ({ status: "ok", spec });

export const EXAMPLES: Example[] = [
  // ── simple counts and measures
  { id: "converted-sessions", fewShot: true, question: "how many sessions converted", expect: ok(q("session", [f("converted", "isTrue")], { kind: "count" })) },
  { id: "leads-7-days", question: "how many leads in the last 7 days", expect: ok(q("lead", [f("submittedAt", ">", ago(7, "day"))], { kind: "count" })) },
  { id: "pricing-views", question: "how many times was the pricing page viewed", expect: ok(q("pageView", [f("page", "=", "/pricing")], { kind: "count" })) },
  { id: "mobile-visitors", question: "how many mobile visitors do we have", expect: ok(q("visitor", [f("device", "=", "mobile")], { kind: "count" })) },
  { id: "google-sessions", question: "how many sessions came from google", expect: ok(q("session", [f("utmSource", "=", "google")], { kind: "count" })) },
  { id: "germany-sessions", question: "sessions from Germany", expect: ok(q("session", [f("country", "=", "Germany")], { kind: "ids" })) },
  { id: "avg-time-pricing", fewShot: true, question: "average time spent on the pricing page", expect: ok(q("pageView", [f("page", "=", "/pricing")], { kind: "aggregate", agg: "avg", field: "visitDuration" })) },
  { id: "median-session", question: "what is the median session length", expect: ok(q("session", [], { kind: "aggregate", agg: "median", field: "duration" })) },
  { id: "distinct-pages", question: "how many different pages were visited", expect: ok(q("pageView", [], { kind: "countDistinct", field: "page" })) },
  { id: "qualified-leads", question: "how many qualified leads", expect: ok(q("lead", [f("qualified", "isTrue")], { kind: "count" })) },
  { id: "leads-no-phone", question: "how many leads left no phone number", expect: ok(q("lead", [f("phone", "isEmpty")], { kind: "count" })) },
  { id: "chrome-visitors", question: "visitors using Chrome", expect: ok(q("visitor", [f("browser", "contains", "Chrome")], { kind: "ids" })), alt: [q("visitor", [f("browser", "=", "Chrome")], { kind: "ids" })] },

  // ── over time and rankings
  { id: "leads-per-day", fewShot: true, question: "leads per day over the last 30 days", expect: ok(q("lead", [f("submittedAt", ">", ago(30, "day"))], by("submittedAt", { bucket: "day", sort: "keyAsc" }))) },
  { id: "top-pages-week", fewShot: true, question: "top 10 pages by views this week", expect: ok(q("pageView", [f("enteredAt", ">", ago(7, "day"))], by("page", { sort: "valueDesc", limit: 10 }))) },
  { id: "campaigns-leads", question: "which campaigns bring leads",
    expect: ok(q("session", [f("converted", "isTrue")], by("utmCampaign", { sort: "valueDesc" }))),
    alt: [q("session", [f("converted", "isTrue")], by("utmSource", { sort: "valueDesc" }))],
  },
  { id: "sessions-per-week", question: "sessions per week for the last 3 months", expect: ok(q("session", [f("startedAt", ">", ago(3, "month"))], by("startedAt", { bucket: "week", sort: "keyAsc" }))) },
  { id: "long-session-exits", question: "where do long sessions end: the exit pages of sessions longer than 3 minutes", expect: ok(q("session", [f("duration", ">", dur(3, "min"))], by("exitPage", { sort: "valueDesc" }))) },
  { id: "median-away", question: "median time visitors spend away from the site", expect: ok(q("awayGap", [], { kind: "aggregate", agg: "median", field: "duration" })) },

  // ── connected rows
  {
    id: "read-blog-no-convert",
    question: "how many sessions read the blog launch post (/blog/launch) properly at least twice (more than 5 seconds each) and did not convert",
    expect: ok(q("session", [rel("pageViews", [f("page", "=", "/blog/launch"), f("visitDuration", ">", dur(5, "sec"))], count, ">=", 2), f("converted", "isFalse")], { kind: "count" })),
  },
  { id: "pricing-before-convert", fewShot: true, question: "how many leads looked at the pricing page before converting", expect: ok(q("lead", [rel("session", [rel("pageViews", [f("page", "=", "/pricing")])])], { kind: "count" })) },
  {
    id: "pricing-before-contact",
    question: "sessions that visited pricing before the contact page",
    expect: ok(q("session", [rel("pageViews", [f("page", "=", "/contact"), rel("pagesBefore", [f("page", "=", "/pricing")])])], { kind: "ids" })),
  },
  {
    id: "three-after-convert",
    question: "sessions with exactly 3 pages after the page where they converted",
    expect: ok(q("session", [rel("pageViews", [f("isConversionPage", "isTrue"), rel("pagesAfter", [], count, "=", 3)])], { kind: "ids" })),
    alt: [q("pageView", [f("isConversionPage", "isTrue"), rel("pagesAfter", [], count, "=", 3)], { kind: "values", field: "session" })],
  },
  { id: "after-homepage", question: "what do people open right after the homepage", expect: ok(q("pageView", [rel("previousPage", [f("page", "=", "/")])], by("page", { sort: "valueDesc" }))) },
  { id: "bounced-fast", question: "sessions that bounced fast: one page and under 10 seconds", expect: ok(q("session", [rel("pageViews", [], count, "=", 1), f("duration", "<", dur(10, "sec"))], { kind: "ids" })) },
  { id: "returning-visitors", question: "how many returning visitors", expect: ok(q("visitor", [rel("sessions", [], count, ">=", 2)], { kind: "count" })) },
  { id: "mobile-never-back", question: "mobile visitors who only came once", expect: ok(q("visitor", [f("device", "=", "mobile"), rel("sessions", [], count, "=", 1)], { kind: "ids" })) },
  { id: "qualified-google-leads", question: "qualified leads that came from google", expect: ok(q("lead", [f("qualified", "isTrue"), rel("session", [f("utmSource", "=", "google")])], { kind: "ids" })) },
  {
    id: "converted-first-page",
    question: "leads who converted on the very first page",
    expect: ok(q("lead", [rel("session", [rel("pageViews", [f("isConversionPage", "isTrue"), f("position", "=", 1)])])], { kind: "ids" })),
  },
  { id: "pricing-half-seen", question: "pricing page views where at least half of the page was seen", expect: ok(q("pageView", [f("page", "=", "/pricing"), f("seenPct", ">=", 50)], { kind: "ids" })) },
  { id: "blog-scrolled-back", question: "blog launch page views where the visitor scrolled back up", expect: ok(q("pageView", [f("page", "=", "/blog/launch"), f("revisited", "isTrue")], { kind: "ids" })) },
  {
    id: "both-pages",
    question: "sessions that visited both pricing and features",
    expect: ok(q("session", [rel("pageViews", [f("page", "=", "/pricing")]), rel("pageViews", [f("page", "=", "/features")])], { kind: "ids" })),
  },
  { id: "either-page", question: "sessions that visited pricing or features",
    expect: ok(q("session", [rel("pageViews", [f("page", "in", ["/pricing", "/features"])])], { kind: "ids" })),
    alt: [
      q("session", [grp("or", [rel("pageViews", [f("page", "=", "/pricing")]), rel("pageViews", [f("page", "=", "/features")])])], { kind: "ids" }),
      q("session", [rel("pageViews", [grp("or", [f("page", "=", "/pricing"), f("page", "=", "/features")])])], { kind: "ids" }),
    ],
  },
  { id: "never-pricing", question: "sessions that never visited the pricing page", expect: ok(q("session", [grp("and", [rel("pageViews", [f("page", "=", "/pricing")])], true)], { kind: "ids" })) },
  { id: "long-mobile", question: "sessions longer than 2 minutes on mobile", expect: ok(q("session", [f("duration", ">", dur(2, "min")), rel("visitor", [f("device", "=", "mobile")])], { kind: "ids" })) },

  // ── forms
  {
    id: "where-give-up",
    fewShot: true,
    question: "which form field do people give up on most",
    expect: ok(q("formField", [f("isLastTouched", "isTrue"), f("formStatus", "=", "abandoned")], by("name", { sort: "valueDesc" }))),
  },
  { id: "slowest-fields", question: "which fields take the longest to fill in", expect: ok(q("formField", [], { kind: "groupBy", field: "name", measure: { agg: "avg", field: "focusedTime" }, sort: "valueDesc" })) },
  { id: "click-no-type", question: "fields people click into but never type in", expect: ok(q("formField", [f("typed", "isFalse")], { kind: "ids" })) },
  {
    id: "abandoned-on-phone",
    question: "abandoned forms where the visitor stopped on the phone field",
    expect: ok(q("form", [f("status", "=", "abandoned"), rel("fields", [f("isLastTouched", "isTrue"), f("fieldType", "=", "phone")])], { kind: "ids" })),
  },
  { id: "median-to-type", question: "median time from seeing a form to typing in it", expect: ok(q("form", [], { kind: "aggregate", agg: "median", field: "timeToFirstInput" })) },
  { id: "abandoned-forms", question: "how many forms were abandoned", expect: ok(q("form", [f("status", "=", "abandoned")], { kind: "count" })) },

  // ── sub-hooks
  {
    id: "hanna-pages",
    fewShot: true,
    question: "which pages did the lead named Hanna view",
    expect: ok(q("pageView", [f("visitor", "in", hook(q("lead", [f("name", "contains", "hanna")], { kind: "values", field: "visitor" })))], { kind: "values", field: "page" })),
  },
  {
    id: "above-average",
    question: "page views longer than the average time on the pricing page",
    expect: ok(q("pageView", [f("visitDuration", ">", hook(q("pageView", [f("page", "=", "/pricing")], { kind: "aggregate", agg: "avg", field: "visitDuration" })))], { kind: "ids" })),
  },
  {
    id: "hanna-sessions",
    question: "show me the sessions of the lead called hanna",
    expect: ok(q("session", [rel("leads", [f("name", "contains", "hanna")])], { kind: "ids" })),
    alt: [q("session", [f("visitor", "in", hook(q("lead", [f("name", "contains", "hanna")], { kind: "values", field: "visitor" })))], { kind: "ids" })],
  },

  // ── vague, human wording (the point of the feature)
  {
    id: "vague-with-dates",
    fewShot: true,
    question: "give me the sessions between 1 September 2026 and 30 September 2026 where the page was seen at least 3% and the conversion session contains at least 3 pages",
    expect: ok(
      q("session", [f("startedAt", "between", "2026-09-01", "2026-09-30"), rel("pageViews", [f("seenPct", ">=", 3)]), f("converted", "isTrue"), rel("pageViews", [], count, ">=", 3)], { kind: "ids" }),
    ),
  },
  { id: "vague-no-dates", fewShot: true, question: "give me a session between this and this, the page was seen at least 3% and the conversion session contains at least 3 pages", expect: { status: "clarify" } },
  { id: "last-month-leads", question: "show me the leads from last month", expect: ok(q("lead", [f("submittedAt", ">", ago(1, "month"))], { kind: "ids" })) },
  { id: "compare-last-month", fewShot: true, question: "how are we doing compared to last month", expect: { status: "unsupported" } },
  { id: "off-topic", question: "what is the weather in Paris", expect: { status: "unsupported" } },
  { id: "avg-pages-per-session", question: "average number of pages per session", expect: { status: "unsupported" } },

  // ── adjusting what is already in the builder
  {
    id: "edit-add-source",
    fewShot: true,
    current: q("session", [f("converted", "isTrue")], { kind: "count" }),
    question: "only the ones from google",
    expect: ok(q("session", [f("converted", "isTrue"), f("utmSource", "=", "google")], { kind: "count" })),
  },
  {
    id: "edit-per-day",
    current: q("pageView", [f("page", "=", "/pricing")], { kind: "count" }),
    question: "show it per day",
    expect: ok(q("pageView", [f("page", "=", "/pricing")], by("enteredAt", { bucket: "day", sort: "keyAsc" }))),
  },
  {
    id: "edit-qualified",
    current: q("lead", [], { kind: "count" }),
    question: "only qualified",
    expect: ok(q("lead", [f("qualified", "isTrue")], { kind: "count" })),
  },
];

/** The specs as HookSpec-shaped values for tests (ids and version are added by the normaliser). */
export const asSpec = (x: Json) => x as unknown as Omit<HookSpec, "v">;
