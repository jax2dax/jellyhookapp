// jh-stats/tests/typical.test.ts - the typical range (frequency table, outliers dropped, mean +/- SD). Run: npm run test:marks
import { MIN_VALUES, typicalRange } from "../typical";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const s = (x: number) => x * 1000;

// the founder's example, repeated to have enough values: a crowd at 31-38 s, and two sessions of exactly 100 s
const crowd = [34, 35, 31, 32, 36, 38];
const vals = [...Array(4).fill(crowd).flat(), 100, 100].map(s);
const t = typicalRange(vals)!;
console.log("example:", { n: t.n, kept: t.kept, mean: (t.mean / 1000).toFixed(1), sd: (t.sd / 1000).toFixed(2), high: (t.high / 1000).toFixed(1) });
ok(t.n === 26 && t.kept === 24, "the two 100 s sessions are left out of 'normal' (24 of 26 kept)");
ok(Math.abs(t.mean - s(34.33)) < 50, "normal is about 34 s, not pulled up by the 100 s pair");
ok(t.high < s(40), "high activity starts below 40 s here, the 100 s sessions are well above it");

// a plain mean would be pulled: show the difference
const plain = vals.reduce((a, b) => a + b, 0) / vals.length;
ok(plain > s(39), "for comparison, the plain mean would say " + (plain / 1000).toFixed(1) + " s");

// a wide spread with no outliers keeps everything
const spread = Array.from({ length: 40 }, (_, i) => s(20 + i * 3));
const w = typicalRange(spread)!;
ok(w.kept === 40, "an even spread from 20 s to 2m17s: nothing is an outlier, all 40 kept");

ok(typicalRange(vals.slice(0, MIN_VALUES - 1)) === null, "under " + MIN_VALUES + " values: no 'normal' yet");
ok(typicalRange([...vals, NaN, -5]) !== null && typicalRange([...vals, NaN, -5])!.n === 26, "bad values are ignored");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
