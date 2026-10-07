// api/close-stale-sessions/route.js
//
// Entry point for the idle sweep, for a scheduler (Vercel Cron, an uptime
// pinger) instead of waiting on tracker traffic. The sweep also runs after
// real tracker requests (see app/api/track/route.js), so this is optional.
//
// It used to be open to anyone. It is now locked behind CRON_SECRET: set that
// environment variable, and send "Authorization: Bearer <CRON_SECRET>" (Vercel
// Cron does this by itself). Without the variable the route stays off.
//
// The work is one database function, jh_close_stale() (see
// mds/migrations/2026-10-07-ingestion-hardening.sql). If it has not been
// installed yet, the older per-session sweep runs instead.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { closeStaleSessions } from "@/lib/closeStaleSessions";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin.rpc("jh_close_stale");
  if (error) {
    console.warn("[close-stale-sessions] jh_close_stale unavailable, using the per-session sweep:", error.message);
    await closeStaleSessions(supabaseAdmin);
    return NextResponse.json({ success: true, mode: "fallback" });
  }
  return NextResponse.json({ success: true, mode: "rpc", result: data?.[0] ?? null });
}
