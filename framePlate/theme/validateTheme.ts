// framePlate/theme/validateTheme.ts
//
// Merges a user-supplied partial theme onto defaultTheme, validating every
// leaf value. A bad value NEVER crashes the chart and NEVER silently renders
// garbage — it's replaced with the default and logged clearly via
// console.warn (recoverable) or console.error (dropped an entire config
// object, e.g. an invalid custom bulb shape). This is the single place
// "UI errors are bad" gets enforced for theming.
import { defaultTheme } from "./defaultTheme";
import type { BulbShapeConfig, BulbType, DeepPartial, FrameOutcome, FramePlateTheme } from "../types";

const FRAME_OUTCOMES: FrameOutcome[] = ["active", "exitedNormally", "converted", "expired", "away", "live"];
const BULB_SHAPES = ["pill", "circle", "diamond", "custom"] as const;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isPositiveNumber(v: unknown): v is number {
  return isFiniteNumber(v) && v > 0;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Picks `override` if it passes `check`, otherwise keeps `fallback` and
 * records a warning naming exactly which field was invalid and why.
 */
function pick<T>(path: string, override: unknown, fallback: T, check: (v: unknown) => v is T, warnings: string[]): T {
  if (override === undefined) return fallback;
  if (check(override)) return override;
  warnings.push(`[framePlate/theme] "${path}" is invalid (got ${JSON.stringify(override)}) — using default.`);
  return fallback;
}

function validateBulb(type: BulbType, override: DeepPartial<BulbShapeConfig> | undefined, fallback: BulbShapeConfig, warnings: string[]): BulbShapeConfig {
  if (override === undefined) return fallback;
  if (typeof override !== "object" || override === null) {
    warnings.push(`[framePlate/theme] bulbs.${type} is invalid (expected an object) — using default.`);
    return fallback;
  }

  const shape = pick(
    `bulbs.${type}.shape`,
    override.shape,
    fallback.shape,
    (v): v is BulbShapeConfig["shape"] => typeof v === "string" && (BULB_SHAPES as readonly string[]).includes(v),
    warnings
  );

  let path = fallback.path;
  if (shape === "custom") {
    if (isNonEmptyString(override.path)) {
      path = override.path;
    } else {
      warnings.push(`[framePlate/theme] bulbs.${type}.shape is "custom" but "path" is missing/invalid — falling back to "pill".`);
      return { ...fallback, shape: "pill" };
    }
  }

  return {
    shape,
    path,
    length: pick(`bulbs.${type}.length`, override.length, fallback.length, isPositiveNumber, warnings),
    thickness: pick(`bulbs.${type}.thickness`, override.thickness, fallback.thickness, isPositiveNumber, warnings),
    color: pick(`bulbs.${type}.color`, override.color, fallback.color, isNonEmptyString, warnings),
    zIndex: pick(`bulbs.${type}.zIndex`, override.zIndex, fallback.zIndex, isFiniteNumber, warnings),
  };
}

export function validateTheme(userTheme?: DeepPartial<FramePlateTheme>): { theme: FramePlateTheme; warnings: string[] } {
  const warnings: string[] = [];

  try {
    if (userTheme === undefined) {
      return { theme: defaultTheme, warnings };
    }
    if (typeof userTheme !== "object" || userTheme === null) {
      warnings.push(`[framePlate/theme] theme override must be an object — ignoring entirely and using defaults.`);
      return { theme: defaultTheme, warnings };
    }

    const t = userTheme;

    const canvasBackground = pick("canvasBackground", t.canvasBackground, defaultTheme.canvasBackground, isNonEmptyString, warnings);

    const plate = {
      width: pick("plate.width", t.plate?.width, defaultTheme.plate.width, isPositiveNumber, warnings),
      minHeight: pick("plate.minHeight", t.plate?.minHeight, defaultTheme.plate.minHeight, isPositiveNumber, warnings),
      maxHeight: pick("plate.maxHeight", t.plate?.maxHeight, defaultTheme.plate.maxHeight, isPositiveNumber, warnings),
      pxToVisualRatio: pick("plate.pxToVisualRatio", t.plate?.pxToVisualRatio, defaultTheme.plate.pxToVisualRatio, isPositiveNumber, warnings),
      cornerRadius: pick("plate.cornerRadius", t.plate?.cornerRadius, defaultTheme.plate.cornerRadius, isFiniteNumber, warnings),
      baseColor: pick("plate.baseColor", t.plate?.baseColor, defaultTheme.plate.baseColor, isNonEmptyString, warnings),
      borderColor: pick("plate.borderColor", t.plate?.borderColor, defaultTheme.plate.borderColor, isNonEmptyString, warnings),
      borderWidth: pick("plate.borderWidth", t.plate?.borderWidth, defaultTheme.plate.borderWidth, isFiniteNumber, warnings),
    };
    if (plate.minHeight > plate.maxHeight) {
      warnings.push(`[framePlate/theme] plate.minHeight (${plate.minHeight}) > plate.maxHeight (${plate.maxHeight}) — swapping them.`);
      [plate.minHeight, plate.maxHeight] = [plate.maxHeight, plate.minHeight];
    }

    const seenOnce = { color: pick("seenOnce.color", t.seenOnce?.color, defaultTheme.seenOnce.color, isNonEmptyString, warnings) };
    const seenTwice = { color: pick("seenTwice.color", t.seenTwice?.color, defaultTheme.seenTwice.color, isNonEmptyString, warnings) };
    const header = {
      color: pick("header.color", t.header?.color, defaultTheme.header.color, isNonEmptyString, warnings),
      heightPx: pick("header.heightPx", t.header?.heightPx, defaultTheme.header.heightPx, isPositiveNumber, warnings),
      widthPx: pick("header.widthPx", t.header?.widthPx, defaultTheme.header.widthPx, isPositiveNumber, warnings),
      segments: pick("header.segments", t.header?.segments, defaultTheme.header.segments, isPositiveNumber, warnings),
      offsetX: pick("header.offsetX", t.header?.offsetX, defaultTheme.header.offsetX, isFiniteNumber, warnings),
    };

    const backgroundByOutcome = { ...defaultTheme.frame.backgroundByOutcome };
    if (t.frame?.backgroundByOutcome && typeof t.frame.backgroundByOutcome === "object") {
      for (const outcome of FRAME_OUTCOMES) {
        const v = (t.frame.backgroundByOutcome as Partial<Record<FrameOutcome, unknown>>)[outcome];
        if (v !== undefined) {
          backgroundByOutcome[outcome] = pick(`frame.backgroundByOutcome.${outcome}`, v, defaultTheme.frame.backgroundByOutcome[outcome], isNonEmptyString, warnings);
        }
      }
    }

    const frame = {
      height: pick("frame.height", t.frame?.height, defaultTheme.frame.height, isPositiveNumber, warnings),
      minWidth: pick("frame.minWidth", t.frame?.minWidth, defaultTheme.frame.minWidth, isPositiveNumber, warnings),
      typicalWidth: pick("frame.typicalWidth", t.frame?.typicalWidth, defaultTheme.frame.typicalWidth, isPositiveNumber, warnings),
      maxWidth: pick("frame.maxWidth", t.frame?.maxWidth, defaultTheme.frame.maxWidth, isPositiveNumber, warnings),
      padding: pick("frame.padding", t.frame?.padding, defaultTheme.frame.padding, isFiniteNumber, warnings),
      gap: pick("frame.gap", t.frame?.gap, defaultTheme.frame.gap, isFiniteNumber, warnings),
      backgroundByOutcome,
      pathLabelHeight: pick("frame.pathLabelHeight", t.frame?.pathLabelHeight, defaultTheme.frame.pathLabelHeight, isPositiveNumber, warnings),
      pathLabelColor: pick("frame.pathLabelColor", t.frame?.pathLabelColor, defaultTheme.frame.pathLabelColor, isNonEmptyString, warnings),
      pathLabelFontSize: pick("frame.pathLabelFontSize", t.frame?.pathLabelFontSize, defaultTheme.frame.pathLabelFontSize, isPositiveNumber, warnings),
    };
    if (!(frame.minWidth <= frame.typicalWidth && frame.typicalWidth <= frame.maxWidth)) {
      warnings.push(
        `[framePlate/theme] frame widths must satisfy minWidth <= typicalWidth <= maxWidth (got ${frame.minWidth}, ${frame.typicalWidth}, ${frame.maxWidth}) — resetting to defaults.`
      );
      frame.minWidth = defaultTheme.frame.minWidth;
      frame.typicalWidth = defaultTheme.frame.typicalWidth;
      frame.maxWidth = defaultTheme.frame.maxWidth;
    }

    const ribbon = {
      enabled: typeof t.ribbon?.enabled === "boolean" ? t.ribbon.enabled : defaultTheme.ribbon.enabled,
      color: pick("ribbon.color", t.ribbon?.color, defaultTheme.ribbon.color, isNonEmptyString, warnings),
      thickness: pick("ribbon.thickness", t.ribbon?.thickness, defaultTheme.ribbon.thickness, isPositiveNumber, warnings),
      tickHeight: pick("ribbon.tickHeight", t.ribbon?.tickHeight, defaultTheme.ribbon.tickHeight, isPositiveNumber, warnings),
      labelColor: pick("ribbon.labelColor", t.ribbon?.labelColor, defaultTheme.ribbon.labelColor, isNonEmptyString, warnings),
      labelFontSize: pick("ribbon.labelFontSize", t.ribbon?.labelFontSize, defaultTheme.ribbon.labelFontSize, isPositiveNumber, warnings),
      gap: pick("ribbon.gap", t.ribbon?.gap, defaultTheme.ribbon.gap, isFiniteNumber, warnings),
    };

    const bulbs = {
      enter: validateBulb("enter", t.bulbs?.enter, defaultTheme.bulbs.enter, warnings),
      exit: validateBulb("exit", t.bulbs?.exit, defaultTheme.bulbs.exit, warnings),
      deepestScroll: validateBulb("deepestScroll", t.bulbs?.deepestScroll, defaultTheme.bulbs.deepestScroll, warnings),
      converted: validateBulb("converted", t.bulbs?.converted, defaultTheme.bulbs.converted, warnings),
    };

    const hover = {
      darkenOpacity: pick("hover.darkenOpacity", t.hover?.darkenOpacity, defaultTheme.hover.darkenOpacity, (v): v is number => isFiniteNumber(v) && v >= 0 && v <= 1, warnings),
    };

    const referenceLine = {
      enabled: typeof t.referenceLine?.enabled === "boolean" ? t.referenceLine.enabled : defaultTheme.referenceLine.enabled,
      repeat: typeof t.referenceLine?.repeat === "boolean" ? t.referenceLine.repeat : defaultTheme.referenceLine.repeat,
      color: pick("referenceLine.color", t.referenceLine?.color, defaultTheme.referenceLine.color, isNonEmptyString, warnings),
      dashArray: pick("referenceLine.dashArray", t.referenceLine?.dashArray, defaultTheme.referenceLine.dashArray, isNonEmptyString, warnings),
      thickness: pick("referenceLine.thickness", t.referenceLine?.thickness, defaultTheme.referenceLine.thickness, isPositiveNumber, warnings),
      labelColor: pick("referenceLine.labelColor", t.referenceLine?.labelColor, defaultTheme.referenceLine.labelColor, isNonEmptyString, warnings),
      labelFontSize: pick("referenceLine.labelFontSize", t.referenceLine?.labelFontSize, defaultTheme.referenceLine.labelFontSize, isPositiveNumber, warnings),
    };

    const theme: FramePlateTheme = { canvasBackground, plate, seenOnce, seenTwice, header, frame, ribbon, bulbs, hover, referenceLine };

    if (warnings.length > 0) {
      console.warn(`[framePlate] theme validation found ${warnings.length} issue(s):`, warnings);
    }

    return { theme, warnings };
  } catch (err) {
    console.error("[framePlate] theme validation crashed unexpectedly — falling back to the default theme entirely.", err);
    return { theme: defaultTheme, warnings: [`Theme validation threw: ${(err as Error)?.message ?? err}`] };
  }
}
