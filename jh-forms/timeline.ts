// jh-forms/timeline.ts
// One form interaction (a form_engagement row) + the page views of that session -> a timeline: what the person did,
// field by field, from the moment the form came on screen until they submitted or stopped. Pure, no database.
// Plan and the rules behind every number: mds/build/form-study/plan.md.
//
// What the stored data can and cannot say (no keystrokes are ever recorded):
//  - per field: first focus, last time it was left, first key press (a time, not which key), total focused time;
//  - a field visited ONCE is exact: it was focused from firstFocusAt to lastLeftAt;
//  - since 2026-10-14 each visit is stored too (`visits`), so a field visited several times is exact as well; rows
//    recorded before that only have first focus, last leave and the total: those bars are drawn from first to last
//    and marked approximate, never with invented intervals;
//  - also since 2026-10-14: filled/empty when last left, how many visits changed the value, validation errors, the
//    form's field list (so untouched fields show), and the on-screen time before the first input.
// Gaps between consecutive fields shorter than PAUSE_MIN_MS are a straight move (Tab, a click), counted as 0.

export const PAUSE_MIN_MS = 1500;
/** A field whose span is longer than its focused time by more than this was left and came back to. */
const REVISIT_SLACK_MS = 400;

export interface FieldTiming {
  order?: number;
  firstFocusAt?: string | null;
  firstKeydownAt?: string | null;
  lastUnfocusAt?: string | null;
  totalFocusedMs?: number;
  visits?: ([string, string] | [string, string, number])[];
  filled?: boolean;
  edits?: number;
  errors?: number;
}

export interface FormFieldDef {
  key: string;
  type: string;
  required: boolean;
}

export interface EngagementRow {
  id?: string;
  session_id: string;
  page_path: string | null;
  page_view_id?: string | null;
  form_index?: number;
  status: string; // viewed | started | submitted | abandoned
  viewed_at: string | null;
  first_input_at: string | null;
  ended_at: string | null;
  last_activity_at?: string | null;
  field_timings?: Record<string, FieldTiming> | null;
  last_field_type?: string | null;
  last_field_key?: string | null;
  form_fields?: FormFieldDef[] | null;
  onscreen_before_start_ms?: number | null;
  /** since 17-form-versions.sql */
  form_key?: string | null;
  form_version_id?: string | null;
}

export interface PageViewRow {
  page_view_id: string;
  session_id: string;
  page_path: string | null;
  entered_at: string;
  left_at: string | null;
}

export interface TimelineField {
  key: string;
  /** "email", "name", "phone", or the raw name of a custom field. */
  label: string;
  order: number;
  firstFocusAt: number;
  lastLeftAt: number;
  focusedMs: number;
  /** focus to first key press; null when nothing was typed (a select, or just clicked) */
  hesitationMs: number | null;
  typed: boolean;
  /** left and came back: the bar from first to last includes time spent elsewhere */
  revisited: boolean;
  /** the field the person was on when the form ended (submit or giving up) */
  last: boolean;
  /** each visit [start, end]; one entry built from first/last when the row predates per-visit storage */
  visits: [number, number][];
  /** true when the bar is only first-to-last (old row, several visits): approximate */
  approx: boolean;
  /** non-empty when last left; null when unknown (old rows) */
  filled: boolean | null;
  /** visits that changed the value */
  edits: number;
  /** times the browser reported it invalid on a submit attempt */
  errors: number;
  required: boolean | null;
}

export interface UntouchedField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  errors: number;
}

export type Segment =
  | { kind: "field"; key: string; from: number; to: number; approx: boolean }
  | { kind: "move"; from: number; to: number; ms: number }
  | { kind: "pause"; from: number; to: number; ms: number }
  | { kind: "otherPage"; from: number; to: number; ms: number; path: string | null }
  | { kind: "away"; from: number; to: number; ms: number };

export interface FormTimeline {
  status: string;
  page: string | null;
  /** first time the form was at least half on screen */
  seenAt: number | null;
  firstInputAt: number | null;
  endedAt: number | null;
  ended: "submitted" | "abandoned" | "open" | "notStarted";
  fields: TimelineField[];
  /** fields of the form nobody focused (known only for forms seen after 2026-10-14) */
  untouched: UntouchedField[];
  /** total fields in the form, when the field list is known */
  formFieldCount: number | null;
  segments: Segment[];
  totals: {
    /** time the form was at least half on screen, tab visible, before the first input (forms seen after 2026-10-14) */
    onscreenBeforeStartMs: number | null;
    /** seen -> first input, elapsed (includes time scrolled away or in another tab) */
    toStartMs: number | null;
    /** first input -> end */
    spanMs: number | null;
    inFieldsMs: number;
    pausesMs: number;
    otherPagesMs: number;
    awayMs: number;
    /** the part of the span not explained by the above (revisited fields, rounding); shown, never hidden */
    unaccountedMs: number;
    fieldsTouched: number;
  };
  /** true when every field was visited once, so every segment is exact */
  exact: boolean;
}

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

function labelOf(key: string): string {
  return key.startsWith("custom:") ? key.slice("custom:".length) || "field" : key;
}

/** Time the person was NOT on this form's page, inside [from, to]: on other pages, or away from the site entirely. */
function outsideIntervals(pageViews: PageViewRow[], formPath: string | null, from: number, to: number) {
  const views = pageViews
    .map((p) => ({ path: p.page_path, a: ms(p.entered_at), b: ms(p.left_at) }))
    .filter((p): p is { path: string | null; a: number; b: number | null } => p.a !== null)
    .sort((x, y) => x.a - y.a);
  const out: { kind: "otherPage" | "away"; from: number; to: number; path: string | null }[] = [];
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const end = v.b ?? (views[i + 1]?.a ?? to);
    if (v.path !== formPath) out.push({ kind: "otherPage", from: v.a, to: end, path: v.path });
    const next = views[i + 1];
    if (next && next.a > end) out.push({ kind: "away", from: end, to: next.a, path: null });
  }
  return out
    .map((o) => ({ ...o, from: Math.max(o.from, from), to: Math.min(o.to, to) }))
    .filter((o) => o.to > o.from);
}

function overlap(a: number, b: number, c: number, d: number): number {
  return Math.max(0, Math.min(b, d) - Math.max(a, c));
}

export function buildFormTimeline(row: EngagementRow, sessionPageViews: PageViewRow[], pauseMinMs = PAUSE_MIN_MS): FormTimeline {
  const seenAt = ms(row.viewed_at);
  const firstInputAt = ms(row.first_input_at);
  const endedAt = ms(row.ended_at) ?? ms(row.last_activity_at);
  const ended: FormTimeline["ended"] = row.status === "submitted" ? "submitted" : row.status === "abandoned" ? "abandoned" : firstInputAt ? "open" : "notStarted";

  const raw = row.field_timings ?? {};
  const defs = new Map((row.form_fields ?? []).map((d) => [d.key, d]));
  const fields: TimelineField[] = [];
  const errorOnly: { key: string; errors: number }[] = [];
  Object.entries(raw).forEach(([key, t], i) => {
    const a = ms(t.firstFocusAt);
    const b = ms(t.lastUnfocusAt) ?? a;
    if (a === null || b === null) {
      if (t.errors) errorOnly.push({ key, errors: t.errors }); // failed validation without ever being focused
      return;
    }
    const focused = Math.max(0, Number(t.totalFocusedMs) || 0);
    const k = ms(t.firstKeydownAt);
    const stored = (t.visits ?? []).map(([x, y]) => [ms(x), ms(y)] as const).filter((v): v is readonly [number, number] => v[0] !== null && v[1] !== null && v[1] >= v[0]).map((v) => [v[0], v[1]] as [number, number]);
    const spanLonger = Math.max(a, b) - a - focused > REVISIT_SLACK_MS;
    fields.push({
      key,
      label: labelOf(key),
      order: typeof t.order === "number" ? t.order : i + 1,
      firstFocusAt: a,
      lastLeftAt: Math.max(a, b),
      focusedMs: focused,
      hesitationMs: k !== null ? Math.max(0, k - a) : null,
      typed: k !== null,
      revisited: stored.length > 1 || (stored.length === 0 && spanLonger),
      last: false,
      visits: stored.length > 0 ? stored : [[a, Math.max(a, b)]],
      approx: stored.length === 0 && spanLonger,
      filled: typeof t.filled === "boolean" ? t.filled : null,
      edits: Number(t.edits) || 0,
      errors: Number(t.errors) || 0,
      required: defs.has(key) ? defs.get(key)!.required : null,
    });
  });
  fields.sort((x, y) => x.order - y.order || x.firstFocusAt - y.firstFocusAt);
  const touched = new Set(fields.map((f) => f.key));
  const errOnly = new Map(errorOnly.map((e) => [e.key, e.errors]));
  const untouched: UntouchedField[] = (row.form_fields ?? [])
    .filter((d) => !touched.has(d.key))
    .map((d) => ({ key: d.key, label: labelOf(d.key), type: d.type, required: d.required, errors: errOnly.get(d.key) ?? 0 }));
  for (const e of errorOnly) if (!defs.has(e.key)) untouched.push({ key: e.key, label: labelOf(e.key), type: "other", required: true, errors: e.errors });

  // the field the person was on at the end: the last field type/key recorded, else the one left last
  const lastKey = row.last_field_type ? (row.last_field_type === "custom" ? "custom:" + (row.last_field_key ?? "unknown") : row.last_field_type) : null;
  const lastField = fields.find((f) => f.key === lastKey) ?? [...fields].sort((x, y) => y.lastLeftAt - x.lastLeftAt)[0];
  if (lastField && ended !== "open") lastField.last = true;

  const start = firstInputAt ?? fields[0]?.firstFocusAt ?? null;
  const end = endedAt ?? (fields.length ? Math.max(...fields.map((f) => f.lastLeftAt)) : null);
  const outside = start !== null && end !== null && end > start ? outsideIntervals(sessionPageViews, row.page_path, start, end) : [];

  // segments: every visit of every field, and what lies between consecutive visits (in time order)
  const segments: Segment[] = [];
  let pausesMs = 0;
  const visits = fields.flatMap((f) => f.visits.map(([from, to]) => ({ key: f.key, from, to, approx: f.approx }))).sort((x, y) => x.from - y.from);
  for (let i = 0; i < visits.length; i++) {
    const v = visits[i];
    segments.push({ kind: "field", key: v.key, from: v.from, to: v.to, approx: v.approx });
    const next = visits[i + 1];
    if (!next) continue;
    const gapFrom = Math.max(...visits.slice(0, i + 1).map((w) => w.to)); // an approximate (long) bar may overlap later ones
    const gapTo = next.from;
    if (gapTo <= gapFrom) continue;
    const gap = gapTo - gapFrom;
    if (gap < pauseMinMs) {
      segments.push({ kind: "move", from: gapFrom, to: gapTo, ms: gap });
      continue;
    }
    // the part of the gap spent off this page is "away"/"other page", the rest is a pause on the page
    // Only the pieces of the gap that are NOT away / on another page are pauses, each drawn where it really was, so a
    // pause never overlaps the time away. A piece shorter than the threshold is neither (it stays "not explained").
    const cuts = outside.map((o) => [Math.max(o.from, gapFrom), Math.min(o.to, gapTo)] as const).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    let cursor = gapFrom;
    const pieces: [number, number][] = [];
    for (const [a, b] of cuts) {
      if (a > cursor) pieces.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < gapTo) pieces.push([cursor, gapTo]);
    for (const [a, b] of pieces) {
      if (b - a >= pauseMinMs) {
        segments.push({ kind: "pause", from: a, to: b, ms: b - a });
        pausesMs += b - a;
      }
    }
  }
  for (const o of outside) segments.push(o.kind === "away" ? { kind: "away", from: o.from, to: o.to, ms: o.to - o.from } : { kind: "otherPage", from: o.from, to: o.to, ms: o.to - o.from, path: o.path });
  segments.sort((a, b) => a.from - b.from);

  const inFieldsMs = fields.reduce((n, f) => n + f.focusedMs, 0);
  const awayMs = outside.filter((o) => o.kind === "away").reduce((n, o) => n + (o.to - o.from), 0);
  const otherPagesMs = outside.filter((o) => o.kind === "otherPage").reduce((n, o) => n + (o.to - o.from), 0);
  const spanMs = start !== null && end !== null ? Math.max(0, end - start) : null;

  return {
    status: row.status,
    page: row.page_path,
    seenAt,
    firstInputAt,
    endedAt: end,
    ended,
    fields,
    untouched,
    formFieldCount: row.form_fields && row.form_fields.length ? row.form_fields.length : null,
    segments,
    totals: {
      onscreenBeforeStartMs: typeof row.onscreen_before_start_ms === "number" ? row.onscreen_before_start_ms : null,
      toStartMs: seenAt !== null && firstInputAt !== null ? Math.max(0, firstInputAt - seenAt) : null,
      spanMs,
      inFieldsMs,
      pausesMs,
      otherPagesMs,
      awayMs,
      unaccountedMs: spanMs !== null ? Math.max(0, spanMs - inFieldsMs - pausesMs - otherPagesMs - awayMs) : 0,
      fieldsTouched: fields.length,
    },
    exact: fields.every((f) => !f.approx),
  };
}
