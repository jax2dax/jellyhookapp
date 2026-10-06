// output/plan.ts
// The output engine's decisions, as pure rules: given a hook, which view
// shows its result and which extra rows ("evidence") explain it. No data,
// no database: output/server/render.ts executes the plan. The rules are
// written out in output/rules.md; keep both and output/tests in step.
import type { EntityKey } from "../jh-hook/schema";
import type { Condition, HookSpec, RelatedCondition } from "../jh-hook/types";
import type { ListKind } from "./types";

export interface OutputPlan {
  view: "number" | "ranking" | "timeSeries" | "values" | ListKind;
  /** For list views: which rows are the items. pageView results are shown as their sessions. */
  listOf?: ListKind;
  pageSize?: number;
  /** Compare the single value with the same measure over everything (base rate). */
  baseRate: boolean;
  /** Evidence to fetch, per the decision "only when the hook filtered on connected rows". */
  evidence: Evidence;
}

export type Evidence =
  | { kind: "none" }
  /** sessions: highlight the page visits that satisfied these page-view conditions */
  | { kind: "visits"; conditions: RelatedCondition[] }
  /** page views returned: highlight exactly those page views inside their sessions */
  | { kind: "returnedVisits" }
  /** leads: show the session they converted in, highlighting visits that satisfied its page-view conditions */
  | { kind: "leadSession"; sessionConditions: Condition[] }
  /** visitors: show up to 2 sessions that satisfied these session conditions */
  | { kind: "visitorSessions"; sessionConditions: RelatedCondition[] };

export const PAGE_SIZE: Record<ListKind, number> = { sessions: 6, leads: 12, visitors: 12, pages: 24, forms: 12, formFields: 50 };

const LIST_OF: Record<EntityKey, ListKind> = {
  session: "sessions",
  pageView: "sessions",
  awayGap: "sessions",
  lead: "leads",
  visitor: "visitors",
  page: "pages",
  form: "forms",
  formField: "formFields",
};

/** Conditions that apply to the row itself (AND level), skipping NOT groups; OR branches are included (any of them may have matched). */
function andLevel(conds: Condition[]): Condition[] {
  const out: Condition[] = [];
  for (const c of conds) {
    if (c.kind === "group") {
      if (!c.not) out.push(...andLevel(c.where));
    } else out.push(c);
  }
  return out;
}

const related = (conds: Condition[], relation: string) =>
  andLevel(conds).filter((c): c is RelatedCondition => c.kind === "related" && c.relation === relation && !isNone(c));

/** "has none" / "count = 0": nothing to highlight. */
function isNone(c: RelatedCondition): boolean {
  if (!c.measure && !c.op) return false;
  const v = typeof c.value === "number" ? c.value : null;
  return (c.op === "=" && v === 0) || (c.op === "<" && v === 1) || (c.op === "<=" && v === 0);
}

export function planOutput(spec: HookSpec): OutputPlan {
  const o = spec.output;
  if (o.kind === "count" || o.kind === "countDistinct" || o.kind === "aggregate") return { view: "number", baseRate: true, evidence: { kind: "none" } };
  if (o.kind === "groupBy") return { view: o.bucket ? "timeSeries" : "ranking", baseRate: false, evidence: { kind: "none" } };
  if (o.kind === "values") return { view: "values", baseRate: false, evidence: { kind: "none" } };

  // a list of the rows themselves
  const listOf = LIST_OF[spec.entity];
  const plan: OutputPlan = { view: listOf, listOf, pageSize: PAGE_SIZE[listOf], baseRate: false, evidence: { kind: "none" } };
  switch (spec.entity) {
    case "session": {
      const pv = related(spec.where, "pageViews");
      if (pv.length) plan.evidence = { kind: "visits", conditions: pv };
      break;
    }
    case "pageView":
      plan.evidence = { kind: "returnedVisits" };
      break;
    case "lead": {
      const s = related(spec.where, "session");
      if (s.length) plan.evidence = { kind: "leadSession", sessionConditions: s.flatMap((c) => c.where) };
      break;
    }
    case "visitor": {
      const s = related(spec.where, "sessions");
      if (s.length) plan.evidence = { kind: "visitorSessions", sessionConditions: s };
      break;
    }
  }
  return plan;
}

/** The page-view conditions inside a set of session conditions (for highlighting inside evidence sessions). */
export function pageViewConditionsIn(sessionConds: Condition[]): RelatedCondition[] {
  return related(sessionConds, "pageViews");
}

/** Human note for what the highlight means. */
export function evidenceNote(e: Evidence, entity: EntityKey): string | undefined {
  switch (e.kind) {
    case "visits":
      return "Highlighted: the page visits that matched your page conditions. Everything else in the session is dimmed.";
    case "returnedVisits":
      return "Each session is shown once, with the matching page views highlighted.";
    case "leadSession":
      return "Under each lead: the session they converted in, which your session conditions looked at.";
    case "visitorSessions":
      return `Under each visitor: up to 2 sessions that matched your session conditions.`;
    default:
      void entity;
      return undefined;
  }
}
