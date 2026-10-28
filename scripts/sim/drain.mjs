#!/usr/bin/env node
// scripts/sim/drain.mjs - npm run drain:bench. Calls the drainer (/api/jobs/drain) of the TEST server every 30 s, the way
// Supabase Cron calls it in production every minute (mds/build/marks/review-2026-10-27.md section 4). The drainer does the
// waiting work: Slack and webhook retries, the queue of other marks (lib/marks/queue.ts), checks of past leads.
// Reads CRON_SECRET from .env.bench, else .env.local (never printed). Only talks to localhost.
// Options: --every 30 (seconds), --times 20 (then stops; 0 = until Ctrl+C), --base http://localhost:3100
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "./envfile.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1]] : null)).filter(Boolean));
const BASE = (args.base ?? "http://localhost:3100").replace(/\/+$/, "");
const EVERY = Number(args.every ?? 30) * 1000;
const TIMES = Number(args.times ?? 20);

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error("drain:bench only calls a server on this computer (localhost).");
  process.exit(1);
}
const secret = [".env.bench", ".env.local"].map((f) => (existsSync(f) ? parseEnv(readFileSync(f, "utf8")).CRON_SECRET : undefined)).find(Boolean);
if (!secret) {
  console.error("No CRON_SECRET in .env.bench or .env.local. Add one (any long random text) and restart the test server.");
  process.exit(1);
}

console.log(`Calling ${BASE}/api/jobs/drain every ${EVERY / 1000}s${TIMES ? `, ${TIMES} times` : ""}. Ctrl+C stops.`);
for (let i = 1; !TIMES || i <= TIMES; i++) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + "/api/jobs/drain", { method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(90_000) });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      console.error("401: the test server has another CRON_SECRET (restart it after changing .env files).");
      process.exit(1);
    }
    console.log(`  ${i}: ${res.status} in ${Math.round((Date.now() - t0) / 1000)}s | lanes ${body.sites ?? "?"}, Slack/webhook sent ${body.sent ?? "?"}, queue leads checked ${body.queued ?? "?"}, past-lead checks ${body.backfills ?? "?"}`);
  } catch (e) {
    console.log(`  ${i}: no answer (${e instanceof Error ? e.message : e})`);
  }
  if (!TIMES || i < TIMES) await new Promise((r) => setTimeout(r, EVERY));
}
