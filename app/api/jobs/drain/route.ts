// app/api/jobs/drain/route.ts
// The lane drainer (lib/notifications/check.ts drain): checks the sites whose new leads are waiting, then sends the due
// Slack and webhook messages. Called every few seconds by Supabase Cron (mds/migrations/20-groups-and-notifications.sql,
// last section) with "Authorization: Bearer <CRON_SECRET>". Anyone else gets 401.
import { NextResponse } from "next/server";
import { drain } from "@/lib/notifications/check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await drain()) });
  } catch (e) {
    console.error("[drain] failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
