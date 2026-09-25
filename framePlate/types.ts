// framePlate/types.ts
//
// Two layers, kept deliberately separate:
//   RAW      — what real (or fake) tracking data looks like: scroll samples over time.
//   GEOMETRY — pure-derived percentage positions the renderer actually consumes.
//
// The renderer (components/*) never looks at RAW data — only GEOMETRY. Swapping
// fake data for real tracked data later means changing the input to
// deriveVisitGeometry(), never the components themselves.

export interface ScrollSample {
  /** ms since this page visit started */
  t: number;
  /**
   * Scroll position as a fraction of the SCROLLABLE RANGE — 0 = not
   * scrolled, 1 = scrolled as far as this page allows. This is NOT a
   * fraction of page height, and the two differ on every page taller than
   * the viewport: on a page 1.25x the viewport, y=1 puts the viewport's TOP
   * only 20% down the page (its bottom is at 100%, which is exactly one
   * viewport height further). deriveVisitGeometry converts these into
   * page-fraction positions — nothing downstream of it works in this space.
   */
  y: number;
}

export interface PageVisitRaw {
  id: string;
  pagePath: string;
  /** ISO timestamp the visitor entered this page */
  enteredAt: string;
  /** ISO timestamp the visitor left this page */
  leftAt: string;
  /** actual rendered page height in px — drives the full-page-plate's height (independent of viewport — see scalePlateHeight.ts) */
  pageHeightPx: number;
  /**
   * The visitor's real viewport height in px for this visit. Required to
   * interpret scrollTrace at all — see ScrollSample.y. Null/omitted falls
   * back to a device-typical estimate (deriveVisitGeometry's
   * fallbackViewportHeightPx), which makes the seen-region math an estimate
   * rather than a measurement — it does NOT affect plate height, which is
   * driven by pageHeightPx alone regardless of whether this is known.
   */
  viewportHeightPx?: number | null;
  /** chronological scroll trace for this visit; empty/undefined = no scroll data */
  scrollTrace?: ScrollSample[];
  /** did a conversion/form-fill happen on this page visit? */
  converted?: boolean;
  /** header positions on the page, 0-1 fraction of page height (optional) */
  headers?: { text: string; y: number }[];
}

export interface SessionRaw {
  id: string;
  visitorId: string;
  startedAt: string; // ISO
  /** ISO timestamp the session ended, or null/undefined if it's still open (the visitor may be on the site right now) */
  endedAt: string | null;
  visits: PageVisitRaw[];
}

/** Common device-type values the tracker records (see visitors.device_type) — anything else falls back to the default theme/viewport. */
export type DeviceType = "desktop" | "mobile" | "tablet";

// ── Timeline items — a session strip is a sequence of these ────────────────

export type FrameOutcome = "active" | "exitedNormally" | "converted" | "expired" | "away" | "live";

/**
 * Everything here is in PAGE-FRACTION space: 0 = top of the page's content,
 * 1 = bottom of it. Raw scroll-range fractions (ScrollSample.y) have already
 * been converted by deriveVisitGeometry — see its header for the formulas.
 */
export interface VisitGeometry {
  kind: "visit";
  id: string;
  pagePath: string;
  durationMs: number;
  pageHeightPx: number;
  /** topmost point ever visible, 0-1 (usually ~0; can be >0 if entered mid-page) */
  seenOnceTop: number;
  /** where the "seen more than once" band begins, 0-1 (null = never revisited) */
  seenTwiceTop: number | null;
  /** deepest VIEWPORT-TOP position ever reached, as a page fraction (raw — not extended by viewport height; see seenBottom for the visible extent) */
  maxScrollY: number;
  /**
   * Bottom edge of everything actually visible during the visit, 0-1 —
   * min(1, maxScrollY + viewportFraction). Every recorded scroll position is
   * where the viewport's TOP was, not its full visible extent — even a
   * visitor who never scrolled at all still saw a full viewport's worth of
   * content below their entry point. Both seen bands render down to this,
   * and the deepest-scroll bulb sits here — never at the raw maxScrollY —
   * so "seen" never renders as a zero-height sliver for a visitor who never
   * scrolled, and the exit bulb (see exitY) can never sit closer than one
   * viewport height above this.
   */
  seenBottom: number;
  /** one viewport height as a 0-1 fraction of THIS visit's own page height — min(1, viewportHeightPx/pageHeightPx). What seenBottom extends maxScrollY downward by. */
  viewportFraction: number;
  /** true when viewportHeightPx had to be guessed (device-typical) rather than measured — the seen-region math is an estimate, not a measurement */
  viewportEstimated: boolean;
  /** viewport TOP position when the visitor entered, 0-1 — enter bulb's y */
  enterY: number;
  /** viewport TOP position when the visitor left, 0-1 — exit bulb's y */
  exitY: number;
  converted: boolean;
  outcome: FrameOutcome;
  headers?: { text: string; y: number }[];
}

export interface GapGeometry {
  kind: "gap";
  id: string;
  /** ms spent away from the site between two page visits in the same session */
  durationMs: number;
  outcome: "away";
}

export type TimelineItem = VisitGeometry | GapGeometry;

// ── Theme / config — every visual constant lives here, nothing hardcoded ───

export type BulbType = "enter" | "exit" | "deepestScroll" | "converted";

export interface BulbShapeConfig {
  /** preset shape, or "custom" to use `path` */
  shape: "pill" | "circle" | "diamond" | "custom";
  /** required when shape === "custom": an SVG path drawn in a -0.5..0.5 unit box, scaled by length/thickness */
  path?: string;
  /**
   * px, how far the bulb protrudes horizontally away from the plate edge.
   * This is what should differ between bulb types — when exit/deepestScroll/
   * converted land at the same y, the longer ones stay visible poking out
   * past the shorter ones (not a size difference in the vertical direction).
   */
  length: number;
  /**
   * px, the bulb's extent along the plate edge (vertical). Keep this the
   * SAME across every bulb type — only `length` should vary.
   */
  thickness: number;
  color: string;
  /** paint order when multiple bulbs land at ~the same y — higher paints last (on top) */
  zIndex: number;
}

export interface FramePlateTheme {
  /** fill behind the entire chart (the whole SVG canvas, drawn first) */
  canvasBackground: string;
  plate: {
    width: number;
    minHeight: number;
    maxHeight: number;
    /**
     * Absolute px-of-actual-page-height → px-of-plate-height ratio, before
     * clamping to [minHeight, maxHeight]. Deliberately absolute (not
     * relative to the tallest page in the session) so a given real page
     * height always renders the same plate height everywhere it appears —
     * same principle as frame width never being container-relative.
     */
    pxToVisualRatio: number;
    cornerRadius: number;
    /** unseen/background fill */
    baseColor: string;
    borderColor: string;
    borderWidth: number;
  };
  seenOnce: { color: string };
  seenTwice: { color: string };
  header: {
    color: string;
    /** vertical amplitude (peak-to-center) of the zigzag mark */
    heightPx: number;
    /** total horizontal span of the zigzag mark */
    widthPx: number;
    /** how many peaks the zigzag has */
    segments: number;
    /** inset from the plate's LEFT edge — the mark is drawn ON the plate, not floating outside it */
    offsetX: number;
  };
  frame: {
    height: number;
    minWidth: number;
    /** width of a "typical" (median-duration) frame */
    typicalWidth: number;
    maxWidth: number;
    /** horizontal + vertical gap between the full-page-plate and the frame edge */
    padding: number;
    /** gap between adjacent frames in the strip */
    gap: number;
    backgroundByOutcome: Record<FrameOutcome, string>;
    /** space reserved above every frame for its page-path label */
    pathLabelHeight: number;
    pathLabelColor: string;
    pathLabelFontSize: number;
  };
  ribbon: {
    color: string;
    thickness: number;
    tickHeight: number;
    labelColor: string;
    labelFontSize: number;
    /** gap between frame bottom and the ribbon */
    gap: number;
  };
  bulbs: Record<BulbType, BulbShapeConfig>;
  hover: {
    /** how dark the overlay on the hovered frame gets, 0-1 */
    darkenOpacity: number;
  };
  /**
   * The "1vh" scale marks — drawn ON EACH PLATE INDIVIDUALLY, at every
   * viewport-height boundary down that plate. Never a single line spanning
   * the whole strip: every plate has its own page-to-viewport ratio, so a
   * strip-wide line can only ever be correct for one plate at a time.
   */
  referenceLine: {
    enabled: boolean;
    color: string;
    dashArray: string;
    thickness: number;
    /** false = mark only the first viewport boundary; true = mark every one down the plate */
    repeat: boolean;
    labelColor: string;
    labelFontSize: number;
  };
}

/** Deep-partial helper for theme overrides — every field optional, recursively. */
export type DeepPartial<T> = T extends object
  ? {
      [K in keyof T]?: DeepPartial<T[K]>;
    }
  : T;

export interface FramePlateChartProps {
  session: SessionRaw;
  theme?: DeepPartial<FramePlateTheme>;
  /**
   * ISO timestamp — visits/gaps starting at or after this are not rendered.
   * Used for the conversion-bounded variant: cut the chart off at the
   * moment of conversion, nothing beyond it.
   */
  domainEnd?: string;
  /** gaps shorter than this are merged into adjacent visits rather than drawn as their own frame */
  minGapMs?: number;
  /** ms of continuous hover before the darken effect appears — avoids flicker when sweeping across the strip */
  hoverDelayMs?: number;
  /**
   * The visitor's real viewport height in px. Two jobs:
   *   1. Fallback for any visit whose own SessionRaw data carries no
   *      viewportHeightPx of its own (a visit's own measured value always
   *      wins) — required to convert scroll-range fractions into page
   *      positions at all, see ScrollSample.y.
   *   2. Whether the per-plate "1vh" marks are drawn — 0 turns them off;
   *      omitting this still leaves the marks on, using the auto-resolved
   *      value from (1) below.
   * Omit to auto-resolve from `deviceType` (mobile/desktop/tablet each get a
   * sensible typical viewport height; unknown device falls back to desktop's).
   * Pass a number to force a specific value regardless of device, or 0 to
   * hide the marks (the geometry math still uses a device-typical fallback
   * even then — turning off the visual marks must never make the "seen"
   * region collapse back to unconverted raw scroll points).
   */
  viewportHeightPx?: number;
  /**
   * The visitor's device type (from visitors.device_type) — drives both the
   * auto-resolved viewportHeightPx above AND the plate's proportions
   * (corner radius, header zigzag tuning) via desktopPlate/mobilePlate.
   * Unknown/omitted falls back to defaultTheme's own values.
   */
  deviceType?: DeviceType | string | null;
  onHoverItem?: (item: TimelineItem | null) => void;
  /**
   * Click-to-pin selection, separate from onHoverItem: fires with the clicked
   * visit (or null if the already-selected frame was clicked again, toggling
   * it off). `isLastVisit` tells the caller whether this is the page the
   * session's timeline actually ends on — the fact "this page is where the
   * session ended" isn't derivable from the item alone, since a mid-session
   * page a visitor navigated away from normally also has outcome
   * "exitedNormally".
   */
  onSelectItem?: (item: TimelineItem | null, meta: { isLastVisit: boolean }) => void;
  className?: string;
}
