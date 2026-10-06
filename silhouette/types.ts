// silhouette/types.ts
// The silhouette model: what the preview draws, derived from a hook alone
// (no data, no database). A hook is a description; the silhouette is that
// description drawn as FramePlate shapes, getting more detailed the more the
// hook says. See silhouette/rules.md for exactly when each thing is drawn.
//
// Every drawn element carries `source`: which hook and which condition
// produced it. Today that powers the "this part changed" glow. In v3 it is
// what lets a person drag a band or a bulb on the silhouette and have the
// change written back into exactly that condition, and nothing else.

/** Where a drawn element came from. */
export interface Source {
  /** "main" for the main hook; "main>c3a9" for the sub-hook in condition c3a9's value; nested sub-hooks chain on. */
  hookPath: string;
  /** Condition ids from the top of that hook down to the condition that produced this element. */
  conditionPath: string[];
}

/** What the plate's page-address label says. */
export type HeaderSpec =
  | { kind: "any" } // any page of the site: "N+"
  | { kind: "exact"; path: string }
  | { kind: "oneOf"; paths: string[] }
  | { kind: "except"; paths: string[] }
  | { kind: "pattern"; op: "contains" | "startsWith" | "endsWith"; text: string };

/** A described share of the page (0-100, from the top). */
export interface Share {
  atLeast?: number;
  atMost?: number;
  /** Mentioned without a number we can draw (for example "scrolled back up"). */
  mentioned?: boolean;
}

export interface PlateSpec {
  header: HeaderSpec;
  seen?: Share;
  seenTwice?: Share;
  notSeen?: Share;
  /** Bulb positions as % down the page; true = mentioned, no position. */
  bulbs: { enter?: number | true; deepest?: number | true; exit?: number | true; converted?: boolean };
  /** A form mini-plate on this page, by its described state. */
  form?: "any" | "viewed" | "started" | "submitted" | "abandoned";
  tall?: boolean;
  /** Things this page must NOT be (from a NOT group inside its conditions). Drawn as a red corner hatch. */
  notes: string[];
}

export type FrameOutcome = "unknown" | "converted" | "abandoned" | "live";

export interface FrameSpec {
  outcome: FrameOutcome;
  /** Described time on page, as a label ("> 5 sec", "3 sec to 5 sec"). */
  duration?: string;
  /** 0-1: wider frame for longer described durations. */
  weight?: number;
}

/** required: must exist. maybe: may exist (inside a range). more: "and possibly more" stub. */
export type Certainty = "required" | "maybe" | "more";

export interface VisitItem {
  kind: "visit";
  /** Stable across edits (built from condition ids), so changes can be highlighted. */
  key: string;
  certainty: Certainty;
  plate: PlateSpec;
  frame: FrameSpec;
  /** The page view a page-result hook returns, shown inside its session. */
  anchor?: boolean;
  /** Small caption under the frame ("page 3", "different page"...). */
  caption?: string;
  source: Source[];
}

export interface AwayItem {
  kind: "away";
  key: string;
  certainty: Certainty;
  duration?: string;
  source: Source[];
}

export type Item = VisitItem | AwayItem;

/** A described property with no shape of its own ("started after 3 days ago", "campaign source is google"). */
export interface Chip {
  key: string;
  text: string;
  source: Source;
}

interface FigureBase {
  key: string;
  title: string;
  /** main: the main hook; sub: a sub-hook (drawn smaller, labelled). */
  scale: "main" | "sub";
  /** A NOT ("none of") description: drawn with red diagonal lines. */
  excluded: boolean;
  chips: Chip[];
  /** For sub-hooks: which value its result flows into. */
  feeds?: string;
}

export interface SessionFigure extends FigureBase {
  kind: "session";
  items: Item[];
  /** The session is still open (live border). */
  live: boolean;
  /** true: converted somewhere. false: described as NOT converted. null: not described. */
  converted: boolean | null;
  /** Range label when the total page count was described ("2 to 5 pages"). */
  pagesLabel?: string;
}

export interface PageFigure extends FigureBase {
  kind: "page";
  item: VisitItem;
}

export type Figure = SessionFigure | PageFigure;

export interface SilhouetteModel {
  figures: Figure[];
  /** Plain-language remarks (for example "3 more alternatives not drawn"). */
  notes: string[];
}

/** The site's page list, for "N+" headers and their hover list. */
export interface SitePages {
  paths: string[];
}
