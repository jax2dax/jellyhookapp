// framePlate/components/FramePlateChart.tsx
//
// Public entry point. Resolves the device-based plate preset and viewport
// height (if `deviceType` is given), merges the caller's own `theme`
// override on top (which always wins), validates the result, builds the
// timeline (deriving geometry + inserting away-gaps + applying the
// domainEnd cutoff + marking a still-open session's last frame "live"),
// and renders the strip inside an error boundary. This is the only export
// most consumers need — everything else in framePlate/ is composable if you
// want to build a differently-shaped variant from the same primitives.
"use client";

import * as React from "react";
import { SessionStrip } from "./SessionStrip";
import { FramePlateErrorBoundary } from "./FramePlateErrorBoundary";
import { buildTimeline } from "../geometry/buildTimeline";
import { validateTheme } from "../theme/validateTheme";
import { plateForDevice, resolveViewportHeightPx } from "../theme/deviceThemes";
import { mergeDeepPartial } from "../theme/mergeThemeOverrides";
import type { DeepPartial, FramePlateChartProps, FramePlateTheme } from "../types";

export function FramePlateChart({ session, theme: themeOverride, domainEnd, minGapMs, hoverDelayMs, viewportHeightPx, deviceType, onHoverItem, className }: FramePlateChartProps) {
  const { theme: validatedTheme } = React.useMemo(() => {
    const devicePreset = plateForDevice(deviceType);
    const combined = mergeDeepPartial<DeepPartial<FramePlateTheme>>(devicePreset, themeOverride);
    return validateTheme(combined);
  }, [themeOverride, deviceType]);

  // effectiveViewportHeightPx drives whether the per-plate "1vh" marks are
  // drawn — 0 is a deliberate opt-out (see resolveViewportHeightPx).
  // fallbackViewportHeightPx drives the actual seen-region MATH for any
  // visit with no measured viewport of its own, and must never be 0 even
  // when the caller turned the marks off — those are separate concerns;
  // turning off the visual marks must never make "seen" collapse back to
  // unconverted raw scroll points.
  const effectiveViewportHeightPx = React.useMemo(() => resolveViewportHeightPx(viewportHeightPx, deviceType), [viewportHeightPx, deviceType]);
  const fallbackViewportHeightPx = React.useMemo(
    () => (effectiveViewportHeightPx > 0 ? effectiveViewportHeightPx : resolveViewportHeightPx(undefined, deviceType)),
    [effectiveViewportHeightPx, deviceType]
  );

  const theme = React.useMemo<FramePlateTheme>(
    () => ({ ...validatedTheme, referenceLine: { ...validatedTheme.referenceLine, enabled: validatedTheme.referenceLine.enabled && effectiveViewportHeightPx > 0 } }),
    [validatedTheme, effectiveViewportHeightPx]
  );

  const timeline = React.useMemo(
    () => buildTimeline(session, domainEnd, minGapMs, fallbackViewportHeightPx),
    [session, domainEnd, minGapMs, fallbackViewportHeightPx]
  );

  return (
    <FramePlateErrorBoundary>
      <SessionStrip timeline={timeline} theme={theme} hoverDelayMs={hoverDelayMs} onHoverItem={onHoverItem} className={className} />
    </FramePlateErrorBoundary>
  );
}
