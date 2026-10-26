// lib/metrics/tests/controlRoom.sql.test.ts - migration 29 (the control room's tables and reports) against a real
// Postgres (PGlite, in memory). The tables it reads are created here with only the columns the reports use; the
// migration runs exactly as written; then known data is put in and every report number is checked.
// Run: npm run test:tracking-sql
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const root = path.resolve(__dirname, "../../..");
const migration = fs.readFileSync(path.join(root, "mds/migrations/29-control-room.sql"), "utf8");

const BASE = `
create role anon; create role authenticated; create role service_role;
create table public.sites (id uuid primary key, domain text, name text, created_at timestamptz default now(), verified boolean, is_active boolean default true, last_event_at timestamptz, deleted_at timestamptz);
create table public.site_members (site_id uuid, user_id text, status text default 'active');
create table public.site_usage_daily (site_id uuid not null references public.sites (id), day date not null, requests int not null default 0, events int not null default 0,
  session_starts int not null default 0, session_ends int not null default 0, page_view_starts int not null default 0, page_view_ends int not null default 0,
  forms int not null default 0, engagement int not null default 0, structure int not null default 0, clicks int not null default 0, dropped int not null default 0,
  bytes_in bigint not null default 0, primary key (site_id, day));
create table public.form_submissions (id uuid primary key, site_id uuid, submitted_at timestamptz);
create table public.marks (id uuid primary key default gen_random_uuid(), site_id uuid, kind text default 'lead', active boolean default true);
create table public.notification_rules (id uuid primary key default gen_random_uuid(), site_id uuid, active boolean default true);
create table public.notification_events (id uuid primary key, site_id uuid, lead_id uuid);
create table public.notification_deliveries (id uuid primary key default gen_random_uuid(), site_id uuid, event_id uuid, status text, created_at timestamptz default now(), sent_at timestamptz);
create table public.check_jobs (lead_id uuid primary key, site_id uuid, run_after timestamptz default now(), created_at timestamptz default now());
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const lead = (n: number) => "10000000-0000-0000-0000-" + String(n).padStart(12, "0");
const ev = (n: number) => "20000000-0000-0000-0000-" + String(n).padStart(12, "0");

async function main() {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(migration);
  ok(true, "migration 29 runs on the tables it reads");

  await db.exec(`
    insert into sites (id, domain, name, verified) values ('${A}', 'a.com', 'A', true), ('${B}', 'b.com', 'B', false);
    insert into site_members values ('${A}', 'u1', 'active'), ('${A}', 'u2', 'active'), ('${A}', 'pending:x@y.z', 'pending_invite'), ('${B}', 'u1', 'active');
    insert into marks (site_id, active) values ('${A}', true), ('${A}', false), ('${A}', true), ('${B}', true);
    insert into notification_rules (site_id, active) values ('${A}', true), ('${A}', false);
  `);
  // usage through the real function, twice the same day: counts add up, new columns included
  await db.query(`select jh_usage_add($1, current_date, $2::jsonb)`, [A, JSON.stringify({ requests: 3, events: 10, session_starts: 2, page_view_starts: 4, forms: 1, server_ms: 120, db_calls: 9, db_ms: 80, db_rows: 30 })]);
  await db.query(`select jh_usage_add($1, current_date, $2::jsonb)`, [A, JSON.stringify({ requests: 1, events: 5, server_ms: 30, db_calls: 2, db_ms: 10 })]);
  // leads: 3 new, 1 old; four of them hooked, messages sent 2 s, 4 s, 10 s and 60 s after the form; one failed
  for (const [n, ago] of [[1, "1 hour"], [2, "2 hours"], [3, "3 hours"], [4, "40 days"]] as const) {
    await db.exec(`insert into form_submissions values ('${lead(n)}', '${A}', now() - interval '${ago}')`);
  }
  await db.exec(`insert into form_submissions values ('${lead(5)}', '${A}', now() - interval '30 minutes')`);
  const sends = [[1, 2], [2, 4], [3, 10], [5, 60]];
  for (const [n, s] of sends) {
    await db.exec(`insert into notification_events values ('${ev(n)}', '${A}', '${lead(n)}')`);
    await db.exec(`insert into notification_deliveries (site_id, event_id, status, sent_at) select '${A}', '${ev(n)}', 'sent', submitted_at + interval '${s} seconds' from form_submissions where id = '${lead(n)}'`);
  }
  await db.exec(`insert into notification_events values ('${ev(9)}', '${A}', '${lead(1)}'); insert into notification_deliveries (site_id, event_id, status) values ('${A}', '${ev(9)}', 'failed')`);
  // runs: three batches and one mark applied
  await db.exec(`
    insert into pipeline_runs (site_id, kind, leads, marks, hooks, total_ms, wait_ms, db_calls, db_ms, db_rows) values
      ('${A}', 'leads', 1, 4, 2, 800, 100, 40, 300, 500), ('${A}', 'leads', 2, 4, 2, 1600, 900, 80, 600, 900), ('${A}', 'leads', 1, 4, 2, 400, 50, 20, 150, 200);
    insert into pipeline_runs (site_id, kind, leads, total_ms, db_rows, error) values ('${A}', 'mark_apply', 12, 5000, 40000, null);
    insert into pipeline_runs (site_id, kind, leads, total_ms, error) values ('${A}', 'leads', 1, 100, 'boom');
    insert into check_jobs (lead_id, site_id, created_at) values ('${lead(5)}', '${A}', now() - interval '5 seconds');
    insert into check_jobs (lead_id, site_id, run_after) values ('${lead(4)}', '${A}', now() + interval '3650 days');
  `);

  const rows = (await db.query(`select * from jh_admin_sites(now() - interval '30 days')`)).rows as any[];
  const a = rows.find((r) => r.site_id === A);
  const b = rows.find((r) => r.site_id === B);
  ok(rows.length === 2 && rows[0].site_id === A, "one row per site, busiest first");
  ok(Number(a.members) === 2 && Number(b.members) === 1, "members: active people only (an open invite is not one)");
  ok(Number(a.requests) === 4 && Number(a.events) === 15 && Number(a.visits) === 2 && Number(a.page_views) === 4 && Number(a.forms) === 1, "traffic: usage summed over the days");
  ok(Number(a.server_ms) === 150 && Number(a.db_calls) === 11 && Number(a.db_ms) === 90 && Number(a.db_rows) === 30, "work: the new usage columns are summed");
  ok(Number(a.leads) === 4 && Number(a.leads_total) === 5, "leads in the period and in all");
  ok(Number(a.marks) === 3 && Number(a.marks_on) === 2 && Number(a.hooks) === 2 && Number(a.hooks_live) === 1, "marks and hooks, all and switched on");
  ok(Number(a.sent) === 4 && Number(a.failed) === 1, "messages sent and failed");
  ok(Math.abs(a.slack_p50_ms - 7000) < 1 && Math.round(a.slack_max_ms) === 60000, "form to Slack: median 7 s (2, 4, 10, 60), slowest 60 s");
  ok(a.slack_p95_ms > 50000 && a.slack_p95_ms < 60000, "form to Slack p95 between the two slowest: " + Math.round(a.slack_p95_ms));
  ok(Number(a.runs) === 4 && Number(a.run_leads) === 5 && Number(a.run_ms) === 2900 && Number(a.run_errors) === 1, "batches of leads: count, leads, time, errors");
  ok(Number(a.run_db_calls) === 140 && Number(a.run_db_rows) === 1600, "batches: database calls and rows");
  ok(Number(a.applies) === 1 && Number(a.apply_ms) === 5000 && Number(a.apply_db_rows) === 40000, "marks applied to old leads, counted apart");
  ok(Number(b.events) === 0 && b.slack_p50_ms === null && Number(b.runs) === 0, "a quiet site: zeros and no latency, not an error");

  const days = (await db.query(`select * from jh_admin_daily($1, 7)`, [A])).rows as any[];
  ok(days.length === 7 && Number(days[6].events) === 15 && Number(days[6].runs) === 4 && Number(days[6].run_db_calls) === 140, "daily: 7 days, today has the traffic, the batches and their database calls");
  const all = (await db.query(`select * from jh_admin_daily(null, 3)`)).rows as any[];
  ok(all.length === 3 && Number(all[2].events) === 15, "daily for all sites (null site)");

  const now = (await db.query(`select * from jh_admin_now()`)).rows[0] as any;
  ok(Number(now.people) === 2, "people: distinct active members across sites");
  ok(Number(now.queue_leads) === 1 && now.queue_oldest_ms >= 4000 && Number(now.queue_parked) === 1, "queue: one waiting (about 5 s), one parked after its last try");
  ok(Number(now.failed_messages_24h) === 1 && Number(now.run_errors_24h) === 1, "failures in the last 24 hours");

  const lat = (await db.query(`select * from jh_admin_latency(now() - interval '30 days')`)).rows[0] as any;
  ok(Number(lat.sent) === 4 && Math.abs(lat.slack_p50_ms - 7000) < 1 && Number(lat.over_30s) === 1, "all sites: 4 sent, median 7 s, one over the 30 s promise");
  ok(Number(lat.runs) === 4 && Number(lat.run_max_ms) === 1600, "all sites: batch times");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main();
