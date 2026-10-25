// lib/marks/evaluate.ts
// Decides which leads have which marks and stores it (lead_marks), so the leads page only READS badges: no query runs
// when someone opens it. Server only, service role (lead_marks has no write policy for signed-in users).
//
// When it runs:
//   - a lead sends a form             evaluateLeads(site, [lead])      app/api/track-form/route.js, after the response
//   - the visit a lead sent ends      evaluateLeads(site, leads)       app/api/track/route.js (scroll/time are final then)
//   - a mark is saved (its rule changed) evaluateMark(site, mark)       lib/actions/marks.action.ts
// Every mark is kept up to date, on or off, so turning a mark on or off never re-checks anything: "on" only decides
// whether its badges show. marks.evaluated_at changes exactly when a mark's results change; the browser keeps each
// mark's results under that stamp and only asks again when it moves (components/leads/LeadsWithMarks.tsx).
// Whether a lead has a mark: v2 marks (jh-marks/v2) by ./journey.ts from the lead's own rows; v1 and Hook marks by the
// mark's Hook query (jh-marks/rule.ts compileRule), on the read-only Hook role.
// Why: jh-marks/reason.ts from the lead's own rows. Design: mds/build/marks/marks.md.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { runHook } from "@/jh-hook/engine/run";
import type { HookSpec } from "@/jh-hook/types";
import { reasonFor, type ReasonInput, type ReasonPage } from "@/jh-marks/reason";
import { compileRule, type MarkRule } from "@/jh-marks/rule";
import { catalogMark, type StatsInput } from "@/jh-marks/catalog";
import { getSiteStats } from "@/lib/stats/siteStats";
import { pgHookDb } from "@/lib/hook/pgDb";
import { isRuleV2, type MarkRuleV2 } from "@/jh-marks/v2/rule";
import { matchV2 } from "./journey";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

export async function evaluateMark(siteId: string, mark: MarkToRun): Promise<number> {
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

/** Checks some leads (new, or whose visit just ended) against every active mark of the site. Never throws. */
export async function evaluateLeads(siteId: string, leadIds: string[]): Promise<void> {
  if (!leadIds.length) return;
  try {
    const first = await admin.from("marks").select("id, rule, spec, reads, source, source_key, var_values").eq("site_id", siteId).eq("kind", "lead");
    // before 19-marks-library.sql: the library columns do not exist yet
    const res = first.error && /source|var_values/.test(first.error.message) ? await admin.from("marks").select("id, rule, spec, reads").eq("site_id", siteId).eq("kind", "lead") : first;
    const marks = res.data as MarkToRun[] | null;
    const error = res.error;
    if (error || !marks?.length) return; // no marks (or the table is not there yet): nothing to do
    for (const m of marks as MarkToRun[]) {
      try {
        const { ids, reasons } = await marked(siteId, m, leadIds);
        const { data: gone } = await admin.from("lead_marks").delete().eq("mark_id", m.id).in("lead_id", leadIds).select("lead_id");
        const removed = !!gone?.length;
        if (ids.length) await admin.from("lead_marks").insert(ids.map((lead_id) => ({ mark_id: m.id, lead_id, site_id: siteId, reason: { parts: reasons.get(lead_id) ?? [] } })));
        const { count } = await admin.from("lead_marks").select("lead_id", { count: "exact", head: true }).eq("mark_id", m.id);
        // a new stamp only when this mark's results for these leads really changed (the browser refetches on a new stamp)
        if (ids.length || removed) await admin.from("marks").update({ match_count: count ?? null, evaluated_at: new Date().toISOString() }).eq("id", m.id);
      } catch (e) {
        console.error("[marks] lead check failed", { site: siteId.slice(0, 8), mark: m.id.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
      }
    }
  } catch (e) {
    console.error("[marks] lead check failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
  }
}

/** The leads whose form was sent in this visit (to re-check them when the visit ends). */
export async function leadsOfSession(siteId: string, sessionId: string): Promise<string[]> {
  const { data } = await admin.from("form_submissions").select("id").eq("site_id", siteId).eq("session_id", sessionId);
  return (data ?? []).map((r) => r.id as string);
}
