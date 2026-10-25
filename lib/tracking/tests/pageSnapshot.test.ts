/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
// lib/tracking/tests/pageSnapshot.test.ts - the form page "so far" sent with a form (lib/tracking/pageSnapshot.js,
// public/tracker.js jhPageSnapshot). Run: npm run test:tracking
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyPageSnapshot, cleanPageSnapshot } from "../pageSnapshot.js";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const now = Date.parse("2026-10-25T10:00:00Z");
const good = {
  page_view_id: "pv_12345678",
  duration: 60_000,
  heading_time: { t: 2, h: [["abc", 2, 0, 550, 2], ["~", 0, -2, 30, 0]] },
  scroll_depth: 0.8,
  max_scroll_depth: 0.9,
  max_scroll_reached_at: new Date(now - 5000).toISOString(),
  revisit_start_scroll: null,
  viewport_height: 900,
};

const c = cleanPageSnapshot(good, now)!;
ok(c.pageViewId === "pv_12345678", "the page view id is kept");
ok(c.update.heading_time?.h?.[0]?.[3] === 550, "heading time is kept");
ok(c.update.scroll_depth === 0.8 && c.update.max_scroll_depth === 0.9 && c.update.viewport_height === 900, "scroll and viewport are kept");
ok("revisit_start_scroll_depth" in c.update && c.update.revisit_start_scroll_depth === null, "never revisited is written as null");
ok(!("left_at" in c.update) && !("time_on_page" in c.update), "the page view is not ended by a snapshot");
ok(cleanPageSnapshot({ ...good, heading_time: { t: 2, h: [["abc", 2, 0, 99999, 1]] } }, now)!.update.heading_time.h[0][3] <= 620, "no heading gets more time than the page had");
ok(cleanPageSnapshot({ ...good, page_view_id: "x" }, now) === null, "a bad page view id: nothing");
ok(cleanPageSnapshot({ ...good, duration: -1 }, now) === null, "a bad duration: nothing");
ok(cleanPageSnapshot(null, now) === null && cleanPageSnapshot("x", now) === null && cleanPageSnapshot([], now) === null, "not an object: nothing");
ok(cleanPageSnapshot({ page_view_id: "pv_12345678", duration: 1000 }, now) === null, "nothing to write: nothing");
ok(cleanPageSnapshot({ ...good, max_scroll_depth: 4 }, now)!.update.max_scroll_depth === undefined, "out-of-range scroll is dropped");

// the write: only into an open page view; failures never throw
function fakeDb(results: { data?: any; error?: any }[]) {
  const calls: { update: any; filters: string[] }[] = [];
  return {
    calls,
    from() {
      const call = { update: null as any, filters: [] as string[] };
      const q: any = {
        update(u: any) { call.update = u; calls.push(call); return q; },
        eq(k: string, v: string) { call.filters.push(k + "=" + v); return q; },
        is(k: string, v: null) { call.filters.push(k + " is " + v); return q; },
        select() { return Promise.resolve(results[calls.length - 1] ?? { data: [], error: null }); },
      };
      return q;
    },
  };
}

const run = async () => {
  const db = fakeDb([{ data: [{ id: 1 }], error: null }]);
  ok((await applyPageSnapshot(db, "site1", good, now)) === true, "an open page view is written");
  ok(db.calls[0].filters.includes("left_at is null") && db.calls[0].filters.includes("site_id=site1") && db.calls[0].filters.includes("page_view_id=pv_12345678"), "only that site's page view, only while open");

  const ended = fakeDb([{ data: [], error: null }]);
  ok((await applyPageSnapshot(ended, "site1", good, now)) === false, "an ended page view is left alone");

  const old = fakeDb([{ data: null, error: { message: 'column "heading_time" does not exist' } }, { data: [{ id: 1 }], error: null }]);
  ok((await applyPageSnapshot(old, "site1", good, now)) === true && !("heading_time" in old.calls[1].update), "before migration 19: the scroll alone");

  const broken = { from() { throw new Error("down"); } };
  ok((await applyPageSnapshot(broken, "site1", good, now)) === false, "a database failure returns false, never throws");
  ok((await applyPageSnapshot(fakeDb([]), "site1", { junk: true }, now)) === false, "junk is ignored");

  // the tracker sends it with every kind of form
  const src = readFileSync(join(process.cwd(), "public/tracker.js"), "utf8");
  ok((src.match(/page_snapshot: jhPageSnapshot\(\)/g) ?? []).length === 3, "the tracker sends a snapshot with forms, HubSpot forms and embedded forms");
  ok(/peek: function \(\)/.test(src) && /credit\(stayMs \+ open, copy\)/.test(src), "the heading meter can be read without ending it");

  console.log(`\n${passes} passed, ${fails} failed`);
  if (fails) process.exit(1);
};
run();
