// framePlate/geometry/scaleFrameWidths.ts
//
// Pure function: durations (ms) → pixel widths. Deliberately an ABSOLUTE
// scale — never normalized against container width or frame count. Two
// pages should not stretch to fill a wide viewport just because there's
// room; the strip's total width is purely a function of the durations
// themselves, and the container scrolls if that total exceeds its width.
//
// Algorithm: median-relative with a compressed tail.
//   - durations at/below the session's median map linearly into
//     [minWidth, typicalWidth] — so a cluster of similar-duration pages
//     (e.g. nine 5-10s visits) all land close to typicalWidth, not spread
//     across the full range.
//   - durations above the median compress toward maxWidth via a log curve,
//     so one 5-minute outlier grows visibly without dwarfing the rest or
//     forcing them down to the minimum.
import type { FramePlateTheme } from "../types";

export interface FrameWidthConfig {
  minWidth: number;
  typicalWidth: number;
  maxWidth: number;
}

export function scaleFrameWidths(durationsMs: number[], config: FrameWidthConfig): number[] {
  const { minWidth, typicalWidth, maxWidth } = config;

  try {
    if (!Array.isArray(durationsMs) || durationsMs.length === 0) return [];

    const safeDurations = durationsMs.map((d) => (Number.isFinite(d) && d >= 0 ? d : 0));
    const sorted = [...safeDurations].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    // No meaningful spread (e.g. every duration is 0) — everything gets the typical width.
    if (median <= 0) {
      return safeDurations.map(() => typicalWidth);
    }

    return safeDurations.map((d) => {
      const ratio = d / median;

      if (ratio <= 1) {
        return minWidth + (typicalWidth - minWidth) * ratio;
      }

      // log-compressed approach to maxWidth: ratio=2 → ~40% of the way,
      // ratio=10 → ~70%, ratio=60 → ~80%. Always < 1, so never reaches
      // maxWidth exactly but gets asymptotically close for extreme outliers.
      const compressed = 1 - 1 / (1 + Math.log(ratio));
      return typicalWidth + (maxWidth - typicalWidth) * compressed;
    });
  } catch (err) {
    console.error("[framePlate] scaleFrameWidths failed — falling back to typicalWidth for every frame.", err);
    return durationsMs.map(() => config.typicalWidth);
  }
}

export function frameWidthConfigFromTheme(theme: FramePlateTheme): FrameWidthConfig {
  return { minWidth: theme.frame.minWidth, typicalWidth: theme.frame.typicalWidth, maxWidth: theme.frame.maxWidth };
}
