// api/close-stale-sessions/route.js
//
// Manual/cron-triggerable entry point for lib/closeStaleSessions.js. Not
// required for the sweep to run — app/api/track/route.js already triggers
// it via after() on real traffic — but kept as a standalone route so it can
// be hit directly (e.g. a monitoring check, or a future cron) without
// waiting on a tracked site to get a hit first.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { closeStaleSessions } from "@/lib/closeStaleSessions";

// Service role — this sweep is inherently cross-tenant (closes stale
// sessions across every site, not one caller's own), so there's no
// per-user ownership check that would even make sense here. Same reasoning
// as the tracker routes — see app/api/track/route.js's header comment.
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function GET() {
  await closeStaleSessions(supabaseAdmin);
  return NextResponse.json({ success: true });
}
