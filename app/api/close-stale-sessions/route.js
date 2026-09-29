// api/close-stale-sessions/route.js
//
// Manual/cron-triggerable entry point for lib/closeStaleSessions.js. Not
// required for the sweep to run — app/api/track/route.js already triggers
// it via after() on real traffic — but kept as a standalone route so it can
// be hit directly (e.g. a monitoring check, or a future cron) without
// waiting on a tracked site to get a hit first.
import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";
import { closeStaleSessions } from "@/lib/closeStaleSessions";

export async function GET() {
  const supabase = createSupabaseClient();
  await closeStaleSessions(supabase);
  return NextResponse.json({ success: true });
}
