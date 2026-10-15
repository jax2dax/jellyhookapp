// lib/tracking/tests/formKey.test.js - the form identity rules. Run: npm run test:forms
import { formKeyLabel, formKeyOf, looksGenerated } from "../formKey.js";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

ok(formKeyOf({ id: "contact", name: "x" }, "/contact", 0) === "id:contact", "the id wins");
ok(formKeyOf({ id: null, name: "lead-form" }, "/contact", 0) === "name:lead-form", "no id: the name");
ok(formKeyOf(undefined, "/contact", 1) === "path:/contact#1", "an old tracker (no hint): page + position, as before");
ok(formKeyOf({ id: "  contact  " }, "/a", 0) === "id:contact", "spaces trimmed");
ok(formKeyOf({ id: "contact us" }, "/a", 0) === "path:/a#0", "an id with a space is not a valid id: fall back");
ok(formKeyOf({ id: "x".repeat(101) }, "/a", 0) === "path:/a#0", "over 100 characters: ignored");

for (const id of [":r1:", "radix-:r3:", "form-8f3a9c2e", "f47ac10b-58cc-4372-a567-0e02b2c3d479", "form_1697371234567"]) ok(looksGenerated(id), "generated, ignored: " + id);
for (const id of ["contact", "contact-form", "wf-form-Contact-Form", "wpforms-form-123", "feedback", "decade", "hsForm_1a2b3c4d-5e6f-7a8b-9c0d-112233445566", "gform_1", "demo_request"]) ok(!looksGenerated(id), "stable, kept: " + id);
ok(formKeyOf({ id: ":r1:", name: "lead" }, "/a", 0) === "name:lead", "a generated id falls through to the name");

ok(formKeyLabel("id:contact") === "#contact" && formKeyLabel("name:lead") === "lead (name)" && formKeyLabel("path:/contact#0") === "/contact (form 1)", "labels people read");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
