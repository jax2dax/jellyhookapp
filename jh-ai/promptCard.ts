// jh-ai/promptCard.ts
// The model's map of Hook, GENERATED from jh-hook/schema.ts so it can never drift from what the builder
// offers (a test pins this). Compact on purpose: the whole card is the static, cached part of every request.
import { AGGS_FOR, AGG_LABEL, FIELD_GROUPS, OPS_FOR, SCHEMA, type EntityKey, type FieldType } from "../jh-hook/schema";

const TYPE_HELP: Record<FieldType, string> = {
  number: "number",
  duration: "duration {amount,unit}",
  percent: "percent 0-100",
  px: "pixels",
  text: "text",
  enum: "one of a list",
  time: "date/time",
  bool: "true/false",
};

/** Hints about internal ids are noise to the model; keep the ones that explain meaning. */
function hint(h: string | undefined): string {
  if (!h || h.startsWith("an internal id")) return "";
  return h.length > 160 ? h.slice(0, 157) + "..." : h;
}

export function buildPromptCard(): string {
  const lines: string[] = [];
  for (const e of Object.keys(SCHEMA) as EntityKey[]) {
    const d = SCHEMA[e];
    lines.push(`ENTITY ${e} = ${d.plural}. One row is one ${d.label}.`);
    const grouped = new Set<string>();
    for (const g of FIELD_GROUPS[e]) for (const k of g.fields) grouped.add(k);
    const order = [...grouped, ...Object.keys(d.fields).filter((k) => !grouped.has(k))];
    for (const k of order) {
      const f = d.fields[k];
      const isId = f.type === "text" && f.ref && f.hint?.startsWith("an internal id");
      const type = isId ? `id of ${f.ref}` : f.enumValues ? `enum ${f.enumValues.join("|")}` : TYPE_HELP[f.type];
      const h = hint(f.hint);
      lines.push(`  ${k} (${type}): ${f.label}${h ? ". " + h : ""}`);
    }
    const rels = Object.entries(d.relations);
    if (rels.length)
      lines.push(`  RELATIONS: ` + rels.map(([k, r]) => `${k} -> ${r.target} (${r.cardinality === "many" ? "many: count/measure them or 'has at least one'" : "one: where must match"}) "${r.label}"`).join("; "));
  }
  lines.push("");
  lines.push("OPERATORS BY TYPE:");
  for (const t of Object.keys(OPS_FOR) as FieldType[]) lines.push(`  ${t}: ${OPS_FOR[t].join(" ")}`);
  lines.push("  (isTrue/isFalse/isEmpty/isNotEmpty take no value. between/notBetween take value and value2. in/notIn take a list.)");
  lines.push("");
  lines.push("MEASURES (agg) BY TYPE (count and countDistinct-less 'count' work on any rows):");
  for (const t of Object.keys(AGGS_FOR) as FieldType[]) lines.push(`  ${t}: ${AGGS_FOR[t].join(" ")}`);
  lines.push(`  agg names: count ${Object.keys(AGG_LABEL).filter((a) => a !== "count").join(" ")}`);
  return lines.join("\n");
}
