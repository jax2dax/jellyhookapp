// lib/marks/tests/markQueue.sql.test.ts - migration 34 (the queue of other marks and the cap on mark work) against a real
// Postgres (PGlite, in memory): it runs twice; jh_take_mark_work grants up to the site's and the database's budget for
// the minute and never more, the hook lane (force) is always granted and counted, sites have separate budgets, and a
// queued lead disappears with its lead.
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
const migration = fs.readFileSync(path.join(root, "mds/migrations/34-mark-queue-and-cap.sql"), "utf8");

const BASE = `
create role anon; create role authenticated; create role service_role;
create table public.sites (id uuid primary key);
create table public.form_submissions (id uuid primary key, site_id uuid);
`;
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const L1 = "10000000-0000-0000-0000-000000000001";

async function main() {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(`insert into sites values ('${A}'), ('${B}'); insert into form_submissions values ('${L1}', '${A}')`);
  await db.exec(migration);
  await db.exec(migration);
  ok(true, "migration 34 runs twice");

  const take = async (site: string, want: number, siteCap: number, allCap: number, force = false) =>
    (await db.query<{ g: number }>(`select public.jh_take_mark_work($1, $2, $3, $4, $5) as g`, [site, want, siteCap, allCap, force])).rows[0].g;

  ok((await take(A, 200, 300, 1000)) === 200, "within the budget: all granted");
  ok((await take(A, 200, 300, 1000)) === 100, "the site's budget of 300 is used up to its end: 100 of 200");
  ok((await take(A, 50, 300, 1000)) === 0, "the site's budget is used: nothing");
  ok((await take(A, 80, 300, 1000, true)) === 80, "the hook lane is always granted");
  ok((await take(B, 500, 300, 1000)) === 300, "another site has its own budget");
  ok((await take(B, 10, 300, 1000)) === 0, "...and it is used too");
  const used = (await db.query<{ site_id: string; checks: number }>(`select site_id::text, checks from mark_work order by site_id`)).rows;
  const all = used.find((r) => r.site_id === "00000000-0000-0000-0000-000000000000")?.checks;
  ok(all === 680, "the database's count holds every grant, the hook lane's too: " + all);
  ok((await take("00000000-0000-0000-0000-0000000000cc", 500, 500, 1000)) === 320, "a third site gets what the database's budget has left: 320");
  ok((await take(A, 0, 300, 1000)) === 0, "asking for nothing takes nothing");

  await db.exec(`insert into mark_jobs (lead_id, site_id) values ('${L1}', '${A}')`);
  let dup = false;
  try {
    await db.exec(`insert into mark_jobs (lead_id, site_id) values ('${L1}', '${A}')`);
  } catch {
    dup = true;
  }
  ok(dup, "one queue row per lead");
  await db.exec(`delete from form_submissions where id = '${L1}'`);
  ok((await db.query(`select 1 from mark_jobs`)).rows.length === 0, "a deleted lead leaves the queue");

  console.log(`\n${passes} passed, ${fails} failed`);
  if (fails) process.exit(1);
}

main();
