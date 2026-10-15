/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// jh-forms/tests/versions.test.ts - runs mds/migrations/17-form-versions.sql on PGlite (real Postgres) and checks the
// version rule, late rows, the re-key when a form gets an id, and the backfill. Run: npm run test:forms
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const SITE = "11111111-1111-1111-1111-111111111111";
const H = 3600_000;
const T0 = Date.parse("2026-10-01T10:00:00Z");
const A = [{ key: "name", type: "text", required: true }, { key: "email", type: "email", required: true }];
const B = [...A, { key: "phone", type: "tel", required: false }];
const C = [A[1], A[0]];

async function main() {
  const pg = new PGlite();
  // what the migration expects to exist in Supabase
  await pg.exec(`
    create role anon; create role authenticated;
    create schema auth; create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create table public.sites (id uuid primary key);
    create table public.site_members (site_id uuid, user_id text, status text);
    create table public.form_engagement (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_path text, form_index integer default 0,
      status text, viewed_at timestamptz, first_input_at timestamptz, ended_at timestamptz, field_timings jsonb default '{}', form_fields jsonb, onscreen_before_start_ms integer);
    insert into public.sites values ('${SITE}');`);
  // old rows from before the migration: one with a field list, one without
  const raw = async (page: string, fields: object | null, at: number) =>
    (await pg.query<{ id: string }>("insert into form_engagement(site_id, session_id, page_path, status, viewed_at, form_fields) values ($1,'s',$2,'viewed',$3,$4) returning id", [SITE, page, new Date(at).toISOString(), fields ? JSON.stringify(fields) : null])).rows[0].id;
  await raw("/contact", A, T0 - 10 * 24 * H);
  await raw("/contact", null, T0 - 9 * 24 * H);

  const sql = readFileSync(join(process.cwd(), "mds/migrations/17-form-versions.sql"), "utf8");
  await pg.exec(sql);
  await pg.exec(sql); // safe to run twice
  const keys = (await pg.query<{ form_key: string; v: string | null }>("select form_key, form_version_id::text v from form_engagement order by viewed_at")).rows;
  ok(keys.every((k) => k.form_key === "path:/contact#0"), "backfill: old rows keyed by page + position");
  ok(keys[0].v !== null && keys[1].v === null, "backfill: the row with a field list got a version, the one without stayed out");

  const versions = async (key: string) => (await pg.query<any>("select id::text, cardinality(fingerprints) fps, started_at, ended_at, fields from form_versions where form_key = $1 order by started_at", [key])).rows;
  const place = async (key: string, page: string, fields: object, at: number) => {
    const id = (await pg.query<{ id: string }>("insert into form_engagement(site_id, session_id, page_path, status, viewed_at, form_fields, form_key) values ($1,'s',$2,'viewed',$3,$4,$5) returning id", [SITE, page, new Date(at).toISOString(), JSON.stringify(fields), key])).rows[0].id;
    return (await pg.query<{ v: string }>("select public.jh_place_form_version($1)::text v", [id])).rows[0].v;
  };

  const K = "id:lead";
  const v1 = await place(K, "/a", A, T0);
  ok((await place(K, "/a", A, T0 + 40 * H)) === v1, "same layout two days later: same version");
  const v2 = await place(K, "/a", B, T0 + 48 * H);
  let vs = await versions(K);
  ok(v2 !== v1 && vs.length === 2 && new Date(vs[0].ended_at).getTime() === T0 + 48 * H, "a change after the first day starts version 2 at once; version 1 ends at that moment");
  ok((await place(K, "/a", C, T0 + 50 * H)) === v2, "another change 2 h later joins version 2 (a version lives at least a day)");
  vs = await versions(K);
  ok(vs[1].fps === 2 && vs[1].fields[0].key === "email", "version 2 now holds both layouts and the newer field list");
  ok((await place(K, "/b", B, T0 + 90 * H)) === v2, "after the first day, a layout already in version 2 stays in it (no flip-flop)");
  ok((await place(K, "/a", A, T0 + 30 * H)) === v1, "a late row from before version 2 goes to the version live at the time");
  const v3 = await place(K, "/a", A, T0 + 100 * H);
  ok(v3 !== v2 && (await versions(K)).length === 3, "layout A again, after version 2's first day: version 3");
  ok((await place(K, "/a", A, T0 + 101 * H)) === v3, "idempotent for the same layout");

  // the /contact form gets an id: its old page + position rows move under the new key and are re-placed
  const moved = await place("id:contact", "/contact", A, T0 + 200 * H);
  const ck = (await pg.query<{ n: number }>("select count(*)::int n from form_engagement where form_key = 'id:contact'")).rows[0].n;
  const left = (await pg.query<{ n: number }>("select count(*)::int n from form_engagement where form_key like 'path:/contact%'")).rows[0].n;
  ok(ck === 3 && left === 0 && moved !== null, "the form got an id: its 2 older rows joined it (3 rows, none left under the page key)");
  ok((await versions("path:/contact#0")).length === 0 && (await versions("id:contact")).length === 1, "the page-key versions were replaced by the new key's versions");

  const fp = async (f: object) => (await pg.query<{ f: string }>("select public.jh_form_fingerprint($1::jsonb) f", [JSON.stringify(f)])).rows[0].f;
  ok((await fp(A)) === (await fp(JSON.parse(JSON.stringify(A)))) && (await fp(A)) !== (await fp(C)) && (await fp(A)).length === 16, "fingerprint: stable, order matters, 16 chars");
  ok((await fp([{ ...A[0], required: false }, A[1]])) !== (await fp(A)), "fingerprint: required matters");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
