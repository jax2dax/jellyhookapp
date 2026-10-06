// jh-hook/debug.ts
// One logger for Hook, browser and server. Errors always print; everything
// else prints only when debugging is switched on, so production consoles
// stay quiet and nothing is computed for a log nobody reads.
//
// Switch on:
//   browser  localStorage.setItem("hook:debug", "1")  (or NEXT_PUBLIC_HOOK_DEBUG=1)
//   server   HOOK_DEBUG=1
// Every line starts with [hook] so it can be filtered in the console and in
// Vercel's logs.

function enabled(): boolean {
  if (typeof window === "undefined") return process.env.HOOK_DEBUG === "1";
  if (process.env.NEXT_PUBLIC_HOOK_DEBUG === "1") return true;
  try {
    return window.localStorage.getItem("hook:debug") === "1";
  } catch {
    return false; // storage blocked (private mode): stay quiet
  }
}

export const hookLog = {
  debug(event: string, data?: unknown): void {
    if (enabled()) console.debug("[hook]", event, data ?? "");
  },
  info(event: string, data?: unknown): void {
    if (enabled()) console.info("[hook]", event, data ?? "");
  },
  warn(event: string, data?: unknown): void {
    console.warn("[hook]", event, data ?? "");
  },
  error(event: string, data?: unknown): void {
    console.error("[hook]", event, data ?? "");
  },
};

/** Short, readable reference code a person can quote when something fails. */
export function refCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
