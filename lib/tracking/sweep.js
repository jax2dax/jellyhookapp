// lib/tracking/sweep.js
// The idle sweep that rides on tracker traffic: at most once every 5 minutes per
// server instance (it used to run on EVERY request). Prefers the one-statement
// database function jh_close_stale(); falls back to the older per-session code
// until the migration has been run.
import { closeStaleSessions } from "@/lib/closeStaleSessions";
import { closeStaleFormEngagement } from "@/lib/closeStaleFormEngagement";

const EVERY_MS = 5 * 60 * 1000;
let lastRun = 0;
let rpcMissing = false;

export async function sweepIfDue(supabase, now = Date.now()) {
  if (now - lastRun < EVERY_MS) return;
  lastRun = now;
  try {
    if (!rpcMissing) {
      const { error } = await supabase.rpc("jh_close_stale");
      if (!error) return;
      rpcMissing = true;
      console.warn("[sweep] jh_close_stale not available, using the per-session sweep:", error.message);
    }
    await closeStaleSessions(supabase);
    await closeStaleFormEngagement(supabase);
  } catch (err) {
    console.error("[sweep] failed:", err);
  }
}
