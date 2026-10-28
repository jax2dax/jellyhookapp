// lib/marks/evaluate.ts
// Decides which leads have which marks and stores it (lead_marks), so the leads page only READS badges: no query runs
// when someone opens it. Server only, service role (lead_marks has no write policy for signed-in users).
//
// When it runs (v3, mds/build/marks/when-marks-run.md):
//   - a lead sends a form             evaluateLeads(site, [lead])      the lead lane, lib/notifications/check.ts
//   - the visit a lead sent ends      evaluateLeads(site, leads)       app/api/track/route.js (scroll/time are final then)
//   - past leads, after a save        evaluateLeads(site, chunk, only) lib/marks/backfill.ts, in the background
// Only marks that are ON are checked: "off" means not checked (before v3 every mark was checked, on or off).
// evaluateMark (every lead, inside the save) is kept for a database before migration 33.
// marks.evaluated_at changes when a mark's results change; the browser keeps each mark's results under that stamp and
// only asks again when it moves (components/leads/LeadsWithMarks.tsx).
// Whether a lead has a mark: v2 marks (jh-marks/v2) by ./journey.ts from the lead's own rows; v1 and Hook marks by the
// mark's Hook query (jh-marks/rule.ts compileRule), on the read-only Hook role.
// Why: jh-marks/reason.ts from the lead's own rows. Design: mds/build/marks/marks.md.
import "server-only";
import { meteredAdmin } from "@/lib/db/admin";
import { runHook } from "@/jh-hook/engine/run";
import type { HookSpec } from "@/jh-hook/types";
import { reasonFor, type ReasonInput, type ReasonPage } from "@/jh-marks/reason";
import { compileRule, type MarkRule } from "@/jh-marks/rule";
import { catalogMark, type StatsInput } from "@/jh-marks/catalog";
import { getSiteStats } from "@/lib/stats/siteStats";
import { pgHookDb } from "@/lib/hook/pgDb";
import { isRuleV2, type MarkRuleV2 } from "@/jh-marks/v2/rule";
import { matchV2, matchV2Many } from "./journey";
import { metered, newMeter } from "@/lib/metrics/meter";
import { recordRun } from "@/lib/metrics/runs";

const admin = meteredAdmin();

/** A mark's Hook query may cost more than a dashboard tile: it scans the site's leads and their pages. */
const MARK_MAX_CREDITS = 5000;
/** Reasons are built for at most this many matched leads per run (the badge itself is stored for all). */
const REASON_CAP = 1000;

export interface MarkToRun {
  id: string;
  /** v1 (chips) or v2 (visit blocks, answers, form: jh-marks/v2, checked by ./journey.ts, not Hook) */
  rule: MarkRule | MarkRuleV2 | null;
  /** null for a connected mark: the published mark is used (catalog.ts) */
  spec: HookSpec | null;
  reads?: string | null;
  source?: "own" | "copy" | "connected";
  source_key?: string | null;
  var_values?: Record<string, string> | null;
}

/** What a published mark may use from the site's statistics. */
async function statsInput(siteId: string): Promise<StatsInput> {
  const s = await getSiteStats(siteId);
  return { sessionHighMs: s?.sessionDuration.beforeConversion?.high ?? null };
}

/**
 * The query (and chip rule, for reasons) a mark runs today. A connected mark is built from the published mark with
 * the person's page variables and this site's statistics, so the publisher's changes apply on its next check.
 */
export async function resolveMark(siteId: string, m: MarkToRun): Promise<{ spec: HookSpec; rule: MarkRule | null }> {
  if (m.source === "connected") {
    const c = catalogMark(m.source_key);
    if (!c) throw new Error("published mark not found: " + m.source_key);
    const made = c.make({ vars: m.var_values ?? {}, stats: await statsInput(siteId) });
    return "rule" in made ? { rule: made.rule, spec: compileRule(made.rule) } : { rule: null, spec: made.spec };
  }
  const v1 = isRuleV2(m.rule) ? null : m.rule;
  if (m.spec) return { spec: m.spec, rule: v1 };
  if (v1) return { spec: compileRule(v1), rule: v1 };
  throw new Error("mark has no conditions: " + m.id);
}

async function matchingLeads(siteId: string, spec: HookSpec, onlyLeads?: string[]): Promise<string[]> {
  const where = onlyLeads ? [...spec.where, { id: "only-leads", kind: "field" as const, field: "id", op: "in" as const, value: onlyLeads }] : spec.where;
  const r = await runHook(pgHookDb, siteId, { ...spec, where, output: { kind: "ids" } }, { maxCredits: MARK_MAX_CREDITS });
  return r.answer.shape === "list" ? r.answer.values : [];
}

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Everything reasonFor needs, for a set of leads, in a handful of reads. */
async function reasonInputs(siteId: string, leadIds: string[]): Promise<Map<string, ReasonInput>> {
  const out = new Map<string, ReasonInput>();
  if (!leadIds.length) return out;
  const leads: { id: string; visitor_id: string | null; session_id: string | null; submitted_at: string }[] = [];
  for (const c of chunks(leadIds, 200)) {
    const { data } = await admin.from("form_submissions").select("id, visitor_id, session_id, submitted_at").eq("site_id", siteId).in("id", c);
    leads.push(...((data ?? []) as typeof leads));
  }
  const visitors = [...new Set(leads.map((l) => l.visitor_id).filter((v): v is string => !!v))];
  const sessionIds = [...new Set(leads.map((l) => l.session_id).filter((v): v is string => !!v))];
  const pages: (ReasonPage & { visitor_id: string })[] = [];
  const sessions: (ReasonInput["sessions"][number] & { visitor_id: string })[] = [];
  const devices = new Map<string, string | null>();
  const fills = new Map<string, number>();
  for (const c of chunks(visitors, 100)) {
    const [pv, ss, vs] = await Promise.all([
      admin.from("page_views").select("visitor_id, session_id, page_path, entered_at, left_at, page_height, viewport_height, entry_scroll_depth, max_scroll_depth, revisit_start_scroll_depth").eq("site_id", siteId).in("visitor_id", c).limit(20_000),
      admin.from("sessions").select("visitor_id, session_id, started_at, referrer, utm_source").eq("site_id", siteId).in("visitor_id", c).limit(5_000),
      admin.from("visitors").select("visitor_id, device_type").eq("site_id", siteId).in("visitor_id", c),
    ]);
    pages.push(...((pv.data ?? []) as typeof pages));
    sessions.push(...((ss.data ?? []) as typeof sessions));
    for (const v of vs.data ?? []) devices.set(v.visitor_id as string, (v.device_type as string) ?? null);
  }
  for (const c of chunks(sessionIds, 100)) {
    const { data } = await admin.from("form_engagement").select("session_id, first_input_at, ended_at").eq("site_id", siteId).eq("status", "submitted").in("session_id", c);
    for (const f of data ?? []) if (f.first_input_at && f.ended_at) fills.set(f.session_id as string, Date.parse(f.ended_at as string) - Date.parse(f.first_input_at as string));
  }
  for (const l of leads) {
    if (!l.visitor_id || !l.session_id) continue;
    out.set(l.id, {
      submittedAt: l.submitted_at,
      sessionId: l.session_id,
      pages: pages.filter((p) => p.visitor_id === l.visitor_id),
      sessions: sessions.filter((s) => s.visitor_id === l.visitor_id),
      device: devices.get(l.visitor_id) ?? null,
      fillMs: fills.get(l.session_id) ?? null,
    });
  }
  return out;
}

async function reasonsFor(siteId: string, rule: MarkRule | null, leadIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!rule) return out; // a Hook query: the badge says what the mark is (its purpose), not per-lead evidence
  const inputs = await reasonInputs(siteId, leadIds.slice(0, REASON_CAP));
  for (const [id, input] of inputs) out.set(id, reasonFor(rule, input));
  return out;
}

/** Re-checks one mark against every lead of the site and replaces its stored results. Returns how many leads have it. */
/** The leads that have a mark, with their reasons: v2 marks by their own checker, the others by Hook. */
async function marked(siteId: string, mark: MarkToRun, onlyLeads?: string[]): Promise<{ ids: string[]; reasons: Map<string, string[]> }> {
  if (isRuleV2(mark.rule) && mark.source !== "connected") {
    const hits = await matchV2(siteId, mark.rule, onlyLeads);
    return { ids: [...hits.keys()], reasons: hits };
  }
  const { spec, rule } = await resolveMark(siteId, mark);
  const ids = await matchingLeads(siteId, spec, onlyLeads);
  return { ids, reasons: await reasonsFor(siteId, rule, ids) };
}

/** Applies one mark to every lead of the site (after it is saved). Measured and recorded for the control room. */
export async function evaluateMark(siteId: string, mark: MarkToRun): Promise<number> {
  const meter = newMeter();
  const t0 = Date.now();
  try {
    const n = await metered(meter, () => applyMark(siteId, mark));
    await recordRun({ site_id: siteId, kind: "mark_apply", leads: n, marks: 1, total_ms: Date.now() - t0 }, meter);
    return n;
  } catch (e) {
    await recordRun({ site_id: siteId, kind: "mark_apply", leads: 0, marks: 1, total_ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) }, meter);
    throw e;
  }
}

async function applyMark(siteId: string, mark: MarkToRun): Promise<number> {
  const { ids, reasons } = await marked(siteId, mark);
  const { error: delErr } = await admin.from("lead_marks").delete().eq("mark_id", mark.id);
  if (delErr) throw new Error("lead_marks delete: " + delErr.message);
  for (const c of chunks(ids, 500)) {
    const { error } = await admin.from("lead_marks").insert(c.map((lead_id) => ({ mark_id: mark.id, lead_id, site_id: siteId, reason: { parts: reasons.get(lead_id) ?? [] } })));
    if (error) throw new Error("lead_marks insert: " + error.message);
  }
  await admin.from("marks").update({ match_count: ids.length, evaluated_at: new Date().toISOString() }).eq("id", mark.id);
  return ids.length;
}

export interface EvaluateOptions {
  /** check only these marks (the ones live hooks use, checked first: lib/notifications/check.ts) */
  only?: string[];
  /** check every mark but these (the rest, after the hooks) */
  except?: string[];
  /** throw when a mark could not be checked, so the caller retries the leads later (a hook's marks must never be skipped
   *  silently: the hook would not fire). Without it, failures are logged and skipped, as before. */
  strict?: boolean;
}

/**
 * Checks some leads (new, or whose visit just ended) against the site's marks (all of them, or `only` / all but
 * `except`). Returns how many marks were checked (for the control room's record of the batch). Never throws unless
 * `strict`.
 *
 * v2 (crowd test, mds/crowd-test/roadmap.md): the v2 marks are checked together, reading the leads' history once
 * (./journey.ts matchV2Many), and the results of every mark are written together: one delete, one insert, then one
 * update per mark whose results changed. Before, each mark read the history and wrote its results itself, one after
 * another (about 8 calls per mark per batch). Older marks (v1 chips, Hook queries, connected library marks) are still
 * checked one by one.
 */
export async function evaluateLeads(siteId: string, leadIds: string[], opts: EvaluateOptions = {}): Promise<number> {
  if (!leadIds.length || (opts.only && !opts.only.length)) return 0;
  const fail = (what: string, e: unknown, mark?: string) => {
    console.error("[marks] lead check failed", { site: siteId.slice(0, 8), ...(mark ? { mark: mark.slice(0, 8) } : {}), what, error: e instanceof Error ? e.message : String(e) });
    if (opts.strict) throw e instanceof Error ? e : new Error(String(e));
  };
  let marks: (MarkToRun & { match_count?: number | null })[];
  try {
    // v3: only marks that are on ("off" means not checked; mds/build/marks/when-marks-run.md)
    let q = admin.from("marks").select("id, rule, spec, reads, source, source_key, var_values, match_count").eq("site_id", siteId).eq("kind", "lead").eq("active", true);
    if (opts.only) q = q.in("id", opts.only);
    const first = await q;
    // before 19-marks-library.sql: the library columns do not exist yet
    let res = first;
    if (first.error && /source|var_values/.test(first.error.message)) {
      let q2 = admin.from("marks").select("id, rule, spec, reads, match_count").eq("site_id", siteId).eq("kind", "lead").eq("active", true);
      if (opts.only) q2 = q2.in("id", opts.only);
      res = (await q2) as typeof first;
    }
    if (res.error) {
      // the table is not there yet (before migration 16): nothing to do; anything else is a failure
      if (/marks/.test(res.error.message) && /does not exist|schema cache/.test(res.error.message)) return 0;
      fail("marks", new Error(res.error.message));
      return 0;
    }
    marks = (res.data ?? []) as typeof marks;
  } catch (e) {
    fail("marks", e);
    return 0;
  }
  if (opts.except?.length) marks = marks.filter((m) => !opts.except!.includes(m.id));
  if (!marks.length) return 0;

  // 1. which leads have which mark
  const results = new Map<string, { ids: string[]; reasons: Map<string, string[]> }>();
  const together = marks.filter((m) => isRuleV2(m.rule) && m.source !== "connected");
  if (together.length) {
    try {
      const hits = await matchV2Many(siteId, together.map((m) => ({ id: m.id, rule: m.rule as MarkRuleV2 })), leadIds);
      for (const [id, found] of hits) results.set(id, { ids: [...found.keys()], reasons: found });
    } catch (e) {
      fail("v2 marks", e);
    }
  }
  for (const m of marks.filter((x) => !together.includes(x))) {
    try {
      results.set(m.id, await marked(siteId, m, leadIds));
    } catch (e) {
      fail("mark", e, m.id);
    }
  }
  if (!results.size) return 0;

  // 2. store them: the old results of these leads for these marks go, the new ones come, in one delete and one insert
  const checked = [...results.keys()];
  try {
    const { data: gone, error: delError } = await admin.from("lead_marks").delete().in("mark_id", checked).in("lead_id", leadIds).select("mark_id");
    if (delError) throw new Error("lead_marks delete: " + delError.message);
    const rows = [...results].flatMap(([mark_id, r]) => r.ids.map((lead_id) => ({ mark_id, lead_id, site_id: siteId, reason: { parts: r.reasons.get(lead_id) ?? [] } })));
    for (const c of chunks(rows, 500)) {
      const { error } = await admin.from("lead_marks").upsert(c, { onConflict: "mark_id,lead_id", ignoreDuplicates: true });
      if (error) throw new Error("lead_marks insert: " + error.message);
    }
    // 3. a new count and stamp for each mark whose results for these leads may have changed (the browser refetches on a
    // new stamp). The count is counted (lead_marks_mark_idx), not worked out from the count read at the start: two
    // checks of the same mark overlap (two requests' other marks, the background check of past leads) and a worked-out
    // count then kept the last writer's error for good.
    const removed = new Set((gone ?? []).map((g) => g.mark_id as string));
    const now = new Date().toISOString();
    await Promise.all(
      marks
        .filter((m) => results.has(m.id) && (results.get(m.id)!.ids.length > 0 || removed.has(m.id)))
        .map(async (m) => {
          const { count } = await admin.from("lead_marks").select("lead_id", { count: "exact", head: true }).eq("mark_id", m.id);
          await admin.from("marks").update({ match_count: count ?? m.match_count ?? null, evaluated_at: now }).eq("id", m.id);
        }),
    );
  } catch (e) {
    fail("store", e);
    return 0;
  }
  return results.size;
}

/** The leads whose form was sent in this visit (to re-check them when the visit ends). */
export async function leadsOfSession(siteId: string, sessionId: string): Promise<string[]> {
  const { data } = await admin.from("form_submissions").select("id").eq("site_id", siteId).eq("session_id", sessionId);
  return (data ?? []).map((r) => r.id as string);
}
