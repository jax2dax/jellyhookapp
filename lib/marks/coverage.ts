// lib/marks/coverage.ts
// Which leads a mark has checked (v3, mds/build/marks/when-marks-run.md). Pure: used by the server (lib/actions) and the
// leads page, so a lead the mark never looked at reads "not checked", never "does not match".
// A mark checks:
//   - past leads sent at or after `from` (the choice at save: last 30 days, last 90 days, all, or none = from the save);
//     while that check runs in the background (newest first), the part it has not reached yet is not checked;
//   - new leads while it is on; leads sent after `offSince` (it was turned off then) are not checked.

export type PastChoice = "30d" | "90d" | "all" | "none";
export const PAST_CHOICES: PastChoice[] = ["30d", "90d", "all", "none"];
export const DEFAULT_PAST: PastChoice = "30d";

/** The state of a mark's checks, as the screens show it. null for a mark on a database before migration 33 (every lead checked). */
export interface MarkCheck {
  /** leads sent at or after this are covered; null = all */
  from: string | null;
  /** turned off at this time; null while on */
  offSince: string | null;
  /** the background check of past leads */
  state: "running" | "done" | "failed" | "stopped" | null;
  /** its newest lead (newer ones are checked as they arrive) */
  until: string | null;
  /** the oldest lead it has checked so far; null before its first chunk */
  cursorAt: string | null;
  total: number | null;
  done: number;
  error: string | null;
}

/** The oldest sending time a choice covers, at `now`; null = all leads. */
export function pastFrom(choice: PastChoice, now = Date.now()): string | null {
  if (choice === "all") return null;
  if (choice === "none") return new Date(now).toISOString();
  return new Date(now - (choice === "30d" ? 30 : 90) * 86_400_000).toISOString();
}

/** Has this mark checked a lead sent at `submittedAt`? (true when unknown: a lead is never called unchecked by guess) */
export function checkedLead(c: MarkCheck | null | undefined, submittedAt: string | null): boolean {
  if (!c || !submittedAt) return true;
  const t = Date.parse(submittedAt);
  if (!Number.isFinite(t)) return true;
  if (c.from && t < Date.parse(c.from)) return false;
  if (c.offSince && t > Date.parse(c.offSince)) return false;
  // the background check goes from `until` back to `from`: what it has not reached yet is not checked
  if (c.state && c.state !== "done" && c.until && t <= Date.parse(c.until)) {
    if (!c.cursorAt || t < Date.parse(c.cursorAt)) return false;
  }
  return true;
}

/** The short status under a mark's name: "off", "checking 120 of 412", "37 leads". */
export function markStatus(m: { active: boolean; matchCount: number | null; check?: MarkCheck | null }): string {
  if (!m.active) return "off";
  const n = m.matchCount ?? 0;
  const leads = n + (n === 1 ? " lead" : " leads");
  const c = m.check;
  if (c?.state === "running") return `checking ${Math.min(c.done, c.total ?? c.done)} of ${c.total ?? "?"}` + (n ? `, ${leads} so far` : "");
  if (c?.state === "failed") return leads + " · check of past leads failed, use Re-check";
  return leads;
}

/** The labels of the past-leads choice. */
export const PAST_LABEL: Record<PastChoice, string> = { "30d": "Last 30 days", "90d": "Last 90 days", all: "All leads", none: "None, only new leads" };

/** A rough time for checking `n` past leads in the background (crowd test v1 variant 7: 3 to 8 ms per lead; the slow end). */
export function checkTime(n: number): string {
  const s = Math.ceil((n * 8) / 1000);
  if (s < 60) return "under a minute";
  const min = Math.ceil(s / 60);
  return `about ${min} minute${min === 1 ? "" : "s"}`;
}

/** "last 30 days", "all leads"... for a `from` relative to when it was chosen (approximate wording for the panel). */
export function coverageText(c: MarkCheck | null | undefined): string {
  if (!c?.from) return "all leads";
  return "leads since " + new Date(c.from).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
