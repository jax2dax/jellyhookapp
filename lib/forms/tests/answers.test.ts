// lib/forms/tests/answers.test.ts. Run: npx jiti lib/forms/tests/answers.test.ts (part of npm run test:marks)
import { answerRange, matchChoice, matchNumber, parseNumberRange, pickedValues, rawKeyOf, valueKindOf } from "../answers";

let passes = 0;
let fails = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) passes++;
  else fails++;
  console.log((cond ? "ok: " : "FAIL: ") + msg);
};
const r = (x: unknown) => JSON.stringify(parseNumberRange(x));
const is = (x: unknown, min: number | null, max: number | null) => r(x) === JSON.stringify({ min, max });

// ── reading numbers ──
ok(is("5000", 5000, 5000), "plain number: " + r("5000"));
ok(is("$5,000", 5000, 5000), "currency and commas: " + r("$5,000"));
ok(is("€30", 30, 30), "euro: " + r("€30"));
ok(is("5k", 5000, 5000), "5k: " + r("5k"));
ok(is("1.5k", 1500, 1500), "1.5k: " + r("1.5k"));
ok(is("2 million", 2_000_000, 2_000_000), "2 million: " + r("2 million"));
ok(is("1.000.000", 1_000_000, 1_000_000), "dots as thousands: " + r("1.000.000"));
ok(is("30%", 30, 30), "percent: " + r("30%"));
ok(is("$1k - $5k", 1000, 5000), "range with k: " + r("$1k - $5k"));
ok(is("$1,000 – $5,000", 1000, 5000), "range with en dash: " + r("$1,000 – $5,000"));
ok(is("10 to 20", 10, 20), "range with to: " + r("10 to 20"));
ok(is("1-5k", 1000, 5000), "scale written once: " + r("1-5k"));
ok(is("under 10k", null, 10000), "under: " + r("under 10k"));
ok(is("less than 10000", null, 10000), "less than: " + r("less than 10000"));
ok(is("< 10k", null, 10000), "<: " + r("< 10k"));
ok(is("over 50k", 50000, null), "over: " + r("over 50k"));
ok(is("50k+", 50000, null), "50k+: " + r("50k+"));
ok(is("$500 per month", 500, 500), "per month: " + r("$500 per month"));
ok(parseNumberRange("not sure yet") === null, "no number: null");
ok(parseNumberRange("tier_2") === null && parseNumberRange("q3 plan") === null, "a digit glued to a name is not a number");
ok(parseNumberRange("") === null && parseNumberRange(null) === null, "empty: null");
ok(is(42, 42, 42), "a real number");

// ── comparing: any part of a range qualifies ──
const band = parseNumberRange("$1k-$5k");
ok(matchNumber(band, ">=", 3000), "$1k-$5k meets >= 3000 (5,000 does)");
ok(!matchNumber(band, ">=", 6000), "$1k-$5k does not meet >= 6000");
ok(matchNumber(band, "<=", 2000), "$1k-$5k meets <= 2000 (1,000 does)");
ok(!matchNumber(band, "<", 1000), "$1k-$5k does not meet < 1000");
ok(matchNumber(band, "=", 4000), "$1k-$5k meets = 4000 (inside)");
ok(matchNumber(band, "between", 4000, 9000), "$1k-$5k meets between 4k and 9k (overlap)");
ok(!matchNumber(band, "between", 6000, 9000), "$1k-$5k does not meet between 6k and 9k");
ok(matchNumber(parseNumberRange("50k+"), ">=", 1_000_000), "50k+ has no top: meets >= 1m");
ok(!matchNumber(parseNumberRange("under 10k"), ">", 10000), "under 10k does not meet > 10000");
ok(matchNumber(parseNumberRange("35"), ">", 30) && !matchNumber(parseNumberRange("30"), ">", 30), "> is strict");
ok(!matchNumber(null, ">=", 1), "no answer never matches");

// ── choices ──
const opts = [{ v: "tier_1", l: "Under $1k" }, { v: "tier_2", l: "$1k-$5k" }, { v: "tier_3", l: "$5k+" }];
ok(matchChoice("tier_2", ["$1k-$5k"], opts), "the visible text matches the sent value");
ok(matchChoice("Branding", ["branding"]), "case does not matter");
ok(matchChoice("Branding, Web design", ["web design"]), "one of several checked boxes");
ok(!matchChoice("", ["x"]), "nothing picked: no match");
ok(JSON.stringify(pickedValues("A, b ,C")) === '["a","b","c"]', "picked values are split and cleaned");
ok(JSON.stringify(answerRange("tier_2", opts)) === JSON.stringify({ min: 1000, max: 5000 }), "an option value reads its label's range");

// ── kinds ──
ok(valueKindOf({ type: "number" }) === "number" && valueKindOf({ type: "range" }) === "number", "number and slider are numbers");
ok(valueKindOf({ type: "select", options: opts }) === "number", "a dropdown of ranges compares as numbers");
ok(valueKindOf({ type: "select", options: [{ v: "a", l: "Branding" }, { v: "b", l: "Web" }] }) === "choice", "a dropdown of words is a choice");
ok(valueKindOf({ type: "checkbox", options: [{ v: "yes", l: "I agree" }] }) === "yesno", "one checkbox is yes/no");
ok(valueKindOf({ type: "checkbox", options: [{ v: "a", l: "A" }, { v: "b", l: "B" }] }) === "multi", "a group of checkboxes is multi");
ok(valueKindOf({ type: "text" }, ["5000", "$3k", "10k", "not sure"]) === "number", "a text box where most answers are numbers is a number");
ok(valueKindOf({ type: "text" }, ["hello", "we need a site", "5k"]) === "text", "a text box of words is text");
ok(rawKeyOf("custom:budget") === "budget" && rawKeyOf("email") === "email", "field-list key to raw_data key");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
