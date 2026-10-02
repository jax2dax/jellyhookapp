// main-chart/components/MainChart.tsx
//
// "Sessions online" over time: how many sessions were open at once, peak
// per bucket, as a smooth area (or stepped, as a variety). Two ways to
// look at it:
//   - Live: right edge pinned to now and moving; drag to pan back through
//     history (loaded on demand, left edge = the site's first session);
//     zoom with the +/- buttons or a trackpad pinch. A plain mouse wheel or
//     two-finger scroll is left alone, so the page still scrolls.
//   - Custom range: a fixed from/to window, any interval.
// uPlot draws; React only renders the controls around it. Every pan/zoom
// frame recomputes the series from already-loaded data (no request), see
// main-chart/docs/architecture.md.
"use client";

import * as React from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import { Radio, CalendarRange, ChevronsRight, Minus, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { storeFor } from "../data/spanStore";
import { computeSeries, valueAt } from "../engine/computeSeries";
import { computeTrend } from "../engine/computeTrend";
import { DEFAULT_INTERVAL_KEY, INTERVALS, intervalByKey } from "../engine/intervals";
import { eventsInView, placePointMarkers, type PlacedPoint } from "../engine/markers";
import { currentPalette, mainChartTheme as theme } from "../theme";
import type { ComputedSeries, MarkerEvent, MarkerLayer, ViewWindow } from "../types";

type Mode = "live" | "custom";
/**
 * "smooth": peak per bucket, points joined by a curve (default).
 * "steps":  peak per bucket, held flat until the next bucket.
 * "trend":  a point only where the count changed (that bucket's average),
 *           the line running straight from one change to the next.
 */
type LineStyle = "smooth" | "steps" | "trend";

const LINE_STYLES: { key: LineStyle; label: string; title: string }[] = [
  { key: "smooth", label: "Smooth", title: "Peak per bucket, joined by a curve" },
  { key: "steps", label: "Steps", title: "Peak per bucket, held flat until the next one" },
  { key: "trend", label: "Trend", title: "Only where the count changed, averaged, with the line running from one change to the next" },
];

/**
 * Marker layers, off until their checkbox is ticked. They sit on top of the
 * session line and never change it (see main-chart/engine/markers.ts).
 */
const MARKER_LAYERS: { key: MarkerLayer; label: string; style: "point" | "vline" }[] = [
  { key: "conversions", label: "Conversions", style: "point" },
  { key: "teamJoins", label: "Team joined", style: "vline" },
];

const POLL_MS = 15_000;
const TICK_MS = 1_000;
/** buckets visible when live mode opens, e.g. 10s -> 1 hour */
const DEFAULT_BUCKETS_IN_VIEW = 360;

type HoverInfo =
  | {
      /** "bucket"/"range": peak views. "average": a trend point. "now": the trend line's live end. */
      kind: "bucket" | "range" | "average" | "now";
      from: number;
      to: number;
      peak: number;
      low: number;
      buckets: number;
    }
  | { kind: "conversions"; at: number; labels: (string | null)[] }
  | { kind: "teamJoin"; at: number; label: string | null };

function hoverKey(h: HoverInfo | null): string {
  if (!h) return "";
  if (h.kind === "conversions") return `c${h.at}:${h.labels.length}`;
  if (h.kind === "teamJoin") return `t${h.at}:${h.label}`;
  return `${h.kind}${h.from}:${h.peak}:${h.low}`;
}

function listLabels(labels: (string | null)[], max = 3): string {
  const named = labels.map((l) => l || "unnamed lead");
  return named.length > max ? `${named.slice(0, max).join(", ")} +${named.length - max} more` : named.join(", ");
}

function formatAgo(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function formatCount(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function formatInstant(t: number, intervalMs: number): string {
  const opts: Intl.DateTimeFormatOptions =
    intervalMs >= 86_400_000
      ? { month: "short", day: "numeric", year: "numeric" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(intervalMs < 60_000 ? { second: "2-digit" } : {}) };
  return new Date(t).toLocaleString(undefined, opts);
}

function toLocalInputValue(t: number): string {
  const d = new Date(t);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const EMPTY_DATA: uPlot.AlignedData = [[], [], []];

export function MainChart({ siteId }: { siteId: string }) {
  const store = React.useMemo(() => storeFor(siteId), [siteId]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const plotRef = React.useRef<uPlot | null>(null);
  const viewRef = React.useRef<ViewWindow | null>(null);
  const followRef = React.useRef(true);
  const seriesRef = React.useRef<ComputedSeries | null>(null);
  const dataFromRef = React.useRef<number | null>(null);
  const requestedFromRef = React.useRef(Infinity);

  const [mode, setMode] = React.useState<Mode>("live");
  const [intervalKey, setIntervalKey] = React.useState(DEFAULT_INTERVAL_KEY);
  const intervalMs = intervalByKey(intervalKey).ms;
  const modeRef = React.useRef<Mode>(mode);
  const intervalRef = React.useRef(intervalMs);
  const [lineStyle, setLineStyle] = React.useState<LineStyle>("smooth");
  const lineStyleRef = React.useRef<LineStyle>(lineStyle);
  const [markersOn, setMarkersOn] = React.useState<Record<MarkerLayer, boolean>>({ conversions: false, teamJoins: false });
  const markersOnRef = React.useRef(markersOn);
  /** where markers land in the current view, in data space; recomputed with the series, drawn in the draw hook */
  const markerDrawRef = React.useRef<{ points: PlacedPoint[]; vlines: MarkerEvent[] }>({ points: [], vlines: [] });

  const [following, setFollowing] = React.useState(true);
  const [hover, setHover] = React.useState<HoverInfo | null>(null);
  const [onlineNow, setOnlineNow] = React.useState<number | null>(null);
  const [seriesMode, setSeriesMode] = React.useState<{ mode: ComputedSeries["mode"]; bucketsPerPoint: number } | null>(null);
  /** the visible stretch is loaded and holds no one at all */
  const [viewEmpty, setViewEmpty] = React.useState(false);
  const [, setStoreVersion] = React.useState(0);

  // Custom-range inputs start empty and get their defaults (last 7 days) on
  // the click that opens them: computing them from Date.now() during
  // render would differ between the server render and hydration.
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [customError, setCustomError] = React.useState<string | null>(null);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  React.useEffect(() => store.subscribe(() => setStoreVersion(store.version)), [store]);

  /** Keep live views inside [first activity, now] and between the min/max zoom. */
  const clampLive = React.useCallback(
    (v: ViewWindow, now: number): ViewWindow => {
      const minSpan = intervalRef.current * theme.minBucketsInView;
      const first = store.firstActivityAt;
      const maxSpan = first === undefined ? Infinity : Math.max(minSpan, (now - first) * 1.05);
      const span = Math.min(maxSpan, Math.max(minSpan, v.to - v.from));
      let from = Math.max(v.from, now - maxSpan);
      let to = from + span;
      if (to > now) {
        to = now;
        from = to - span;
      }
      return { from, to };
    },
    [store]
  );

  const setFollow = React.useCallback((value: boolean) => {
    if (followRef.current !== value) {
      followRef.current = value;
      setFollowing(value);
    }
  }, []);

  /** Ask for history left of the view, one extra screen ahead, once per new left edge. */
  const loadLeftIfNeeded = React.useCallback(() => {
    const v = viewRef.current;
    if (!v || modeRef.current !== "live") return;
    if (v.from >= requestedFromRef.current) return;
    const want = v.from - (v.to - v.from);
    requestedFromRef.current = want;
    store.ensureRange(want, Infinity);
    // Switched-on conversion markers load the same stretch, and only what's missing.
    if (markersOnRef.current.conversions) store.ensureMarkers("conversions", want, Infinity);
  }, [store]);

  /** First load of a layer that was just switched on, for whatever the chart is showing. */
  const loadMarkers = React.useCallback(
    (layer: MarkerLayer) => {
      const v = viewRef.current;
      if (!v) return;
      if (layer === "teamJoins") {
        store.ensureMarkers("teamJoins", 0, 0);
      } else if (modeRef.current === "live") {
        store.ensureMarkers(layer, Math.min(requestedFromRef.current, v.from - (v.to - v.from)), Infinity);
      } else {
        store.ensureMarkers(layer, v.from, v.to >= store.now() ? Infinity : v.to);
      }
    },
    [store]
  );

  /** Recompute from loaded data and hand it to uPlot. Cheap enough for every frame. */
  const redraw = React.useCallback(() => {
    const u = plotRef.current;
    const v = viewRef.current;
    if (!u || !v) return;
    const now = store.now();
    const drawTo = Math.min(v.to, now);
    const dataFrom = store.dataFromFor(drawTo - 1);
    dataFromRef.current = dataFrom;

    let s: ComputedSeries | null = null;
    if (dataFrom !== null) {
      const compute = lineStyleRef.current === "trend" ? computeTrend : computeSeries;
      s = compute(store.timeline(), {
        from: v.from,
        to: v.to,
        now,
        dataFrom,
        intervalMs: intervalRef.current,
        maxPoints: Math.max(1, Math.round(u.bbox.width / (window.devicePixelRatio || 1))),
      });
    }
    seriesRef.current = s;
    // Placed BEFORE setData: setData triggers the draw that reads this.
    const on = markersOnRef.current;
    markerDrawRef.current = {
      // Anything earlier than one interval before the view can't snap into it.
      points: s && on.conversions ? placePointMarkers(eventsInView(store.markerEvents("conversions"), v.from - intervalRef.current, drawTo), s, v.from) : [],
      vlines: on.teamJoins ? eventsInView(store.markerEvents("teamJoins"), v.from, drawTo) : [],
    };
    u.batch(() => {
      u.setData(s ? [s.xs, s.peak, s.low] : EMPTY_DATA, false);
      u.setScale("x", { min: v.from, max: v.to });
    });
    const isEmpty = s !== null && s.xs.length > 0 && s.peak.every((v) => !v);
    setViewEmpty((prev) => (prev === isEmpty ? prev : isEmpty));
    setSeriesMode((prev) =>
      s && (prev?.mode !== s.mode || Math.round(prev.bucketsPerPoint) !== Math.round(s.bucketsPerPoint)) ? { mode: s.mode, bucketsPerPoint: s.bucketsPerPoint } : prev
    );
  }, [store]);

  /**
   * Zoom the live view by factor k (>1 = out, <1 = in). anchorFrac is where
   * in the plot (0 = left, 1 = right) stays put; while pinned to now, the
   * right edge ("now") always stays put instead.
   */
  const zoomBy = React.useCallback(
    (k: number, anchorFrac = 0.5) => {
      const v = viewRef.current;
      if (!v || modeRef.current !== "live") return;
      const now = store.now();
      const anchor = followRef.current ? v.to : v.from + anchorFrac * (v.to - v.from);
      const next = clampLive({ from: anchor - (anchor - v.from) * k, to: anchor + (v.to - anchor) * k }, now);
      viewRef.current = next;
      setFollow(next.to >= now - 1);
      loadLeftIfNeeded();
      redraw();
    },
    [store, clampLive, setFollow, loadLeftIfNeeded, redraw]
  );

  // ── Create the plot once ────────────────────────────────────────────────
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const zoneStyle = (u: uPlot, history: string, provisional: string): CanvasRenderingContext2D["fillStyle"] => {
      const boundary = u.valToPos(store.now() - theme.provisionalWindowMs, "x", true);
      const left = u.bbox.left;
      const right = left + u.bbox.width;
      if (!Number.isFinite(boundary) || boundary >= right) return history;
      if (boundary <= left) return provisional;
      const g = u.ctx.createLinearGradient(left, 0, right, 0);
      const f = (boundary - left) / (right - left);
      g.addColorStop(0, history);
      g.addColorStop(f, history);
      g.addColorStop(f, provisional);
      g.addColorStop(1, provisional);
      return g;
    };
    // Monotone cubic: the same wavy look as a shadcn area chart, but it
    // never overshoots, so the curve can't dip below 0 or rise above the
    // real peak between two points ("natural" splines do both).
    const smooth = uPlot.paths.spline!();
    const stepped = uPlot.paths.stepped!({ align: 1 });
    const linePath: uPlot.Series.PathBuilder = (u, seriesIdx, idx0, idx1) =>
      (lineStyleRef.current === "steps" ? stepped : smooth)(u, seriesIdx, idx0, idx1);

    const opts: uPlot.Options = {
      width: el.clientWidth || 600,
      height: theme.heightPx,
      ms: 1,
      legend: { show: false },
      cursor: { drag: { x: false, y: false, setScale: false }, points: { show: false }, y: false },
      scales: {
        x: { time: true, auto: false },
        y: { range: (_u, _min, max) => [0, Math.max(1, Math.ceil((max ?? 0) * 1.12))] },
      },
      axes: [
        {
          stroke: () => currentPalette().axis,
          grid: { stroke: () => currentPalette().grid, width: 1 },
          ticks: { stroke: () => currentPalette().grid, width: 1 },
          font: theme.font,
        },
        {
          stroke: () => currentPalette().axis,
          grid: { stroke: () => currentPalette().grid, width: 1 },
          ticks: { show: false },
          font: theme.font,
          size: 44,
          // people are whole numbers: only integer gridlines
          incrs: [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000],
          values: (_u, splits) => splits.map((v) => v.toLocaleString()),
        },
      ],
      series: [
        {},
        {
          label: "Peak online",
          stroke: (u) => zoneStyle(u, currentPalette().line, currentPalette().provisionalLine),
          width: theme.lineWidth,
          paths: linePath,
          points: { show: false },
        },
        {
          label: "Lowest online",
          stroke: "transparent",
          width: 0,
          fill: (u) => zoneStyle(u, currentPalette().fill, currentPalette().provisionalFill),
          paths: linePath,
          points: { show: false },
        },
      ],
      // Only has height in envelope mode, where one pixel column holds many buckets.
      bands: [{ series: [1, 2], fill: (u) => zoneStyle(u, currentPalette().band, currentPalette().provisionalBand) }],
      hooks: {
        draw: [
          (u) => {
            const pal = currentPalette();
            const { ctx, bbox } = u;
            ctx.save();
            // Not loaded yet (left of the loaded history): shaded, never drawn as zero.
            const dataFrom = dataFromRef.current;
            const shadeTo = dataFrom === null ? bbox.left + bbox.width : Number.isFinite(dataFrom) ? u.valToPos(dataFrom, "x", true) : bbox.left;
            if (shadeTo > bbox.left) {
              ctx.fillStyle = pal.loadingShade;
              ctx.fillRect(bbox.left, bbox.top, Math.min(shadeTo, bbox.left + bbox.width) - bbox.left, bbox.height);
            }
            // "Now" marker.
            const nowX = u.valToPos(store.now(), "x", true);
            if (nowX >= bbox.left && nowX <= bbox.left + bbox.width) {
              ctx.strokeStyle = pal.nowLine;
              ctx.lineWidth = 1 * (window.devicePixelRatio || 1);
              ctx.setLineDash([4 * (window.devicePixelRatio || 1), 4 * (window.devicePixelRatio || 1)]);
              ctx.beginPath();
              ctx.moveTo(Math.round(nowX) + 0.5, bbox.top);
              ctx.lineTo(Math.round(nowX) + 0.5, bbox.top + bbox.height);
              ctx.stroke();
            }

            // ── Marker layers, drawn after (on top of) the session line ──
            const dpr = window.devicePixelRatio || 1;
            const m = theme.marker;
            const inPlot = (x: number) => x >= bbox.left && x <= bbox.left + bbox.width;
            const { points, vlines } = markerDrawRef.current;

            ctx.setLineDash([]);
            ctx.globalAlpha = m.lineOpacity;
            ctx.strokeStyle = pal.teamJoin;
            ctx.lineWidth = m.lineWidth * dpr;
            for (const e of vlines) {
              const x = Math.round(u.valToPos(e.t, "x", true)) + 0.5;
              if (!inPlot(x)) continue;
              ctx.beginPath();
              ctx.moveTo(x, bbox.top);
              ctx.lineTo(x, bbox.top + bbox.height);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;

            ctx.font = `600 ${m.countFontPx * dpr}px ${m.fontFamily}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            for (const p of points) {
              const x = u.valToPos(p.x, "x", true);
              const y = u.valToPos(p.y, "y", true);
              if (!inPlot(x)) continue;
              ctx.fillStyle = pal.markerRing;
              ctx.beginPath();
              ctx.arc(x, y, (m.dotRadius + m.ringWidth) * dpr, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = pal.conversion;
              ctx.beginPath();
              ctx.arc(x, y, m.dotRadius * dpr, 0, Math.PI * 2);
              ctx.fill();
              if (p.events.length > 1) ctx.fillText(String(p.events.length), x, y - (m.dotRadius + m.ringWidth + 2) * dpr);
            }
            ctx.restore();
          },
        ],
        setCursor: [
          (u) => {
            const set = (next: HoverInfo | null) => setHover((prev) => (hoverKey(prev) === hoverKey(next) ? prev : next));

            // A marker under the cursor wins over the line beneath it.
            const left = u.cursor.left ?? -1;
            const top = u.cursor.top ?? -1;
            if (left >= 0) {
              const r = theme.marker.hoverRadius;
              const { points, vlines } = markerDrawRef.current;
              let bestDot: PlacedPoint | null = null;
              let bestDx = Infinity;
              for (const p of points) {
                const dx = Math.abs(u.valToPos(p.x, "x") - left);
                const dy = Math.abs(u.valToPos(p.y, "y") - top);
                if (dx <= r && dy <= r * 1.5 && dx < bestDx) {
                  bestDot = p;
                  bestDx = dx;
                }
              }
              if (bestDot) return set({ kind: "conversions", at: bestDot.x, labels: bestDot.events.map((e) => e.label) });
              for (const e of vlines) {
                if (Math.abs(u.valToPos(e.t, "x") - left) <= r / 2) return set({ kind: "teamJoin", at: e.t, label: e.label });
              }
            }

            const s = seriesRef.current;
            const idx = u.cursor.idx;
            if (!s || idx == null || s.xs.length < 2) return set(null);
            let next: HoverInfo;
            if (s.mode === "trend") {
              // Every trend point is real, including the line's end at "now".
              const from = s.xs[idx];
              const isNow = idx === s.xs.length - 1 && from >= store.now() - 1000;
              next = { kind: isNow ? "now" : "average", from, to: from + s.intervalMs, peak: s.peak[idx] ?? 0, low: s.low[idx] ?? 0, buckets: 1 };
            } else {
              const i = Math.min(idx, s.xs.length - 2); // the last point only closes the final step
              const from = s.xs[i];
              const to = s.mode === "bucket" ? from + s.intervalMs : s.xs[i + 1];
              next = { kind: s.mode === "bucket" ? "bucket" : "range", from, to, peak: s.peak[i] ?? 0, low: s.low[i] ?? 0, buckets: Math.round((to - from) / s.intervalMs) };
            }
            set(next);
          },
        ],
      },
    };

    const u = new uPlot(opts, EMPTY_DATA, el);
    plotRef.current = u;

    // ── Pan (drag) and pinch-zoom, live mode only ────────────────────────
    const over = u.over;
    let drag: { x: number; view: ViewWindow } | null = null;
    const anchorAt = (clientX: number) => {
      const rect = over.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    };

    // A plain wheel / two-finger scroll is NOT handled: the page scrolls as
    // normal. Chrome, Edge and Firefox report a trackpad pinch as a wheel
    // event with ctrlKey set; only that zooms the chart (and stops the
    // browser from zooming the whole page instead).
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || !viewRef.current || modeRef.current !== "live") return;
      e.preventDefault();
      zoomBy(Math.exp(e.deltaY * theme.pinchZoomSensitivity), anchorAt(e.clientX));
    };
    // Safari reports a trackpad pinch as its own gesture events instead.
    let lastGestureScale = 1;
    const onGestureStart = (e: Event) => {
      if (modeRef.current !== "live") return;
      e.preventDefault();
      lastGestureScale = 1;
    };
    const onGestureChange = (e: Event) => {
      if (modeRef.current !== "live") return;
      e.preventDefault();
      const g = e as Event & { scale: number; clientX: number };
      if (!g.scale) return;
      zoomBy(lastGestureScale / g.scale, anchorAt(g.clientX));
      lastGestureScale = g.scale;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!viewRef.current || modeRef.current !== "live" || e.button !== 0) return;
      drag = { x: e.clientX, view: viewRef.current };
      over.setPointerCapture(e.pointerId);
      over.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return;
      const now = store.now();
      const span = drag.view.to - drag.view.from;
      const dt = ((e.clientX - drag.x) / over.clientWidth) * span;
      const next = clampLive({ from: drag.view.from - dt, to: drag.view.to - dt }, now);
      viewRef.current = next;
      setFollow(next.to >= now - span * 0.002);
      if (followRef.current) viewRef.current = { from: now - span, to: now };
      loadLeftIfNeeded();
      redraw();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!drag) return;
      drag = null;
      if (over.hasPointerCapture(e.pointerId)) over.releasePointerCapture(e.pointerId);
      over.style.cursor = "";
    };
    over.addEventListener("wheel", onWheel, { passive: false });
    over.addEventListener("gesturestart", onGestureStart);
    over.addEventListener("gesturechange", onGestureChange);
    over.addEventListener("pointerdown", onPointerDown);
    over.addEventListener("pointermove", onPointerMove);
    over.addEventListener("pointerup", onPointerUp);
    over.addEventListener("pointercancel", onPointerUp);
    over.style.touchAction = "pan-y"; // horizontal drags pan the chart, vertical ones still scroll the page

    const resize = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (width > 0 && width !== u.width) {
        u.setSize({ width, height: theme.heightPx });
        redraw();
      }
    });
    resize.observe(el);

    // Light/dark switch: palette is read at draw time, just repaint.
    const themeWatch = new MutationObserver(() => u.redraw(false, true));
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      resize.disconnect();
      themeWatch.disconnect();
      over.removeEventListener("wheel", onWheel);
      over.removeEventListener("gesturestart", onGestureStart);
      over.removeEventListener("gesturechange", onGestureChange);
      over.removeEventListener("pointerdown", onPointerDown);
      over.removeEventListener("pointermove", onPointerMove);
      over.removeEventListener("pointerup", onPointerUp);
      over.removeEventListener("pointercancel", onPointerUp);
      u.destroy();
      plotRef.current = null;
    };
  }, [store, clampLive, setFollow, loadLeftIfNeeded, redraw, zoomBy]);

  // ── Line style: Smooth/Steps share data; Trend computes its own points ──
  React.useEffect(() => {
    lineStyleRef.current = lineStyle;
    redraw();
  }, [lineStyle, redraw]);

  // ── Interval changes: keep the view, but respect the new minimum zoom ───
  React.useEffect(() => {
    intervalRef.current = intervalMs;
    const v = viewRef.current;
    if (v && modeRef.current === "live") {
      viewRef.current = clampLive(v, store.now());
      loadLeftIfNeeded();
    }
    redraw();
  }, [intervalMs, store, clampLive, loadLeftIfNeeded, redraw]);

  // ── Entering live mode: pinned to now, showing the last
  // DEFAULT_BUCKETS_IN_VIEW buckets, or further back if that would be empty ─
  React.useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    const open = () => {
      if (cancelled) return;
      viewRef.current = openingLiveView();
      setFollow(true);
      requestedFromRef.current = Infinity;
      loadLeftIfNeeded();
      redraw();
    };
    // The opening view depends on when the latest activity was, so wait for that first.
    if (store.firstActivityAt !== undefined) open();
    else store.ensureBounds().then(open);
    return () => {
      cancelled = true;
    };
    // openingLiveView only reads refs and the store
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, store, setFollow, loadLeftIfNeeded, redraw]);

  // ── New data arrived: once the first-activity time is known, re-clamp ────
  React.useEffect(() => {
    return store.subscribe(() => {
      const v = viewRef.current;
      if (v && modeRef.current === "live") {
        const now = store.now();
        const span = v.to - v.from;
        viewRef.current = clampLive(followRef.current ? { from: now - span, to: now } : v, now);
      }
      redraw();
    });
  }, [store, clampLive, redraw]);

  // ── Clock: "now" keeps moving, and the live value with it ───────────────
  React.useEffect(() => {
    const tick = () => {
      const now = store.now();
      const v = viewRef.current;
      if (v && modeRef.current === "live" && followRef.current) {
        const span = v.to - v.from;
        viewRef.current = { from: now - span, to: now };
      }
      redraw();
      setOnlineNow(store.size > 0 || store.isLive() ? valueAt(store.timeline(), now) : null);
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [store, redraw]);

  // ── Live polling: only while the tab is visible and the view reaches now ─
  React.useEffect(() => {
    const reachesNow = () => {
      const v = viewRef.current;
      return modeRef.current === "live" || (v !== null && v.to >= store.now() - theme.provisionalWindowMs);
    };
    const poll = () => {
      if (document.visibilityState === "visible" && store.isLive() && reachesNow()) {
        store.poll(MARKER_LAYERS.filter((l) => markersOnRef.current[l.key]).map((l) => l.key));
      }
    };
    // Catch up right away on (re)mount: the store outlives this component, and
    // nothing was polled while the dashboard was closed.
    poll();
    const id = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [store]);

  const applyCustom = (fromValue = customFrom, toValue = customTo) => {
    const from = fromValue ? new Date(fromValue).getTime() : NaN;
    const to = toValue ? new Date(toValue).getTime() : NaN;
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
      setCustomError("Pick a start that's before the end.");
      return;
    }
    setCustomError(null);
    viewRef.current = { from, to };
    setFollow(false);
    // A window that reaches now keeps updating live, same as live mode.
    const end = to >= store.now() ? Infinity : to;
    store.ensureRange(from, end);
    if (markersOnRef.current.conversions) store.ensureMarkers("conversions", from, end);
    redraw();
  };

  const toggleMarker = (layer: MarkerLayer, on: boolean) => {
    const next = { ...markersOnRef.current, [layer]: on };
    markersOnRef.current = next;
    setMarkersOn(next);
    if (on) loadMarkers(layer);
    redraw();
  };

  /**
   * Live mode's starting view: the last DEFAULT_BUCKETS_IN_VIEW buckets,
   * unless nobody visited in that stretch. Then it reaches back to include
   * the most recent visit (plus a little room), so a quiet site never opens
   * on a flat, empty line that looks like nothing loaded.
   */
  function openingLiveView(): ViewWindow {
    const now = store.now();
    let span = intervalRef.current * DEFAULT_BUCKETS_IN_VIEW;
    const last = store.lastActivityAt;
    if (last !== undefined && last < now - span) span = (now - last) * theme.lastVisitPadding;
    return clampLive({ from: now - span, to: now }, now);
  }

  const jumpToLastVisit = () => {
    viewRef.current = openingLiveView();
    setFollow(true);
    loadLeftIfNeeded();
    redraw();
  };

  const jumpToNow = () => {
    const v = viewRef.current;
    const now = store.now();
    if (!v) return;
    viewRef.current = clampLive({ from: now - (v.to - v.from), to: now }, now);
    setFollow(true);
    redraw();
  };

  const loading = store.pending > 0;
  // "Never had a visitor" is about the SITE, not about what's loaded: a busy
  // site can have nothing in the stretch currently loaded.
  const neverVisited = !loading && store.firstActivityAt !== undefined && store.lastActivityAt === undefined;
  const lastVisitAgo = store.lastActivityAt !== undefined ? formatAgo(store.now() - store.lastActivityAt) : null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            Sessions online
            {mode === "live" && <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${following ? "animate-pulse" : "opacity-40"}`} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-input p-0.5">
              {LINE_STYLES.map((style) => (
                <Button
                  key={style.key}
                  size="sm"
                  variant={lineStyle === style.key ? "secondary" : "ghost"}
                  className="h-7 px-2.5 text-xs"
                  title={style.title}
                  onClick={() => setLineStyle(style.key)}
                >
                  {style.label}
                </Button>
              ))}
            </div>
            <div className="flex rounded-md border border-input p-0.5">
              <Button size="sm" variant={mode === "live" ? "secondary" : "ghost"} className="h-7 px-2.5 text-xs" onClick={() => setMode("live")}>
                <Radio className="mr-1 h-3.5 w-3.5" /> Live
              </Button>
              <Button
                size="sm"
                variant={mode === "custom" ? "secondary" : "ghost"}
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  if (mode === "custom") return;
                  const now = Date.now();
                  const fromValue = customFrom || toLocalInputValue(now - 7 * 86_400_000);
                  const toValue = customTo || toLocalInputValue(now);
                  setCustomFrom(fromValue);
                  setCustomTo(toValue);
                  setMode("custom");
                  applyCustom(fromValue, toValue);
                }}
              >
                <CalendarRange className="mr-1 h-3.5 w-3.5" /> Custom range
              </Button>
            </div>
            <div className="flex flex-wrap rounded-md border border-input p-0.5">
              {INTERVALS.map((iv) => (
                <Button
                  key={iv.key}
                  size="sm"
                  variant={iv.key === intervalKey ? "secondary" : "ghost"}
                  className="h-7 min-w-9 px-2 text-xs"
                  onClick={() => setIntervalKey(iv.key)}
                >
                  {iv.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Own line, fixed height, one line max: its text changes length on
            every hover and every second, and must never shift the controls
            above or the chart below. */}
        <div className="mb-2 mt-1.5 h-4 truncate text-xs text-muted-foreground">
          {hover?.kind === "conversions" ? (
            <>
              <span className="font-medium text-foreground">
                {hover.labels.length} conversion{hover.labels.length === 1 ? "" : "s"}
              </span>{" "}
              on the {formatInstant(hover.at, intervalMs)} point: {listLabels(hover.labels)}
            </>
          ) : hover?.kind === "teamJoin" ? (
            <>
              <span className="font-medium text-foreground">{hover.label}</span> joined the team · {formatInstant(hover.at, 1000)}
            </>
          ) : hover?.kind === "now" ? (
            <>
              Now: <span className="font-medium text-foreground">{formatCount(hover.peak)}</span> open
            </>
          ) : hover?.kind === "average" ? (
            <>
              Change at {formatInstant(hover.from, intervalMs)}:{" "}
              <span className="font-medium text-foreground">about {formatCount(hover.peak)} online</span> on average across that{" "}
              {intervalByKey(intervalKey).label}
            </>
          ) : hover ? (
            <>
              {formatInstant(hover.from, intervalMs)} to {formatInstant(hover.to, intervalMs)}:{" "}
              <span className="font-medium text-foreground">
                {hover.low === hover.peak ? `peak ${hover.peak}` : `between ${hover.low} and ${hover.peak}`}
              </span>
              {hover.buckets > 1 && ` across ${hover.buckets.toLocaleString()} ${intervalByKey(intervalKey).label} buckets`}
            </>
          ) : (
            <>
              {onlineNow !== null && (
                <>
                  <span className="font-medium text-foreground">{onlineNow}</span> open right now ·{" "}
                </>
              )}
              {lineStyle === "trend"
                ? `average online wherever it changed, per ${intervalByKey(intervalKey).label}`
                : `most people online at once, per ${intervalByKey(intervalKey).label}`}
            </>
          )}
        </div>

        {/* Marker layers: off until ticked. Swatches render in both themes and CSS
            picks one, since reading the theme during render breaks hydration. */}
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span>Markers</span>
          {MARKER_LAYERS.map((layer) => {
            const swatch = (color: string, className: string) =>
              layer.style === "point" ? (
                <span className={`h-2.5 w-2.5 rounded-full ${className}`} style={{ backgroundColor: color }} />
              ) : (
                <span className={`h-3 w-0.5 rounded-full ${className}`} style={{ backgroundColor: color }} />
              );
            const color = layer.key === "conversions" ? "conversion" : "teamJoin";
            return (
              <label key={layer.key} className="inline-flex cursor-pointer select-none items-center gap-1.5 text-foreground">
                <Checkbox checked={markersOn[layer.key]} onCheckedChange={(c) => toggleMarker(layer.key, c === true)} />
                {swatch(theme.light[color], "inline-block dark:hidden")}
                {swatch(theme.dark[color], "hidden dark:inline-block")}
                {layer.label}
              </label>
            );
          })}
        </div>

        {mode === "custom" && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="datetime-local"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            />
            <Button size="sm" className="h-8 text-xs" onClick={() => applyCustom()}>
              Show
            </Button>
            {customError && <span className="text-xs text-destructive">{customError}</span>}
          </div>
        )}

        <div className="relative">
          <div ref={containerRef} className="w-full min-w-0" role="img" aria-label="Number of sessions open at once over time" />
          {loading && <span className="pointer-events-none absolute left-14 top-2 text-[11px] text-muted-foreground">Loading sessions…</span>}
          {neverVisited ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No sessions yet. This fills in as soon as your first visitor arrives.
            </span>
          ) : (
            viewEmpty &&
            !loading && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>Nobody was online in this stretch{lastVisitAgo ? ` · last visit ${lastVisitAgo}` : ""}.</span>
                {mode === "live" && lastVisitAgo && (
                  <Button size="sm" variant="outline" className="pointer-events-auto h-7 bg-background/80 text-xs" onClick={jumpToLastVisit}>
                    Show the last visit
                  </Button>
                )}
              </div>
            )
          )}
          {store.error && <span className="absolute left-14 top-2 text-[11px] text-destructive">{store.error}</span>}
          {mode === "live" && (
            <div className="absolute right-2 top-2 flex items-center gap-1.5">
              {!following && (
                <Button size="sm" variant="outline" className="h-7 bg-background/80 text-xs" onClick={jumpToNow}>
                  Now <ChevronsRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              )}
              <div className="flex rounded-md border border-input bg-background/80">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Zoom out" onClick={() => zoomBy(theme.buttonZoomFactor)}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Zoom in" onClick={() => zoomBy(1 / theme.buttonZoomFactor)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {/* both rendered, CSS picks one: reading the theme in render would differ between server and client */}
            <span className="inline-block h-2 w-3 rounded-sm dark:hidden" style={{ backgroundColor: theme.light.provisionalLine }} />
            <span className="hidden h-2 w-3 rounded-sm dark:inline-block" style={{ backgroundColor: theme.dark.provisionalLine }} />
            Last 30 minutes: a visitor whose tab crashed here can still be counted until the server closes their session. The chart corrects itself after.
          </span>
          {lineStyle === "trend" && (
            <span>
              Trend: a point only where the count changed, the line running from one change to the next. Averages, so a very short
              spike can look smaller here than in Smooth or Steps.
            </span>
          )}
          {lineStyle !== "trend" && seriesMode?.mode === "envelope" && (
            <span>
              Too many {intervalByKey(intervalKey).label} buckets to draw one by one: each column shows the highest and lowest of about{" "}
              {Math.round(seriesMode.bucketsPerPoint).toLocaleString()}.
            </span>
          )}
          {mode === "live" && <span>Drag to move through time · pinch or +/- to zoom</span>}
        </div>
      </CardContent>
    </Card>
  );
}
