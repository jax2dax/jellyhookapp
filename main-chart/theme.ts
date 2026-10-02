// main-chart/theme.ts
// Every visual constant the main chart uses. Canvas can't read CSS
// variables, so light and dark are two concrete palettes, picked from the
// <html class="dark"> flag at draw time. See main-chart/docs/ui-ux.md for
// why each color is what it is.

export interface MainChartPalette {
  /** the line + fill for confirmed history */
  line: string;
  fill: string;
  /** band between a pixel column's lowest and highest bucket (only visible in envelope mode) */
  band: string;
  /**
   * The provisional stretch (the last PROVISIONAL_WINDOW_MS): same blue-cyan
   * FramePlate uses for "live, still open", since a tab that crashed in
   * this window can still be counted until the server closes it.
   */
  provisionalLine: string;
  provisionalFill: string;
  provisionalBand: string;
  nowLine: string;
  axis: string;
  grid: string;
  loadingShade: string;
  /** conversion dots: FramePlate's "converted" yellow, the same meaning everywhere in the product */
  conversion: string;
  /** thin ring around each dot in the card's background color, so a dot stays readable over the line and fill */
  markerRing: string;
  /** team-joined vertical lines: a color no other part of the chart uses */
  teamJoin: string;
}

export const mainChartTheme = {
  heightPx: 300,
  lineWidth: 1.5,
  /** must match lib/closeStaleSessions.js's SESSION_IDLE_TIMEOUT_MS: how long a dead tab can stay "open" before the server closes it */
  provisionalWindowMs: 30 * 60 * 1000,
  /** smallest zoom: this many buckets across the plot */
  minBucketsInView: 12,
  /** when the chart opens wider to include the last visit: how much room to leave, as a multiple of (now - last visit) */
  lastVisitPadding: 1.15,
  /** each +/- button click scales the visible span by this much */
  buttonZoomFactor: 1.6,
  /** trackpad pinch: span scales by e^(deltaY * this) per event, so zoom speed follows the gesture */
  pinchZoomSensitivity: 0.01,
  marker: {
    /** conversion dot radius, CSS px */
    dotRadius: 4.5,
    ringWidth: 1.5,
    /** team-joined line width, CSS px, and how solid it is (it must not compete with the data) */
    lineWidth: 1,
    lineOpacity: 0.7,
    /** hover picks the nearest marker within this many CSS px of the cursor */
    hoverRadius: 8,
    /** the "2", "3"... drawn above a dot holding more than one conversion */
    countFontPx: 10,
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
  },
  font: "11px ui-sans-serif, system-ui, sans-serif",
  dark: {
    line: "#22c55e",
    fill: "rgba(34, 197, 94, 0.22)",
    band: "rgba(34, 197, 94, 0.10)",
    provisionalLine: "#22d3ee",
    provisionalFill: "rgba(34, 211, 238, 0.20)",
    provisionalBand: "rgba(34, 211, 238, 0.09)",
    nowLine: "rgba(34, 211, 238, 0.65)",
    axis: "#8a8a8a",
    grid: "rgba(255, 255, 255, 0.06)",
    loadingShade: "rgba(255, 255, 255, 0.03)",
    conversion: "#eab308",
    markerRing: "#0a0a0a",
    teamJoin: "#818cf8",
  } satisfies MainChartPalette,
  light: {
    line: "#16a34a",
    fill: "rgba(22, 163, 74, 0.18)",
    band: "rgba(22, 163, 74, 0.08)",
    provisionalLine: "#0891b2",
    provisionalFill: "rgba(8, 145, 178, 0.16)",
    provisionalBand: "rgba(8, 145, 178, 0.07)",
    nowLine: "rgba(8, 145, 178, 0.6)",
    axis: "#6b6b6b",
    grid: "rgba(0, 0, 0, 0.06)",
    loadingShade: "rgba(0, 0, 0, 0.03)",
    conversion: "#ca8a04",
    markerRing: "#ffffff",
    teamJoin: "#6366f1",
  } satisfies MainChartPalette,
};

export function currentPalette(): MainChartPalette {
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  return dark ? mainChartTheme.dark : mainChartTheme.light;
}
