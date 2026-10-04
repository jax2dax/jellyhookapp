// jh-hook/types.ts
// The Hook language: a small, typed, JSON-serializable spec. This is the
// product's own query language, NOT SQL. A spec says WHAT the user wants
// (return this entity, where these conditions hold, measured like this);
// the engine decides how to fetch it. Everything here is plain data, so it
// can be saved, shared in a URL (?q=), and edited by more than one front
// end (form today, a node graph later). Vocabulary: jh-hook/schema.ts.
// See jh-hook/architecture.md.
import type { Agg, EntityKey, FieldType, Op } from "./schema";

export type DurationUnit = "ms" | "sec" | "min" | "hr" | "day";
export type RelativeUnit = "minute" | "hour" | "day" | "week" | "month";

/** A duration the user typed, in their unit. The engine converts to ms. */
export interface DurationLiteral {
  amount: number;
  unit: DurationUnit;
}
/** A moment relative to now ("3 days ago"). */
export interface RelativeTimeLiteral {
  ago: number;
  unit: RelativeUnit;
}

export type Literal = number | string | boolean | string[] | number[] | DurationLiteral | RelativeTimeLiteral;

/**
 * The tunnel: a value that is the OUTPUT of another, complete hook.
 * A sub-hook returning one value (count, aggregate) feeds any single-value
 * operator; one returning a list (ids, values) feeds only list operators
 * (is any of / is none of). Types must match: a list of visitor ids can
 * only feed a visitor id field. Mismatches are errors, never coercions.
 */
export interface HookValue {
  hook: HookSpec;
}

export type ValueArg = Literal | HookValue;

export interface Measure {
  agg: Agg;
  /** Required for every agg except count. */
  field?: string;
  /** 0-100, only for percentile. */
  p?: number;
}

/** A condition on one of the entity's own fields. */
export interface FieldCondition {
  id: string;
  kind: "field";
  field: string;
  op: Op;
  value?: ValueArg;
  /** Upper bound for between / notBetween. */
  value2?: ValueArg;
}

/**
 * A condition on related rows. For a "many" relation it measures them:
 * "number of page views where page is /blogs" >= 2, "total time on page" <
 * 30 sec, "number of different pages" = 3. With no measure it means "has at
 * least one" (and, under a NOT group, "has none"). For a "one" relation
 * (a page view's session) it means "that related row matches `where`".
 */
export interface RelatedCondition {
  id: string;
  kind: "related";
  relation: string;
  where: Condition[];
  measure?: Measure;
  op?: Op;
  value?: ValueArg;
  value2?: ValueArg;
}

/** AND / OR over conditions, optionally negated. */
export interface GroupCondition {
  id: string;
  kind: "group";
  mode: "and" | "or";
  not?: boolean;
  where: Condition[];
}

export type Condition = FieldCondition | RelatedCondition | GroupCondition;

export type Output =
  | { kind: "count" }
  | { kind: "countDistinct"; field: string }
  | { kind: "ids" }
  | { kind: "values"; field: string }
  | { kind: "aggregate"; agg: Exclude<Agg, "count" | "countDistinct">; field: string; p?: number }
  | {
      kind: "groupBy";
      field: string;
      /** time fields only: bucket moments into hours, days... */
      bucket?: "hour" | "day" | "week" | "month";
      measure: Measure;
      sort?: "valueDesc" | "valueAsc" | "keyAsc" | "keyDesc";
      limit?: number;
    };

export interface OrderSpec {
  /** auto: the engine picks the order of the top-level conditions. manual: `steps` is the user's order. */
  mode: "auto" | "manual";
  steps?: string[];
  /**
   * Only meaningful for manual. true (default): if the engine's own order
   * is much cheaper than the user's, it overrides and says so. false: the
   * user's order is obeyed exactly.
   */
  guard?: boolean;
}

export interface HookSpec {
  v: 2;
  entity: EntityKey;
  /** Top-level conditions, ANDed. Each one is a step the planner can reorder. */
  where: Condition[];
  output: Output;
  order?: OrderSpec;
}

// ── Result ─────────────────────────────────────────────────────────────
export interface PlanStep {
  id: string;
  label: string;
  /** Postgres's own row estimate for this step alone (no scanning). */
  estRows: number;
}

export interface HookPlan {
  strategy: "fused" | "staged";
  order: string[];
  steps: PlanStep[];
  notes: string[];
}

export interface HookCost {
  credits: number;
  pgCost: number;
}

/** What each tunnel (sub-hook) produced before the main query ran. */
export interface TunnelInfo {
  path: string;
  label: string;
  shape: "one" | "list";
  type: FieldType;
  /** list: how many values. one: 1. */
  count: number;
  /** list: the first few values. one: the value. */
  sample: string[];
}

export type HookAnswer =
  | { shape: "one"; type: FieldType; value: number | string | null }
  | { shape: "list"; type: FieldType; values: string[]; truncated: boolean }
  | { shape: "table"; keyType: FieldType; valueType: FieldType; rows: { key: string | null; value: number | string | null }[] };

export interface HookResult {
  answer: HookAnswer;
  plan: HookPlan;
  cost: HookCost;
  tunnels: TunnelInfo[];
  timing: { planMs: number; execMs: number };
  sql: string;
}

export const LIST_LIMIT = 5000;
export const GROUP_LIMIT_MAX = 500;
