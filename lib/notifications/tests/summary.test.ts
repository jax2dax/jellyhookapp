/* eslint-disable @typescript-eslint/no-explicit-any -- a stand-in database */
// lib/notifications/tests/summary.test.ts - the visit and page summaries of hook messages, from database rows to words
// (lib/notifications/summary.ts, mds/build/notifications/session-summary.md). Run: npm run test:marks
// "server-only" is replaced by an empty module here (it throws outside a Next server build).
import { createJiti } from "jiti";
import { join } from "node:path";
import { keyOfText } from "../../tracking/headingTime.js";

const root = process.cwd();
const jiti = createJiti(join(root, "lib/notifications/tests/summary.test.ts"), {
  alias: { "server-only": join(root, "lib/notifications/tests/emptyModule.ts"), "@": root },
});

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

// ── a stand-in Supabase client: answers selects on the tables summary.ts reads, records the filters ──
type Row = Record<string, unknown>;
function fakeDb(tables: Record<string, Row[]>, opts: { failOn?: string; delayMs?: number } = {}) {
  const reads: string[] = [];
  return {
    reads,
    from(table: string) {
      let rowsOut = [...(tables[table] ?? [])];
      const q: any = {
        select() { return q; },
        eq(k: string, v: unknown) { rowsOut = rowsOut.filter((r) => r[k] === v); return q; },
        in(k: string, vs: unknown[]) { rowsOut = rowsOut.filter((r) => vs.includes(r[k])); return q; },
        lte(k: string, v: string) { rowsOut = rowsOut.filter((r) => String(r[k]) <= v); return q; },
        order(k: string, o?: { ascending?: boolean }) { rowsOut.sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : 1) * (o?.ascending === false ? -1 : 1)); return q; },
        range(from: number, to: number) { rowsOut = rowsOut.slice(from, to + 1); return q; },
        then(resolve: (v: unknown) => void) {
          reads.push(table);
          const answer = opts.failOn === table ? { data: null, error: { message: "boom" } } : { data: rowsOut, error: null };
          if (opts.delayMs) setTimeout(() => resolve(answer), opts.delayMs);
          else resolve(answer);
        },
      };
      return q;
    },
  };
}

const now = Date.now();
const T = (s: number) => new Date(now - 300_000 + s * 1000).toISOString(); // the form visit started 5 minutes ago
const DAY = 86_400;
const ht = (entries: [string, number][]) => ({ t: 2, h: entries.map(([text, s], i) => [keyOfText(text), 2, i, s * 10, 1]) });
const pv = (id: string, session: string, path: string, from: number, to: number | null, headingTime: unknown = null): Row => ({
  page_view_id: id, session_id: session, visitor_id: "v1", site_id: "site1", page_path: path,
  entered_at: T(from), left_at: to === null ? null : T(to), viewport_height: 900, page_height: 3000,
  entry_scroll_depth: 0, scroll_depth: 0.6, max_scroll_depth: 0.6, revisit_start_scroll_depth: null, heading_time: headingTime,
});
const headers = [{ i: 0, text: "Plans", tag: "h2", y: 300 }, { i: 1, text: "Business", tag: "h2", y: 1300 }, { i: 2, text: "Questions", tag: "h2", y: 2500 }];

const tables: Record<string, Row[]> = {
  sessions: [
    { session_id: "s_old", visitor_id: "v1", site_id: "site1", started_at: T(-DAY), ended_at: T(-DAY + 60), last_activity_at: T(-DAY + 60) },
    { session_id: "s_form", visitor_id: "v1", site_id: "site1", started_at: T(0), ended_at: null, last_activity_at: T(110) },
  ],
  page_views: [
    pv("p0", "s_old", "/pricing", -DAY, -DAY + 50, ht([["Plans", 20], ["Business", 25]])),
    pv("p1", "s_form", "/", 0, 20, ht([["Plans", 12]])),
    pv("p2", "s_form", "/pricing", 21, 80, ht([["Business", 45], ["Questions", 5]])),
    // the form page, still open: its heading times are the snapshot sent with the form
    pv("p3", "s_form", "/contact", 81, null, ht([["Plans", 10]])),
  ],
  page_structure_versions: ["/", "/pricing", "/contact"].map((path, i) => ({ id: "ver" + i, site_id: "site1", page_path: path, device_class: "desktop", headers, page_height: 3000, first_seen_at: T(-10 * DAY) })),
  page_structure: [],
};
const lead = { id: "L1", visitor_id: "v1", session_id: "s_form", submitted_at: T(100) };
const opts = (o: Record<string, unknown> = {}) => ({ source: true, adImage: true, watchButton: true, openButton: true, details: true, summary: "moderate", pages: [], pageScope: "all", ...o }) as any;

const run = async () => {
  const { buildSummaries, summariesWithin, wantsSummary } = (await jiti.import(join(root, "lib/notifications/summary.ts"))) as typeof import("../summary");

  const db = fakeDb(tables);
  const r = await buildSummaries("site1", [lead], [{ key: "r1|L1", leadId: "L1", options: opts({ pages: ["/pricing", "/careers"] }) }], db as any);
  const s = r.get("r1|L1");
  const lines = s?.summary?.lines ?? [];
  ok(lines[0] === "Their 2nd visit: / (20s) → /pricing (59s) → /contact (19s).", "the visit with the form, numbered from the first visit ever, cut at the form: " + lines[0]);
  ok(lines.includes("Most of the time on /pricing (59s)."), "where most of the time went");
  ok(lines.some((l) => l.startsWith('The most on "Business" on /pricing (45s)')), "the heading with the most time");
  ok(lines.some((l) => l.startsWith('The least on "Questions" on /pricing (5s)')), "the heading with the least time");
  const form = await buildSummaries("site1", [lead], [{ key: "f", leadId: "L1", options: opts({ summary: "off", pages: ["/contact"] }) }], fakeDb(tables) as any);
  const formText = form.get("f")?.pages?.[0].text ?? "";
  ok(formText.startsWith("19s;") && formText.includes('most on "Plans" (10s)') && formText.endsWith("sent the form here"), "the open form page: cut at the form, its headings from the snapshot: " + formText);
  ok(s?.pages?.[0].path === "/pricing" && (s.pages[0].text ?? "").startsWith("1m 49s over 2 views in 2 visits"), "page summary over every visit: " + s?.pages?.[0].text);
  ok(s?.pages?.[1].text === null, "a page never opened: null (the message says Page not visited)");
  ok(JSON.stringify(db.reads.sort()) === JSON.stringify(["page_structure_versions", "page_views", "sessions"]), "one read per table for the whole batch: " + db.reads.join(", "));

  const conv = await buildSummaries("site1", [lead], [{ key: "k", leadId: "L1", options: opts({ summary: "off", pages: ["/pricing"], pageScope: "converting" }) }], fakeDb(tables) as any);
  ok(conv.get("k")?.summary === null && (conv.get("k")?.pages?.[0].text ?? "").startsWith("59s;"), "summary off, page summary from the visit with the form only");

  const shortR = await buildSummaries("site1", [lead], [{ key: "k", leadId: "L1", options: opts({ summary: "short" }) }], fakeDb(tables) as any);
  ok(shortR.get("k")?.summary?.lines.length === 1, "Short is one line");

  const longR = await buildSummaries("site1", [lead], [{ key: "k", leadId: "L1", options: opts({ summary: "long" }) }], fakeDb(tables) as any);
  ok((longR.get("k")?.summary?.lines ?? []).some((l) => l.startsWith("Sent the form on /contact")), "Long ends with where they sent the form");

  // nothing asked: nothing read
  const idle = fakeDb(tables);
  ok((await buildSummaries("site1", [lead], [{ key: "k", leadId: "L1", options: opts({ summary: "off" }) }], idle as any)).size === 0 && idle.reads.length === 0, "summary off and no pages: no query at all");
  ok(!wantsSummary(opts({ summary: "off" })) && wantsSummary(opts({ summary: "off", pages: ["/a"] })), "wantsSummary");

  // a lead without a visitor or without visits: left out, others unaffected
  const two = await buildSummaries("site1", [lead, { id: "L2", visitor_id: "nobody", session_id: null, submitted_at: T(100) }], [{ key: "a", leadId: "L1", options: opts() }, { key: "b", leadId: "L2", options: opts() }], fakeDb(tables) as any);
  ok(two.has("a") && !two.has("b"), "a lead with no visits gets no summary; the other is unaffected");

  // failures and slowness: the messages go without summaries, never an error
  let threw = false;
  try { await buildSummaries("site1", [lead], [{ key: "k", leadId: "L1", options: opts() }], fakeDb(tables, { failOn: "page_views" }) as any); } catch { threw = true; }
  ok(threw, "buildSummaries reports a failed read to its caller");
  // summariesWithin builds its own client: give it no database and a short budget
  const t0 = Date.now();
  const late = await summariesWithin(50, "site1", [lead], [{ key: "k", leadId: "L1", options: opts() }]);
  ok(late.size === 0 && Date.now() - t0 < 2000, "summariesWithin: a failure or the budget passing gives no summaries, quickly");
  const t1 = Date.now();
  const slow = await summariesWithin(100, "site1", [lead], [{ key: "k", leadId: "L1", options: opts() }], fakeDb(tables, { delayMs: 1500 }) as any);
  ok(slow.size === 0 && Date.now() - t1 < 1000, "a slow database: the budget passes and the messages go without summaries (" + (Date.now() - t1) + " ms)");
  const quick = await summariesWithin(2500, "site1", [lead], [{ key: "k", leadId: "L1", options: opts() }], fakeDb(tables) as any);
  ok(quick.get("k")?.summary?.lines.length === 4, "within the budget: the summaries");
  ok((await summariesWithin(50, "site1", [lead], [{ key: "k", leadId: "L1", options: opts({ summary: "off" }) }])).size === 0, "summariesWithin: nothing asked, nothing done");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
};
run();
