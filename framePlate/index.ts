// framePlate/index.ts — public API
export { FramePlateChart } from "./components/FramePlateChart";
export { SessionStrip } from "./components/SessionStrip";
export { Frame } from "./components/Frame";
export { FullPagePlate } from "./components/FullPagePlate";
export { Bulb } from "./components/Bulb";
export { DurationRibbon } from "./components/DurationRibbon";

export { defaultTheme, lightPlate, darkPlate } from "./theme/defaultTheme";
export { validateTheme } from "./theme/validateTheme";
export { desktopPlate, mobilePlate, miniPlate, plateForDevice, resolveViewportHeightPx } from "./theme/deviceThemes";
export { mergeDeepPartial } from "./theme/mergeThemeOverrides";

export { deriveVisitGeometry } from "./geometry/deriveVisitGeometry";
export { buildTimeline } from "./geometry/buildTimeline";
export { scaleFrameWidths, frameWidthConfigFromTheme } from "./geometry/scaleFrameWidths";
export { scalePlateHeights } from "./geometry/scalePlateHeight";

export { generateFakeSession, generateOutlierTestSession } from "./fakeData/generateFakeSession";
export { formatFrameDuration, computeSeenBreakdown } from "./format";
export type { SeenBreakdown } from "./format";

export type {
  ScrollSample,
  PageVisitRaw,
  SessionRaw,
  DeviceType,
  VisitGeometry,
  GapGeometry,
  TimelineItem,
  FrameOutcome,
  BulbType,
  BulbShapeConfig,
  FramePlateTheme,
  FramePlateChartProps,
  DeepPartial,
} from "./types";
