// lib/admin/format.ts
// How the control room writes numbers (app/admin). Pure, safe in the browser.

/** 950 -> "950", 12_400 -> "12.4k", 3_200_000 -> "3.2M" */
export function count(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return (n / 1000).toFixed(0) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(Math.round(n));
}

/** a duration: "850 ms", "4.2 s", "3m 10s", "2.5 h"; "–" when unknown */
export function dur(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(Number(ms))) return "–";
  const v = Number(ms);
  if (v < 1000) return Math.round(v) + " ms";
  if (v < 60_000) return (v / 1000).toFixed(v < 10_000 ? 1 : 0) + " s";
  if (v < 3_600_000) {
    const s = Math.round(v / 1000); // whole seconds first, so 119.6 s is "2m 0s", never "1m 60s"
    return Math.floor(s / 60) + "m " + (s % 60) + "s";
  }
  return (v / 3_600_000).toFixed(1) + " h";
}

export function usd(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "–";
  const n = Number(v);
  return n >= 100 ? "$" + n.toFixed(0) : n >= 1 ? "$" + n.toFixed(2) : n === 0 ? "$0" : "$" + n.toFixed(4);
}

export function bytes(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + " GB";
  if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(0) + " KB";
  return n + " B";
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return Math.round(ms / 60_000) + " min ago";
  if (ms < 86_400_000) return Math.round(ms / 3_600_000) + " h ago";
  return Math.round(ms / 86_400_000) + " days ago";
}

/** The promise: a Slack message within 30 s of its form. */
export const PROMISE_MS = 30_000;
export function promiseTone(ms: number | null | undefined): "ok" | "warn" | "bad" | "none" {
  if (ms === null || ms === undefined) return "none";
  return ms <= PROMISE_MS * 0.5 ? "ok" : ms <= PROMISE_MS ? "warn" : "bad";
}
