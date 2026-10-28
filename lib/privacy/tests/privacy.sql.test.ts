// lib/privacy/tests/privacy.sql.test.ts - migration 35 (retention and erasing a person) against a real Postgres (PGlite,
// in memory): it runs twice; jh_purge_site deletes only what is older than the cutoff, only for that site, in batches;
// jh_erase_person deletes every lead with the email, the visits of the browsers that sent them (aliases too), and
// nothing of other people or other sites; a lead's children go with it.
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
const migration = fs.readFileSync(path.join(root, "mds/migrations/35-privacy-retention-and-erasure.sql"), "utf8");

const BASE = `
create role anon; create role authenticated; create role service_role;
create table public.sites (id uuid primary key, deleted_at timestamptz);
create table public.visitors (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), visitor_id text, site_id uuid, first_seen timestamptz, last_seen timestamptz);
create table public.sessions (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), session_id text, visitor_id text, site_id uuid, started_at timestamptz, last_activity_at timestamptz);
create table public.page_views (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), session_id text, visitor_id text, site_id uuid);
create table public.form_submissions (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), site_id uuid, visitor_id text, email text, submitted_at timestamptz);
create table public.form_engagement (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), site_id uuid, visitor_id text, session_id text);
create table public.click_events (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), site_id uuid, visitor_id text, clicked_at timestamptz default now());
create table public.visitor_aliases (site_id uuid, alias_id text, visitor_id text, created_at timestamptz default now(), primary key (site_id, alias_id));
create table public.lead_marks (lead_id uuid references public.form_submissions (id) on delete cascade, mark text);
`;
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const OLD = "now() - interval '20 months'";

async function main() {
  const db = new PGlite();
  await db.exec(BASE);
  await db.exec(`insert into sites (id) values ('${A}'), ('${B}')`);
  await db.exec(migration);
  await db.exec(migration);
  ok(true, "migration 35 runs twice");
  const r = await db.query<{ retention_months: number }>(`select retention_months from sites where id = '${A}'`);
  ok(r.rows[0].retention_months === 13, "existing sites get 13 months");
  let threw = false;
  try {
    await db.exec(`update sites set retention_months = 7 where id = '${A}'`);
  } catch {
    threw = true;
  }
  ok(threw, "only 6, 13, 25 or null are allowed");

  const count = async (t: string, site = A) => Number((await db.query<{ n: number }>(`select count(*)::int as n from ${t} where site_id = '${site}'`)).rows[0].n);

  // ── retention ──
  await db.exec(`
    insert into page_views (site_id, visitor_id, created_at) values ('${A}', 'v-old', ${OLD}), ('${A}', 'v-new', now()), ('${B}', 'v-b', ${OLD});
    insert into form_submissions (site_id, visitor_id, email, submitted_at) values ('${A}', 'v-old', 'old@x.com', ${OLD}), ('${A}', 'v-new', 'new@x.com', now());
    insert into sessions (site_id, visitor_id, started_at, last_activity_at) values ('${A}', 'v-old', ${OLD}, ${OLD}), ('${A}', 'v-new', now(), now());
    insert into visitors (site_id, visitor_id, first_seen, last_seen) values ('${A}', 'v-old', ${OLD}, ${OLD}), ('${A}', 'v-new', now(), now());
    insert into click_events (site_id, visitor_id, clicked_at) values ('${A}', 'v-old', ${OLD});
  `);
  const n = (await db.query<{ n: number }>(`select public.jh_purge_site('${A}', now() - interval '13 months', 5000) as n`)).rows[0].n;
  ok(n === 5, "purge deleted the 5 old rows of site A (" + n + ")");
  ok((await count("page_views")) === 1 && (await count("form_submissions")) === 1 && (await count("sessions")) === 1 && (await count("visitors")) === 1, "recent rows stay");
  ok((await count("page_views", B)) === 1, "another site's old rows are not touched");
  await db.exec(`insert into page_views (site_id, created_at) select '${A}', ${OLD} from generate_series(1, 7)`);
  const first = (await db.query<{ n: number }>(`select public.jh_purge_site('${A}', now() - interval '13 months', 5) as n`)).rows[0].n;
  ok(first === 5, "a batch deletes at most p_batch rows per table");
  await db.query(`select public.jh_purge_site('${A}', now() - interval '13 months', 5)`);
  ok((await count("page_views")) === 1, "the next batch finishes the backlog");

  // ── erasure ──
  await db.exec(`
    insert into form_submissions (site_id, visitor_id, email) values ('${A}', 'p1', 'Pat@Example.com'), ('${A}', 'p2-phone', 'pat@example.com'), ('${A}', 'other', 'sam@example.com'), ('${B}', 'pb', 'pat@example.com');
    insert into visitor_aliases (site_id, alias_id, visitor_id) values ('${A}', 'p1-private', 'p1');
    insert into page_views (site_id, visitor_id) values ('${A}', 'p1'), ('${A}', 'p1-private'), ('${A}', 'p2-phone'), ('${A}', 'other');
    insert into sessions (site_id, visitor_id) values ('${A}', 'p1'), ('${A}', 'other');
    insert into visitors (site_id, visitor_id) values ('${A}', 'p1'), ('${A}', 'p2-phone'), ('${A}', 'other');
    insert into form_engagement (site_id, visitor_id) values ('${A}', 'p1-private');
    insert into lead_marks (lead_id, mark) select id, 'hot' from form_submissions where email ilike 'pat@example.com' and site_id = '${A}';
  `);
  const e = (await db.query<{ r: { leads: number; visitors: number; rows: number } }>(`select public.jh_erase_person('${A}', ' PAT@example.com ') as r`)).rows[0].r;
  ok(e.leads === 2, "both of Pat's leads (two devices, any letter case) are erased (" + e.leads + ")");
  ok(e.visitors === 3, "Pat's two browsers and the merged private window (" + e.visitors + ")");
  const left = (await db.query<{ v: string }>(`select visitor_id as v from page_views where site_id = '${A}' and visitor_id in ('p1', 'p1-private', 'p2-phone', 'other')`)).rows.map((x) => x.v);
  ok(left.length === 1 && left[0] === "other", "Pat's page views are gone, Sam's stay");
  ok((await count("form_engagement")) === 0 && (await count("visitor_aliases")) === 0, "form activity and aliases go too");
  ok(Number((await db.query<{ n: number }>(`select count(*)::int as n from lead_marks`)).rows[0].n) === 0, "the leads' marks go with them (cascade)");
  ok((await count("form_submissions", B)) === 1, "the same email on another site is not touched");
  const none = (await db.query<{ r: { leads: number } }>(`select public.jh_erase_person('${A}', '') as r`)).rows[0].r;
  ok(none.leads === 0, "an empty email erases nothing");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main();
