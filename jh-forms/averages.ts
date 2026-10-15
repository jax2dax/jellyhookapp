// jh-forms/averages.ts
// The typical successful submission of a form, per form VERSION, and the comparison with the previous version. Pure, no
// database: the caller passes the rows of one version (and the page views of their sessions). Every duration is a
// median. Design and every rule: mds/build/form-study/averages-and-versions.md.
//
//  - Versions: a form's field list (key, type, required, in order) is fingerprinted. A new fingerprint starts a new
//    version at once, EXCEPT within the first 24 h of the current version: changes then belong to the same version, so
//    a version always lives at least a day (placeInVersion).
//  - Who is in the average: submitted forms only, the newest AVG_SAMPLE_MAX of them.
//  - Two groups: "typed" and "filled without typing" (a text-like field that ended filled with no key press: autofill,
//    a password manager or paste). Medians of times use the typed group only; counts use everyone.
//  - A comparison needs MIN_COMPARE_STARTED started forms in both versions.
import { buildFormTimeline, type EngagementRow, type FieldTiming, type FormFieldDef, type FormTimeline, type PageViewRow } from "./timeline";

export const SAME_VERSION_WINDOW_MS = 24 * 3600_000;
export const MAX_VERSIONS_PER_FORM = 20;
export const AVG_SAMPLE_MAX = 500;
export const MIN_COMPARE_STARTED = 30;
/** Field types a person types into. A select, checkbox or date picker filled without a key press is normal, not autofill. */
const TYPING_TYPES = new Set(["text", "email", "tel", "textarea", "number", "url", "search"]);

// ---------- versions ----------

function fnv1a(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** 16 hex chars identifying a field list. Order, key, type and required all count; nothing else does (labels are not tracked). */
export function fingerprintOf(fields: FormFieldDef[]): string {
  const s = fields.map((f) => f.key + "|" + f.type + "|" + (f.required ? 1 : 0)).join("\n");
  return fnv1a(s, 0x811c9dc5) + fnv1a(s, 0x9e3779b9);
}

export interface FormVersion {
  id: string;
  startedAt: number;
  /** null while it is the current version */
  endedAt: number | null;
  /** every field list seen in this version (more than one when the form was changed again within its first 24 h) */
  fingerprints: string[];
  /** the field list the version settled on: the last one seen in its first 24 h */
  fields: FormFieldDef[];
}

/**
 * Where a form row with this field list belongs. Mutates nothing: returns the new version list.
 * 1. No version yet: the first one starts.
 * 2. The fingerprint is already part of the current version: that version.
 * 3. The current version is less than 24 h old: the change joins it (its field list becomes this one).
 * 4. Otherwise: the current version ends now and a new one starts.
 * A form with two live layouts (one id on two pages with different fields) stops creating versions after the first day
 * of the version that contains both, because rule 2 then matches either layout.
 */
export function placeInVersion(versions: FormVersion[], fields: FormFieldDef[], at: number, newId: () => string): { versions: FormVersion[]; versionId: string; created: boolean } {
  const fp = fingerprintOf(fields);
  const list = versions.map((v) => ({ ...v, fingerprints: [...v.fingerprints] }));
  const cur = list[list.length - 1];
  if (!cur) {
    const v = { id: newId(), startedAt: at, endedAt: null, fingerprints: [fp], fields };
    return { versions: [v], versionId: v.id, created: true };
  }
  if (cur.fingerprints.includes(fp)) return { versions: list, versionId: cur.id, created: false };
  if (at - cur.startedAt < SAME_VERSION_WINDOW_MS || list.length >= MAX_VERSIONS_PER_FORM) {
    cur.fingerprints.push(fp);
    if (at - cur.startedAt < SAME_VERSION_WINDOW_MS) cur.fields = fields;
    return { versions: list, versionId: cur.id, created: false };
  }
  cur.endedAt = at;
  const v = { id: newId(), startedAt: at, endedAt: null, fingerprints: [fp], fields };
  list.push(v);
  return { versions: list, versionId: v.id, created: true };
}

/** "09/03 - 10/11", "10/11 - today" (dates in UTC, the same for every viewer) */
export function versionLabel(v: { startedAt: number; endedAt: number | null }): string {
  const d = (t: number) => {
    const x = new Date(t);
    return String(x.getUTCMonth() + 1).padStart(2, "0") + "/" + String(x.getUTCDate()).padStart(2, "0");
  };
  return d(v.startedAt) + " - " + (v.endedAt === null ? "today" : d(v.endedAt));
}

// ---------- the average submission ----------

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Linear-interpolated quantile (q in 0..1) of a non-empty list, the same method as Postgres percentile_cont. */
export function quantile(xs: number[], q: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// ---------- unusual (outliers against the healthy reference) ----------

/** People needed in the reference before anything is called unusual. */
export const MIN_REFERENCE = 30;
/** Never unusual for less than this over the typical value, however tight the reference is. */
export const MIN_UNUSUAL_GAP_MS = 10_000;

/** The spread of one duration in the reference: quartiles and the limit above which a value is unusual. */
export interface Spread {
  n: number;
  q1: number;
  median: number;
  q3: number;
  /** the higher of: q3 + 1.5 x (q3 - q1) (Tukey's rule), and median + MIN_UNUSUAL_GAP_MS */
  limit: number;
}

export function spreadOf(xs: number[]): Spread | null {
  if (!xs.length) return null;
  const q1 = quantile(xs, 0.25)!;
  const med = quantile(xs, 0.5)!;
  const q3 = quantile(xs, 0.75)!;
  return { n: xs.length, q1, median: med, q3, limit: Math.max(q3 + 1.5 * (q3 - q1), med + MIN_UNUSUAL_GAP_MS) };
}

/** Only slower than usual counts: being fast is not a problem to flag. */
export const isUnusual = (value: number | null | undefined, s: Spread | null | undefined): boolean =>
  typeof value === "number" && !!s && s.n >= MIN_REFERENCE && value > s.limit;

export const TOTAL_KEYS = ["beforeTyping", "span", "inFields", "pauses", "otherPages", "away"] as const;
export type TotalKey = (typeof TOTAL_KEYS)[number];

/** The value of each total in one timeline, by the same rules the reference uses. */
export function totalsOf(t: FormTimeline): Record<TotalKey, number | null> {
  return {
    beforeTyping: t.totals.onscreenBeforeStartMs ?? t.totals.toStartMs,
    span: t.totals.spanMs,
    inFields: t.totals.inFieldsMs,
    pauses: t.totals.pausesMs,
    otherPages: t.totals.otherPagesMs,
    away: t.totals.awayMs,
  };
}

/** What in one person's form is unusual against a reference: field keys (time in the field) and totals. */
export function unusualIn(t: FormTimeline, ref: VersionSummary | null): { fields: Set<string>; totals: Set<TotalKey> } {
  const fields = new Set<string>();
  const totals = new Set<TotalKey>();
  if (!ref?.spread) return { fields, totals };
  for (const f of t.fields) if (isUnusual(f.focusedMs, ref.spread.fields[f.key])) fields.add(f.key);
  const v = totalsOf(t);
  for (const k of TOTAL_KEYS) if (isUnusual(v[k], ref.spread.totals[k])) totals.add(k);
  return { fields, totals };
}
const share = (a: number, b: number) => (b > 0 ? a / b : null);

/** Keys of text-like fields that ended filled with no key press in any visit. */
export function filledWithoutTyping(row: EngagementRow): string[] {
  const types = new Map((row.form_fields ?? []).map((d) => [d.key, d.type]));
  const out: string[] = [];
  for (const [key, t] of Object.entries(row.field_timings ?? {}) as [string, FieldTiming][]) {
    const type = types.get(key) ?? (key === "email" ? "email" : key === "phone" ? "tel" : "text");
    if (!TYPING_TYPES.has(type)) continue;
    const typedInAVisit = (t.visits ?? []).some((v) => v[2] === 1);
    if (t.filled === true && !t.firstKeydownAt && !typedInAVisit) out.push(key);
  }
  return out;
}

export interface AvgField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  /** typed-group submissions in which the field was used */
  used: number;
  inFieldMs: number | null;
  hesitationMs: number | null;
  /** median pause right after this field, among those who paused there (null when nobody did). Not over everyone:
   *  when fewer than half pause, that median is 0 and hides the pause. Read it together with pausedShare. */
  pauseAfterMs: number | null;
  /** share of those who used it who paused 1.5 s or more after it */
  pausedShare: number | null;
  cameBackShare: number | null;
  /** typed-group submissions whose form had the field and that never touched it, of those whose form had it */
  skippedShare: number | null;
  /** all submissions in which it was filled without typing */
  filledWithoutTyping: number;
}

export interface VersionSummary {
  started: number;
  submitted: number;
  completionRate: number | null;
  /** submitted rows the medians are built from (the newest AVG_SAMPLE_MAX) */
  sampled: number;
  typed: number;
  withoutTyping: number;
  /** medians over the typed group; null when it is empty */
  form: { fillMs: number | null; beforeTypingMs: number | null; inFieldsMs: number | null; pausesMs: number | null; otherPagesMs: number | null; awayMs: number | null; pauses: number | null };
  withoutTypingFillMs: number | null;
  fields: AvgField[];
  /** quartiles of the typed group, for the unusual check: time in each field, and each total */
  spread: { fields: Record<string, Spread | null>; totals: Record<TotalKey, Spread | null> };
}

/** Bump when a formula here changes: frozen summaries made by an older formula are then recomputed. */
export const SUMMARY_FORMULA_VERSION = 1;

/** Pause time after each field in one timeline: each pause goes to the field whose visit came right before it. */
function pausesAfter(t: FormTimeline): Map<string, number> {
  const out = new Map<string, number>();
  let lastKey: string | null = null;
  for (const s of t.segments) {
    if (s.kind === "field") lastKey = s.key;
    else if (s.kind === "pause" && lastKey) out.set(lastKey, (out.get(lastKey) ?? 0) + s.ms);
  }
  return out;
}

/**
 * One version's average submission. `rows`: every form row of the version in the chosen range (any status).
 * `fields`: the version's field list (the order of the chart). `pageViews`: page views of the sessions involved.
 */
export function summarizeVersion(rows: EngagementRow[], fields: FormFieldDef[], pageViews: PageViewRow[], sampleMax = AVG_SAMPLE_MAX): VersionSummary {
  const started = rows.filter((r) => r.status !== "viewed").length;
  const submittedRows = rows.filter((r) => r.status === "submitted");
  const sample = [...submittedRows].sort((a, b) => Date.parse(b.ended_at ?? "") - Date.parse(a.ended_at ?? "")).slice(0, sampleMax);
  const bySession = new Map<string, PageViewRow[]>();
  for (const p of pageViews) bySession.set(p.session_id, [...(bySession.get(p.session_id) ?? []), p]);

  const typed: FormTimeline[] = [];
  const other: FormTimeline[] = [];
  const noTypeCount = new Map<string, number>();
  for (const r of sample) {
    const t = buildFormTimeline(r, bySession.get(r.session_id) ?? []);
    const nt = filledWithoutTyping(r);
    for (const k of nt) noTypeCount.set(k, (noTypeCount.get(k) ?? 0) + 1);
    (nt.length ? other : typed).push(t);
  }

  const m = (pick: (t: FormTimeline) => number | null) => median(typed.map(pick).filter((x): x is number => x !== null));
  const pauseMaps = typed.map(pausesAfter);
  const known = new Set(fields.map((f) => f.key));
  const extra = [...new Set(typed.flatMap((t) => t.fields.map((f) => f.key)))].filter((k) => !known.has(k));
  const order: FormFieldDef[] = [...fields, ...extra.map((key) => ({ key, type: "other", required: false }))];

  const avgFields: AvgField[] = order.map((def) => {
    const uses = typed.map((t, i) => ({ f: t.fields.find((x) => x.key === def.key), pause: pauseMaps[i].get(def.key) ?? 0 })).filter((u) => u.f);
    // skipped is out of the forms that HAD the field: a layout without it (another variant, or an edit in the
    // version's first day) is not a skip. Forms with an unknown field list count as having it.
    const had = typed.filter((t) => t.formFieldCount === null || t.fields.some((x) => x.key === def.key) || t.untouched.some((x) => x.key === def.key)).length;
    return {
      key: def.key,
      label: def.key.startsWith("custom:") ? def.key.slice(7) || "field" : def.key,
      type: def.type,
      required: def.required,
      used: uses.length,
      inFieldMs: median(uses.map((u) => u.f!.focusedMs)),
      hesitationMs: median(uses.map((u) => u.f!.hesitationMs).filter((x): x is number => x !== null)),
      pauseAfterMs: median(uses.map((u) => u.pause).filter((p) => p > 0)),
      pausedShare: share(uses.filter((u) => u.pause > 0).length, uses.length),
      cameBackShare: share(uses.filter((u) => u.f!.visits.length > 1 || u.f!.revisited).length, uses.length),
      skippedShare: share(Math.max(0, had - uses.length), had),
      filledWithoutTyping: noTypeCount.get(def.key) ?? 0,
    };
  });

  return {
    started,
    submitted: submittedRows.length,
    completionRate: share(submittedRows.length, started),
    sampled: sample.length,
    typed: typed.length,
    withoutTyping: other.length,
    form: {
      fillMs: m((t) => t.totals.spanMs),
      beforeTypingMs: m((t) => t.totals.onscreenBeforeStartMs ?? t.totals.toStartMs),
      inFieldsMs: m((t) => t.totals.inFieldsMs),
      pausesMs: m((t) => t.totals.pausesMs),
      otherPagesMs: m((t) => t.totals.otherPagesMs),
      awayMs: m((t) => t.totals.awayMs),
      pauses: m((t) => t.segments.filter((s) => s.kind === "pause").length),
    },
    withoutTypingFillMs: median(other.map((t) => t.totals.spanMs).filter((x): x is number => x !== null)),
    fields: avgFields,
    spread: {
      fields: Object.fromEntries(order.map((d) => [d.key, spreadOf(typed.map((t) => t.fields.find((x) => x.key === d.key)?.focusedMs).filter((x): x is number => typeof x === "number"))])),
      totals: Object.fromEntries(TOTAL_KEYS.map((k) => [k, spreadOf(typed.map((t) => totalsOf(t)[k]).filter((x): x is number => x !== null))])) as Record<TotalKey, Spread | null>,
    },
  };
}

// ---------- comparison ----------

const diff = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

export type Comparison =
  | { state: "noPrevious" }
  | { state: "tooFew"; currentStarted: number; previousStarted: number }
  | {
      state: "ok";
      currentStarted: number;
      previousStarted: number;
      /** percentage points: 0.32 vs 0.27 = +5 */
      completionPoints: number | null;
      fillMs: number | null;
      beforeTypingMs: number | null;
      inFieldsMs: number | null;
      pausesMs: number | null;
      /** per field present in both versions: median time in field, current minus previous */
      fields: Record<string, number | null>;
    };

export function compareSummaries(cur: VersionSummary, prev: VersionSummary | null, min = MIN_COMPARE_STARTED): Comparison {
  if (!prev) return { state: "noPrevious" };
  if (cur.started < min || prev.started < min) return { state: "tooFew", currentStarted: cur.started, previousStarted: prev.started };
  const prevFields = new Map(prev.fields.map((f) => [f.key, f]));
  const fields: Record<string, number | null> = {};
  for (const f of cur.fields) if (prevFields.has(f.key)) fields[f.key] = diff(f.inFieldMs, prevFields.get(f.key)!.inFieldMs);
  const points = cur.completionRate === null || prev.completionRate === null ? null : Math.round((cur.completionRate - prev.completionRate) * 1000) / 10;
  return {
    state: "ok",
    currentStarted: cur.started,
    previousStarted: prev.started,
    completionPoints: points,
    fillMs: diff(cur.form.fillMs, prev.form.fillMs),
    beforeTypingMs: diff(cur.form.beforeTypingMs, prev.form.beforeTypingMs),
    inFieldsMs: diff(cur.form.inFieldsMs, prev.form.inFieldsMs),
    pausesMs: diff(cur.form.pausesMs, prev.form.pausesMs),
    fields,
  };
}
