/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// jh-marks/tests/rule.test.ts - marks compiled to Hook and run on PGlite (real Postgres), against four leads whose
// answers are worked out by hand. Also: checking, plain English, colours, templates. Run: npm run test:marks
import { PGlite } from "@electric-sql/pglite";
import { clearEstimateCache, runHook, type HookDb } from "../../jh-hook/engine/run";
import { seenPct, reasonFor } from "../reason";
import { colorFor, compileRule, describeRule, MARK_COLORS, RuleError, TEMPLATES, validateRule, type MarkRule } from "../rule";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const SITE = "11111111-1111-1111-1111-111111111111";
const DAY = 86_400_000;
const T0 = Date.parse("2026-10-01T10:00:00Z");
const iso = (t: number) => new Date(t).toISOString();

// Read % with page 2000 px, screen 800 px, entered at the top: seen = 0.4 + 0.6 x max scroll
const READ = { r100: 1, r85: 0.75, r52: 0.2 };
type V = { path: string; secs: number; read: number };
const fixture: { lead: string; vid: string; device: string; visits: { sid: string; at: number; utm?: string; ref?: string; pages: V[]; sendAfter?: number; after?: V[] }[]; fillSec?: number }[] = [
  // A: two visits. Visit 1: pricing 40 s read 100%. Visit 2 (google): blog, pricing 10 s, contact, SENDS, then pricing again
  { lead: "A", vid: "va", device: "desktop", fillSec: 30, visits: [
    { sid: "sa1", at: T0, pages: [{ path: "/", secs: 5, read: READ.r52 }, { path: "/pricing", secs: 40, read: READ.r100 }, { path: "/about", secs: 5, read: READ.r52 }] },
    { sid: "sa2", at: T0 + DAY, utm: "google", pages: [{ path: "/blog/x", secs: 20, read: READ.r85 }, { path: "/pricing", secs: 10, read: READ.r52 }, { path: "/contact", secs: 15, read: READ.r100 }], sendAfter: 2, after: [{ path: "/pricing", secs: 300, read: READ.r100 }] },
  ] },
  // B: one visit from facebook, sends; then a later visit with a long pricing view (after sending: never counts)
  { lead: "B", vid: "vb", device: "desktop", visits: [
    { sid: "sb1", at: T0 + 2 * DAY, ref: "https://m.facebook.com/", pages: [{ path: "/", secs: 3, read: READ.r52 }, { path: "/contact", secs: 20, read: READ.r100 }], sendAfter: 1 },
    { sid: "sb2", at: T0 + 3 * DAY, pages: [{ path: "/pricing", secs: 100, read: READ.r100 }] },
  ] },
  // C: one direct visit on a phone: pricing 35 s read 52%, demo, contact, sends (slow form)
  { lead: "C", vid: "vc", device: "mobile", fillSec: 90, visits: [
    { sid: "sc1", at: T0 + 4 * DAY, pages: [{ path: "/pricing", secs: 35, read: READ.r52 }, { path: "/demo", secs: 10, read: READ.r85 }, { path: "/contact", secs: 30, read: READ.r100 }], sendAfter: 2 },
  ] },
  // D: two visits, reads 85% or more of everything, pricing 5 s each time
  { lead: "D", vid: "vd", device: "desktop", visits: [
    { sid: "sd1", at: T0 + 5 * DAY, pages: [{ path: "/pricing", secs: 5, read: READ.r85 }] },
    { sid: "sd2", at: T0 + 6 * DAY, pages: [{ path: "/pricing", secs: 5, read: READ.r100 }, { path: "/contact", secs: 10, read: READ.r85 }], sendAfter: 1 },
  ] },
];

async function main() {
  const pg = new PGlite();
  await pg.exec(`
    create table sessions (id uuid primary key default gen_random_uuid(), session_id text unique, visitor_id text, site_id uuid, started_at timestamptz, ended_at timestamptz, last_activity_at timestamptz, referrer text, country text, timezone text, utm_source text, utm_medium text, utm_campaign text);
    create table page_views (id uuid primary key default gen_random_uuid(), page_view_id text, session_id text, visitor_id text, site_id uuid, page_url text, page_path text, page_title text, entered_at timestamptz, left_at timestamptz, time_on_page integer, scroll_depth real, max_scroll_depth real, max_scroll_reached_at timestamptz, page_height integer, entry_scroll_depth real, revisit_start_scroll_depth real, viewport_height integer);
    create table form_submissions (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_url text, page_path text, name text, email text, phone text, confidence text default 'high', raw_data jsonb, submitted_at timestamptz, qualified boolean);
    create table visitors (id uuid primary key default gen_random_uuid(), visitor_id text, site_id uuid, first_seen timestamptz, last_seen timestamptz, device_type text, browser text, os text, language text);
    create table form_engagement (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_view_id text, page_path text, form_index integer default 0, status text, last_field_type text, last_field_key text, viewed_at timestamptz, first_input_at timestamptz, ended_at timestamptz, field_timings jsonb default '{}', last_activity_at timestamptz, form_fields jsonb, onscreen_before_start_ms integer, form_key text, form_version_id uuid);`);
  const leadId: Record<string, string> = {};
  for (const f of fixture) {
    await pg.query("insert into visitors(visitor_id, site_id, device_type) values ($1,$2,$3)", [f.vid, SITE, f.device]);
    for (const v of f.visits) {
      await pg.query("insert into sessions(session_id, visitor_id, site_id, started_at, utm_source, referrer) values ($1,$2,$3,$4,$5,$6)", [v.sid, f.vid, SITE, iso(v.at), v.utm ?? null, v.ref ?? null]);
      let t = v.at;
      const put = async (p: V) => {
        await pg.query("insert into page_views(session_id, visitor_id, site_id, page_path, entered_at, left_at, page_height, viewport_height, entry_scroll_depth, max_scroll_depth) values ($1,$2,$3,$4,$5,$6,2000,800,0,$7)", [v.sid, f.vid, SITE, p.path, iso(t), iso(t + p.secs * 1000), p.read]);
        t += p.secs * 1000 + 1000;
      };
      for (const p of v.pages) await put(p);
      if (v.sendAfter !== undefined) {
        const at = t - 500; // while on the last page listed
        const r = await pg.query<{ id: string }>("insert into form_submissions(site_id, visitor_id, session_id, page_path, submitted_at, name) values ($1,$2,$3,'/contact',$4,$5) returning id", [SITE, f.vid, v.sid, iso(at), f.lead]);
        leadId[f.lead] = r.rows[0].id;
        if (f.fillSec) await pg.query("insert into form_engagement(site_id, visitor_id, session_id, page_path, status, first_input_at, ended_at) values ($1,$2,$3,'/contact','submitted',$4,$5)", [SITE, f.vid, v.sid, iso(at - f.fillSec * 1000), iso(at)]);
        for (const p of v.after ?? []) await put(p);
      }
    }
  }
  await pg.exec("analyze");
  const db: HookDb = {
    async query(sql, params) { return (await pg.query(sql, params as any[])).rows as any; },
    async explain(sql, params) { const r: any = await pg.query("EXPLAIN (FORMAT JSON) " + sql, params as any[]); const p = r.rows[0]["QUERY PLAN"][0].Plan; return { rows: p["Plan Rows"], cost: p["Total Cost"] }; },
  };
  const nameOf = Object.fromEntries(Object.entries(leadId).map(([k, v]) => [v, k]));
  const who = async (rule: Partial<MarkRule>): Promise<string> => {
    clearEstimateCache();
    const r = await runHook(db, SITE, compileRule(validateRule({ v: 1, scope: "any", rows: [], lead: [], ...rule })), { maxCredits: 100000 });
    if (r.answer.shape !== "list") throw new Error("not a list");
    return r.answer.values.map((id) => nameOf[id]).sort().join("");
  };
  const card = (path: string, extra: object = {}) => ({ id: "c" + path, path, match: "exact", ...extra });
  const row = (cards: object[], order = "any") => ({ id: "r", order, cards });

  ok((await who({ rows: [row([card("/pricing", { minSeconds: 30 })])] as any })) === "AC", "saw /pricing for 30 s or more: A (visit 1) and C. Not B (only after sending), not D (5 s)");
  ok((await who({ scope: "converting", rows: [row([card("/pricing", { minSeconds: 30 })])] as any })) === "C", "only the visit they sent the form in: C (A's pricing that visit was 10 s)");
  ok((await who({ rows: [row([card("/pricing"), card("/contact")], "sequence")] as any })) === "ACD", "/pricing then /contact in one visit: A, C, D");
  ok((await who({ rows: [row([card("/contact"), card("/pricing")], "sequence")] as any })) === "", "/contact then /pricing: nobody (A's pricing after contact came after sending)");
  ok((await who({ rows: [row([card("/pricing"), card("/demo")])] as any })) === "C", "any order, two pages: /pricing and /demo: C");
  ok((await who({ rows: [row([card("/pricing", { minTimes: 2 })])] as any })) === "AD", "/pricing twice or more across visits: A, D (A's third view was after sending)");
  ok((await who({ rows: [row([card("/pricing", { minTimes: 2, timesIn: "visit" })])] as any })) === "", "/pricing twice in ONE visit: nobody");
  ok((await who({ scope: "all", rows: [row([card("/pricing")])] as any })) === "ACD", "/pricing in every visit before sending: A, C, D (B's visit had none)");
  ok((await who({ rows: [row([card("/blog/", { match: "startsWith" })])] as any })) === "A", "any page under /blog/: A");
  ok((await who({ rows: [row([card("/pricing", { minReadPct: 80 })])] as any })) === "AD", "read 80% or more of /pricing: A (visit 1) and D");
  ok((await who({ lead: [{ id: "x", kind: "readEvery", minPct: 80 }, { id: "y", kind: "pages", min: 2 }] as any })) === "D", "template 'General high intent' (80% of every page, 2+ pages): D");
  ok((await who({ lead: [{ id: "x", kind: "visits", min: 2 }] as any })) === "AD", "came twice or more before sending: A, D (B's second visit was after)");
  ok((await who({ lead: [{ id: "x", kind: "source", value: "google" }] as any })) === "A", "came from google (utm): A");
  ok((await who({ lead: [{ id: "x", kind: "source", value: "facebook" }] as any })) === "B", "came from facebook (referrer): B");
  ok((await who({ scope: "converting", lead: [{ id: "x", kind: "source", value: "google" }] as any })) === "A", "came from google in the sending visit: A");
  ok((await who({ lead: [{ id: "x", kind: "device", value: "mobile" }] as any })) === "C", "on a phone: C");
  ok((await who({ lead: [{ id: "x", kind: "formTime", op: "under", seconds: 60 }] as any })) === "A", "filled the form in under 60 s: A");
  ok((await who({ lead: [{ id: "x", kind: "formTime", op: "over", seconds: 60 }] as any })) === "C", "filled the form in over 60 s: C");
  ok((await who({ lead: [{ id: "x", kind: "totalTime", minSeconds: 70 }] as any })) === "AC", "spent 70 s or more on the site before sending: A (95 s) and C (75 s)");
  ok((await who({ rows: [row([card("/pricing", { minSeconds: 30 })])], lead: [{ id: "x", kind: "device", value: "mobile" }] } as any)) === "C", "rows and lead chips together are AND: C");

  // reasons, from the lead's own rows, and the read share agreeing with Hook's
  const rows = async (sql: string, p: unknown[]) => (await pg.query<any>(sql, p)).rows;
  const input = async (lead: string) => {
    const s = (await rows("select * from form_submissions where id = $1", [leadId[lead]]))[0];
    const pages = (await rows("select session_id, page_path, entered_at, left_at, page_height, viewport_height, entry_scroll_depth, max_scroll_depth, revisit_start_scroll_depth from page_views where visitor_id = $1", [s.visitor_id])).map((p: any) => ({ ...p, entered_at: new Date(p.entered_at).toISOString(), left_at: p.left_at ? new Date(p.left_at).toISOString() : null }));
    const sessions = (await rows("select session_id, started_at, referrer, utm_source from sessions where visitor_id = $1", [s.visitor_id])).map((x: any) => ({ ...x, started_at: new Date(x.started_at).toISOString() }));
    return { submittedAt: new Date(s.submitted_at).toISOString(), sessionId: s.session_id, pages, sessions, device: lead === "C" ? "mobile" : "desktop", fillMs: lead === "A" ? 30_000 : lead === "C" ? 90_000 : null };
  };
  const hookSeen = (await runHook(db, SITE, { v: 3, entity: "pageView", where: [], output: { kind: "values", field: "seenPct" } } as any)).answer as any;
  const jsSeen = (await rows("select page_height, viewport_height, entry_scroll_depth, max_scroll_depth, revisit_start_scroll_depth from page_views", [])).map((p: any) => seenPct(p));
  ok(JSON.stringify([...new Set(hookSeen.values.map(Number))].sort()) === JSON.stringify([...new Set(jsSeen)].sort()), "the read share in JS is Hook's seenPct, value for value: " + [...new Set(jsSeen)].sort().join(", "));
  const ra = reasonFor(validateRule({ rows: [{ cards: [{ path: "/pricing", minSeconds: 30 }] }], lead: [{ kind: "visits", min: 2 }, { kind: "source", value: "google" }, { kind: "formTime", op: "under", seconds: 60 }] }), await input("A"));
  console.log("reason A:", ra);
  ok(ra.join(" | ") === "/pricing: 1 view, longest 40 s, read 100% | 2 visits | from google | form filled in 30 s", "A's reason: the 40 s pricing view (not the 300 s one after sending), 2 visits, google, 30 s form");
  const rb = reasonFor(validateRule({ lead: [{ kind: "readEvery", minPct: 80 }, { kind: "pages", min: 2 }] }), await input("D"));
  ok(rb.join(" | ") === "read at least 85% of every page | 3 pages", "D's reason for the high intent template: " + rb.join(" | "));
  ok(reasonFor(validateRule({ rows: [{ order: "sequence", cards: [{ path: "/pricing" }, { path: "/contact" }] }] }), await input("C"))[0] === "/pricing → /contact in one visit", "a sequence reads as a path");
  ok(reasonFor(null, await input("C")).length === 0, "a mark made in Hook has no rule: no reason phrases");

  // checking
  const bad = (x: unknown) => { try { validateRule(x); return ""; } catch (e) { return e instanceof RuleError ? e.message : "other"; } };
  ok(bad({ v: 1, rows: [], lead: [] }) === "Add at least one condition.", "an empty mark is refused");
  ok(validateRule({ rows: [{ cards: [{ path: "https://x.com/pricing?a=1" }] }] }).rows[0].cards[0].path === "/pricing", "a pasted full address becomes its path");
  ok(validateRule({ rows: [{ order: "sequence", cards: [{ path: "/a", minTimes: 3 }, { path: "/b" }] }] }).rows[0].cards[0].minTimes === null, "times are dropped inside an ordered row (it is about one visit)");
  ok(validateRule({ rows: [{ order: "sequence", cards: [{ path: "/a" }] }] }).rows[0].order === "any", "one page can't be in order: back to any");
  ok(bad({ rows: [{ cards: [{ path: "/a", minReadPct: 140 }] }] }).includes("between 1 and 100"), "a read share over 100 is refused");
  ok(bad({ lead: [{ kind: "nope" }] }) === "Unknown condition.", "an unknown chip is refused");

  // plain English
  const reads = describeRule(validateRule({ rows: [{ cards: [{ path: "/pricing", minSeconds: 30, minReadPct: 80 }] }, { order: "sequence", cards: [{ path: "/pricing" }, { path: "/demo" }] }], lead: [{ kind: "source", value: "google" }] }));
  console.log("reads:", reads);
  ok(reads === "Before sending the form, they saw /pricing (stayed 30 s or more, read 80% or more of it); saw /pricing, then /demo, in one visit; and came from google.", "reads as one plain sentence");
  ok(describeRule(validateRule({ scope: "converting", lead: [{ kind: "visits", min: 1 }] })).startsWith("In the visit they sent the form"), "scope words");

  ok(MARK_COLORS.includes(colorFor("Pricing reader") as any) && colorFor("a") === colorFor("a"), "colour from the name: stable, from the palette");
  ok(TEMPLATES.length === 3 && TEMPLATES.every((t) => validateRule(t.rule) && compileRule(validateRule(t.rule)).entity === "lead"), "the three templates are valid marks on leads");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
