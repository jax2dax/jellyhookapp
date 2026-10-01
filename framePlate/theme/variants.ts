// framePlate/theme/variants.ts
// Alternate chart varieties — orthogonal to the device presets in
// deviceThemes.ts (those are about which device a visit happened on;
// these are about how to lay the chart out regardless of device). Spread
// into the `theme` prop like any other override; never applied by default.
import type { DeepPartial, FramePlateTheme } from "../types";

/**
 * Every frame in a render shares one height sized to the tallest plate
 * actually being drawn (+ a little padding), instead of the fixed default —
 * capped at that same default, so it only ever shrinks, never grows past
 * it. Built for views that are reliably short, single-page sessions (e.g.
 * a truncated start-of-session → conversion chart), where the fixed
 * height otherwise leaves a large empty gap below every plate. See
 * FramePlateTheme.frame.dynamicHeight's doc comment for exactly how the
 * height is computed.
 */
export const compactFrameHeight: DeepPartial<FramePlateTheme> = {
  frame: { dynamicHeight: true, dynamicHeightPadding: 8 },
};
