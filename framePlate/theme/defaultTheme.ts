// framePlate/theme/defaultTheme.ts
// The out-of-the-box look — tuned in the /dev/frame-plate playground.
//
// Colors that need to track light/dark mode reference dedicated CSS custom
// properties (--fp-*, declared in app/globals.css under :root and .dark)
// with a literal fallback for the case those variables aren't defined at
// all — e.g. if this module gets dropped into a different project. Editing
// globals.css is enough to restyle the chart; nothing here needs to change.
// Every value is still a plain override target — this file is a starting
// point, not a contract.
import type { FramePlateTheme, DeepPartial } from "../types";

export const defaultTheme: FramePlateTheme = {
  canvasBackground: "var(--fp-canvas, #0a0a0a)",
  plate: {
    width: 70,
    minHeight: 35,
    maxHeight: 300,
    pxToVisualRatio: 0.09,
    cornerRadius: 2,
    baseColor: "var(--fp-plate, #111111)",
    borderColor: "var(--fp-plate-border, #3a3a3a)",
    borderWidth: 1.5,
  },
  seenOnce: { color: "#4ade80" },
  seenTwice: { color: "#0f3d1c" },
  // A tiny horizontal zigzag standing in for "there's a heading here",
  // drawn ON the plate (inset from its left edge) — not another bulb shape.
  header: { color: "var(--fp-text-muted, #9a9a9a)", heightPx: 3, widthPx: 16, segments: 4, offsetX: 8 },
  frame: {
    height: 340,
    minWidth: 72,
    typicalWidth: 160,
    maxWidth: 340,
    padding: 14,
    gap: 10,
    // Per framePlate/assets/bulbs-explained.png: session entered (green),
    // exited normally (neutral gray — the one outcome color that needs to
    // flip with light/dark since it's meant to recede, not stand out),
    // converted/form filled (yellow), session expired (red), exited site
    // and came back (purple, on the "away" gap frames).
    backgroundByOutcome: {
      active: "#3f5f3f",
      exitedNormally: "var(--fp-frame-exited, #1c1c1c)",
      converted: "#a6821b",
      expired: "#6b2f2f",
      away: "#5a4080",
      // The session hasn't closed yet — the visitor may be on this exact
      // page right now. Blue-cyan, distinct from every "this is over" color
      // above. Fixed hex like the other outcomes, not --fp-* linked: it's a
      // semantic signal that should read the same in light or dark mode.
      live: "#0e7490",
    },
    pathLabelHeight: 20,
    pathLabelColor: "var(--fp-text-muted, #bdbdbd)",
    pathLabelFontSize: 11,
  },
  ribbon: {
    enabled: true,
    color: "var(--fp-ribbon, #c9c9c9)",
    thickness: 3,
    tickHeight: 16,
    labelColor: "var(--fp-text, #e6e6e6)",
    labelFontSize: 13,
    gap: 14,
  },
  bulbs: {
    // `thickness` (vertical, along the edge) is the SAME for every bulb —
    // only `length` (horizontal protrusion) differs, so stacked bulbs read
    // as bars of increasing reach rather than a diamond of shifting height.
    // Bulb colors are deliberately fixed hex, not theme-linked — they're
    // semantic (enter/exit/deepest/converted) and should read the same
    // regardless of light or dark mode.
    enter: { shape: "pill", length: 7, thickness: 3, color: "#22c55e", zIndex: 1 },
    exit: { shape: "pill", length: 9, thickness: 3, color: "#ef4444", zIndex: 3 },
    deepestScroll: { shape: "pill", length: 15, thickness: 3, color: "#3b82f6", zIndex: 2 },
    converted: { shape: "pill", length: 22, thickness: 3, color: "#eab308", zIndex: 0 },
  },
  hover: {
    darkenOpacity: 0.35,
  },
  referenceLine: {
    enabled: true,
    color: "var(--fp-text, #e6e6e6)",
    dashArray: "5,4",
    thickness: 1,
    // Every viewport boundary down the plate, not just the first — it reads
    // as a ruler, making "this page is about three screens long" legible
    // without measuring anything.
    repeat: true,
    labelColor: "var(--fp-text, #e6e6e6)",
    labelFontSize: 10,
  },
};

// ── Manual light/dark overlays ──────────────────────────────────────────────
// defaultTheme above already tracks light/dark automatically via --fp-*
// CSS variables (see app/globals.css), so most consumers of THIS app never
// need these. They exist for embedding framePlate somewhere that doesn't
// define those variables — apply on top of defaultTheme via a merge, e.g.
// <FramePlateChart theme={{ ...myOverrides, ...darkPlate }} />.
export const lightPlate: DeepPartial<FramePlateTheme> = {
  canvasBackground: "#f5f5f5",
  plate: { baseColor: "#f5f5f5", borderColor: "#c18b8b" },
};

export const darkPlate: DeepPartial<FramePlateTheme> = {
  canvasBackground: "#0a0a0a",
  plate: { baseColor: "#111111", borderColor: "#3a3a3a" },
};
