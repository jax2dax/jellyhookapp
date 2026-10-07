import type { Metadata } from "next";
import { AGGS_FOR, AGG_LABEL, FIELD_GROUPS, OPS_FOR, OP_LABEL, SCHEMA, TIME_OP_LABEL, TYPE_LABEL, type EntityKey, type FieldType } from "@/jh-hook/schema";
import { DocHeader, Section, H3, P, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Hook field reference",
  description: "Every row type, field, comparison and measure Hook offers. Generated from Hook itself, so it always matches the builder.",
  alternates: { canonical: "/docs/hook/field-reference" },
};

const ops = (t: FieldType) => OPS_FOR[t].map((o) => (t === "time" && TIME_OP_LABEL[o]) || OP_LABEL[o]).join(", ");

export default function FieldReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Field reference"
        intro="Every kind of row, every field you can test or measure, and what you can compare it with. This page is generated from Hook itself, so it can never describe something the builder does not offer."
      />

      <Section title="Value types">
        <DataTable head={["Type", "You can compare with"]} rows={(Object.keys(TYPE_LABEL) as FieldType[]).map((t) => [TYPE_LABEL[t], ops(t)])} />
      </Section>

      <Section title="Measures">
        <P>Used by <b>a calculation:</b>, by breakdowns, and by <b>count or total</b> on connected rows.</P>
        <DataTable
          head={["Measure", "Works on"]}
          rows={(Object.keys(AGG_LABEL) as (keyof typeof AGG_LABEL)[]).map((a) => [
            AGG_LABEL[a],
            a === "count" ? "any rows" : (Object.keys(AGGS_FOR) as FieldType[]).filter((t) => AGGS_FOR[t].includes(a)).map((t) => TYPE_LABEL[t]).join(", "),
          ])}
        />
      </Section>

      {(Object.keys(SCHEMA) as EntityKey[]).map((e) => {
        const def = SCHEMA[e];
        const rels = Object.values(def.relations);
        return (
          <Section key={e} title={def.plural}>
            <P>One row is one {def.label}.</P>
            {FIELD_GROUPS[e].map((g) => (
              <div key={g.label}>
                <H3>{g.label}</H3>
                <DataTable
                  head={["Field", "Type", "Notes"]}
                  rows={g.fields.map((k) => {
                    const f = def.fields[k];
                    return [f.label, `${TYPE_LABEL[f.type]}${f.enumValues ? ` (${f.enumValues.join(", ")})` : ""}`, f.hint ?? ""];
                  })}
                />
              </div>
            ))}
            {rels.length > 0 && (
              <div>
                <H3>Connected rows</H3>
                <DataTable head={["Connection", "Kind"]} rows={rels.map((r) => [r.label, r.cardinality === "many" ? "several: can be counted or measured" : "one row: can be matched"])} />
              </div>
            )}
          </Section>
        );
      })}

      <DocFooter feature="hook" />
    </div>
  );
}
