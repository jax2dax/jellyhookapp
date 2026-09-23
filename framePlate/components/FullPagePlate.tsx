// framePlate/components/FullPagePlate.tsx
//
// The gray "miniature page" — background at full plate size, seen/seen-twice
// overlays clipped to its rounded shape, optional header tick marks, and
// the four trigger bulbs. This is the visual core of one page visit.
//
// Geometry computed in a plain function so no try/catch ever wraps JSX
// (see Bulb.tsx for why that matters) — a computation failure renders a
// clearly-marked dashed error placeholder instead of a silent blank.
"use client";

import * as React from "react";
import { Bulb } from "./Bulb";
import type { FramePlateTheme, VisitGeometry } from "../types";

export interface FullPagePlateProps {
  visit: VisitGeometry;
  width: number;
  height: number;
  theme: FramePlateTheme;
}

interface PlateGeometry {
  seenOnceY: number;
  seenOnceH: number;
  seenTwiceY: number;
  seenTwiceH: number;
  hasSeenTwice: boolean;
}

/** A tiny horizontal zigzag standing in for "there's a heading here" — deliberately not another bulb shape. */
function zigzagPoints(width: number, amplitude: number, segments: number): string {
  const safeSegments = Math.max(2, Math.round(segments));
  const step = width / safeSegments;
  const pts: string[] = [];
  for (let i = 0; i <= safeSegments; i++) {
    pts.push(`${i * step},${i % 2 === 0 ? -amplitude : amplitude}`);
  }
  return pts.join(" ");
}

function computePlateGeometry(props: FullPagePlateProps): PlateGeometry | null {
  try {
    const { visit, height } = props;
    if (!Number.isFinite(height) || height <= 0) {
      console.error("[framePlate] FullPagePlate given a non-finite/non-positive height, skipping render.", { height });
      return null;
    }
    const { seenOnceTop, seenTwiceTop, maxScrollY } = visit;
    const seenBottom = Math.max(seenOnceTop, seenTwiceTop ?? maxScrollY, maxScrollY);
    const seenOnceY = seenOnceTop * height;
    const seenOnceH = Math.max(0, (seenTwiceTop ?? maxScrollY) * height - seenOnceY);
    const seenTwiceY = (seenTwiceTop ?? seenBottom) * height;
    const seenTwiceH = Math.max(0, maxScrollY * height - seenTwiceY);
    return { seenOnceY, seenOnceH, seenTwiceY, seenTwiceH, hasSeenTwice: seenTwiceTop !== null };
  } catch (err) {
    console.error(`[framePlate] FullPagePlate geometry computation failed for visit "${props.visit?.id}":`, err);
    return null;
  }
}

export function FullPagePlate(props: FullPagePlateProps) {
  const clipId = React.useId().replace(/[:]/g, "");
  const geometry = computePlateGeometry(props);
  const { width, height, theme, visit } = props;

  if (geometry === null) {
    return (
      <rect
        width={width}
        height={Number.isFinite(height) && height > 0 ? height : theme.plate.minHeight}
        rx={theme.plate.cornerRadius}
        fill={theme.plate.baseColor}
        stroke="#f00"
        strokeWidth={1}
        strokeDasharray="3,3"
      />
    );
  }

  const { enterY, exitY, maxScrollY, converted, headers } = visit;

  return (
    <g>
      <defs>
        <clipPath id={`fpp-clip-${clipId}`}>
          <rect width={width} height={height} rx={theme.plate.cornerRadius} ry={theme.plate.cornerRadius} />
        </clipPath>
      </defs>

      {/* background (unseen) */}
      <rect
        width={width}
        height={height}
        rx={theme.plate.cornerRadius}
        ry={theme.plate.cornerRadius}
        fill={theme.plate.baseColor}
        stroke={theme.plate.borderColor}
        strokeWidth={theme.plate.borderWidth}
      />

      <g clipPath={`url(#fpp-clip-${clipId})`}>
        {geometry.seenOnceH > 0 && <rect x={0} y={geometry.seenOnceY} width={width} height={geometry.seenOnceH} fill={theme.seenOnce.color} />}
        {geometry.hasSeenTwice && geometry.seenTwiceH > 0 && <rect x={0} y={geometry.seenTwiceY} width={width} height={geometry.seenTwiceH} fill={theme.seenTwice.color} />}

        {/* header marks — a tiny horizontal zigzag standing in for a line of heading text, drawn ON the plate itself */}
        {headers?.map((h, i) => (
          <polyline
            key={i}
            points={zigzagPoints(theme.header.widthPx, theme.header.heightPx / 2, theme.header.segments)}
            transform={`translate(${theme.header.offsetX}, ${h.y * height})`}
            fill="none"
            stroke={theme.header.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        ))}
      </g>

      {/* right-edge bulbs — painted longest-first so the shortest (exit) stays visible on top when they coincide */}
      {converted && <Bulb config={theme.bulbs.converted} y={exitY} plateHeight={height} plateWidth={width} side="right" label="converted" />}
      <Bulb config={theme.bulbs.deepestScroll} y={maxScrollY} plateHeight={height} plateWidth={width} side="right" label="deepest scroll" />
      <Bulb config={theme.bulbs.exit} y={exitY} plateHeight={height} plateWidth={width} side="right" label="exited" />

      {/* left-edge: entry never collides with the above, painted independently */}
      <Bulb config={theme.bulbs.enter} y={enterY} plateHeight={height} plateWidth={width} side="left" label="entered" />
    </g>
  );
}
