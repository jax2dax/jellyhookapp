// framePlate/components/SessionStrip.tsx
//
// Lays out a full timeline of frames left-to-right inside a horizontally
// scrollable container. Total SVG width is purely a function of the
// frames' own (absolute, non-container-relative) widths — it never
// stretches to fill the wrapping div, so a 2-page session stays narrow
// with empty space beside it, and a long session naturally overflows into
// a scrollbar.
//
// The "1vh" reference marks are NOT drawn here — they're per-plate, inside
// FullPagePlate (see ViewportMarks there). Every plate has its own
// page-to-viewport ratio, so a single line spanning the whole strip could
// only ever be correct for one plate at a time.
"use client";

import * as React from "react";
import { Frame } from "./Frame";
import { scaleFrameWidths, frameWidthConfigFromTheme } from "../geometry/scaleFrameWidths";
import { scalePlateHeights } from "../geometry/scalePlateHeight";
import type { FramePlateTheme, TimelineItem } from "../types";

export interface SessionSelectMeta {
  /** true when the clicked visit is the last visit in the whole timeline — the page the session itself ended on (if it's not still live/converted) */
  isLastVisit: boolean;
}

export interface SessionStripProps {
  timeline: TimelineItem[];
  theme: FramePlateTheme;
  hoverDelayMs?: number;
  onHoverItem?: (item: TimelineItem | null) => void;
  /** fires with the clicked visit (or null when the already-selected one is clicked again, toggling it off) */
  onSelectItem?: (item: TimelineItem | null, meta: SessionSelectMeta) => void;
  className?: string;
}

export function SessionStrip({ timeline, theme, hoverDelayMs = 150, onHoverItem, onSelectItem, className }: SessionStripProps) {
  // hoveredId fires onHoverItem immediately (so consumers like an info
  // panel feel responsive); activeHoverId is what actually drives the
  // darken overlay, and only flips on after hoverDelayMs of continuous
  // hover — sweeping the mouse across the strip shouldn't flash every
  // frame it passes over.
  const [activeHoverId, setActiveHoverId] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const hoverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection is scoped to whatever timeline is currently shown — switching
  // to a different session's timeline shouldn't leave a stale frame pinned
  // "selected" that no longer exists in the new one. Reset during render
  // (React's documented pattern for this) rather than an effect, since an
  // effect here would just cause an extra render with the stale selection
  // still visible for one frame.
  const [prevTimeline, setPrevTimeline] = React.useState(timeline);
  if (timeline !== prevTimeline) {
    setPrevTimeline(timeline);
    setSelectedId(null);
  }

  const layout = React.useMemo(() => {
    try {
      if (!timeline || timeline.length === 0) return null;

      const widths = scaleFrameWidths(
        timeline.map((i) => i.durationMs),
        frameWidthConfigFromTheme(theme)
      );

      const visitHeights = scalePlateHeights(
        timeline.filter((i) => i.kind === "visit").map((i) => i.pageHeightPx),
        { minHeight: theme.plate.minHeight, maxHeight: theme.plate.maxHeight, pxToVisualRatio: theme.plate.pxToVisualRatio }
      );

      let visitCursor = 0;
      const plateHeightByIndex = timeline.map((item) => {
        if (item.kind !== "visit") return theme.plate.minHeight;
        return visitHeights[visitCursor++] ?? theme.plate.minHeight;
      });

      let x = 0;
      const positions = widths.map((w) => {
        const thisX = x;
        x += w + theme.frame.gap;
        return thisX;
      });

      const totalWidth = Math.max(0, x - theme.frame.gap);
      const ribbonLabelSpace = theme.ribbon.enabled ? theme.ribbon.gap + theme.ribbon.labelFontSize * 1.6 : 0;
      const topOffset = theme.frame.pathLabelHeight;
      const totalHeight = topOffset + theme.frame.height + ribbonLabelSpace;

      return { widths, plateHeightByIndex, positions, totalWidth, totalHeight, topOffset };
    } catch (err) {
      console.error("[framePlate] SessionStrip layout computation failed:", err);
      return null;
    }
  }, [timeline, theme]);

  React.useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  if (!timeline || timeline.length === 0) {
    return <div className={className} style={{ padding: 24, color: theme.ribbon.labelColor, opacity: 0.6, fontSize: 13 }}>No session activity to display.</div>;
  }

  if (!layout) {
    return <div className={className} style={{ padding: 24, color: "#f66", fontSize: 13 }}>FramePlate failed to render this session — see console for details.</div>;
  }

  function handleHover(item: TimelineItem | null) {
    onHoverItem?.(item);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (item === null) {
      setActiveHoverId(null);
      return;
    }
    hoverTimerRef.current = setTimeout(() => setActiveHoverId(item.id), hoverDelayMs);
  }

  function handleClick(item: TimelineItem, index: number) {
    if (item.kind !== "visit") return;
    const nextSelectedId = selectedId === item.id ? null : item.id;
    setSelectedId(nextSelectedId);
    if (!onSelectItem) return;
    if (nextSelectedId === null) {
      onSelectItem(null, { isLastVisit: false });
      return;
    }
    // "last visit" = the last VISIT-kind item in the timeline, not just the
    // last item overall (a trailing away-gap frame can't be selected at all).
    let lastVisitIndex = -1;
    for (let j = timeline.length - 1; j >= 0; j--) {
      if (timeline[j].kind === "visit") {
        lastVisitIndex = j;
        break;
      }
    }
    onSelectItem(item, { isLastVisit: index === lastVisitIndex });
  }

  return (
    <div className={className} style={{ overflowX: "auto", overflowY: "hidden" }}>
      <svg width={layout.totalWidth} height={layout.totalHeight} role="img" aria-label="Session activity chart">
        <rect x={0} y={0} width={layout.totalWidth} height={layout.totalHeight} fill={theme.canvasBackground} />

        {timeline.map((item, i) => (
          <g key={item.id} transform={`translate(${layout.positions[i]}, ${layout.topOffset})`}>
            <Frame
              item={item}
              width={layout.widths[i]}
              plateHeight={layout.plateHeightByIndex[i]}
              theme={theme}
              darken={activeHoverId === item.id}
              selected={selectedId === item.id}
              onHover={handleHover}
              onClick={onSelectItem ? (clicked) => handleClick(clicked, i) : undefined}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
