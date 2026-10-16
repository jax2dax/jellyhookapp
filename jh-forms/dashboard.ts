// jh-forms/dashboard.ts
// The form dashboard, made of Hook queries. Pure, no database: `dashboardSpecs` builds the Hook queries (one per
// number or table), the server runs them with runHook (lib/actions/formDashboard.action.ts), and `assembleDashboard`
// turns the raw answers into the dashboard's data. Every figure on the dashboard is therefore a Hook answer a person
// could also ask for by hand in /platform/hook. Docs: mds/documentation/form-dashboard.md.
//
// What "seen / started / submitted / abandoned" mean here (form_engagement.status):
//   seen        every form interaction (it was at least half on screen)
//   started     a field was clicked into (status is not "viewed")
//   submitted   the form was submitted
//   abandoned   started and not submitted, once the visit is over (a form still being filled is "in progress")
import { normalizeSpec } from "../jh-ai/normalize";
import type { HookSpec } from "../jh-hook/types";

type Json = Record<string, unknown>;
const f = (field: string, op: string, value?: unknown): Json => ({ kind: "field", field, op, ...(value !== undefined ? { value } : {}) });
const spec = (entity: string, where: Json[], output: Json): HookSpec => normalizeSpec({ entity, where, output });
const by = (field: string, measure: Json, extra: Json = {}): Json => ({ kind: "groupBy", field, measure, ...extra });
const COUNT = { agg: "count" };

/**
 * Which form interactions a dashboard covers: one form (its key), and within it a version, or a date range, or all
 * time. formKey null = every form of the site (before 17-form-versions.sql, or "all forms").
 */
export interface FormScope {
  formKey: string | null;
  version?: string | null;
  /** ISO; inclusive */
  from?: string | null;
  /** ISO; exclusive */
  to?: string | null;
}

/** The queries, by name. Each answers one number table of the dashboard. */
export function dashboardSpecs(scope: FormScope): Record<string, HookSpec> {
  const inScope: Json[] = [
    ...(scope.formKey ? [f("formKey", "=", scope.formKey)] : []),
    ...(scope.version ? [f("version", "=", scope.version)] : []),
    ...(scope.from ? [f("viewedAt", ">=", scope.from)] : []),
    ...(scope.to ? [f("viewedAt", "<", scope.to)] : []),
  ];
  const form = (...extra: Json[]) => [...inScope, ...extra];
  const started = f("status", "!=", "viewed");
  // formField rows belong to a form: the scope is a condition on that form
  const ofForms = { kind: "related", relation: "form", where: inScope } as Json;
  const fieldBy = (extra: Json[], measure: Json) => spec("formField", [ofForms, ...extra], by("name", measure, { sort: "valueDesc", limit: 60 }));

  return {
    // overview: counts by status, and per page (one form can be on several pages)
    statusCounts: spec("form", form(), by("status", COUNT)),
    pagesSeen: spec("form", form(), by("page", COUNT, { sort: "valueDesc", limit: 30 })),
    pagesStarted: spec("form", form(started), by("page", COUNT, { limit: 100 })),
    pagesSubmitted: spec("form", form(f("status", "=", "submitted")), by("page", COUNT, { limit: 100 })),
    pagesAbandoned: spec("form", form(f("status", "=", "abandoned")), by("page", COUNT, { limit: 100 })),
    pagesFillTime: spec("form", form(f("status", "=", "submitted")), by("page", { agg: "median", field: "fillTime" }, { limit: 100 })),
    pagesBeforeTyping: spec("form", form(started), by("page", { agg: "median", field: "timeOnScreenBeforeStart" }, { limit: 100 })),
    pagesToFirstInput: spec("form", form(started), by("page", { agg: "median", field: "timeToFirstInput" }, { limit: 100 })),
    // trend: starts and submissions per day (also tells how many days the scope really spans)
    dailySeen: spec("form", form(), by("viewedAt", COUNT, { bucket: "day", sort: "keyAsc", limit: 400 })),
    dailyStarted: spec("form", form(started), by("viewedAt", COUNT, { bucket: "day", sort: "keyAsc", limit: 400 })),
    dailySubmitted: spec("form", form(f("status", "=", "submitted")), by("viewedAt", COUNT, { bucket: "day", sort: "keyAsc", limit: 400 })),
    // fields: one table per measure, joined by field name. Durations are medians (founder decision 2026-10-15).
    // out of the forms that were started: a form only seen never had a chance to use its fields
    fieldRows: fieldBy([f("formStatus", "!=", "viewed")], COUNT),
    fieldTouched: fieldBy([f("touched", "isTrue")], COUNT),
    fieldFocus: fieldBy([f("touched", "isTrue")], { agg: "median", field: "focusedTime" }),
    fieldHesitation: fieldBy([f("typed", "isTrue")], { agg: "median", field: "timeToFirstKey" }),
    fieldGaveUp: fieldBy([f("isLastTouched", "isTrue"), f("formStatus", "=", "abandoned")], COUNT),
    fieldCorrected: fieldBy([f("changes", ">", 1)], COUNT),
    fieldErrors: fieldBy([f("errors", ">=", 1)], { agg: "sum", field: "errors" }),
    fieldLeftEmpty: fieldBy([f("filled", "isFalse")], COUNT),
    fieldRequired: fieldBy([f("required", "isTrue")], COUNT),
  };
}

/** The site's forms (all time): how many were started and submitted, to list them and pick the main one. */
export function formListSpecs(): Record<"formsStarted" | "formsSubmitted", HookSpec> {
  return {
    formsStarted: spec("form", [f("status", "!=", "viewed")], by("formKey", COUNT, { sort: "valueDesc", limit: 30 })),
    formsSubmitted: spec("form", [f("status", "=", "submitted")], by("formKey", COUNT, { sort: "valueDesc", limit: 30 })),
  };
}

// ── answers -> dashboard ────────────────────────────────────────────────
export type Rows = { key: string | null; value: number | string | null }[];
export type DashboardAnswers = Record<keyof ReturnType<typeof dashboardSpecs>, Rows>;

export interface Funnel {
  seen: number;
  started: number;
  submitted: number;
  abandoned: number;
  inProgress: number;
  /** started / seen */
  startRate: number | null;
  /** submitted / started */
  completionRate: number | null;
  /** abandoned / (submitted + abandoned): of the forms that are over, how many were given up */
  abandonRate: number | null;
}

export interface PageRow {
  page: string;
  seen: number;
  started: number;
  submitted: number;
  abandoned: number;
  completionRate: number | null;
  medianFillMs: number | null;
  /** on-screen time when known, else the elapsed time from seeing to typing */
  medianBeforeTypingMs: number | null;
  beforeTypingIsOnScreen: boolean;
}

export interface FieldRow {
  name: string;
  /** forms in which this field was clicked into / forms that have the field (from the field list) */
  touched: number;
  rows: number;
  reach: number | null;
  medianFocusedMs: number | null;
  medianHesitationMs: number | null;
  gaveUp: number;
  /** gave up here / all abandoned forms in scope */
  gaveUpShare: number | null;
  corrected: number;
  errors: number;
  leftEmpty: number;
  required: boolean;
}

export interface FormDashboard {
  funnel: Funnel;
  pages: PageRow[];
  fields: FieldRow[];
  daily: { day: string; seen: number; started: number; submitted: number }[];
  /** the field to look at first, and why (the most give-ups, then the most errors, then the slowest) */
  headline: string | null;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const map = (rows: Rows | undefined) => new Map((rows ?? []).map((r) => [String(r.key ?? ""), r.value]));
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function assembleDashboard(a: DashboardAnswers): FormDashboard {
  const status = map(a.statusCounts);
  const seen = [...status.values()].reduce<number>((n, v) => n + num(v), 0);
  const submitted = num(status.get("submitted"));
  const abandoned = num(status.get("abandoned"));
  const inProgress = num(status.get("started"));
  const started = submitted + abandoned + inProgress;
  const funnel: Funnel = { seen, started, submitted, abandoned, inProgress, startRate: ratio(started, seen), completionRate: ratio(submitted, started), abandonRate: ratio(abandoned, submitted + abandoned) };

  const pStart = map(a.pagesStarted), pSub = map(a.pagesSubmitted), pAb = map(a.pagesAbandoned), pFill = map(a.pagesFillTime), pOn = map(a.pagesBeforeTyping), pEl = map(a.pagesToFirstInput);
  const pages: PageRow[] = (a.pagesSeen ?? []).map((r) => {
    const page = String(r.key ?? "");
    const s = num(pStart.get(page));
    const sub = num(pSub.get(page));
    const onScreen = numOrNull(pOn.get(page));
    return {
      page,
      seen: num(r.value),
      started: s,
      submitted: sub,
      abandoned: num(pAb.get(page)),
      completionRate: ratio(sub, s),
      medianFillMs: numOrNull(pFill.get(page)),
      medianBeforeTypingMs: onScreen ?? numOrNull(pEl.get(page)),
      beforeTypingIsOnScreen: onScreen !== null,
    };
  });

  const touched = map(a.fieldTouched), focus = map(a.fieldFocus), hes = map(a.fieldHesitation), gave = map(a.fieldGaveUp), corr = map(a.fieldCorrected), err = map(a.fieldErrors), empty = map(a.fieldLeftEmpty), req = map(a.fieldRequired);
  const fields: FieldRow[] = (a.fieldRows ?? []).map((r) => {
    const name = String(r.key ?? "");
    const rows = num(r.value);
    const t = num(touched.get(name));
    const g = num(gave.get(name));
    return {
      name,
      touched: t,
      rows,
      reach: ratio(t, rows),
      medianFocusedMs: numOrNull(focus.get(name)),
      medianHesitationMs: numOrNull(hes.get(name)),
      gaveUp: g,
      gaveUpShare: ratio(g, abandoned),
      corrected: num(corr.get(name)),
      errors: num(err.get(name)),
      leftEmpty: num(empty.get(name)),
      required: num(req.get(name)) > 0,
    };
  });

  const days = new Map<string, { seen: number; started: number; submitted: number }>();
  const day = (k: unknown) => {
    const key = String(k).slice(0, 10);
    if (!days.has(key)) days.set(key, { seen: 0, started: 0, submitted: 0 });
    return days.get(key)!;
  };
  for (const r of a.dailySeen ?? []) day(r.key).seen = num(r.value);
  for (const r of a.dailyStarted ?? []) day(r.key).started = num(r.value);
  for (const r of a.dailySubmitted ?? []) day(r.key).submitted = num(r.value);
  const daily = [...days.entries()].map(([day, v]) => ({ day, ...v })).sort((x, y) => x.day.localeCompare(y.day));

  // the one-line takeaway: only when there is something to say
  const top = [...fields].sort((x, y) => y.gaveUp - x.gaveUp)[0];
  const slow = [...fields].filter((x) => x.medianFocusedMs !== null).sort((x, y) => (y.medianFocusedMs ?? 0) - (x.medianFocusedMs ?? 0))[0];
  const errTop = [...fields].sort((x, y) => y.errors - x.errors)[0];
  let headline: string | null = null;
  if (abandoned > 0 && top && top.gaveUp > 0) headline = `${top.name} is where most people give up: ${top.gaveUp} of ${abandoned} abandoned forms ended on it.`;
  else if (errTop && errTop.errors > 0) headline = `${errTop.name} fails validation most often: ${errTop.errors} times.`;
  else if (slow && slow.medianFocusedMs !== null && fields.length > 1) headline = `${slow.name} takes the longest to fill in.`;

  return { funnel, pages, fields, daily, headline };
}
