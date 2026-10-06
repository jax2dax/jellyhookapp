// output/server/queries.ts
// The SQL the output engine sends through Hook's connection, as pure
// builders (no database, no "server-only"), so the exact statements are
// tested against a real Postgres in output/tests. Every statement is pinned
// to the site through the engine's scoped() sources.
import { Ctx, compileCondition } from "../../jh-hook/engine/compile";
import { SQL } from "../../jh-hook/engine/sqlmap";
import type { Condition, RelatedCondition } from "../../jh-hook/types";

export interface Stmt {
  sql: string;
  params: unknown[];
}

/**
 * Page visits (session_id, page_view_id) inside these sessions that satisfy
 * one "page views where ..." condition. Compiled by the Hook engine itself,
 * so every field, operator, sub-hook and sequence works for highlighting.
 */
export function matchingVisitsQuery(siteId: string, cond: RelatedCondition, sessionIds: string[]): Stmt {
  const ctx = new Ctx(siteId);
  const preds = cond.where.map((c) => `(${compileCondition(c, "pageView", "b", ctx)})`);
  const ids = ctx.p.add(sessionIds, "text[]");
  return {
    sql:
      ctx.withClause() +
      `SELECT b.session_id AS sid, b.page_view_id AS pvid FROM ${SQL.pageView.source("b")} WHERE b.session_id = ANY(${ids})${preds.length ? ` AND ${preds.join(" AND ")}` : ""}`,
    params: ctx.p.values,
  };
}

/** (visitor_id, session_id) of these visitors' sessions that satisfy ALL these session conditions, newest first. */
export function matchingSessionsQuery(siteId: string, conds: RelatedCondition[], visitorIds: string[]): Stmt {
  const ctx = new Ctx(siteId);
  const preds = conds.flatMap((c) => c.where).map((c: Condition) => `(${compileCondition(c, "session", "b", ctx)})`);
  const ids = ctx.p.add(visitorIds, "text[]");
  return {
    sql:
      ctx.withClause() +
      `SELECT b.visitor_id AS vid, b.session_id AS sid FROM ${SQL.session.source("b")} WHERE b.visitor_id = ANY(${ids})${preds.length ? ` AND ${preds.join(" AND ")}` : ""} ORDER BY b.started_at DESC NULLS LAST`,
    params: ctx.p.values,
  };
}

/** Folds query rows into session -> highlighted page_view_ids. */
export function foldVisits(rows: Record<string, unknown>[], into = new Map<string, Set<string>>()): Map<string, Set<string>> {
  for (const r of rows) {
    const sid = String(r.sid);
    if (!into.has(sid)) into.set(sid, new Set());
    if (r.pvid) into.get(sid)!.add(String(r.pvid));
  }
  return into;
}

/** Folds query rows into visitor -> up to `perVisitor` session ids, keeping the given (newest first) order. */
export function foldSessions(rows: Record<string, unknown>[], perVisitor: number): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    const vid = String(r.vid);
    const list = out.get(vid) ?? [];
    if (list.length < perVisitor) list.push(String(r.sid));
    out.set(vid, list);
  }
  return out;
}
