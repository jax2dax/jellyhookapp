// lib/tracking/tests/attribution.test.ts - offline. Run: npm run test:forms
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { firstTouchLabel, lastNonDirectLabel } from "../../analytics/attribution.js";
import { classifyReferrer, normalizeSource } from "../../analytics/classifyReferrer.js";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const fb = { utm_source: "fb" };
const direct = { utm_source: null, referrer: null };
const google = { utm_source: null, referrer: "https://www.google.com/" };

ok(["fb", "Facebook", "facebook.com", "www.facebook.com", "FB "].every((x) => normalizeSource(x) === "Facebook"), "fb, Facebook, facebook.com, www.facebook.com are one source");
ok(normalizeSource("li") === "LinkedIn" && normalizeSource("x") === "Twitter/X" && normalizeSource("newsletter") === "Newsletter", "aliases, and unknown sources are title-cased");
ok(classifyReferrer({ utm_source: "facebook" }) === classifyReferrer({ referrer: "https://m.facebook.com/x" }), "a tagged and an untagged Facebook visit get the same label");

ok(firstTouchLabel([fb, direct]) === "Facebook" && lastNonDirectLabel([fb, direct]) === "Facebook", "fb then direct: Facebook in both models (direct never takes the credit)");
ok(firstTouchLabel([fb, google]) === "Facebook" && lastNonDirectLabel([fb, google]) === "Google", "fb then Google search: first visit = Facebook, last non-direct = Google");
ok(firstTouchLabel([direct, fb]) === "Direct" && lastNonDirectLabel([direct, fb]) === "Facebook", "direct then fb: first visit = Direct, last non-direct = Facebook");
ok(lastNonDirectLabel([direct, direct]) === "Direct" && lastNonDirectLabel([]) === "Direct", "only direct visits: Direct");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
