// lib/forms/tests/catalog.test.ts. Run: npx jiti lib/forms/tests/catalog.test.ts (part of npm run test:marks)
import { buildCatalog, findFields, isGeneratedKey } from "../catalog";

let passes = 0;
let fails = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) passes++;
  else fails++;
  console.log((cond ? "ok: " : "FAIL: ") + msg);
};

const reports = [
  // newest first: this field list wins for form "id:contact"
  {
    form_key: "id:contact",
    page_path: "/contact",
    form_fields: [
      { key: "email", type: "email", label: "Work email" },
      { key: "custom:field_3", type: "text" },
      { key: "custom:field_4", type: "text", label: "Monthly budget" },
      { key: "custom:company_size", type: "number", min: 1, max: 5000 },
      { key: "custom:budget", type: "radio", label: "Budget range", options: [{ v: "tier_1", l: "Under $1k" }, { v: "tier_2", l: "$1k-$5k" }, { v: "tier_3", l: "$5k+" }] },
      { key: "custom:upload", type: "file" },
    ],
  },
  { form_key: "id:contact", page_path: "/contact", form_fields: [{ key: "custom:old_field", type: "text" }] }, // older: ignored
  { form_key: "id:quote", page_path: "/quote", form_fields: [{ key: "custom:company_size", type: "number" }] },
];
const answers = [
  { field_3: "not sure", field_4: "$3,000", company_size: "40", budget: "tier_2" },
  { field_4: "5k", company_size: "12" },
  { field_4: "10000", field_3: "hello" },
  { field_4: "about 2k" },
];
const cat = buildCatalog(reports, [{ field_key: "custom:field_3", name: "Project notes" }], answers);
const by = (k: string) => cat.find((f) => f.key === k)!;

ok(!cat.some((f) => f.key === "email"), "name / email / phone are the lead itself, not listed");
ok(!cat.some((f) => f.key === "custom:upload"), "file inputs are not listed");
ok(!cat.some((f) => f.key === "custom:old_field"), "only the latest field list of a form counts");
ok(by("custom:field_3").name === "Project notes" && by("custom:field_3").ownName === "Project notes" && !by("custom:field_3").unnamed, "the owner's name wins");
ok(by("custom:field_4").name === "Monthly budget" && by("custom:field_4").kind === "number", "the page label, and a text box of numbers is a number (" + by("custom:field_4").kind + ")");
ok(by("custom:company_size").name === "Company size" && by("custom:company_size").forms.length === 2 && by("custom:company_size").pages.includes("/quote"), "a readable key becomes the name; seen on two forms");
ok(by("custom:budget").kind === "number", "a radio group of ranges compares as numbers");
ok(by("custom:field_4").answered === 4 && by("custom:field_4").sampled === 4, "answered count from the sample");

const unnamed = buildCatalog([{ form_key: "x", page_path: "/", form_fields: [{ key: "custom:field_9", type: "text" }] }], [], []);
ok(unnamed[0].unnamed && unnamed[0].name === "field_9", "no owner name, no label, a generated key: unnamed");

ok(isGeneratedKey("field_3") && isGeneratedKey("input_17") && isGeneratedKey("wpforms[fields][4]") && isGeneratedKey("q12") && isGeneratedKey("123"), "generated keys are spotted");
ok(!isGeneratedKey("budget") && !isGeneratedKey("company_size") && !isGeneratedKey("project-type"), "real keys are not");

ok(findFields(cat, "budget")[0]?.key === "custom:field_4" || findFields(cat, "budget")[0]?.key === "custom:budget", "\"budget\" finds the budget fields");
ok(findFields(cat, "budget").length === 2, "both budget fields are offered (" + findFields(cat, "budget").map((f) => f.name).join(", ") + ")");
ok(findFields(cat, "company size")[0]?.key === "custom:company_size", "\"company size\" finds Company size");
ok(findFields(cat, "revenue").length === 0, "nothing close: empty (the caller shows the naming help)");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
