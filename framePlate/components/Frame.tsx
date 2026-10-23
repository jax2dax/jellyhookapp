// framePlate/components/Frame.tsx
//
// One pillar in the strip: a colored background (keyed by outcome) sized
// width×theme.frame.height, holding either a centered FullPagePlate (a real
// page visit) or nothing at all (a solid "away" gap block), plus the
// duration ribbon underneath. When hovered, a dark overlay fades in on TOP
// of this frame only — other frames are left untouched, never dimmed.
//
// Geometry computed in a plain function so no try/catch ever wraps JSX
// (see Bulb.tsx for why that matters).
"use client";

import { createPortal } from "react-dom";

import * as React from "react";
import { FullPagePlate } from "./FullPagePlate";
import { DurationRibbon } from "./DurationRibbon";
import { computeSeenBreakdown } from "../format";
import { SectionTooltipBody, isSectionView, type HeatRange } from "./SectionBands";
import type { FramePlateTheme, PlateView, TimelineItem, VisitGeometry } from "../types";

export interface FrameProps {
  item: TimelineItem;
  width: number;
  plateHeight: number;
  theme: FramePlateTheme;
  /** what the plate shows inside, see PlateView */
  view?: PlateView;
  /** the heat map's scale across the whole visit */
  heatRange?: HeatRange;
  /** true once this specific frame has been hovered past the hover delay */
  darken?: boolean;
  /** true when this frame is the one currently pinned open in the click-to-select details panel */
  selected?: boolean;
  onHover?: (item: TimelineItem | null) => void;
  onClick?: (item: TimelineItem) => void;
}

interface FrameGeometry {
  bg: string;
  plateX: number;
  plateY: number;
}

function computeFrameGeometry(props: FrameProps): FrameGeometry | null {
  try {
    const { item, width, theme } = props;
    if (!Number.isFinite(width) || width <= 0) {
      console.error("[framePlate] Frame given a non-finite/non-positive width, skipping render.", { width });
      return null;
    }
    const bg = theme.frame.backgroundByOutcome[item.outcome] ?? theme.frame.backgroundByOutcome.active;
    const plateX = (width - theme.plate.width) / 2;
    // Top-aligned, not vertically centered: every plate's top edge is the
    // top of the actual page, at the same y across every frame. Only the
    // bottom edge moves, further down for taller pages.
    const plateY = theme.frame.padding;
    return { bg, plateX, plateY };
  } catch (err) {
    console.error(`[framePlate] Frame geometry computation failed for item "${props.item?.id}":`, err);
    return null;
  }
}

/** Rough px-per-character estimate so the always-visible label fits its frame without DOM text measurement. */
function truncateToWidth(text: string, maxWidth: number, fontSize: number): string {
  const avgCharPx = fontSize * 0.58;
  const maxChars = Math.max(1, Math.floor(maxWidth / avgCharPx));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

function formatDurationShort(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function pct(v: number): string {
  return `${(Math.max(0, v) * 100).toFixed(1)}%`;
}

// Compact hover card that follows the cursor, to its RIGHT (never over the frame being looked at); it flips to the
// left near the right edge of the screen. Rendered in a portal so no SVG or scroll container clips it.
const TOOLTIP_MAX_WIDTH = 150;
const TOOLTIP_OFFSET = 14;

function SwatchRow({ color, label, border }: { color: string; label: string; border?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: color, border: border ?? "none", flexShrink: 0, display: "inline-block" }} />
      <span>{label}</span>
    </div>
  );
}

function SeenTooltip({ item, theme, at, bySection, withSubs }: { item: VisitGeometry; theme: FramePlateTheme; at: { x: number; y: number }; bySection?: boolean; withSubs?: boolean }) {
  const { seenOncePct, seenTwicePct, notSeenPct } = computeSeenBreakdown(item);
  const maxWidth = bySection ? 230 : TOOLTIP_MAX_WIDTH;
  const flip = typeof window !== "undefined" && at.x + TOOLTIP_OFFSET + maxWidth > window.innerWidth - 8;
  return (
    <div
      style={{
        position: "fixed",
        left: flip ? at.x - TOOLTIP_OFFSET - maxWidth : at.x + TOOLTIP_OFFSET,
        top: at.y + 10,
        zIndex: 60,
        pointerEvents: "none",
        background: "var(--fp-plate, #111)",
        border: "1px solid var(--fp-plate-border, #333)",
        borderRadius: 6,
        padding: "5px 8px",
        fontSize: 10.5,
        lineHeight: 1.3,
        color: "var(--fp-text, #eee)",
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        boxSizing: "border-box",
        maxWidth,
        width: "max-content",
        minWidth: bySection ? 170 : undefined,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.pagePath || "(unknown)"}</div>
      {bySection ? (
        <SectionTooltipBody visit={item} withSubs={withSubs} />
      ) : (
        <>
          <SwatchRow color={theme.seenOnce.color} label={`seen ${pct(seenOncePct)}`} />
          <SwatchRow color={theme.seenTwice.color} label={`seen 2x+ ${pct(seenTwicePct)}`} />
          <SwatchRow color={theme.plate.baseColor} border="1px solid var(--fp-plate-border, #555)" label={`not seen ${pct(notSeenPct)}`} />
        </>
      )}
    </div>
  );
}

export function Frame(props: FrameProps) {
  const { item, width, plateHeight, theme, view, heatRange, darken, selected, onHover, onClick } = props;
  const geometry = computeFrameGeometry(props);
  const frameHeight = theme.frame.height;
  // where the cursor is, for the hover card (hooks before any early return)
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);

  if (geometry === null) {
    return <rect width={Number.isFinite(width) && width > 0 ? width : theme.frame.minWidth} height={frameHeight} fill="#552222" stroke="#f00" strokeDasharray="4,4" />;
  }

  const clickable = item.kind === "visit" && !!onClick;

  return (
    <g
      onMouseEnter={() => onHover?.(item)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => {
        onHover?.(null);
        setCursor(null);
      }}
      onClick={() => clickable && onClick!(item)}
      style={{ cursor: onHover || clickable ? "pointer" : undefined }}
    >
      {/* "away" gap frames have no plate breakdown to show — keep the plain native tooltip for those */}
      {item.kind === "gap" && <title>{`away — ${formatDurationShort(item.durationMs)}`}</title>}

      {item.kind === "visit" && (
        <text x={width / 2} y={-6} textAnchor="middle" fill={theme.frame.pathLabelColor} fontSize={theme.frame.pathLabelFontSize} fontWeight={600}>
          {truncateToWidth(item.pagePath || "(unknown)", width, theme.frame.pathLabelFontSize)}
        </text>
      )}

      <rect width={width} height={frameHeight} fill={geometry.bg} />

      {/* selection ring — pinned open in the click-to-select details panel, distinct from the hover darken overlay */}
      {selected && (
        <rect x={1} y={1} width={Math.max(0, width - 2)} height={Math.max(0, frameHeight - 2)} fill="none" stroke="#60a5fa" strokeWidth={2} rx={2} />
      )}

      {item.kind === "visit" && (
        <g transform={`translate(${geometry.plateX}, ${geometry.plateY})`}>
          <FullPagePlate visit={item} width={theme.plate.width} height={plateHeight} theme={theme} view={view} heatRange={heatRange} />
        </g>
      )}

      {theme.ribbon.enabled && <DurationRibbon width={width} durationMs={item.durationMs} y={frameHeight + theme.ribbon.gap} theme={theme} />}

      {/* hover overlay — darkens only this frame, fades in after the SessionStrip delay */}
      <rect
        width={width}
        height={frameHeight}
        fill="#000000"
        opacity={darken ? theme.hover.darkenOpacity : 0}
        style={{ transition: "opacity 180ms ease", pointerEvents: "none" }}
      />

      {/* rich hover tooltip — page path + seen/seen-2x+/not-seen as % of the full page */}
      {item.kind === "visit" && darken && cursor && typeof document !== "undefined" && createPortal(<SeenTooltip item={item} theme={theme} at={cursor} bySection={isSectionView(view)} withSubs={view !== "sections-main"} />, document.body)}
    </g>
  );
}
