// output/types.ts
// The output engine's contract: what the canvas receives after a hook runs.
// The hook engine finds rows; the output engine decides HOW to show them
// (output/plan.ts) and fetches what that view needs (output/server/). A
// person sees sessions, leads, pages and numbers, never raw ids.
//
// Ids that the browser must hand back (to load more) travel as sealed
// tokens (output/server/seal.ts): encrypted, tied to the site, useless
// outside this site's canvas. Page-visit ids used to highlight frames are
// FramePlate's own visit ids (page_view_id), the same values every session
// chart in the app already renders with.
import type { SessionRaw } from "../framePlate/types";
import type { FieldType } from "../jh-hook/schema";

/** One session ready to draw as a FramePlate. */
export interface SessionCard {
  session: SessionRaw;
  deviceType: string | null;
  /** page_view_ids of the visits that satisfied the hook's page conditions (highlighted, others dimmed). */
  highlight: string[];
  /** Why this session is here, in a few words (for example "matched: page is /blogs"). */
  reason?: string;
}

export interface LeadCard {
  /** Only for the link to the lead's page (an authorized app page). Never rendered as text. */
  href: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  submittedAt: string | null;
  page: string | null;
  qualified: boolean | null;
  /** The rest of the submitted form, raw (hidden behind a reveal toggle). */
  fields: { key: string; value: string }[];
  /** Evidence: the session(s) that qualified this lead, when the hook filtered on them. */
  sessions: SessionCard[];
}

export interface VisitorCard {
  device: string | null;
  browser: string | null;
  os: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  sessionsCount: number;
  lead: { name: string | null; email: string | null; href: string } | null;
  /** Evidence: up to 2 sessions that satisfied the hook's session conditions. */
  sessions: SessionCard[];
}

export interface PageCard {
  path: string;
  views: number;
  submissions: number;
}

export interface FormCard {
  page: string | null;
  status: string | null;
  lastField: string | null;
  viewedAt: string | null;
  fillMs: number | null;
  fieldsTouched: number;
}

export interface FieldRow {
  page: string | null;
  field: string;
  fieldType: string;
  focusedMs: number | null;
  typed: boolean;
  lastTouched: boolean;
  formStatus: string | null;
}

/** A list view: the first page of items, a total, and sealed tokens for the rest. */
export interface ListView<K extends string, T> {
  kind: K;
  sentence: string;
  total: number;
  truncated: boolean;
  items: T[];
  /** Sealed tokens for the items not loaded yet, in display order. */
  more: string[];
  pageSize: number;
  /** One line on what is highlighted / why extra rows are shown. */
  note?: string;
}

export type CanvasView =
  | { kind: "number"; sentence: string; type: FieldType; value: number | string | null; base?: { value: number | string | null; label: string; share: number | null } }
  | { kind: "ranking"; sentence: string; keyType: FieldType; valueType: FieldType; rows: { key: string | null; value: number | string | null }[] }
  | { kind: "timeSeries"; sentence: string; bucket: string; valueType: FieldType; rows: { key: string | null; value: number | string | null }[] }
  | { kind: "values"; sentence: string; type: FieldType; values: string[]; truncated: boolean }
  | ListView<"sessions", SessionCard>
  | ListView<"leads", LeadCard>
  | ListView<"visitors", VisitorCard>
  | ListView<"pages", PageCard>
  | ListView<"forms", FormCard>
  | ListView<"formFields", FieldRow>
  | { kind: "compare"; a: CompareSide; b: CompareSide; formula: Formula; result: number | null; resultLabel: string };

export type ListKind = "sessions" | "leads" | "visitors" | "pages" | "forms" | "formFields";

export interface CompareSide {
  sentence: string;
  type: FieldType;
  value: number | null;
}

export type Formula = "ratio" | "percent" | "difference" | "change";
export const FORMULA_LABEL: Record<Formula, string> = {
  ratio: "A / B",
  percent: "A / B x 100 (%)",
  difference: "A - B",
  change: "change from B to A (%)",
};
