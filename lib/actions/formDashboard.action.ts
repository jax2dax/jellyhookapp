// lib/actions/formDashboard.action.ts
// The form dashboard's data, for the CURRENT site (site from siteOrThrow, the same rule as every Hook action; the browser
// never supplies a site id).
//
// What it returns (design: mds/build/form-study/averages-and-versions.md):
//  - the site's lead forms (every tracked form is a data-conversion="true" form), the main one picked by submissions;
//  - the form's versions (form_versions, newest first);
//  - "current": the form's current version over its whole life, as Hook answers (funnel, fields, give-ups) plus the
//    median successful submission built from its submitted rows;
//  - "compare": the same for the side chosen at the top (all time, a version, or a date range), or nothing.
// Counts are Hook queries (read-only role, pinned to the site, credit ceiling). Medians, spreads and the "unusual"
// limits come from the submitted rows themselves (newest AVG_SAMPLE_MAX), read with the user's own login (RLS).
// An ended version's side is computed once and frozen in form_versions.summary.
"use server";

import { runHook } from "@/jh-hook/engine/run";
import { hookLog } from "@/jh-hook/debug";
import { AVG_SAMPLE_MAX, SUMMARY_FORMULA_VERSION, summarizeVersion, unusualIn, versionLabel, TOTAL_KEYS, type TotalKey, type VersionSummary } from "@/jh-forms/averages";
import { assembleDashboard, dashboardSpecs, formListSpecs, type DashboardAnswers, type FormDashboard, type FormScope, type Rows } from "@/jh-forms/dashboard";
import { buildFormTimeline, type EngagementRow, type FormFieldDef, type FormTimeline, type PageViewRow } from "@/jh-forms/timeline";
import { formKeyLabel } from "@/lib/tracking/formKey";
import { pgHookDb } from "@/lib/hook/pgDb";
import { failure, siteOrThrow } from "@/lib/hook/site";
import { createSupabaseClient } from "@/lib/supabase";

/** Per query. Protects the database: a query the planner expects to cost more is refused, not run. Measured
 *  2026-10-15: about 100 credits per query at 1,000 form rows in scope, about 970 at 10,000, so 500 holds up to roughly
 *  5,000 rows. Above that, frozen version summaries carry the old numbers. */
const DASHBOARD_MAX_CREDITS = 500;
const DAY = 86_400_000;

export type CompareChoice = { kind: "off" } | { kind: "all" } | { kind: "version"; id: string } | { kind: "custom"; from: string; to: string };

export interface FormOption {
  key: string;
  label: string;
  started: number;
  submitted: number;
}

export interface VersionInfo {
  id: string;
  label: string;
  startedAt: string;
  endedAt: string | null;
  current: boolean;
  /** field lists seen in its first 24 h (more than 1 = edited again that day) */
  layouts: number;
  pages: string[];
  fields: FormFieldDef[];
}

export interface Side {
  label: string;
  scope: FormScope;
  /** days the side spans, for per-day rates (at least 1) */
  days: number;
  dashboard: FormDashboard;
  /** the median successful submission and its spreads; null when nothing was submitted */
  reference: VersionSummary | null;
  /** true when read from the frozen copy of an ended version */
  frozen: boolean;
}

export type DashboardResponse =
  | {
      ok: true;
      forms: FormOption[];
      form: string | null;
      versions: VersionInfo[];
      /** false until 17-form-versions.sql has run: everything then covers every form, all time */
      versionsReady: boolean;
      compareChoice: CompareChoice;
      current: Side;
      compare: Side | null;
      /** with a comparison: how many of the current version's submitted forms (the newest AVG_SAMPLE_MAX) are unusual
       *  against the comparison's reference, per field key and per total */
      unusual: { of: number; fields: Record<string, number>; totals: Record<TotalKey, number> } | null;
      credits: number;
      ms: number;
      at: string;
    }
  | { ok: false; error: string; ref?: string };

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
const uuid = /^[0-9a-f-]{36}$/i;

function parseCompare(raw: unknown, from: unknown, to: unknown): CompareChoice {
  if (raw === "all") return { kind: "all" };
  if (typeof raw === "string" && raw.startsWith("v:") && uuid.test(raw.slice(2))) return { kind: "version", id: raw.slice(2) };
  if (raw === "custom" && typeof from === "string" && typeof to === "string" && isoDay.test(from) && isoDay.test(to) && from <= to) return { kind: "custom", from, to };
  return { kind: "off" };
}

async function runSpecs(siteId: string, specs: Record<string, unknown>): Promise<{ answers: Record<string, Rows>; credits: number }> {
  let credits = 0;
  const entries = await Promise.all(
    Object.entries(specs).map(async ([name, spec]) => {
      const r = await runHook(pgHookDb, siteId, spec as Parameters<typeof runHook>[2], { maxCredits: DASHBOARD_MAX_CREDITS });
      credits += r.cost.credits;
      return [name, r.answer.shape === "table" ? (r.answer.rows as Rows) : []] as const;
    }),
  );
  return { answers: Object.fromEntries(entries), credits };
}

const ROW_COLS = "id, session_id, page_path, form_index, status, viewed_at, first_input_at, ended_at, last_activity_at, field_timings, last_field_type, last_field_key, form_fields, onscreen_before_start_ms";

/** The newest submitted rows of a scope and their sessions' page views: what the medians are built from. */
async function referenceRows(siteId: string, scope: FormScope): Promise<{ rows: EngagementRow[]; pageViews: PageViewRow[] }> {
  const supabase = createSupabaseClient();
  let q = supabase.from("form_engagement").select(ROW_COLS).eq("site_id", siteId).eq("status", "submitted");
  if (scope.formKey) q = q.eq("form_key", scope.formKey);
  if (scope.version) q = q.eq("form_version_id", scope.version);
  if (scope.from) q = q.gte("viewed_at", scope.from);
  if (scope.to) q = q.lt("viewed_at", scope.to);
  const { data, error } = await q.order("ended_at", { ascending: false }).limit(AVG_SAMPLE_MAX);
  if (error) throw new Error("reference rows: " + error.message);
  const rows = (data ?? []) as EngagementRow[];
  const sessions = [...new Set(rows.map((r) => r.session_id).filter(Boolean))];
  const pageViews: PageViewRow[] = [];
  for (let i = 0; i < sessions.length; i += 100) {
    const { data: pv } = await supabase.from("page_views").select("page_view_id, session_id, page_path, entered_at, left_at").eq("site_id", siteId).in("session_id", sessions.slice(i, i + 100));
    pageViews.push(...((pv ?? []) as PageViewRow[]));
  }
  return { rows, pageViews };
}

function spanDays(startMs: number | null, endMs: number | null, dash: FormDashboard): number {
  const first = dash.daily[0]?.day ? Date.parse(dash.daily[0].day) : null;
  const last = dash.daily.at(-1)?.day ? Date.parse(dash.daily.at(-1)!.day) + DAY : null;
  const a = startMs ?? first ?? Date.now();
  const b = endMs ?? (startMs !== null ? Date.now() : last ?? Date.now());
  return Math.max(1, (b - a) / DAY);
}

async function buildSide(siteId: string, label: string, scope: FormScope, fields: FormFieldDef[], span: { start: number | null; end: number | null }): Promise<{ side: Side; credits: number; timelines: FormTimeline[] }> {
  const [{ answers, credits }, ref] = await Promise.all([runSpecs(siteId, dashboardSpecs(scope)), referenceRows(siteId, scope)]);
  const dashboard = assembleDashboard(answers as DashboardAnswers);
  const reference = ref.rows.length ? summarizeVersion(ref.rows, fields, ref.pageViews) : null;
  const bySession = new Map<string, PageViewRow[]>();
  for (const p of ref.pageViews) bySession.set(p.session_id, [...(bySession.get(p.session_id) ?? []), p]);
  const timelines = ref.rows.map((r) => buildFormTimeline(r, bySession.get(r.session_id) ?? []));
  return { side: { label, scope, days: spanDays(span.start, span.end, dashboard), dashboard, reference, frozen: false }, credits, timelines };
}

export async function getFormDashboard(input: { form?: string | null; compare?: string | null; from?: string | null; to?: string | null } = {}): Promise<DashboardResponse> {
  const t0 = Date.now();
  let siteId = "";
  try {
    siteId = await siteOrThrow();
    const supabase = createSupabaseClient();
    let credits = 0;

    // 1. the site's forms. Fails (unknown field) until the migration has run: then one scope for everything.
    let forms: FormOption[] = [];
    let versionsReady = true;
    try {
      const list = await runSpecs(siteId, formListSpecs());
      credits += list.credits;
      const sub = new Map(list.answers.formsSubmitted.map((r) => [String(r.key), Number(r.value) || 0]));
      forms = list.answers.formsStarted
        .filter((r) => r.key)
        .map((r) => ({ key: String(r.key), label: formKeyLabel(String(r.key)), started: Number(r.value) || 0, submitted: sub.get(String(r.key)) ?? 0 }))
        .sort((a, b) => b.submitted - a.submitted || b.started - a.started);
    } catch {
      versionsReady = false;
    }
    const form = forms.find((f) => f.key === input.form)?.key ?? forms[0]?.key ?? null;

    // 2. its versions, newest first
    let versions: VersionInfo[] = [];
    const frozen = new Map<string, { summary: unknown; summary_version: number | null }>();
    if (versionsReady && form) {
      const { data, error } = await supabase.from("form_versions").select("id, started_at, ended_at, fingerprints, pages, fields, summary, summary_version").eq("site_id", siteId).eq("form_key", form).order("started_at", { ascending: false });
      if (error) versionsReady = false;
      for (const v of data ?? []) {
        versions.push({ id: v.id, label: versionLabel({ startedAt: Date.parse(v.started_at), endedAt: v.ended_at ? Date.parse(v.ended_at) : null }), startedAt: v.started_at, endedAt: v.ended_at, current: !v.ended_at, layouts: (v.fingerprints ?? []).length, pages: v.pages ?? [], fields: (v.fields ?? []) as FormFieldDef[] });
        frozen.set(v.id, { summary: v.summary, summary_version: v.summary_version });
      }
      if (!versionsReady) versions = [];
    }
    const cur = versions.find((v) => v.current) ?? null;
    const fields = cur?.fields ?? versions[0]?.fields ?? [];

    // 3. the current side: the current version over its whole life (or everything, before versions exist)
    const curScope: FormScope = cur ? { formKey: form, version: cur.id } : { formKey: form };
    const curLabel = cur ? "Current version (" + cur.label + ")" : "All time";
    const choice = parseCompare(input.compare, input.from, input.to);

    // 4. the compare side
    const cmpPromise = (async (): Promise<{ side: Side; credits: number; timelines?: FormTimeline[] } | null> => {
      if (choice.kind === "off" || !form) return null;
      if (choice.kind === "all") return buildSide(siteId, "All time (every version)", { formKey: form }, fields, { start: null, end: null });
      if (choice.kind === "custom") {
        const to = new Date(Date.parse(choice.to) + DAY).toISOString(); // the "to" day is included
        return buildSide(siteId, choice.from + " to " + choice.to, { formKey: form, from: new Date(choice.from).toISOString(), to }, fields, { start: Date.parse(choice.from), end: Date.parse(to) });
      }
      const v = versions.find((x) => x.id === choice.id);
      if (!v) return null;
      const span = { start: Date.parse(v.startedAt), end: v.endedAt ? Date.parse(v.endedAt) : null };
      const stored = frozen.get(v.id);
      if (v.endedAt && stored?.summary && stored.summary_version === SUMMARY_FORMULA_VERSION) {
        return { side: { ...(stored.summary as Side), frozen: true }, credits: 0 };
      }
      const built = await buildSide(siteId, "Version " + v.label, { formKey: form, version: v.id }, v.fields, span);
      if (v.endedAt) {
        // an ended version never changes again: keep its numbers (RLS: members may set only these three columns)
        const { error } = await supabase.from("form_versions").update({ summary: built.side, summary_version: SUMMARY_FORMULA_VERSION, summary_at: new Date().toISOString() }).eq("id", v.id).eq("site_id", siteId);
        if (error) hookLog.info("form version freeze failed", { site: siteId.slice(0, 8), message: error.message });
      }
      return built;
    })();

    const [curSide, cmp] = await Promise.all([buildSide(siteId, curLabel, curScope, fields, { start: cur ? Date.parse(cur.startedAt) : null, end: null }), cmpPromise]);
    credits += curSide.credits + (cmp?.credits ?? 0);
    let unusual: { of: number; fields: Record<string, number>; totals: Record<TotalKey, number> } | null = null;
    if (cmp?.side.reference) {
      unusual = { of: curSide.timelines.length, fields: {}, totals: Object.fromEntries(TOTAL_KEYS.map((k) => [k, 0])) as Record<TotalKey, number> };
      for (const t of curSide.timelines) {
        const u = unusualIn(t, cmp.side.reference);
        for (const k of u.fields) unusual.fields[k] = (unusual.fields[k] ?? 0) + 1;
        for (const k of u.totals) unusual.totals[k] += 1;
      }
    }
    const ms = Date.now() - t0;
    hookLog.info("form dashboard", { site: siteId.slice(0, 8), compare: choice.kind, credits, ms });
    return { ok: true, forms, form, versions, versionsReady, compareChoice: choice, current: curSide.side, compare: cmp?.side ?? null, unusual, credits, ms, at: new Date().toISOString() };
  } catch (e) {
    return failure(e, { what: "form dashboard", siteId, t0 });
  }
}

/**
 * The "All time" reference of one form, for a lead's own form chart (it has no compare picker): the median successful
 * submission and its spreads. Null when the form has too few submissions or no key.
 */
export async function getFormReference(formKey: string | null): Promise<VersionSummary | null> {
  if (!formKey) return null;
  try {
    const siteId = await siteOrThrow();
    const ref = await referenceRows(siteId, { formKey });
    if (!ref.rows.length) return null;
    const fields = (ref.rows[0].form_fields ?? []) as FormFieldDef[];
    return summarizeVersion(ref.rows, fields, ref.pageViews);
  } catch (e) {
    hookLog.info("form reference failed", { message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}
