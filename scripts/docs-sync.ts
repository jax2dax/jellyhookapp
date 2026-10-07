// scripts/docs-sync.ts
// Run: npm run docs:check   fails when Hook / the preview / the results canvas changed since the
//                           public docs were last reviewed (see app/docs/docsSync.ts)
//      npm run docs:stamp   prints the values to paste into app/docs/docsSync.ts AFTER re-reading the docs
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AGGS_FOR, AGG_LABEL, FIELD_GROUPS, OPS_FOR, OP_LABEL, SCHEMA, TYPE_LABEL } from "../jh-hook/schema";
import { SPEC_VERSION } from "../jh-hook/types";
import { DOCS_REVIEWED } from "../app/docs/docsSync";

const root = path.resolve(__dirname, "..");
const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const file = (p: string) => sha(readFileSync(path.join(root, p), "utf8").replace(/\r\n/g, "\n"));

const current = {
  hookSpecVersion: SPEC_VERSION,
  hookSchema: sha(JSON.stringify({ SCHEMA, FIELD_GROUPS, OPS_FOR, OP_LABEL, AGG_LABEL, AGGS_FOR, TYPE_LABEL })),
  previewRules: file("silhouette/rules.md"),
  resultsRules: file("output/rules.md"),
};

if (process.argv.includes("--stamp")) {
  console.log("Paste into app/docs/docsSync.ts, only after re-reading the docs:\n");
  console.log(`  hookSpecVersion: ${current.hookSpecVersion},\n  hookSchema: "${current.hookSchema}",\n  previewRules: "${current.previewRules}",\n  resultsRules: "${current.resultsRules}",`);
  process.exit(0);
}

const where: Record<string, string> = {
  hookSpecVersion: "the Hook query format changed: app/docs/hook/* (especially how-it-works, organizing) and the Hook developer docs",
  hookSchema: "a Hook entity, field, type, operator or measure changed: app/docs/hook/building, connected-rows, examples, glossary (the Field reference updates itself)",
  previewRules: "silhouette/rules.md changed: app/docs/preview/*",
  resultsRules: "output/rules.md changed: app/docs/results/*",
};
let bad = 0;
for (const k of Object.keys(current) as (keyof typeof current)[]) {
  if (current[k] !== DOCS_REVIEWED[k]) {
    bad++;
    console.log(`DOCS OUT OF DATE: ${k}\n  ${where[k]}\n`);
  }
}
if (bad) {
  console.log("Re-read those pages and fix what changed. Then run: npm run docs:stamp, and paste the values into app/docs/docsSync.ts.");
  process.exit(1);
}
console.log("docs are in sync with Hook, the preview and the results canvas");
