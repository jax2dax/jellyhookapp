// framePlate/theme/deviceThemes.ts
//
// Device-aware presets — applied automatically by FramePlateChart when a
// `deviceType` prop is passed (typically visitors.device_type from the real
// data), before the caller's own `theme` override (which always wins on
// conflicts). Unknown/omitted device type means defaultTheme's own values
// are used untouched — nothing here is a hard requirement.
import type { DeepPartial, DeviceType, FramePlateTheme } from "../types";

// Only the corner radius and the header-zigzag tuning differ between
// devices in practice — desktop plates read as sharp-edged windows, mobile
// plates get a rounder corner to read as a phone screen, and the zigzag's
// span/segment count is retuned slightly narrower/denser for mobile's
// typically narrower content column.
export const desktopPlate: DeepPartial<FramePlateTheme> = {
  plate: { cornerRadius: 2 },
  header: { widthPx: 16, segments: 4, offsetX: 8 },
};

export const mobilePlate: DeepPartial<FramePlateTheme> = {
  plate: { cornerRadius: 9 },
  header: { widthPx: 20, segments: 7, offsetX: 7 },
};

// Compact variant for small "advertisement" previews of the chart (e.g. a
// shortcut card on the dashboard overview) — not a device preset, applied by
// the caller explicitly on top of whatever device preset already merged in.
// Shrinks every size-related knob so a whole session fits in a small card;
// the duration ribbon is turned off entirely (see ribbon.enabled) and the
// "1vh" marks are hidden by the caller passing viewportHeightPx={0} to
// FramePlateChart — that's a separate, existing opt-out (see
// resolveViewportHeightPx), not something this preset controls.
export const miniPlate: DeepPartial<FramePlateTheme> = {
  plate: { width: 40, minHeight: 22, maxHeight: 84, pxToVisualRatio: 0.035, cornerRadius: 1, borderWidth: 1 },
  frame: { height: 100, minWidth: 46, typicalWidth: 62, maxWidth: 110, padding: 6, gap: 5, pathLabelHeight: 12, pathLabelFontSize: 8 },
  header: { heightPx: 2, widthPx: 8, segments: 3, offsetX: 3 },
  ribbon: { enabled: false },
  bulbs: {
    enter: { length: 4, thickness: 2 },
    exit: { length: 5, thickness: 2 },
    deepestScroll: { length: 8, thickness: 2 },
    converted: { length: 12, thickness: 2 },
  },
};

/** Returns the plate preset for a device type, or undefined for unknown/other — caller falls back to defaultTheme as-is. */
export function plateForDevice(deviceType: DeviceType | string | null | undefined): DeepPartial<FramePlateTheme> | undefined {
  if (deviceType === "mobile" || deviceType === "tablet") return mobilePlate;
  if (deviceType === "desktop") return desktopPlate;
  return undefined;
}

// Typical viewport heights (px) — used to auto-resolve the "1vh" reference
// line so it's never a single fixed number regardless of who's looking at
// the chart. Rough real-world medians; override with an explicit
// viewportHeightPx prop if you have the visitor's actual value.
const DEVICE_VIEWPORT_HEIGHT_PX: Record<DeviceType, number> = {
  desktop: 900,
  mobile: 700,
  tablet: 1024,
};

/**
 * Resolves the effective 1vh reference height. `explicit === 0` is a
 * deliberate opt-out (draws no line at all) — anything else explicit wins
 * outright; omitting it (undefined) auto-resolves from device type, with
 * desktop's value as the final fallback for unknown/missing device type.
 */
export function resolveViewportHeightPx(explicit: number | undefined, deviceType: DeviceType | string | null | undefined): number {
  if (explicit === 0) return 0;
  if (Number.isFinite(explicit) && (explicit as number) > 0) return explicit as number;
  if (deviceType === "mobile") return DEVICE_VIEWPORT_HEIGHT_PX.mobile;
  if (deviceType === "tablet") return DEVICE_VIEWPORT_HEIGHT_PX.tablet;
  return DEVICE_VIEWPORT_HEIGHT_PX.desktop;
}
