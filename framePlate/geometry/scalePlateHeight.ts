// framePlate/geometry/scalePlateHeight.ts
//
// Pure function: a page's actual height (px) → the full-page-plate's
// rendered height. Deliberately ABSOLUTE — a given real page height always
// renders the same plate height everywhere it appears, never scaled
// relative to the tallest page in the current session (same principle as
// scaleFrameWidths never scaling relative to container width). Clamped to
// [minHeight, maxHeight] so a very short page never collapses to nothing
// and a very tall one never blows past the strip.
export interface PlateHeightConfig {
  minHeight: number;
  maxHeight: number;
  pxToVisualRatio: number;
}

export function scalePlateHeights(pageHeightsPx: number[], config: PlateHeightConfig): number[] {
  const { minHeight, maxHeight, pxToVisualRatio } = config;

  try {
    if (!Array.isArray(pageHeightsPx)) return [];

    return pageHeightsPx.map((h) => {
      const safeHeight = Number.isFinite(h) && h > 0 ? h : 0;
      const visual = safeHeight * pxToVisualRatio;
      return Math.max(minHeight, Math.min(maxHeight, visual || minHeight));
    });
  } catch (err) {
    console.error("[framePlate] scalePlateHeights failed — falling back to minHeight for every plate.", err);
    return pageHeightsPx.map(() => config.minHeight);
  }
}
