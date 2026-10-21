/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// lib/tracking/tests/identity.test.ts - one person, one visitor (mds/migrations/19-visitor-aliases.sql), run on PGlite
// (real Postgres): ids from one device merge; other devices, leads and other days do not. Run: npm run test:tracking
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const SITE = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const DAY = 86_400_000;
const T = Date.parse("2026-10-16T15:00:00Z");

async function main() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon; create role authenticated; create schema auth; create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create table public.sites (id uuid primary key); create table public.site_members (site_id uuid, user_id text, status text);
    create table public.visitors (id uuid primary key default gen_random_uuid(), visitor_id text, site_id uuid, ip_address text, ip_hash text, first_seen timestamptz, last_seen timestamptz, device_type text,
      first_referrer text, first_utm_source text, first_utm_medium text, first_utm_campaign text, first_landing_path text, first_touch_at timestamptz, unique (site_id, visitor_id));
    create table public.sessions (id uuid primary key default gen_random_uuid(), session_id text unique, visitor_id text, site_id uuid, started_at timestamptz, ended_at timestamptz, last_activity_at timestamptz);
    create table public.form_submissions (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text);
    insert into public.sites values ('${SITE}'), ('${OTHER}');`);
  const sql = readFileSync(join(process.cwd(), "mds/migrations/19-visitor-aliases.sql"), "utf8");
  await pg.exec(sql);
  await pg.exec(sql); // safe to run twice

  const resolve = async (visitor: string, ip: string | null, ua: string | null, at: number, site = SITE, extra: object = {}) =>
    (await pg.query<{ v: string }>("select public.jh_resolve_visitor($1, $2, $3::jsonb, $4) as v", [site, visitor, JSON.stringify({ ip_hash: ip, ua_hash: ua, device_type: "desktop", first_seen: new Date(at).toISOString(), last_seen: new Date(at).toISOString(), ...extra }), new Date(at).toISOString()])).rows[0].v;
  const count = async (site = SITE) => (await pg.query<{ n: number }>("select count(*)::int n from public.visitors where site_id = $1", [site])).rows[0].n;

  // six ids from one device (same IP, same browser), minutes apart: one visitor
  const ids = ["fr1", "fr2", "fr3", "fr4", "fr5", "fr6"];
  const got: string[] = [];
  for (let i = 0; i < ids.length; i++) got.push(await resolve(ids[i], "ipA", "uaA", T + i * 120_000));
  ok(got.every((g) => g === "fr1"), "six new ids from one device all count as the first one");
  ok((await count()) === 1, "only one visitor row exists");
  ok((await resolve("fr4", "ipA", "uaA", T + 9e6)) === "fr1" && (await resolve("fr1", "ipA", "uaA", T + 9e6)) === "fr1", "the same ids later still resolve to it (an alias, and the visitor itself)");

  // another device, another browser, another site, no hashes: separate
  ok((await resolve("other-ip", "ipB", "uaA", T)) === "other-ip", "same browser from another IP: a different visitor");
  ok((await resolve("other-ua", "ipA", "uaB", T)) === "other-ua", "same IP with another browser: a different visitor");
  ok((await resolve("fr1", "ipA", "uaA", T, OTHER)) === "fr1" && (await count(OTHER)) === 1, "another site never merges with this one");
  ok((await resolve("nohash", null, "uaA", T)) === "nohash" && (await resolve("nohash2", null, "uaA", T)) === "nohash2", "no IP hash (no salt set): never merged");

  // the next day: a new visitor
  ok((await resolve("fr7", "ipA", "uaA", T + DAY)) === "fr7", "the next UTC day the same device is a new visitor (Vercel's daily rule)");

  // a lead is never merged into
  await resolve("lead1", "ipC", "uaC", T);
  await pg.query("insert into public.form_submissions (site_id, visitor_id) values ($1, 'lead1')", [SITE]);
  ok((await resolve("after-lead", "ipC", "uaC", T + 60_000)) === "after-lead", "a visitor who already sent a form is never the target of a merge");

  // the first visitor's own data is kept, merged ids create no rows
  const row = (await pg.query<any>("select * from public.visitors where site_id = $1 and visitor_id = 'fr1'", [SITE])).rows[0];
  ok(row.ip_hash === "ipA" && row.ua_hash === "uaA" && row.device_type === "desktop", "the visitor row keeps its hashes and device");
  ok((await pg.query<{ n: number }>("select count(*)::int n from public.visitor_aliases where site_id = $1", [SITE])).rows[0].n === 5, "five aliases (fr2 to fr6)");

  // ids that arrive at the same moment (two connections) still find each other
  const results = await Promise.all(["p1", "p2", "p3", "p4"].map((id) => resolve(id, "ipD", "uaD", T + 5e6)));
  ok(new Set(results).size === 1, "four ids arriving at the same time resolve to one visitor: " + [...new Set(results)].join(","));

  // sessions: a merged visitor's refreshes join the visit that is still active
  const sess = async (raw: string, visitor: string, at: number) => (await pg.query<{ s: string }>("select public.jh_resolve_session($1, $2, $3, $4) as s", [SITE, raw, visitor, new Date(at).toISOString()])).rows[0].s;
  const mk = (id: string, visitor: string, start: number, last: number, ended: number | null = null) =>
    pg.query("insert into public.sessions (session_id, visitor_id, site_id, started_at, last_activity_at, ended_at) values ($1,$2,$3,$4,$5,$6)", [id, visitor, SITE, new Date(start).toISOString(), new Date(last).toISOString(), ended ? new Date(ended).toISOString() : null]);
  ok((await sess("s-first", "fr1", T)) === "s-first", "no active session yet: the new one keeps its own id");
  await mk("s-first", "fr1", T, T + 60_000);
  ok((await sess("s-r2", "fr1", T + 120_000)) === "s-first" && (await sess("s-r3", "fr1", T + 180_000)) === "s-first", "two refreshes of a merged visitor join the visit that is still active");
  ok((await sess("s-r2", "fr1", T + 4e6)) === "s-first", "the same refresh id keeps resolving to it (an alias)");
  ok((await sess("s-late", "fr1", T + 3 * 3_600_000)) === "s-late", "after 30 minutes idle the next one is a new visit");
  await mk("s-ended", "vx", T, T + 60_000, T + 90_000);
  ok((await sess("s-after-end", "vx", T + 120_000)) === "s-after-end", "an ended visit is never joined");
  ok((await sess("s-first", "fr1", T + 4e6)) === "s-first", "a session that already exists keeps its id");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
