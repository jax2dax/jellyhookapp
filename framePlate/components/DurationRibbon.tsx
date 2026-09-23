// framePlate/components/DurationRibbon.tsx
//
// The "⊢────5 MIN────⊣" bar drawn below each frame. Two line segments with
// end-tick marks, broken in the middle for a centered label — matching the
// bracket style in the assets.
//
// Geometry computed in a plain function so no try/catch ever wraps JSX
// (see Bulb.tsx for why that matters).
"use client";

import * as React from "react";
import { formatFrameDuration } from "../format";
import type { FramePlateTheme } from "../types";

export interface DurationRibbonProps {
  width: number;
  durationMs: number;
  y: number;
  theme: FramePlateTheme;
}

interface RibbonGeometry {
  label: string;
  leftLineEnd: number;
  rightLineStart: number;
  mid: number;
}

function computeRibbonGeometry(props: DurationRibbonProps): RibbonGeometry | null {
  try {
    const { width, durationMs, theme } = props;
    if (!Number.isFinite(width) || width <= 0) {
      console.error("[framePlate] DurationRibbon given a non-finite/non-positive width, skipping render.", { width });
      return null;
    }
    const label = formatFrameDuration(durationMs);
    const labelWidth = Math.min(width * 0.7, label.length * theme.ribbon.labelFontSize * 0.62 + 12);
    const mid = width / 2;
    const gapHalf = labelWidth / 2;
    return { label, leftLineEnd: Math.max(0, mid - gapHalf), rightLineStart: Math.min(width, mid + gapHalf), mid };
  } catch (err) {
    console.error("[framePlate] DurationRibbon geometry computation failed:", err);
    return null;
  }
}

export function DurationRibbon(props: DurationRibbonProps) {
  const geometry = computeRibbonGeometry(props);
  if (geometry === null) return null;

  const { width, y, theme } = props;
  const { color, thickness, tickHeight, labelColor, labelFontSize } = theme.ribbon;

  return (
    <g>
      <line x1={0} y1={y} x2={geometry.leftLineEnd} y2={y} stroke={color} strokeWidth={thickness} />
      <line x1={geometry.rightLineStart} y1={y} x2={width} y2={y} stroke={color} strokeWidth={thickness} />
      <line x1={0} y1={y - tickHeight / 2} x2={0} y2={y + tickHeight / 2} stroke={color} strokeWidth={thickness} />
      <line x1={width} y1={y - tickHeight / 2} x2={width} y2={y + tickHeight / 2} stroke={color} strokeWidth={thickness} />
      <text x={geometry.mid} y={y} dominantBaseline="middle" textAnchor="middle" fill={labelColor} fontSize={labelFontSize} fontWeight={600}>
        {geometry.label}
      </text>
    </g>
  );
}
