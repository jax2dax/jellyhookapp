// components/LocalDate.tsx
//
// Renders an ISO date/datetime string in the VIEWER's browser timezone, via
// lib/leadFormat.js's formatDate/formatDateTime. Those helpers call plain
// toLocaleDateString/toLocaleString with no explicit timeZone, so whichever
// runtime executes them determines the timezone shown — correct once
// running in the browser, but Next still server-renders "use client"
// components once for the initial HTML. A naive "use client" wrapper would
// therefore show the SERVER's timezone (Vercel, effectively UTC) for the
// first paint, then silently "correct" itself on hydration with a console
// warning about mismatched content.
//
// dynamic(..., { ssr: false }) — same pattern as components/RandomIconBadge.tsx
// — skips that server render pass entirely, so this only ever renders in
// the browser and is never wrong, at the cost of the text popping in
// slightly after first paint instead of being present in the initial HTML.
"use client";

import dynamicImport from "next/dynamic";
import { formatDate, formatDateTime } from "@/lib/leadFormat";

export interface LocalDateProps {
  value: string | null;
  /** "date" (e.g. "Jan 5, 2026") or "datetime" (adds the time) */
  mode?: "date" | "datetime";
}

function LocalDateInner({ value, mode = "date" }: LocalDateProps) {
  return <>{mode === "datetime" ? formatDateTime(value) : formatDate(value)}</>;
}

export const LocalDate = dynamicImport(() => Promise.resolve(LocalDateInner), { ssr: false });
