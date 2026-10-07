// jh-hook/schema.ts
// The Hook vocabulary: every entity a hook can return, every field it can
// filter or measure on, and how entities relate. Client-safe metadata only
// (labels, types, relations). How each field becomes SQL lives server side
// in engine/sqlmap.ts, and a test asserts the two never drift apart.
//
// Adding a column to Hook = one entry here + one entry in sqlmap.ts. The
// compiler, the planner, the operators and the UI all pick it up from these
// two tables; nothing else changes.

export type EntityKey = "pageView" | "session" | "lead" | "visitor" | "form" | "formField" | "page" | "awayGap";

/**
 * duration: stored and compared in ms; the user types any unit.
 * percent:  0-100.
 * px:       real page pixels.
 * time:     a moment (timestamptz); literals may be absolute or "last N days".
 */
export type FieldType = "number" | "duration" | "percent" | "px" | "text" | "enum" | "time" | "bool";

/** Identity a text field carries. Two fields can feed each other through a tunnel only if their refs match. */
export type RefKind = "pageView" | "session" | "lead" | "visitor" | "form" | "formField" | "page" | "awayGap";

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
      timeOnPage: { label: "time on page (browser timer)", type: "duration", hint: "the browser's own stopwatch, sent when the visitor leaves. Can differ by a second or more from 'time on page', which is what the visit chart shows" },
      visitDuration: { label: "time on page", type: "duration", hint: "left at minus entered at, both stamped by the server. This is the 'Time on page' in the visit chart's details" },
      isOpen: { label: "still on screen", type: "bool" },
      seenPct: { label: "share of page seen", type: "percent", hint: "the share of the page that was on screen at least once (the light green band). Empty when the screen height was never recorded" },
      seenTwicePct: { label: "share of page seen 2x+", type: "percent", hint: "the share of the page the visitor saw MORE THAN ONCE (scrolled back over): the dark green band. Not limited to exactly twice" },
      notSeenPct: { label: "share of page never seen", type: "percent", hint: "the share of the page that was never on screen. Empty when the screen height was never recorded" },
      entryPct: { label: "where they entered (% down the page)", type: "percent", hint: "where the top of the screen was on arrival, as a share of the page" },
      deepestPct: { label: "furthest point reached (% down the page)", type: "percent", hint: "the bottom of the deepest screen reached (the blue bulb), as a share of the page" },
      exitPct: { label: "where they left (% down the page)", type: "percent", hint: "where the top of the screen was when they left" },
      revisited: { label: "scrolled back up", type: "bool" },
      deepestAt: ts("reached deepest point at"),
      timeToDeepest: { label: "time to deepest point", type: "duration" },
      pageHeight: { label: "page height", type: "px" },
      viewportHeight: { label: "screen height", type: "px" },
      viewportMeasured: { label: "screen height was recorded", type: "bool", hint: "false on older rows; seen percentages are empty for them" },
      position: { label: "page number in the session (1 = first)", type: "number", hint: "1 = the first page of the session" },
      isLanding: { label: "is the landing page", type: "bool" },
      isExit: { label: "is the exit page", type: "bool" },
      isConversionPage: { label: "converted on this page", type: "bool", hint: "the page view that was open when a form was submitted: the latest one entered at or before the submission. Same rule the conversions page uses" },
      inConvertedSession: { label: "session converted", type: "bool" },
      enteredHour: { label: "hour of day (UTC, 0-23)", type: "number" },
      enteredWeekday: { label: "day of week (UTC, 0 = Sunday)", type: "number" },
    },
    relations: {
      session: { label: "its session", target: "session", cardinality: "one" },
      visitor: { label: "its visitor", target: "visitor", cardinality: "one" },
      forms: { label: "its forms", target: "form", cardinality: "many" },
      // Sequence: the page views around this one in the same session, by
      // the order they were entered. "3 pages after the conversion" =
      // a page view where converted on this page, whose pages after it
      // number exactly 3.
      nextPage: { label: "the next page", target: "pageView", cardinality: "one" },
      previousPage: { label: "the previous page", target: "pageView", cardinality: "one" },
      pagesAfter: { label: "the pages after it", target: "pageView", cardinality: "many" },
      pagesBefore: { label: "the pages before it", target: "pageView", cardinality: "many" },
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
      duration: { label: "session length", type: "duration", hint: "start to end, or to last activity if still open" },
      isOpen: { label: "still open", type: "bool" },
      converted: { label: "converted", type: "bool", hint: "a form was submitted in this session" },
      landingPage: { label: "landing page", type: "text", ref: "page" },
      exitPage: { label: "exit page", type: "text", ref: "page" },
      referrer: { label: "referrer", type: "text" },
      utmSource: { label: "campaign source (utm)", type: "text" },
      utmMedium: { label: "campaign medium (utm)", type: "text" },
      utmCampaign: { label: "campaign name (utm)", type: "text" },
      country: { label: "country", type: "text" },
      timezone: { label: "visitor timezone", type: "text" },
      startedHour: { label: "hour of day (UTC, 0-23)", type: "number" },
      startedWeekday: { label: "day of week (UTC, 0 = Sunday)", type: "number" },
    },
    relations: {
      pageViews: { label: "page views", target: "pageView", cardinality: "many" },
      awayGaps: { label: "away periods", target: "awayGap", cardinality: "many" },
      leads: { label: "form submissions", target: "lead", cardinality: "many" },
      forms: { label: "form activity", target: "form", cardinality: "many" },
      visitor: { label: "its visitor", target: "visitor", cardinality: "one" },
    },
  },

  lead: {
    label: "form submission",
    plural: "form submissions (leads)",
    ref: "lead",
    fields: {
      id: { label: "lead id", type: "text", ref: "lead" },
      name: { label: "name", type: "text" },
      email: { label: "email", type: "text" },
      phone: { label: "phone", type: "text" },
      page: { label: "submitted on page", type: "text", ref: "page" },
      submittedAt: ts("submitted at"),
      qualified: { label: "marked qualified by sales", type: "bool", hint: "set by sales on the leads page. Empty = not reviewed yet" },
      confidence: { label: "form quality (high = has an email)", type: "enum", enumValues: ["high", "low"], hint: "set automatically when the form is submitted: high if an email was present. Not a person's judgment" },
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
      forms: { label: "form activity", target: "form", cardinality: "many" },
    },
  },

  form: {
    label: "form activity",
    plural: "form activity",
    ref: "form",
    fields: {
      id: { label: "form interaction id", type: "text", ref: "form" },
      page: { label: "page", type: "text", ref: "page" },
      formIndex: { label: "which form on the page (0 = first)", type: "number", hint: "0 = the first form on the page" },
      status: { label: "status", type: "enum", enumValues: ["viewed", "started", "submitted", "abandoned"] },
      lastFieldType: { label: "last field touched", type: "enum", enumValues: ["name", "email", "phone", "custom"] },
      viewedAt: ts("first seen at"),
      firstInputAt: ts("first typed at"),
      endedAt: ts("ended at"),
      timeToFirstInput: { label: "time from seeing to typing", type: "duration" },
      fillTime: { label: "time spent filling", type: "duration", hint: "first keystroke to submit or abandon" },
      fieldsTouched: { label: "form fields touched", type: "number", hint: "a lower bound: fields never focused are not counted" },
      session: { label: "session id", type: "text", ref: "session" },
      visitor: { label: "visitor id", type: "text", ref: "visitor" },
    },
    relations: {
      session: { label: "its session", target: "session", cardinality: "one" },
      visitor: { label: "its visitor", target: "visitor", cardinality: "one" },
      fields: { label: "its fields", target: "formField", cardinality: "many" },
    },
  },

  formField: {
    label: "form field",
    plural: "form fields",
    ref: "formField",
    fields: {
      name: { label: "field", type: "text", hint: "email, name, phone, or the form's own name for any other field" },
      fieldType: { label: "field type", type: "enum", enumValues: ["name", "email", "phone", "custom"] },
      order: { label: "order focused (1 = first)", type: "number", hint: "the order in which the visitor first clicked into the fields" },
      focusedTime: { label: "time spent in the field", type: "duration", hint: "total time the cursor was in this field, across every visit to it" },
      typed: { label: "typed in it", type: "bool", hint: "false = clicked in but never typed a key" },
      timeToFirstKey: { label: "time before typing", type: "duration", hint: "from first clicking into the field to the first keystroke" },
      isLastTouched: { label: "last field touched", type: "bool", hint: "the field they were on when they stopped. On an abandoned form, this is where they gave up" },
      firstFocusAt: ts("first clicked into at"),
      firstKeyAt: ts("first typed at"),
      lastLeftAt: ts("last left at"),
      formStatus: { label: "form status", type: "enum", enumValues: ["viewed", "started", "submitted", "abandoned"] },
      page: { label: "page", type: "text", ref: "page" },
      session: { label: "session id", type: "text", ref: "session" },
      visitor: { label: "visitor id", type: "text", ref: "visitor" },
    },
    relations: {
      form: { label: "its form", target: "form", cardinality: "one" },
      session: { label: "its session", target: "session", cardinality: "one" },
    },
  },

  page: {
    label: "page",
    plural: "pages (unique addresses)",
    ref: "page",
    fields: {
      path: { label: "path", type: "text", ref: "page" },
    },
    relations: {
      pageViews: { label: "page views", target: "pageView", cardinality: "many" },
      leads: { label: "form submissions on it", target: "lead", cardinality: "many" },
      forms: { label: "form activity on it", target: "form", cardinality: "many" },
    },
  },

  awayGap: {
    label: "away period",
    plural: "away periods",
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

// ── Presentation: where a person looks for a value ─────────────────────
// Every field belongs to one named group, so a menu of 30 fields reads as
// 5-6 labelled sections instead of one long list. A test fails if a field is
// missing from every group. These names are user-facing: see
// jh-hook/naming.md before changing them.

export const TYPE_LABEL: Record<FieldType, string> = {
  number: "number",
  duration: "duration",
  percent: "percent",
  px: "pixels",
  text: "text",
  enum: "one of a fixed list",
  time: "date and time",
  bool: "yes / no",
};

export interface FieldGroup {
  label: string;
  fields: string[];
}

export const FIELD_GROUPS: Record<EntityKey, FieldGroup[]> = {
  pageView: [
    { label: "Which page", fields: ["page", "url", "title"] },
    { label: "When and how long", fields: ["enteredAt", "leftAt", "timeOnPage", "visitDuration", "isOpen", "enteredHour", "enteredWeekday"] },
    { label: "How much of the page was seen", fields: ["seenPct", "seenTwicePct", "notSeenPct", "entryPct", "deepestPct", "exitPct", "revisited", "deepestAt", "timeToDeepest"] },
    { label: "Place in the session", fields: ["position", "isLanding", "isExit", "isConversionPage", "inConvertedSession"] },
    { label: "Screen and page size", fields: ["pageHeight", "viewportHeight", "viewportMeasured"] },
    { label: "Ids", fields: ["id", "session", "visitor"] },
  ],
  session: [
    { label: "When and how long", fields: ["startedAt", "endedAt", "lastActivityAt", "duration", "isOpen", "startedHour", "startedWeekday"] },
    { label: "Outcome", fields: ["converted"] },
    { label: "Entry and exit", fields: ["landingPage", "exitPage"] },
    { label: "Where they came from", fields: ["referrer", "utmSource", "utmMedium", "utmCampaign"] },
    { label: "Visitor location", fields: ["country", "timezone"] },
    { label: "Ids", fields: ["id", "visitor"] },
  ],
  lead: [
    { label: "Who", fields: ["name", "email", "phone"] },
    { label: "Submission", fields: ["page", "submittedAt", "confidence", "qualified"] },
    { label: "Ids", fields: ["id", "visitor", "session"] },
  ],
  visitor: [
    { label: "Activity", fields: ["firstSeen", "lastSeen", "isLead"] },
    { label: "Device", fields: ["device", "browser", "os", "language"] },
    { label: "Ids", fields: ["id"] },
  ],
  form: [
    { label: "Which form", fields: ["page", "formIndex"] },
    { label: "Progress", fields: ["status", "lastFieldType", "fieldsTouched"] },
    { label: "Timing", fields: ["viewedAt", "firstInputAt", "endedAt", "timeToFirstInput", "fillTime"] },
    { label: "Ids", fields: ["id", "session", "visitor"] },
  ],
  formField: [
    { label: "Which field", fields: ["name", "fieldType", "order"] },
    { label: "Friction", fields: ["focusedTime", "typed", "timeToFirstKey", "isLastTouched", "formStatus"] },
    { label: "Timing", fields: ["firstFocusAt", "firstKeyAt", "lastLeftAt"] },
    { label: "Where", fields: ["page"] },
    { label: "Ids", fields: ["session", "visitor"] },
  ],
  page: [{ label: "Page", fields: ["path"] }],
  awayGap: [
    { label: "Timing", fields: ["startedAt", "endedAt", "duration"] },
    { label: "Ids", fields: ["session"] },
  ],
};

// Ids exist so queries can link to each other (a sub-hook that returns
// visitor ids feeding a visitor id field). Say so wherever a field has no
// hint of its own, so nobody wonders what to do with them.
for (const def of Object.values(SCHEMA)) {
  for (const f of Object.values(def.fields)) {
    if (f.ref && f.type === "text" && /(^| )id$/.test(f.label) && !f.hint) f.hint = "an internal id, used to link queries together (for example a sub-hook that returns " + f.label + "s)";
  }
}
