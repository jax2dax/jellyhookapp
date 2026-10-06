// jh-hook/scripts/genReference.ts
// Writes jh-hook/reference.md from schema.ts, so the field reference in the
// docs can never drift from what the builder actually offers.
// Run from the project root:  node_modules/.bin/jiti jh-hook/scripts/genReference.ts
import { writeFileSync } from "node:fs";
import { AGGS_FOR, AGG_LABEL, FIELD_GROUPS, OPS_FOR, OP_LABEL, SCHEMA, TIME_OP_LABEL, TYPE_LABEL, type EntityKey, type FieldType } from "../schema";

const ops = (t: FieldType) => OPS_FOR[t].map((o) => (t === "time" && TIME_OP_LABEL[o]) || OP_LABEL[o]).join(", ");
const out: string[] = [];
out.push("# Hook: field reference", "", "Generated from `jh-hook/schema.ts` by `jh-hook/scripts/genReference.ts`. Do not edit by hand.", "");

out.push("## Value types", "", "| Type | You can compare with |", "|---|---|");
for (const t of Object.keys(TYPE_LABEL) as FieldType[]) out.push(`| ${TYPE_LABEL[t]} | ${ops(t)} |`);

out.push("", "## Measures", "", "| Measure | Works on |", "|---|---|");
for (const a of Object.keys(AGG_LABEL) as (keyof typeof AGG_LABEL)[]) {
  const types = (Object.keys(AGGS_FOR) as FieldType[]).filter((t) => a === "count" || AGGS_FOR[t].includes(a)).map((t) => TYPE_LABEL[t]);
  out.push(`| ${AGG_LABEL[a]} | ${a === "count" ? "any rows" : types.join(", ")} |`);
}

for (const e of Object.keys(SCHEMA) as EntityKey[]) {
  const def = SCHEMA[e];
  out.push("", `## ${def.plural}`, "", `One row is one ${def.label}. Its id is a ${def.ref} id.`, "");
  for (const g of FIELD_GROUPS[e]) {
    out.push(`### ${g.label}`, "", "| Field | Type | Notes |", "|---|---|---|");
    for (const k of g.fields) {
      const f = def.fields[k];
      out.push(`| ${f.label} | ${TYPE_LABEL[f.type]}${f.enumValues ? ` (${f.enumValues.join(", ")})` : ""} | ${(f.hint ?? "").replace(/\|/g, "/")} |`);
    }
    out.push("");
  }
  const rels = Object.values(def.relations);
  if (rels.length) {
    out.push("### Connected rows", "", "| Relation | Kind |", "|---|---|");
    for (const r of rels) out.push(`| ${r.label} | ${r.cardinality === "many" ? "several: can be counted or measured" : "one row: can be matched"} |`);
    out.push("");
  }
}
writeFileSync("jh-hook/reference.md", out.join("\n"));
console.log("wrote jh-hook/reference.md");
