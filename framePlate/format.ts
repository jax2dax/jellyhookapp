// framePlate/format.ts
// Duration label formatting for the ribbon, matching the assets' style:
// "40 sec", "5 MIN", falling back to a compact "Xm Ys" for non-round minutes.
export function formatFrameDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sec`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes} MIN`;
  return `${minutes}m ${seconds}s`;
}
