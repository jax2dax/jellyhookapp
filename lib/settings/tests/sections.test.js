// lib/settings/tests/sections.test.js - the grouped sections of Settings (lib/settings/sections.js). Run: npm run test:tracking
import { DEFAULT_SECTION, SETTINGS_GROUPS, resolveSection, sectionById, sectionHref, visibleGroups } from "../sections.js";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const ids = (flags) => visibleGroups(flags).flatMap((g) => g.items.map((i) => i.id));
ok(new Set(SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.id))).size === SETTINGS_GROUPS.flatMap((g) => g.items).length, "every section id is unique");
ok(SETTINGS_GROUPS.flatMap((g) => g.items).every((i) => i.label && i.description), "every section has a label and a description");
ok(JSON.stringify(visibleGroups({}).map((g) => g.title)) === JSON.stringify(["Workspace", "Tracking", "Forms"]), "without the AI flag the Integrations group is gone entirely");
ok(!ids({}).includes("ai") && ids({ mcp: true }).includes("ai"), "AI access shows only when its flag is on");

ok(resolveSection(null) === DEFAULT_SECTION && resolveSection("") === DEFAULT_SECTION && resolveSection("nope") === DEFAULT_SECTION, "no or unknown section: the default");
ok(resolveSection("forms") === "forms" && resolveSection("connection") === "connection", "a known section");
ok(resolveSection("ai", {}) === DEFAULT_SECTION && resolveSection("ai", { mcp: true }) === "ai", "a section behind a switched-off flag falls back to the default");
ok(resolveSection("tracker") === "installation" && resolveSection("site") === "general" && resolveSection("fields") === "fields", "old ?tab= addresses still work");
ok(resolveSection("ai", {}) === "general" && resolveSection(["x"]) === "general", "bad values are safe");

ok(sectionHref("general") === "/platform/settings" && sectionHref("forms") === "/platform/settings?section=forms", "addresses: the default is clean");
ok(sectionHref("fields", "&field=name") === "/platform/settings?section=fields&field=name" && sectionHref("general", "field=x") === "/platform/settings?field=x", "extra parameters are kept");
ok(sectionById("forms")?.group === "Forms" && sectionById("zzz") === null, "a section knows its group");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
