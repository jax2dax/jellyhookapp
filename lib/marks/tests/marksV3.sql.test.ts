// lib/marks/tests/marksV3.sql.test.ts - migration 33 (v3: when marks run) against a real Postgres (PGlite, in memory):
// it runs on the tables it changes, twice, keeps existing marks as they were, refuses an unknown state, and the
// newest-first walk the background check uses (lib/marks/backfill.ts: submitted_at, then id, below a cursor) visits
// every lead exactly once even when several share a sending time.
// Run: npm run test:tracking-sql
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const root = path.resolve(__dirname, "../../..");
const migration = fs.readFileSync(path.join(root, "mds/migrations/33-marks-v3.sql"), "utf8");

const BASE = `
create table public.form_submissions (id uuid primary key, site_id uuid, submitted_at timestamptz);
create table public.marks (id uuid primary key default gen_random_uuid(), site_id uuid, kind text default 'lead', active boolean default true, match_count int, evaluated_at timestamptz);
`;
const S = "00000000-0000-0000-0000-00000000000a";
const lead = (n: number) => "10000000-0000-0000-0000-" + String(n).padStart(12, "0");

async function main() {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(`insert into marks (site_id, match_count) values ('${S}', 7)`);
  await db.exec(migration);
  await db.exec(migration);
  ok(true, "migration 33 runs twice");

  const m = (await db.query<{ rule_version: number; checked_from: string | null; backfill_state: string | null; backfill_run: number; backfill_done: number; match_count: number }>(`select * from marks`)).rows[0];
  ok(m.rule_version === 1 && m.checked_from === null && m.backfill_state === null && m.backfill_run === 0 && m.backfill_done === 0, "an existing mark: version 1, all leads covered, no check running");
  ok(m.match_count === 7, "its count is kept");

  let refused = false;
  try {
    await db.exec(`update marks set backfill_state = 'paused'`);
  } catch {
    refused = true;
  }
  ok(refused, "an unknown check state is refused");
  await db.exec(`update marks set backfill_state = 'running'`);
  ok(true, "'running' is accepted");

  // 25 leads, five of them at the very same moment
  for (let i = 1; i <= 25; i++) {
    const t = i <= 5 ? "2026-10-20T10:00:00Z" : `2026-10-${String(1 + (i % 19)).padStart(2, "0")}T0${i % 10}:00:00Z`;
    await db.query(`insert into form_submissions values ($1, $2, $3)`, [lead(i), S, t]);
  }
  // the walk: newest first, 4 at a time, below (cursor_at, cursor_id)
  const seen: string[] = [];
  let cur: { at: string; id: string } | null = null;
  for (let guard = 0; guard < 20; guard++) {
    const rows: { id: string; submitted_at: string }[] = (
      await db.query<{ id: string; submitted_at: string }>(
        `select id, submitted_at::text from form_submissions where site_id = $1 ${cur ? "and (submitted_at < $2 or (submitted_at = $2 and id < $3))" : ""} order by submitted_at desc, id desc limit 4`,
        cur ? [S, cur.at, cur.id] : [S],
      )
    ).rows;
    if (!rows.length) break;
    seen.push(...rows.map((r) => r.id));
    const last = rows[rows.length - 1];
    cur = { at: last.submitted_at, id: last.id };
  }
  ok(seen.length === 25 && new Set(seen).size === 25, `the walk visits every lead once (${seen.length} visited, ${new Set(seen).size} different)`);

  const idx = (await db.query<{ indexname: string }>(`select indexname from pg_indexes where tablename in ('marks', 'form_submissions')`)).rows.map((r) => r.indexname);
  ok(idx.includes("form_submissions_site_submitted_idx") && idx.includes("marks_backfill_running_idx"), "both indexes exist");

  console.log(`\n${passes} passed, ${fails} failed`);
  if (fails) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
