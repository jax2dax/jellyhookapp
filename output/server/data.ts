// output/server/data.ts
// Everything the canvas needs to draw, fetched for exactly the rows on
// screen. Two doors, on purpose:
//   - Hook's read-only connection (pgHookDb + scoped()) for ordering,
//     counting and evidence: it can use the engine's compiler, so any
//     condition a person can write can be used to pick what to highlight.
//   - The app's Supabase client (signed-in user, RLS on) for display rows
//     (session replays, leads, visitors, forms), the same way the leads and
//     conversions pages read them. page_structure (headers, page heights)
//     is only reachable this way.
// Every query is pinned to the site; nothing here trusts the browser.
import "server-only";
import { createSupabaseClient } from "@/lib/supabase";
import { pgHookDb } from "@/lib/hook/pgDb";
import { buildSessionsRaw } from "@/lib/leadSessions/transform";
import { scoped } from "../../jh-hook/engine/sql";
import { SQL } from "../../jh-hook/engine/sqlmap";
import type { RelatedCondition } from "../../jh-hook/types";
import { foldSessions, foldVisits, matchingSessionsQuery, matchingVisitsQuery } from "./queries";
import type { SessionRaw } from "../../framePlate/types";
import type { FieldRow, FormCard, PageCard, SessionCard } from "../types";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const iso = (v: unknown) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));

function check<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return (res.data ?? []) as T;
}

// ── ordering: a stable display order for a set of result ids ─────────────
export async function orderSessions(siteId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await pgHookDb.query(
    `SELECT b.session_id AS id FROM ${scoped("sessions", "b")} WHERE b.session_id = ANY($2::text[]) ORDER BY b.started_at DESC NULLS LAST`,
    [siteId, ids],
  );
  const known = rows.map((r) => String(r.id));
  const seen = new Set(known);
  return [...known, ...ids.filter((x) => !seen.has(x))]; // page views with no sessions row go last
}

/** page view (or away period) uuids -> their sessions, each with the page_view_ids to highlight, newest session first. */
export async function sessionsOfPageViews(siteId: string, pvIds: string[]): Promise<{ id: string; h: string[] }[]> {
  if (!pvIds.length) return [];
  const rows = await pgHookDb.query(
    `SELECT b.session_id AS sid, b.page_view_id AS pvid FROM ${scoped("page_views", "b")} WHERE b.id = ANY($2::uuid[]) AND b.session_id IS NOT NULL`,
    [siteId, pvIds],
  );
  const by = new Map<string, string[]>();
  for (const r of rows) {
    const sid = String(r.sid);
    if (!by.has(sid)) by.set(sid, []);
    if (r.pvid) by.get(sid)!.push(String(r.pvid));
  }
  const order = await orderSessions(siteId, [...by.keys()]);
  return order.map((id) => ({ id, h: by.get(id) ?? [] }));
}

export async function orderLeads(siteId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await pgHookDb.query(`SELECT b.id::text AS id FROM ${scoped("form_submissions", "b")} WHERE b.id = ANY($2::uuid[]) ORDER BY b.submitted_at DESC NULLS LAST`, [siteId, ids]);
  return rows.map((r) => String(r.id));
}

export async function orderVisitors(siteId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await pgHookDb.query(
    `SELECT b.visitor_id AS id FROM ${scoped("visitors", "b")} WHERE b.visitor_id = ANY($2::text[]) GROUP BY b.visitor_id ORDER BY max(b.last_seen) DESC NULLS LAST`,
    [siteId, ids],
  );
  return rows.map((r) => String(r.id));
}

export async function orderPages(siteId: string, paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const rows = await pgHookDb.query(
    `SELECT b.page_path AS id FROM ${scoped("page_views", "b")} WHERE b.page_path = ANY($2::text[]) GROUP BY 1 ORDER BY count(*) DESC`,
    [siteId, paths],
  );
  return rows.map((r) => String(r.id));
}

export async function orderForms(siteId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await pgHookDb.query(`SELECT b.id::text AS id FROM ${scoped("form_engagement", "b")} WHERE b.id = ANY($2::uuid[]) ORDER BY b.viewed_at DESC NULLS LAST`, [siteId, ids]);
  return rows.map((r) => String(r.id));
}

export async function orderFormFields(siteId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await pgHookDb.query(`SELECT b.id AS id FROM ${SQL.formField.source("b")} WHERE b.id = ANY($2::text[]) ORDER BY b.focused_ms DESC NULLS LAST`, [siteId, ids]);
  return rows.map((r) => String(r.id));
}

// ── evidence: which rows satisfied the hook's conditions on connected rows ─
/**
 * For each session, the page_view_ids of its visits that satisfy any of these
 * "page views where ..." conditions. Compiled by the Hook engine itself, so
 * every field, operator, sub-hook and sequence works here too.
 */
export async function matchingVisits(siteId: string, conds: RelatedCondition[], sessionIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (!sessionIds.length || !conds.length) return out;
  const results = await Promise.all(conds.map((c) => {
    const q = matchingVisitsQuery(siteId, c, sessionIds);
    return pgHookDb.query(q.sql, q.params);
  }));
  for (const rows of results) foldVisits(rows, out);
  return out;
}

/** For each visitor, up to `perVisitor` of their sessions that satisfy ALL these session conditions, newest first. */
export async function matchingSessionsOfVisitors(siteId: string, conds: RelatedCondition[], visitorIds: string[], perVisitor = 2): Promise<Map<string, string[]>> {
  if (!visitorIds.length) return new Map();
  const q = matchingSessionsQuery(siteId, conds, visitorIds);
  return foldSessions(await pgHookDb.query(q.sql, q.params), perVisitor);
}

// ── display rows ─────────────────────────────────────────────────────────
/** Session replays (FramePlate data) for these session ids, plus each visitor's device. */
export async function sessionReplays(siteId: string, sessionIds: string[]): Promise<Map<string, { session: SessionRaw; deviceType: string | null }>> {
  const out = new Map<string, { session: SessionRaw; deviceType: string | null }>();
  if (!sessionIds.length) return out;
  const supabase = createSupabaseClient();
  const [sessions, pageViews, submissions, formEngagement] = await Promise.all([
    supabase.from("sessions").select("*").eq("site_id", siteId).in("session_id", sessionIds).then((r) => check<Row[]>(r, "sessions")),
    supabase.from("page_views").select("*").eq("site_id", siteId).in("session_id", sessionIds).order("entered_at", { ascending: true }).then((r) => check<Row[]>(r, "page_views")),
    supabase.from("form_submissions").select("*").eq("site_id", siteId).in("session_id", sessionIds).then((r) => check<Row[]>(r, "form_submissions")),
    supabase.from("form_engagement").select("*").eq("site_id", siteId).in("session_id", sessionIds).then((r) => check<Row[]>(r, "form_engagement")),
  ]);
  const paths = [...new Set(pageViews.map((p) => str(p.page_path)).filter((p): p is string => !!p))];
  const visitorIds = [...new Set(sessions.map((s) => str(s.visitor_id)).filter((v): v is string => !!v))];
  const [pageStructure, visitors] = await Promise.all([
    paths.length ? supabase.from("page_structure").select("*").eq("site_id", siteId).in("page_path", paths).then((r) => check<Row[]>(r, "page_structure")) : Promise.resolve([] as Row[]),
    visitorIds.length ? supabase.from("visitors").select("visitor_id, device_type").eq("site_id", siteId).in("visitor_id", visitorIds).then((r) => check<Row[]>(r, "visitors")) : Promise.resolve([] as Row[]),
  ]);
  const device = new Map(visitors.map((v) => [String(v.visitor_id), str(v.device_type)]));
  const built = buildSessionsRaw({ sessions, pageViews, submissions, pageStructure, formEngagement }) as SessionRaw[];
  for (const s of built) out.set(s.id, { session: s, deviceType: device.get(s.visitorId) ?? null });
  return out;
}

export function sessionCards(order: string[], replays: Map<string, { session: SessionRaw; deviceType: string | null }>, highlight: Map<string, Iterable<string>>, reason?: string): SessionCard[] {
  const out: SessionCard[] = [];
  for (const id of order) {
    const r = replays.get(id);
    if (r) out.push({ session: r.session, deviceType: r.deviceType, highlight: [...(highlight.get(id) ?? [])], reason });
  }
  return out;
}

export async function leadRows(siteId: string, ids: string[]): Promise<Row[]> {
  if (!ids.length) return [];
  const supabase = createSupabaseClient();
  const rows = check<Row[]>(await supabase.from("form_submissions").select("*").eq("site_id", siteId).in("id", ids), "form_submissions");
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Row => !!r);
}

export async function visitorRows(siteId: string, ids: string[]): Promise<{ visitors: Map<string, Row>; leads: Map<string, Row>; sessions: Map<string, number> }> {
  const supabase = createSupabaseClient();
  const [visitors, leads, counts] = await Promise.all([
    supabase.from("visitors").select("*").eq("site_id", siteId).in("visitor_id", ids).then((r) => check<Row[]>(r, "visitors")),
    supabase.from("form_submissions").select("id, visitor_id, name, email, submitted_at").eq("site_id", siteId).in("visitor_id", ids).order("submitted_at", { ascending: false }).then((r) => check<Row[]>(r, "form_submissions")),
    pgHookDb.query(`SELECT b.visitor_id AS vid, count(*)::int AS n FROM ${scoped("sessions", "b")} WHERE b.visitor_id = ANY($2::text[]) GROUP BY 1`, [siteId, ids]),
  ]);
  const vmap = new Map<string, Row>();
  for (const v of visitors) if (!vmap.has(String(v.visitor_id))) vmap.set(String(v.visitor_id), v);
  const lmap = new Map<string, Row>();
  for (const l of leads) if (!lmap.has(String(l.visitor_id))) lmap.set(String(l.visitor_id), l); // newest first
  return { visitors: vmap, leads: lmap, sessions: new Map(counts.map((c) => [String(c.vid), Number(c.n)])) };
}

export async function pageCards(siteId: string, paths: string[]): Promise<PageCard[]> {
  if (!paths.length) return [];
  const [views, subs] = await Promise.all([
    pgHookDb.query(`SELECT b.page_path AS p, count(*)::int AS n FROM ${scoped("page_views", "b")} WHERE b.page_path = ANY($2::text[]) GROUP BY 1`, [siteId, paths]),
    pgHookDb.query(`SELECT b.page_path AS p, count(*)::int AS n FROM ${scoped("form_submissions", "b")} WHERE b.page_path = ANY($2::text[]) GROUP BY 1`, [siteId, paths]),
  ]);
  const v = new Map(views.map((r) => [String(r.p), Number(r.n)]));
  const s = new Map(subs.map((r) => [String(r.p), Number(r.n)]));
  return paths.map((path) => ({ path, views: v.get(path) ?? 0, submissions: s.get(path) ?? 0 }));
}

export async function formCards(siteId: string, ids: string[]): Promise<FormCard[]> {
  if (!ids.length) return [];
  const rows = await pgHookDb.query(
    `SELECT b.id::text AS id, b.page_path, b.status, b.last_field_type, b.last_field_key, b.viewed_at, ` +
      `EXTRACT(EPOCH FROM (b.ended_at - b.first_input_at)) * 1000 AS fill_ms, ` +
      `(SELECT count(*) FROM jsonb_object_keys(COALESCE(b.field_timings, '{}'::jsonb)))::int AS touched ` +
      `FROM ${scoped("form_engagement", "b")} WHERE b.id = ANY($2::uuid[])`,
    [siteId, ids],
  );
  const by = new Map(rows.map((r) => [String(r.id), r]));
  return ids
    .map((id) => by.get(id))
    .filter((r): r is Row => !!r)
    .map((r) => ({
      page: str(r.page_path),
      status: str(r.status),
      lastField: r.last_field_type === "custom" ? str(r.last_field_key) : str(r.last_field_type),
      viewedAt: iso(r.viewed_at),
      fillMs: r.fill_ms == null ? null : Number(r.fill_ms),
      fieldsTouched: Number(r.touched ?? 0),
    }));
}

export async function fieldRows(siteId: string, ids: string[]): Promise<FieldRow[]> {
  if (!ids.length) return [];
  const f = SQL.formField.fields;
  const rows = await pgHookDb.query(
    `SELECT b.id AS id, ${f.page("b")} AS page, ${f.name("b")} AS field, ${f.fieldType("b")} AS ftype, ${f.focusedTime("b")} AS ms, ` +
      `${f.typed("b")} AS typed, ${f.isLastTouched("b")} AS last, ${f.formStatus("b")} AS status FROM ${SQL.formField.source("b")} WHERE b.id = ANY($2::text[])`,
    [siteId, ids],
  );
  const by = new Map(rows.map((r) => [String(r.id), r]));
  return ids
    .map((id) => by.get(id))
    .filter((r): r is Row => !!r)
    .map((r) => ({
      page: str(r.page),
      field: String(r.field ?? ""),
      fieldType: String(r.ftype ?? ""),
      focusedMs: r.ms == null ? null : Number(r.ms),
      typed: !!r.typed,
      lastTouched: !!r.last,
      formStatus: str(r.status),
    }));
}

export { iso, str };
