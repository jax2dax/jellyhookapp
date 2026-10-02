// main-chart — "sessions online over time". Docs: main-chart/overview.md.
export { MainChart } from "./components/MainChart";
export { computeSeries, valueAt } from "./engine/computeSeries";
export { computeTrend } from "./engine/computeTrend";
export { placePointMarkers, monotoneCubicAt } from "./engine/markers";
export { buildTimeline } from "./engine/buildTimeline";
export { useSessionsOnlineNow } from "./hooks/useSessionsOnlineNow";
export { INTERVALS } from "./engine/intervals";
export type { OnlineSpan, SpanPayload, ComputedSeries, ViewWindow, IntervalDef, MarkerLayer, MarkerEvent, MarkerPayload } from "./types";
