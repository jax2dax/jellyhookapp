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
  /** scroll position as a fraction of page height, 0 = top, 1 = bottom */
  y: number;
}

export interface PageVisitRaw {
  id: string;
  pagePath: string;
  /** ISO timestamp the visitor entered this page */
  enteredAt: string;
  /** ISO timestamp the visitor left this page */
  leftAt: string;
  /** actual rendered page height in px — drives the full-page-plate's height */
  pageHeightPx: number;
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
  /** deepest point ever scrolled to, 0-1 — also the deepest-scroll bulb's y */
  maxScrollY: number;
  /** viewport position when the visitor entered, 0-1 — enter bulb's y */
  enterY: number;
  /** viewport position when the visitor left, 0-1 — exit bulb's y */
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
  /** style for the optional single "1vh" scale reference line — see FramePlateChartProps.viewportHeightPx */
  referenceLine: {
    color: string;
    dashArray: string;
    thickness: number;
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
   * Optional: draws ONE horizontal dashed reference line + label across the
   * whole strip (never repeated per frame) at the scaled height of one
   * viewport — e.g. pass 900 for a typical desktop viewport — so it's easy
   * to judge how many "screens" deep a page's content actually is.
   * Omit to not draw it at all.
   */
  /**
   * Omit to auto-resolve from `deviceType` (mobile/desktop/tablet each get a
   * sensible typical viewport height; unknown device falls back to desktop's).
   * Pass a number to force a specific value regardless of device.
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
  className?: string;
}
