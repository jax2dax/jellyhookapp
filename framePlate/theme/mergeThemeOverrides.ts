// framePlate/theme/mergeThemeOverrides.ts
//
// Combines two DeepPartial<FramePlateTheme> objects — used to layer a
// device preset (desktopPlate/mobilePlate) under the caller's own explicit
// `theme` prop, so the caller's values always win on any field they've
// actually set, while everything they didn't touch still gets the device
// preset. Recurses into plain nested objects (there are no arrays in
// FramePlateTheme, so this doesn't need to handle that case).
export function mergeDeepPartial<T extends object>(base: T | undefined, override: T | undefined): T | undefined {
  if (!base) return override;
  if (!override) return base;

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(override)) {
    const overrideVal = (override as Record<string, unknown>)[key];
    const baseVal = (base as Record<string, unknown>)[key];
    const bothPlainObjects = isPlainObject(overrideVal) && isPlainObject(baseVal);
    result[key] = bothPlainObjects ? mergeDeepPartial(baseVal as object, overrideVal as object) : overrideVal;
  }
  return result as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
