// lib/analytics/visitsAggregate.test.ts
// The counting rules of "Visits over time". Run: npm run test:visits
import { aggregateVisits, OTHER_KEY, type AggSession } from "./visitsAggregate";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) {
    passes++;
    console.log("ok:", m);
  } else {
    fails++;
    console.log("FAIL:", m);
  }
};

const H = 3_600_000;
const start = new Date(Date.UTC(2026, 9, 6, 0));
const at = (h: number, m = 0) => new Date(start.getTime() + h * H + m * 60_000).toISOString();
let n = 0;
const s = (visitorId: string | null, h: number, m: number, group = "Direct"): AggSession => ({ id: `s${++n}`, startedAt: at(h, m), visitorId, group });
const opts = { start, end: new Date(start.getTime() + 24 * H), bucketMs: H, bucketCount: 24, unique: false, split: false, top: 7 };

// the example from the spec: 3 sessions at 2:xx and 2 at 3:xx from one person
const person = [s("v1", 2, 5), s("v1", 2, 20), s("v1", 2, 40), s("v1", 3, 10), s("v1", 3, 50)];
let r = aggregateVisits(person, opts);
ok(r.buckets[2].visits === 3 && r.buckets[3].visits === 2 && r.total === 5, "plain: every session counts (3 at 2:00, 2 at 3:00)");
r = aggregateVisits(person, { ...opts, unique: true });
ok(r.buckets[2].visits === 1 && r.buckets[3].visits === 1 && r.total === 2, "unique: one person counts once per hour (1 at 2:00, 1 at 3:00, not 5)");

r = aggregateVisits([s("v1", 1, 0), s("v2", 1, 30), s(null, 1, 40), s(null, 1, 50)], { ...opts, unique: true });
ok(r.buckets[1].visits === 4, "unique: two different people + two sessions with no visitor id = 4");

// split: ranking, colours, "Other"
const mixed: AggSession[] = [
  ...Array.from({ length: 5 }, (_, i) => s(`a${i}`, 4, i, "Google")),
  ...Array.from({ length: 3 }, (_, i) => s(`b${i}`, 5, i, "Facebook")),
  ...Array.from({ length: 2 }, (_, i) => s(`c${i}`, 4, 30 + i, "Direct")),
  s("d", 6, 0, "x.com"),
  s("e", 6, 1, "y.com"),
];
r = aggregateVisits(mixed, { ...opts, split: true, top: 3 });
ok(r.series.map((x) => x.label).join() === "Google,Facebook,Direct,Other (2)", "split: biggest groups first, the rest in Other");
ok(r.buckets[4].parts!.g0 === 5 && r.buckets[4].parts!.g2 === 2 && r.buckets[6].parts![OTHER_KEY] === 2, "split: each bar divided by group");
ok(r.buckets.every((b) => Object.values(b.parts ?? {}).reduce((a, x) => a + x, 0) === b.visits), "split: every stack adds up to its bar");
// Facebook keeps g1 even in a bar where it is absent, and when unique is switched on
const r2 = aggregateVisits(mixed, { ...opts, split: true, top: 3, unique: true });
ok(r.series.map((x) => x.key).join() === r2.series.map((x) => x.key).join() && r2.series[1].label === "Facebook", "colours (keys) don't move when unique is toggled");
ok(r.buckets[6].parts!.g1 === undefined, "a group absent from a bar takes no part of it (its colour is never reused there)");

// unique + split: first session's group wins, stack still equals the unique total
const switcher = [s("v9", 8, 0, "Google"), s("v9", 8, 10, "Facebook"), s("v9", 8, 20, "Facebook"), s("w", 8, 30, "Facebook")];
r = aggregateVisits(switcher, { ...opts, split: true, unique: true });
const b8 = r.buckets[8];
const g = (label: string) => r.series.find((x) => x.label === label)!.key;
ok(b8.visits === 2 && b8.parts![g("Google")] === 1 && b8.parts![g("Facebook")] === 1, "unique + split: a person counts once, under their first session's group");

// boundaries
r = aggregateVisits([s("v", 23, 59), s("v", -1, 0), { id: "z", startedAt: null, visitorId: "v", group: "" }], opts);
ok(r.buckets[23].visits === 1 && r.total === 1, "sessions outside the window or without a start are ignored");

console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `\nALL ${passes} PASS`);
process.exit(fails ? 1 : 0);
