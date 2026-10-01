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

interface FormImitationGeometry {
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  color: string;
  stripes: { x: number; y: number; width: number; height: number }[];
}

/**
 * The form imitation — an inset box at the form's real measured position,
 * narrower than the plate (theme.formImitation.widthFraction) so the seen/
 * seen-twice bands stay visible on either side. Ceases to exist entirely
 * (returns null) whenever the form was never measured at all — no
 * form_engagement row reached 'viewed' on this page view, meaning the form
 * never crossed the 50%-visible threshold that triggers position capture.
 * Independent of `converted`: a form that was seen but never submitted
 * still has a real position worth showing.
 *
 * Field stripes: one per DISTINCT field ever focused (visit.formFieldCount —
 * a lower bound on the form's real field count, see PageVisitRaw's doc
 * comment), sized relative to the box's OWN height so however many there
 * are, they stay inside it — thickness shrinks as the count goes up
 * (boxHeight / count), clamped between theme.formImitation.min/
 * maxStripeThicknessPx so a form with only 1-2 focused fields never renders
 * a stripe so thick it reads as a filled block instead of a thin line.
 */
function computeFormImitationGeometry(visit: VisitGeometry, width: number, height: number, theme: FramePlateTheme): FormImitationGeometry | null {
  try {
    const { formTopFrac, formBottomFrac, formStatus, formFieldCount } = visit;
    if (formTopFrac == null || formBottomFrac == null) return null;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

    const fi = theme.formImitation;
    const boxWidth = width * fi.widthFraction;
    const boxX = (width - boxWidth) / 2;
    const boxY = Math.min(formTopFrac, formBottomFrac) * height;
    const boxHeight = Math.max(fi.minHeightPx, Math.abs(formBottomFrac - formTopFrac) * height);
    const color = formStatus === "submitted" ? fi.submittedColor : fi.color;

    const fieldCount = Math.max(0, Math.floor(formFieldCount ?? 0));
    const stripes: FormImitationGeometry["stripes"] = [];
    if (fieldCount > 0) {
      const slot = boxHeight / fieldCount;
      const thickness = Math.min(fi.maxStripeThicknessPx, Math.max(fi.minStripeThicknessPx, slot * 0.5));
      const stripeWidth = boxWidth * 0.8;
      const stripeX = boxX + (boxWidth - stripeWidth) / 2;
      for (let i = 0; i < fieldCount; i++) {
        const cy = boxY + i * slot + slot / 2;
        stripes.push({ x: stripeX, y: cy - thickness / 2, width: stripeWidth, height: thickness });
      }
    }

    return { boxX, boxY, boxWidth, boxHeight, color, stripes };
  } catch (err) {
    console.error(`[framePlate] form imitation geometry failed for visit "${visit?.id}":`, err);
    return null;
  }
}

function FormImitation({ visit, width, height, theme }: { visit: VisitGeometry; width: number; height: number; theme: FramePlateTheme }) {
  const geometry = computeFormImitationGeometry(visit, width, height, theme);
  if (geometry === null) return null;
  const fi = theme.formImitation;
  return (
    <g aria-label="form position">
      <rect x={geometry.boxX} y={geometry.boxY} width={geometry.boxWidth} height={geometry.boxHeight} rx={fi.cornerRadius} ry={fi.cornerRadius} fill={geometry.color} />
      {geometry.stripes.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} fill={fi.stripeColor} />
      ))}
    </g>
  );
}

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
    const { seenOnceTop, seenTwiceTop, seenBottom } = visit;
    // Both bands share the SAME bottom edge (seenBottom — the deepest point
    // reached, extended by one viewport height; see VisitGeometry.seenBottom).
    // This is what guarantees "seen" always has positive height, even for a
    // visitor who never scrolled at all.
    const seenOnceY = seenOnceTop * height;
    const seenOnceH = Math.max(0, (seenTwiceTop ?? seenBottom) * height - seenOnceY);
    const seenTwiceY = (seenTwiceTop ?? seenBottom) * height;
    const seenTwiceH = Math.max(0, seenBottom * height - seenTwiceY);
    return { seenOnceY, seenOnceH, seenTwiceY, seenTwiceH, hasSeenTwice: seenTwiceTop !== null };
  } catch (err) {
    console.error(`[framePlate] FullPagePlate geometry computation failed for visit "${props.visit?.id}":`, err);
    return null;
  }
}

/**
 * Per-plate "1vh" ruler marks — drawn on THIS plate only, at every multiple
 * of its own viewportFraction down its own height. Never a strip-wide line:
 * each plate has its own page-to-viewport ratio (a 1.25-screen page and a
 * 5-screen page in the same session have different vFrac), so a single line
 * across the whole strip can only ever be correct for one of them.
 */
function ViewportMarks({ vFrac, height, width, theme }: { vFrac: number; height: number; width: number; theme: FramePlateTheme }) {
  const ref = theme.referenceLine;
  if (!ref.enabled || !Number.isFinite(vFrac) || vFrac <= 0 || vFrac >= 1) return null; // vFrac >= 1 = page fits in one screen, nothing to mark

  const step = vFrac * height;
  if (!Number.isFinite(step) || step <= 1) return null;

  const count = ref.repeat ? Math.max(1, Math.floor(height / step)) : 1;
  const marks: number[] = [];
  for (let i = 1; i <= count; i++) {
    const y = i * step;
    if (y >= height - 0.5) break; // a mark exactly on the bottom edge is just the edge
    marks.push(y);
  }
  if (marks.length === 0) return null;

  return (
    <g pointerEvents="none">
      {marks.map((y, i) => (
        <line key={i} x1={0} y1={y} x2={width} y2={y} stroke={ref.color} strokeWidth={ref.thickness} strokeDasharray={ref.dashArray} />
      ))}
    </g>
  );
}

export function FullPagePlate(props: FullPagePlateProps) {
  const clipId = React.useId().replace(/[:]/g, "");
  const geometry = computePlateGeometry(props);
  const { width, height, theme, visit } = props;

  // TEMP DEBUG — remove once the page-height investigation is done.
  console.log(
    `[JH DEBUG][FullPagePlate render] ${visit?.pagePath} (id=${visit?.id}): ` +
      `RENDERED plate height=${height}px, pxToVisualRatio=${theme.plate.pxToVisualRatio}, ` +
      `visit.pageHeightPx=${visit?.pageHeightPx} (=> expected height ${((visit?.pageHeightPx ?? 0) * theme.plate.pxToVisualRatio).toFixed(1)}px before clamping to [${theme.plate.minHeight}, ${theme.plate.maxHeight}]), ` +
      `viewportFraction=${visit?.viewportFraction?.toFixed(4)} (=> 1vh mark spacing on this plate should be ${((visit?.viewportFraction ?? 0) * height).toFixed(1)}px, plate should show ${(1 / (visit?.viewportFraction || 1)).toFixed(2)} marks' worth)`
  );

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

  const { enterY, exitY, seenBottom, viewportFraction: vFrac, converted, headers, formTopFrac, formBottomFrac } = visit;
  // The form imitation renders whenever the form was ever measured at all
  // (view detection needs no interaction — see FormImitation's doc comment
  // above), independent of whether this particular visit converted. The
  // old single-point bulb is now only ever a fallback for a conversion
  // recorded before form_engagement position tracking existed at all.
  const hasFormSpan = formTopFrac != null && formBottomFrac != null;

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

        <ViewportMarks vFrac={vFrac} height={height} width={width} theme={theme} />

        {/* form imitation — inset, narrower than the plate, so seen/seen-twice
            stay visible either side of it; see FormImitation's doc comment. */}
        {hasFormSpan && <FormImitation visit={visit} width={width} height={height} theme={theme} />}
      </g>

      {/* right-edge bulbs — painted longest-first so the shortest (exit) stays visible on top when they coincide.
          The old single-point converted bulb only ever appears now as a
          fallback for a conversion recorded before form position tracking
          existed — see hasFormSpan above. */}
      {!hasFormSpan && converted && <Bulb config={theme.bulbs.converted} y={exitY} plateHeight={height} plateWidth={width} side="right" label="converted" />}
      <Bulb config={theme.bulbs.deepestScroll} y={seenBottom} plateHeight={height} plateWidth={width} side="right" label="deepest scroll" />
      <Bulb config={theme.bulbs.exit} y={exitY} plateHeight={height} plateWidth={width} side="right" label="exited" />

      {/* left-edge: entry never collides with the above, painted independently */}
      <Bulb config={theme.bulbs.enter} y={enterY} plateHeight={height} plateWidth={width} side="left" label="entered" />
    </g>
  );
}
