// lib/marks/evaluate.ts
// Decides which leads have which marks and stores it (lead_marks), so the leads page only READS badges: no query runs
// when someone opens it. Server only, service role (lead_marks has no write policy for signed-in users).
//
// When it runs:
//   - a lead sends a form             evaluateLeads(site, [lead])      app/api/track-form/route.js, after the response
//   - the visit a lead sent ends      evaluateLeads(site, leads)       app/api/track/route.js (scroll/time are final then)
//   - a mark is saved or turned on    evaluateMark(site, mark)          lib/actions/marks.action.ts
// Whether a lead has a mark: the mark's Hook query (jh-marks/rule.ts compileRule), on the read-only Hook role.
// Why: jh-marks/reason.ts from the lead's own rows. Design: mds/build/marks/marks.md.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { runHook } from "@/jh-hook/engine/run";
import type { HookSpec } from "@/jh-hook/types";
import { reasonFor, type ReasonInput, type ReasonPage } from "@/jh-marks/reason";
import type { MarkRule } from "@/jh-marks/rule";
import { pgHookDb } from "@/lib/hook/pgDb";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** A mark's Hook query may cost more than a dashboard tile: it scans the site's leads and their pages. */
const MARK_MAX_CREDITS = 5000;
/** Reasons are built for at most this many matched leads per run (the badge itself is stored for all). */
const REASON_CAP = 1000;

export interface MarkToRun {
  id: string;
  rule: MarkRule | null;
  spec: HookSpec;
  reads?: string | null;
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

async function reasonsFor(siteId: string, mark: MarkToRun, leadIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!mark.rule) return out; // made in Hook: the badge says what the mark is ("reads"), not per-lead evidence
  const inputs = await reasonInputs(siteId, leadIds.slice(0, REASON_CAP));
  for (const [id, input] of inputs) out.set(id, reasonFor(mark.rule, input));
  return out;
}

/** Re-checks one mark against every lead of the site and replaces its stored results. Returns how many leads have it. */
export async function evaluateMark(siteId: string, mark: MarkToRun): Promise<number> {
  const ids = await matchingLeads(siteId, mark.spec);
  const reasons = await reasonsFor(siteId, mark, ids);
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
    const { data: marks, error } = await admin.from("marks").select("id, rule, spec, reads").eq("site_id", siteId).eq("active", true).eq("kind", "lead");
    if (error || !marks?.length) return; // no marks (or the table is not there yet): nothing to do
    for (const m of marks as MarkToRun[]) {
      try {
        const ids = await matchingLeads(siteId, m.spec, leadIds);
        const reasons = await reasonsFor(siteId, m, ids);
        await admin.from("lead_marks").delete().eq("mark_id", m.id).in("lead_id", leadIds);
        if (ids.length) await admin.from("lead_marks").insert(ids.map((lead_id) => ({ mark_id: m.id, lead_id, site_id: siteId, reason: { parts: reasons.get(lead_id) ?? [] } })));
        const { count } = await admin.from("lead_marks").select("lead_id", { count: "exact", head: true }).eq("mark_id", m.id);
        await admin.from("marks").update({ match_count: count ?? null }).eq("id", m.id);
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
