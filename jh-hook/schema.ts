// jh-hook/schema.ts
// The Hook vocabulary: every entity a hook can return, every field it can
// filter or measure on, and how entities relate. Client-safe metadata only
// (labels, types, relations). How each field becomes SQL lives server side
// in engine/sqlmap.ts, and a test asserts the two never drift apart.
//
// Adding a column to Hook = one entry here + one entry in sqlmap.ts. The
// compiler, the planner, the operators and the UI all pick it up from these
// two tables; nothing else changes.

export type EntityKey = "pageView" | "session" | "lead" | "visitor" | "form" | "page" | "awayGap";

/**
 * duration: stored and compared in ms; the user types any unit.
 * percent:  0-100.
 * px:       real page pixels.
 * time:     a moment (timestamptz); literals may be absolute or "last N days".
 */
export type FieldType = "number" | "duration" | "percent" | "px" | "text" | "enum" | "time" | "bool";

/** Identity a text field carries. Two fields can feed each other through a tunnel only if their refs match. */
export type RefKind = "pageView" | "session" | "lead" | "visitor" | "form" | "page" | "awayGap";

export interface FieldDef {
  label: string;
  type: FieldType;
  ref?: RefKind;
  enumValues?: string[];
  /** Shown in the UI as a hint; say what is non-obvious, not what the label already says. */
  hint?: string;
}

export interface RelationDef {
  label: string;
  target: EntityKey;
  /** many: measured (count, sum, avg...). one: the related row must match. */
  cardinality: "many" | "one";
}

export interface EntityDef {
  label: string;
  plural: string;
  /** What "ids" returns for this entity, and the identity it tunnels as. */
  ref: RefKind;
  fields: Record<string, FieldDef>;
  relations: Record<string, RelationDef>;
}

const ts = (label: string, hint?: string): FieldDef => ({ label, type: "time", hint });

export const SCHEMA: Record<EntityKey, EntityDef> = {
  pageView: {
    label: "page view",
    plural: "page views",
    ref: "pageView",
    fields: {
      id: { label: "page view id", type: "text", ref: "pageView" },
      page: { label: "page", type: "text", ref: "page" },
      url: { label: "full url", type: "text" },
      title: { label: "page title", type: "text" },
      session: { label: "session id", type: "text", ref: "session" },
      visitor: { label: "visitor id", type: "text", ref: "visitor" },
      enteredAt: ts("entered at"),
      leftAt: ts("left at", "empty while the page is still open"),
      timeOnPage: { label: "time on page", type: "duration" },
      isOpen: { label: "still open", type: "bool" },
      seenPct: { label: "seen", type: "percent", hint: "share of the page that was on screen at some point (the light green band). Empty when the viewport was never measured" },
      seenTwicePct: { label: "seen twice or more", type: "percent", hint: "share of the page the visitor scrolled back over (the dark green band)" },
      notSeenPct: { label: "not seen", type: "percent" },
      entryPct: { label: "entry position", type: "percent", hint: "where the top of the screen was on arrival, as a share of the page" },
      deepestPct: { label: "deepest point", type: "percent", hint: "the bottom of the deepest screen reached (the blue bulb), as a share of the page" },
      exitPct: { label: "exit position", type: "percent", hint: "where the top of the screen was when they left" },
      revisited: { label: "scrolled back up", type: "bool" },
      deepestAt: ts("reached deepest point at"),
      timeToDeepest: { label: "time to deepest point", type: "duration" },
      pageHeight: { label: "page height", type: "px" },
      viewportHeight: { label: "screen height", type: "px" },
      viewportMeasured: { label: "screen height measured", type: "bool", hint: "false on older rows; seen percentages are empty for them" },
      position: { label: "position in session", type: "number", hint: "1 = the first page of the session" },
      isLanding: { label: "is the landing page", type: "bool" },
      isExit: { label: "is the exit page", type: "bool" },
      inConvertedSession: { label: "in a converted session", type: "bool" },
      enteredHour: { label: "hour entered (UTC)", type: "number" },
      enteredWeekday: { label: "weekday entered (UTC, 0 = Sunday)", type: "number" },
    },
    relations: {
      session: { label: "its session", target: "session", cardinality: "one" },
      visitor: { label: "its visitor", target: "visitor", cardinality: "one" },
      pageInfo: { label: "its page", target: "page", cardinality: "one" },
      forms: { label: "forms on this page in this session", target: "form", cardinality: "many" },
    },
  },

  session: {
    label: "session",
    plural: "sessions",
    ref: "session",
    fields: {
      id: { label: "session id", type: "text", ref: "session" },
      visitor: { label: "visitor id", type: "text", ref: "visitor" },
      startedAt: ts("started at"),
      endedAt: ts("ended at", "empty while the session is open"),
      lastActivityAt: ts("last activity at"),
      duration: { label: "duration", type: "duration", hint: "start to end, or to last activity if still open" },
      isOpen: { label: "still open", type: "bool" },
      converted: { label: "converted", type: "bool", hint: "a form was submitted in this session" },
      landingPage: { label: "landing page", type: "text", ref: "page" },
      exitPage: { label: "exit page", type: "text", ref: "page" },
      referrer: { label: "referrer", type: "text" },
      utmSource: { label: "utm source", type: "text" },
      utmMedium: { label: "utm medium", type: "text" },
      utmCampaign: { label: "utm campaign", type: "text" },
      country: { label: "country", type: "text" },
      timezone: { label: "visitor timezone", type: "text" },
      startedHour: { label: "hour started (UTC)", type: "number" },
      startedWeekday: { label: "weekday started (UTC, 0 = Sunday)", type: "number" },
    },
    relations: {
      pageViews: { label: "page views", target: "pageView", cardinality: "many" },
      awayGaps: { label: "away gaps", target: "awayGap", cardinality: "many" },
      leads: { label: "form submissions", target: "lead", cardinality: "many" },
      forms: { label: "forms seen", target: "form", cardinality: "many" },
      visitor: { label: "its visitor", target: "visitor", cardinality: "one" },
    },
  },

  lead: {
    label: "lead",
    plural: "leads (submissions)",
    ref: "lead",
    fields: {
      id: { label: "lead id", type: "text", ref: "lead" },
      name: { label: "name", type: "text" },
      email: { label: "email", type: "text" },
      phone: { label: "phone", type: "text" },
      page: { label: "submitted on page", type: "text", ref: "page" },
      submittedAt: ts("submitted at"),
      qualified: { label: "qualified", type: "bool", hint: "set by sales. Empty = not reviewed yet" },
      confidence: { label: "confidence", type: "enum", enumValues: ["high", "low"] },
      visitor: { label: "visitor id", type: "text", ref: "visitor" },
      session: { label: "session id", type: "text", ref: "session" },
    },
    relations: {
      session: { label: "its session", target: "session", cardinality: "one" },
      visitor: { label: "its visitor", target: "visitor", cardinality: "one" },
    },
  },

  visitor: {
    label: "visitor",
    plural: "visitors",
    ref: "visitor",
    fields: {
      id: { label: "visitor id", type: "text", ref: "visitor" },
      firstSeen: ts("first seen"),
      lastSeen: ts("last seen"),
      device: { label: "device", type: "enum", enumValues: ["desktop", "mobile"] },
      browser: { label: "browser", type: "text" },
      os: { label: "operating system", type: "text" },
      language: { label: "language", type: "text" },
      isLead: { label: "has submitted a form", type: "bool" },
    },
    relations: {
      sessions: { label: "sessions", target: "session", cardinality: "many" },
      pageViews: { label: "page views", target: "pageView", cardinality: "many" },
      leads: { label: "form submissions", target: "lead", cardinality: "many" },
      forms: { label: "forms seen", target: "form", cardinality: "many" },
    },
  },

  form: {
    label: "form interaction",
    plural: "form interactions",
    ref: "form",
    fields: {
      id: { label: "form interaction id", type: "text", ref: "form" },
      page: { label: "page", type: "text", ref: "page" },
      formIndex: { label: "form number on page", type: "number", hint: "0 = the first form on the page" },
      status: { label: "status", type: "enum", enumValues: ["viewed", "started", "submitted", "abandoned"] },
      lastFieldType: { label: "last field touched", type: "enum", enumValues: ["name", "email", "phone", "custom"] },
      viewedAt: ts("first seen at"),
      firstInputAt: ts("first typed at"),
      endedAt: ts("ended at"),
      timeToFirstInput: { label: "time from seeing to typing", type: "duration" },
      fillTime: { label: "time spent filling", type: "duration", hint: "first keystroke to submit or abandon" },
      fieldsTouched: { label: "fields touched", type: "number", hint: "a lower bound: fields never focused are not counted" },
      session: { label: "session id", type: "text", ref: "session" },
      visitor: { label: "visitor id", type: "text", ref: "visitor" },
    },
    relations: {
      session: { label: "its session", target: "session", cardinality: "one" },
      visitor: { label: "its visitor", target: "visitor", cardinality: "one" },
      pageInfo: { label: "its page", target: "page", cardinality: "one" },
    },
  },

  page: {
    label: "page",
    plural: "pages",
    ref: "page",
    fields: {
      path: { label: "path", type: "text", ref: "page" },
    },
    relations: {
      pageViews: { label: "views", target: "pageView", cardinality: "many" },
      leads: { label: "form submissions on it", target: "lead", cardinality: "many" },
      forms: { label: "form interactions on it", target: "form", cardinality: "many" },
    },
  },

  awayGap: {
    label: "away gap",
    plural: "away gaps",
    ref: "awayGap",
    fields: {
      startedAt: ts("left the site at"),
      endedAt: ts("came back at"),
      duration: { label: "time away", type: "duration" },
      session: { label: "session id", type: "text", ref: "session" },
    },
    relations: {
      session: { label: "its session", target: "session", cardinality: "one" },
    },
  },
};

/** Same threshold FramePlate draws an away frame at (framePlate/geometry/buildTimeline.ts). */
export const AWAY_GAP_MIN_MS = 15_000;

// ── Operators ──────────────────────────────────────────────────────────
export type Op =
  | "=" | "!=" | ">" | ">=" | "<" | "<="
  | "between" | "notBetween"
  | "in" | "notIn"
  | "contains" | "notContains" | "startsWith" | "endsWith"
  | "isEmpty" | "isNotEmpty"
  | "isTrue" | "isFalse";

const NUMERIC: Op[] = ["=", "!=", ">", ">=", "<", "<=", "between", "notBetween", "isEmpty", "isNotEmpty"];
export const OPS_FOR: Record<FieldType, Op[]> = {
  number: NUMERIC,
  duration: NUMERIC,
  percent: NUMERIC,
  px: NUMERIC,
  time: [">", ">=", "<", "<=", "between", "notBetween", "isEmpty", "isNotEmpty"],
  text: ["=", "!=", "in", "notIn", "contains", "notContains", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
  enum: ["=", "!=", "in", "notIn", "isEmpty", "isNotEmpty"],
  bool: ["isTrue", "isFalse", "isEmpty"],
};

/** Operators that take no value / two values / a list. Everything else takes one value. */
export const NO_VALUE_OPS: ReadonlySet<Op> = new Set(["isEmpty", "isNotEmpty", "isTrue", "isFalse"]);
export const TWO_VALUE_OPS: ReadonlySet<Op> = new Set(["between", "notBetween"]);
export const LIST_OPS: ReadonlySet<Op> = new Set(["in", "notIn"]);

export const OP_LABEL: Record<Op, string> = {
  "=": "is", "!=": "is not", ">": "more than", ">=": "at least", "<": "less than", "<=": "at most",
  between: "between", notBetween: "not between", in: "is any of", notIn: "is none of",
  contains: "contains", notContains: "does not contain", startsWith: "starts with", endsWith: "ends with",
  isEmpty: "is empty", isNotEmpty: "is not empty", isTrue: "is true", isFalse: "is false",
};
/** Time reads better as before/after. */
export const TIME_OP_LABEL: Partial<Record<Op, string>> = { ">": "after", ">=": "on or after", "<": "before", "<=": "on or before" };

// ── Aggregates ─────────────────────────────────────────────────────────
export type Agg = "count" | "countDistinct" | "sum" | "avg" | "min" | "max" | "median" | "percentile";
export const AGG_LABEL: Record<Agg, string> = {
  count: "number of", countDistinct: "number of different", sum: "total", avg: "average", min: "lowest",
  max: "highest", median: "median", percentile: "percentile",
};
/** Which aggregates make sense on which field type (count needs no field). */
export const AGGS_FOR: Record<FieldType, Agg[]> = {
  number: ["countDistinct", "sum", "avg", "min", "max", "median", "percentile"],
  duration: ["countDistinct", "sum", "avg", "min", "max", "median", "percentile"],
  percent: ["countDistinct", "avg", "min", "max", "median", "percentile"],
  px: ["countDistinct", "avg", "min", "max", "median", "percentile"],
  time: ["countDistinct", "min", "max"],
  text: ["countDistinct"],
  enum: ["countDistinct"],
  bool: ["countDistinct"],
};

/** The type an aggregate produces. */
export function aggType(agg: Agg, fieldType: FieldType | null): FieldType {
  if (agg === "count" || agg === "countDistinct") return "number";
  return fieldType ?? "number";
}
