// lib/tracking/tests/formRules.test.js - which form submissions are leads (lib/tracking/formRules.js), the vendor form
// keys (lib/tracking/formKey.js), and that public/tracker.js applies exactly the same rule and keys (its copies are
// taken from the tracker's own source and run here). Run: npm run test:forms
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countsAsLead, markOf } from "../formRules.js";
import { formKeyLabel, formKeyOf } from "../formKey.js";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

// ── the rule ──
ok(countsAsLead({ mark: "false", rule: true, specifyForm: false }) === false, 'data-conversion="false" wins over everything');
ok(countsAsLead({ mark: "true", rule: false, specifyForm: true }) === true, 'data-conversion="true" wins over a switch and the default');
ok(countsAsLead({ mark: null, rule: false, specifyForm: false }) === false, "a form switched off is not a lead");
ok(countsAsLead({ mark: null, rule: true, specifyForm: true }) === true, 'a form switched on is a lead, also on an "Only forms I mark" site');
ok(countsAsLead({ mark: null, rule: null, specifyForm: false }) === true, "a new site: an unswitched form is a lead");
ok(countsAsLead({ mark: null, rule: null, specifyForm: true }) === false, 'an "Only forms I mark" site: an unswitched form is not, as before');
ok(markOf("true") === "true" && markOf(true) === "true" && markOf("false") === "false" && markOf("yes") === null && markOf(undefined) === null, "marks");

// ── vendor keys ──
ok(formKeyOf({ vendor: "hubspot", id: "29478CF5-7fa5-4065-b80d-c8347ee65073" }, "/contact", -1) === "hubspot:29478cf5-7fa5-4065-b80d-c8347ee65073", "a new HubSpot form: its form id (kept although it looks like a uuid)");
ok(formKeyOf({ vendor: "typeform" }, "/contact", -1) === "embed:typeform", "an embedded provider");
ok(formKeyOf({ vendor: "hubspot", id: "not a guid!" }, "/contact", 2) === "path:/contact#2" && formKeyOf({ vendor: "Evil<script>" }, "/c", 0) === "path:/c#0", "a bad vendor hint falls back to page + position");
ok(formKeyLabel("hubspot:29478cf5-7fa5-4065-b80d-c8347ee65073") === "HubSpot form …ee65073" && formKeyLabel("embed:calendly") === "Calendly (embedded)", "vendor labels");

// ── the tracker's copies behave the same ──
const src = readFileSync(join(process.cwd(), "public/tracker.js"), "utf8");
const from = src.indexOf("  const JH_FORM_ALLOWED");
const to = src.indexOf("  /** The key hint of a real <form>");
ok(from > 0 && to > from, "found the rule in the tracker");
const make = new Function("jhState", src.slice(from, to) + "\nreturn { jhFormKeyOf, jhCountsAsLead, jhMarkOf };");
const state = { formRules: {}, specifyFormMode: false };
const t = make(state);

const hints = [
  [{ id: "contact", name: "x" }, "/contact", 0],
  [{ id: null, name: "lead-form" }, "/contact", 0],
  [undefined, "/contact", 1],
  [{ id: "  contact  " }, "/a", 0],
  [{ id: "contact us" }, "/a", 0],
  [{ id: "x".repeat(101) }, "/a", 0],
  [{ id: ":r1:", name: "lead" }, "/a", 0],
  [{ id: "form-8f3a9c2e" }, "/a", 3],
  [{ id: "hsForm_1a2b3c4d-5e6f-7a8b-9c0d-112233445566" }, "/a", 0],
  [{ id: "form_1697371234567" }, "/a", 0],
  [{ id: "wpforms-form-123" }, "/a", 0],
  [{ vendor: "hubspot", id: "29478CF5-7fa5-4065-b80d-c8347ee65073" }, "/contact", -1],
  [{ vendor: "hubspot", id: "nope" }, "/contact", -1],
  [{ vendor: "typeform" }, "/x", -1],
  [{ vendor: "Typeform" }, "/x", -1],
  [{ name: "demo_request" }, "/demo", 2],
];
let same = 0;
for (const [h, p, i] of hints) {
  const a = formKeyOf(h, p, i);
  const b = t.jhFormKeyOf(h, p, i);
  if (a === b) same++;
  else console.log("  differs:", JSON.stringify(h), a, "vs", b);
}
ok(same === hints.length, `the tracker builds the same form key (${same}/${hints.length})`);

let agree = 0;
let cases = 0;
for (const mark of ["true", "false", null]) {
  for (const rule of [true, false, null]) {
    for (const specifyForm of [true, false]) {
      state.specifyFormMode = specifyForm;
      state.formRules = rule === null ? {} : { "id:contact": rule };
      cases++;
      if (t.jhCountsAsLead("id:contact", mark) === countsAsLead({ mark, rule, specifyForm })) agree++;
    }
  }
}
ok(agree === cases, `the tracker decides the same in every case (${agree}/${cases})`);

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
