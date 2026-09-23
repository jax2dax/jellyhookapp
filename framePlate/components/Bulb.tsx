// framePlate/components/Bulb.tsx
//
// One trigger-point marker (enter/exit/deepestScroll/converted), drawn as a
// short horizontal bar protruding from the plate's left or right edge at a
// given y fraction. `length` (how far it reaches away from the edge) is
// what should differ between bulb types; `thickness` (its extent along the
// edge) stays the same for every type — so when exit/deepestScroll/
// converted land at the same y, they read as bars of increasing reach
// poking out past each other, not a stack of differently-tall shapes.
//
// All fallible computation happens in computeBulbGeometry() below, which
// returns null on failure — the component itself never wraps JSX in
// try/catch (React only executes child render lazily, so a try/catch around
// JSX here would not actually catch a real render failure; only the
// top-level FramePlateErrorBoundary does that reliably).
"use client";

import * as React from "react";
import type { BulbShapeConfig } from "../types";

export interface BulbProps {
  config: BulbShapeConfig;
  /** fraction of plate height, 0 = top */
  y: number;
  plateHeight: number;
  plateWidth: number;
  side: "left" | "right";
  label?: string;
}

type BulbGeometry =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "diamond"; points: string }
  | { kind: "custom"; x: number; y: number; scaleX: number; scaleY: number; path: string }
  | { kind: "pill"; x: number; y: number; width: number; height: number; r: number };

function computeBulbGeometry(props: BulbProps): BulbGeometry | null {
  try {
    const { config, y, plateHeight, plateWidth, side } = props;
    const cy = y * plateHeight;
    const edgeX = side === "left" ? 0 : plateWidth;
    const dir = side === "left" ? -1 : 1;
    const { length, thickness, shape } = config;

    if (!Number.isFinite(cy) || !Number.isFinite(edgeX) || !Number.isFinite(length) || !Number.isFinite(thickness)) {
      console.error("[framePlate] Bulb given non-finite geometry input, skipping render.", { y, plateHeight, plateWidth, length, thickness });
      return null;
    }

    if (shape === "circle") {
      return { kind: "circle", cx: edgeX + (dir * Math.min(length, thickness)) / 2, cy, r: Math.max(1, Math.min(length, thickness) / 2) };
    }

    if (shape === "diamond") {
      const cx = edgeX + (dir * length) / 2;
      const halfL = length / 2;
      const halfT = thickness / 2;
      const points = [
        [cx, cy - halfT],
        [cx + dir * halfL, cy],
        [cx, cy + halfT],
        [cx - dir * halfL, cy],
      ]
        .map((p) => p.join(","))
        .join(" ");
      return { kind: "diamond", points };
    }

    if (shape === "custom") {
      if (!config.path) {
        console.error(`[framePlate] Bulb shape is "custom" but no path was provided — rendering fallback dot.`);
        return { kind: "circle", cx: edgeX, cy, r: 4 };
      }
      const x = side === "left" ? edgeX - length : edgeX;
      return { kind: "custom", x, y: cy - thickness / 2, scaleX: length, scaleY: thickness, path: config.path };
    }

    // default: "pill" — a horizontal bar, rounded on its two short (outer) ends
    const x = side === "left" ? edgeX - length : edgeX;
    const r = thickness / 2;
    return { kind: "pill", x, y: cy - thickness / 2, width: length, height: thickness, r };
  } catch (err) {
    console.error("[framePlate] Bulb geometry computation failed:", err);
    return null;
  }
}

export function Bulb(props: BulbProps) {
  const geometry = computeBulbGeometry(props);
  if (geometry === null) return null;

  const { config, label } = props;
  const color = config.color;

  if (geometry.kind === "circle") {
    return <circle cx={geometry.cx} cy={geometry.cy} r={geometry.r} fill={color} aria-label={label} />;
  }
  if (geometry.kind === "diamond") {
    return <polygon points={geometry.points} fill={color} aria-label={label} />;
  }
  if (geometry.kind === "custom") {
    return (
      <g transform={`translate(${geometry.x}, ${geometry.y}) scale(${geometry.scaleX}, ${geometry.scaleY}) translate(0.5, 0.5)`}>
        <path d={geometry.path} fill={color} />
      </g>
    );
  }
  return <rect x={geometry.x} y={geometry.y} width={geometry.width} height={geometry.height} rx={geometry.r} ry={geometry.r} fill={color} aria-label={label} />;
}
