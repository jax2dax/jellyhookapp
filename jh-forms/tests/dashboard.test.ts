/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures are plain JSON rows */
// jh-forms/tests/dashboard.test.ts - the dashboard's Hook queries, run for real (PGlite = real Postgres), and the assembly.
// Run: npm run test:forms
import { PGlite } from "@electric-sql/pglite";
import { runHook, clearEstimateCache, type HookDb } from "../../jh-hook/engine/run";
import { assembleDashboard, dashboardSpecs, formListSpecs, type DashboardAnswers, type FormScope, type Rows } from "../dashboard";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const SITE = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const NOW = Date.now();
const ago = (days: number, extraMs = 0) => new Date(NOW - days * 86_400_000 + extraMs).toISOString();
const FIELDS = JSON.stringify([{ key: "name", type: "text", required: true }, { key: "email", type: "email", required: true }, { key: "phone", type: "tel", required: false }]);
const T = (order: number, focused: number, key: number | null, extra: object = {}) => ({ order, totalFocusedMs: focused, firstFocusAt: "2026-10-10T10:00:00Z", firstKeydownAt: key === null ? null : "2026-10-10T10:00:00Z", ...extra });
// firstKeydownAt - firstFocusAt must equal the hesitation: build explicit times
const timing = (order: number, focused: number, hesitation: number | null, extra: object = {}) => ({
  order, totalFocusedMs: focused, firstFocusAt: "2026-10-10T10:00:00Z",
  firstKeydownAt: hesitation === null ? null : new Date(Date.parse("2026-10-10T10:00:00Z") + hesitation).toISOString(),
  lastUnfocusAt: "2026-10-10T10:00:30Z", visits: [["2026-10-10T10:00:00Z", "2026-10-10T10:00:30Z", 1]], ...extra,
});
void T;

async function main() {
  const pg = new PGlite();
  await pg.exec(`create table form_engagement (id uuid primary key default gen_random_uuid(), site_id uuid, visitor_id text, session_id text, page_view_id text, page_path text, form_index integer default 0, status text, last_field_type text, last_field_key text, viewed_at timestamptz, first_input_at timestamptz, ended_at timestamptz, field_timings jsonb default '{}', last_activity_at timestamptz, form_fields jsonb, onscreen_before_start_ms integer, form_key text, form_version_id uuid);`);
  const ins = (site: string, page: string, status: string, viewedDays: number, first: boolean, fillSec: number | null, last: string | null, ft: object, onscreen: number | null, ff: string | null = FIELDS) =>
    pg.query("insert into form_engagement(site_id,visitor_id,session_id,page_path,status,last_field_type,viewed_at,first_input_at,ended_at,field_timings,form_fields,onscreen_before_start_ms,form_key) values ($1,'v','s',$2,$3,$4,$5,$6,$7,$8,$9,$10,'path:' || $2 || '#0')",
      [site, page, status, last, ago(viewedDays), first ? ago(viewedDays, 4000) : null, fillSec === null ? null : ago(viewedDays, 4000 + fillSec * 1000), JSON.stringify(ft), ff, onscreen]);

  // /contact: 2 submitted (fill 30 s and 50 s), 3 abandoned (all ending on phone), 1 in progress, 2 only seen
  const full = { name: timing(1, 4000, 1000, { filled: true, edits: 1 }), email: timing(2, 9000, 2000, { filled: true, edits: 2, errors: 1 }), phone: timing(3, 5000, 1000, { filled: true, edits: 1 }) };
  await ins(SITE, "/contact", "submitted", 1, true, 30, "phone", full, 3000);
  await ins(SITE, "/contact", "submitted", 2, true, 50, "phone", full, 5000);
  for (let i = 0; i < 3; i++) await ins(SITE, "/contact", "abandoned", 2 + i, true, 20, "phone", { name: timing(1, 4000, 1000, { filled: true, edits: 1 }), email: timing(2, 3000, 2000, { filled: true, edits: 1 }), phone: timing(3, 8000, null, { filled: false, edits: 0 }) }, 2000);
  await ins(SITE, "/contact", "started", 0, true, null, "name", { name: timing(1, 1000, 500, { filled: true, edits: 1 }) }, 1000);
  for (let i = 0; i < 2; i++) await ins(SITE, "/contact", "viewed", 3, false, null, null, {}, null);
  // /demo: 1 submitted; an old form (45 days ago, outside a 30 day range); another site's form
  await ins(SITE, "/demo", "submitted", 1, true, 10, "email", { email: timing(1, 2000, 500, { filled: true, edits: 1 }) }, 1500, JSON.stringify([{ key: "email", type: "email", required: true }]));
  await ins(SITE, "/contact", "submitted", 45, true, 10, "email", full, 1000);
  await ins(OTHER, "/contact", "submitted", 1, true, 10, "email", full, 1000);
  await pg.exec("analyze");

  const db: HookDb = {
    async query(sql, params) { return (await pg.query(sql, params as any[])).rows as any; },
    async explain(sql, params) { const res: any = await pg.query("EXPLAIN (FORMAT JSON) " + sql, params as any[]); const p = res.rows[0]["QUERY PLAN"][0].Plan; return { rows: p["Plan Rows"], cost: p["Total Cost"] }; },
  };
  const run = async (scope: FormScope) => {
    clearEstimateCache();
    const specs = dashboardSpecs(scope);
    const out: Record<string, Rows> = {};
    for (const [k, s] of Object.entries(specs)) {
      const r = await runHook(db, SITE, s, { maxCredits: 1000 });
      out[k] = r.answer.shape === "table" ? (r.answer.rows as Rows) : [];
    }
    return assembleDashboard(out as DashboardAnswers);
  };

  const all = await run({ formKey: null, from: ago(30) });
  ok(all.funnel.seen === 9 && all.funnel.started === 7 && all.funnel.submitted === 3 && all.funnel.abandoned === 3 && all.funnel.inProgress === 1, "funnel over 30 days, this site only: 9 seen, 7 started, 3 submitted, 3 abandoned, 1 in progress (the 45-day-old form and the other site's form are out)");
  ok(near(all.funnel.completionRate, 3 / 7) && near(all.funnel.startRate, 7 / 9) && near(all.funnel.abandonRate, 3 / 6), "rates: completion = submitted / started, start = started / seen, abandon = abandoned / (submitted + abandoned)");

  const contact = all.pages.find((p) => p.page === "/contact")!;
  ok(contact.seen === 8 && contact.started === 6 && contact.submitted === 2 && contact.abandoned === 3, "per page: /contact 8 seen, 6 started, 2 submitted, 3 abandoned");
  ok(near(contact.medianFillMs, 40_000), "median fill time of submitted /contact forms: 40 s (30 s and 50 s)");
  ok(contact.beforeTypingIsOnScreen && near(contact.medianBeforeTypingMs, 2000), "median time on screen before typing, for forms that have it: 2 s");
  ok(all.pages[0].page === "/contact", "pages ranked by how many forms were seen");

  const f = (n: string) => all.fields.find((x) => x.name === n)!;
  ok(f("phone").gaveUp === 3 && near(f("phone").gaveUpShare, 1), "phone: all 3 abandoned forms ended on it (give-up share 100%)");
  ok(f("name").gaveUp === 0, "name: nobody gave up on it");
  ok(f("email").errors === 2 && f("name").errors === 0, "validation errors: email failed twice (once on each submitted /contact form)");
  ok(f("phone").leftEmpty === 3, "phone left empty by the 3 who gave up there");
  ok(f("email").corrected === 2 && f("phone").corrected === 0, "corrected (value changed in more than one visit): email on 2 forms");
  ok(f("name").required && f("email").required && !f("phone").required, "required comes from the form's field list");
  console.log("name:", f("name").touched, "of", f("name").rows);
  ok(f("name").rows === 8 && f("name").touched === 6, "reach counts the forms that list the field: name was clicked into in 6 of the 8 /contact forms (the 2 only seen never touched it; /demo lists only email)");
  ok(near(f("email").medianHesitationMs, 2000), "median time before typing in the email field: 2 s (five 2 s, one 0.5 s)");
  ok(all.headline !== null && all.headline.includes("phone"), "the headline names the field most people give up on: " + all.headline);

  const one = await run({ formKey: "path:/demo#0", from: ago(30) });
  ok(one.funnel.seen === 1 && one.funnel.submitted === 1 && one.fields.length === 1 && one.fields[0].name === "email", "one form (by its key): only that form and its fields");
  const week = await run({ formKey: null, from: ago(0.5) });
  ok(week.funnel.seen === 1 && week.funnel.started === 1, "a shorter range (from 12 h ago) keeps only the form seen today");
  const until = await run({ formKey: "path:/contact#0", from: ago(60), to: ago(30) });
  ok(until.funnel.seen === 1 && until.funnel.submitted === 1, "a closed date range: only the /contact form from 45 days ago");
  ok(all.daily.length > 0 && all.daily.reduce((n, d) => n + d.submitted, 0) === 3 && all.daily.reduce((n, d) => n + d.seen, 0) === 9, "per-day series: 9 seen, 3 submissions in total");

  // versions: put the two submitted /contact forms in one version
  const V = "33333333-3333-3333-3333-333333333333";
  await pg.query("update form_engagement set form_version_id = $1 where site_id = $2 and page_path = '/contact' and status = 'submitted' and viewed_at > now() - interval '30 days'", [V, SITE]);
  const ver = await run({ formKey: "path:/contact#0", version: V });
  ok(ver.funnel.seen === 2 && ver.funnel.submitted === 2 && ver.funnel.completionRate === 1, "one version: only its rows (2 seen, 2 submitted)");
  const allTime = await run({ formKey: "path:/contact#0" });
  ok(allTime.funnel.seen === 9, "all time for one form: every row of it, the 45-day-old one too (9)");

  clearEstimateCache();
  const fl: Record<string, Rows> = {};
  for (const [k, s] of Object.entries(formListSpecs())) { const r = await runHook(db, SITE, s, { maxCredits: 1000 }); fl[k] = r.answer.shape === "table" ? (r.answer.rows as Rows) : []; }
  ok(fl.formsSubmitted[0]?.key === "path:/contact#0" && Number(fl.formsSubmitted[0]?.value) === 3, "form list: /contact has the most submissions (3, all time, this site only)");

  const empty = assembleDashboard({ statusCounts: [], pagesSeen: [] } as unknown as DashboardAnswers);
  ok(empty.funnel.seen === 0 && empty.funnel.completionRate === null && empty.pages.length === 0 && empty.headline === null, "no forms: zeros, rates are empty (never a division by zero), no headline");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
function near(a: number | null, b: number) { return a !== null && Math.abs(a - b) < 1e-6; }
main().catch((e) => { console.error(e); process.exit(2); });
