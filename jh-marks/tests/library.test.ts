/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// jh-marks/tests/library.test.ts - the marks library on PGlite (real Postgres): the three "around the form" signals
// (left while filling, times away after seeing it, pages between seeing and sending) and the published marks that use
// them, against one person per idea whose answer is worked out by hand. Run: npm run test:marks
import { PGlite } from "@electric-sql/pglite";
import { clearEstimateCache, runHook, type HookDb } from "../../jh-hook/engine/run";
import { CATALOG, catalogMark, catalogVersion } from "../catalog";
import { compileRule } from "../rule";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const SITE = "11111111-1111-1111-1111-111111111111";
const T0 = Date.parse("2026-10-01T10:00:00Z");
const iso = (t: number) => new Date(t).toISOString();

type Page = [path: string, secs: number, gapAfterSecs: number];
type Form = { page: string; viewedAt: number; firstInputAt?: number; endedAt?: number; status: string };
type Visit = { sid: string; at: number; pages: Page[]; forms: Form[]; sendAt?: number };
const people: { name: string; vid: string; visits: Visit[] }[] = [];
const add = (name: string, visits: Visit[]) => people.push({ name, vid: "v" + name, visits });

// times are seconds from the visit's start
// Hesitant: on /contact, starts the form at 5 s, opens /pricing at 31 s while filling, comes back, sends at 80 s
add("H", [{ sid: "sh", at: T0, pages: [["/contact", 30, 1], ["/pricing", 15, 1], ["/contact", 40, 0]], forms: [{ page: "/contact", viewedAt: 2, firstInputAt: 5, endedAt: 80, status: "submitted" }], sendAt: 80 }]);
// Researcher: sees the form at 2 s, then away 22 s and away 20 s (both after seeing it), sends at 85 s
add("R", [{ sid: "sr", at: T0 + 1e6, pages: [["/contact", 8, 22], ["/about", 10, 20], ["/contact", 30, 0]], forms: [{ page: "/contact", viewedAt: 2, firstInputAt: 62, endedAt: 85, status: "submitted" }], sendAt: 85 }]);
// Away twice BEFORE seeing the form, then sees it and sends: must not count as a researcher
add("B", [{ sid: "sb", at: T0 + 2e6, pages: [["/", 5, 20], ["/about", 5, 20], ["/contact", 40, 0]], forms: [{ page: "/contact", viewedAt: 52, firstInputAt: 55, endedAt: 85, status: "submitted" }], sendAt: 85 }]);
// Extensive researcher: the researcher pattern in two visits, sends in the second
add("E", [
  { sid: "se1", at: T0 + 3e6, pages: [["/contact", 8, 22], ["/about", 10, 20], ["/contact", 30, 0]], forms: [{ page: "/contact", viewedAt: 2, endedAt: 90, status: "viewed" }] },
  { sid: "se2", at: T0 + 4e6, pages: [["/contact", 8, 22], ["/about", 10, 20], ["/contact", 30, 0]], forms: [{ page: "/contact", viewedAt: 2, firstInputAt: 62, endedAt: 85, status: "submitted" }], sendAt: 85 },
]);
// Convinced: sees the form, reads /a /b /c without leaving the site, comes back and sends
add("C", [{ sid: "sc", at: T0 + 5e6, pages: [["/contact", 5, 1], ["/a", 20, 1], ["/b", 20, 1], ["/c", 20, 1], ["/contact", 30, 0]], forms: [{ page: "/contact", viewedAt: 2, firstInputAt: 75, endedAt: 98, status: "submitted" }], sendAt: 98 }]);
// Hurdle: starts a form and gives up in visit 1, sends one in visit 2
add("U", [
  { sid: "su1", at: T0 + 6e6, pages: [["/contact", 40, 0]], forms: [{ page: "/contact", viewedAt: 2, firstInputAt: 10, endedAt: 30, status: "abandoned" }] },
  { sid: "su2", at: T0 + 7e6, pages: [["/contact", 30, 0]], forms: [{ page: "/contact", viewedAt: 2, firstInputAt: 5, endedAt: 25, status: "submitted" }], sendAt: 25 },
]);

async function main() {
  const pg = new PGlite();
  await pg.exec(`
    create table sessions (id uuid primary key default gen_random_uuid(), session_id text unique, visitor_id text, site_id uuid, started_at timestamptz, ended_at timestamptz, last_activity_at timestamptz, referrer text, country text, timezone text, utm_source text, utm_medium text, utm_campaign text);
    create table page_views (id uuid primary key default gen_random_uuid(), page_view_id text, session_id text, visitor_id text, site_id uuid, page_url text, page_path text, page_title text, entered_at timestamptz, left_at timestamptz, time_on_page integer, scroll_depth real, max_scroll_depth real, max_scroll_reached_at timestamptz, page_height integer, entry_scroll_depth real, revisit_start_scroll_depth real, viewport_height integer);
    create table form_submissions (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_url text, page_path text, name text, email text, phone text, confidence text default 'high', raw_data jsonb, submitted_at timestamptz, qualified boolean);
    create table visitors (id uuid primary key default gen_random_uuid(), visitor_id text, site_id uuid, first_seen timestamptz, last_seen timestamptz, device_type text, browser text, os text, language text);
    create table form_engagement (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_view_id text, page_path text, form_index integer default 0, status text, last_field_type text, last_field_key text, viewed_at timestamptz, first_input_at timestamptz, ended_at timestamptz, field_timings jsonb default '{}', last_activity_at timestamptz, form_fields jsonb, onscreen_before_start_ms integer, form_key text, form_version_id uuid);`);
  const leadOf: Record<string, string> = {};
  for (const p of people) {
    await pg.query("insert into visitors(visitor_id, site_id) values ($1,$2)", [p.vid, SITE]);
    for (const v of p.visits) {
      let t = v.at;
      for (const [path, secs, gap] of v.pages) {
        await pg.query("insert into page_views(session_id, visitor_id, site_id, page_path, entered_at, left_at) values ($1,$2,$3,$4,$5,$6)", [v.sid, p.vid, SITE, path, iso(t), iso(t + secs * 1000)]);
        t += (secs + gap) * 1000;
      }
      await pg.query("insert into sessions(session_id, visitor_id, site_id, started_at, ended_at) values ($1,$2,$3,$4,$5)", [v.sid, p.vid, SITE, iso(v.at), iso(t)]);
      for (const fm of v.forms) {
        const at = (s?: number) => (s === undefined ? null : iso(v.at + s * 1000));
        await pg.query("insert into form_engagement(site_id, visitor_id, session_id, page_path, status, viewed_at, first_input_at, ended_at) values ($1,$2,$3,$4,$5,$6,$7,$8)", [SITE, p.vid, v.sid, fm.page, fm.status, at(fm.viewedAt), at(fm.firstInputAt), at(fm.endedAt)]);
      }
      if (v.sendAt !== undefined) {
        const r = await pg.query<{ id: string }>("insert into form_submissions(site_id, visitor_id, session_id, page_path, submitted_at, name) values ($1,$2,$3,'/contact',$4,$5) returning id", [SITE, p.vid, v.sid, iso(v.at + v.sendAt * 1000), p.name]);
        leadOf[r.rows[0].id] = p.name;
      }
    }
  }
  await pg.exec("analyze");
  const db: HookDb = {
    async query(sql, params) { return (await pg.query(sql, params as any[])).rows as any; },
    async explain(sql, params) { const r: any = await pg.query("EXPLAIN (FORMAT JSON) " + sql, params as any[]); const p = r.rows[0]["QUERY PLAN"][0].Plan; return { rows: p["Plan Rows"], cost: p["Total Cost"] }; },
  };
  const who = async (key: string, stats = { sessionHighMs: null as number | null }) => {
    clearEstimateCache();
    const m = catalogMark(key)!;
    const made = m.make({ vars: {}, stats });
    const spec = "spec" in made ? made.spec : compileRule(made.rule);
    const r = await runHook(db, SITE, spec, { maxCredits: 100000 });
    return (r.answer as any).values.map((x: string) => leadOf[x]).sort().join("");
  };
  const formValue = async (field: string, sid: string) => {
    clearEstimateCache();
    const r = await runHook(db, SITE, { v: 3, entity: "form", where: [{ id: "a", kind: "field", field: "session", op: "=", value: sid }, { id: "b", kind: "field", field: "status", op: "=", value: "submitted" }], output: { kind: "values", field } } as any);
    return (r.answer as any).values.map(String).join(",");
  };

  // the three signals, one by one
  ok((await formValue("leftWhileFilling", "sh")) === "true", "left while filling: H opened /pricing in the middle of the form");
  ok((await formValue("leftWhileFilling", "sr")) === "false", "not for R: no other page and no time away between the first input and sending");
  ok((await formValue("awaysAfterSeen", "sr")) === "2", "times away after seeing it: R was away twice (22 s, 20 s) after seeing the form");
  ok((await formValue("awaysAfterSeen", "sb")) === "0", "B was away twice BEFORE seeing the form: 0");
  ok((await formValue("pagesSeenToSent", "sc")) === "3", "pages between seeing and sending: C read /a, /b and /c (the form's own page not counted)");
  ok((await formValue("pagesSeenToSent", "sh")) === "1", "H: only /pricing");

  // the published marks
  ok((await who("hesitant-converters")) === "H", "Hesitant converters: H");
  ok((await who("researchers")) === "ER", "Researchers (in the sending visit): R and E (E did it in the sending visit too); not B");
  ok((await who("extensive-researchers")) === "E", "Extensive researchers (2+ visits): E only");
  ok((await who("convinced-by-content")) === "C", "Convinced by the content: C (3 pages after the form, no time away)");
  ok((await who("form-hurdle")) === "U", "Form was a hurdle: U gave up a form in an earlier visit, then sent one");
  ok((await who("high-activity", { sessionHighMs: 88_000 })) === "BCER", "High activity against a site normal of 88 s: B, E, R (90 s) and C (99 s); not H (87 s)");
  ok((await who("high-activity", { sessionHighMs: null })) === "", "Not enough visits for a site normal: the 5-minute fallback, nobody here");

  // the catalogue as a whole
  for (const m of CATALOG) {
    const made = m.make({ vars: {}, stats: { sessionHighMs: 60_000 } });
    const spec = "spec" in made ? made.spec : compileRule(made.rule);
    let err = "";
    try {
      clearEstimateCache();
      await runHook(db, SITE, spec, { maxCredits: 100000 });
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    ok(!err && spec.entity === "lead", "published: " + m.name + " runs" + (err ? " (" + err + ")" : ""));
  }
  const pr = catalogMark("pricing-reader")!;
  const made = pr.make({ vars: { pricing: "/plans" }, stats: { sessionHighMs: null } });
  ok("rule" in made && made.rule.rows[0].cards[0].path === "/plans", "a page variable: Pricing reader on a site whose pricing page is /plans");
  ok(catalogVersion(pr) === catalogVersion(pr), "a published mark's version is stable");
  ok(new Set(CATALOG.map((m) => m.key)).size === CATALOG.length, "every published key is unique");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
