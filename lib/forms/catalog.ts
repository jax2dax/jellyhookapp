// lib/forms/catalog.ts
// The site's form fields as one list, for the mark builder, Enter with AI and Settings → Form fields
// (mds/build/marks/marks-v2-plan.md). Built from what the tracker reported about each form (the latest field list per
// form: key, type, required, label, choices, limits; never values), the names people gave fields
// (form_field_names), and a sample of recent answers (only to tell whether a text box holds numbers and how often it is
// filled). Pure: the server action passes the rows in.
import { rawKeyOf, valueKindOf, type ValueKind } from "./answers";

export interface ReportedField {
  key: string;
  type: string;
  required?: boolean;
  label?: string;
  options?: { v: string; l: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface CatalogField {
  /** the tracker's key: "custom:<name>", or "email" / "name" / "phone" */
  key: string;
  /** the key in a lead's raw_data */
  rawKey: string;
  /** what people see: the owner's name, else the page's label, else the raw key */
  name: string;
  /** the owner's name, when given */
  ownName: string | null;
  /** the label read from the page ("" when the page gives none) */
  pageLabel: string;
  /** true when neither the owner nor the page named it (keys like field_3): marks cannot find it by name */
  unnamed: boolean;
  type: string;
  kind: ValueKind;
  options: { v: string; l: string }[];
  min: number | null;
  max: number | null;
  /** forms and pages it was seen on */
  forms: string[];
  pages: string[];
  /** in the sampled recent leads: how many answered it */
  answered: number;
  sampled: number;
}

const CONTACT = new Set(["email", "name", "phone"]);
// keys that are generated, not named by a person: field_3, input_17, wpforms[fields][4], form-field-2, q12
const GENERATED = /^(field|input|form[-_]?field|item|question|q|element|el|wpforms\[fields\])[\s_\-[\]]*\d+\]?$/i;

/** Is a raw key a real name a person could recognise ("budget", "company_size"), or a generated one ("field_3")? */
export function isGeneratedKey(rawKey: string): boolean {
  return GENERATED.test(rawKey.trim()) || /^\d+$/.test(rawKey.trim()) || rawKey.length > 40;
}

const human = (rawKey: string) => rawKey.replace(/[_\-[\]]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

/**
 * @param reports   form_engagement rows, newest first: the first row per form_key wins (its latest field list)
 * @param names     form_field_names rows
 * @param answers   recent form_submissions raw_data objects (newest first)
 */
export function buildCatalog(
  reports: { form_key: string | null; page_path: string | null; form_fields: unknown }[],
  names: { field_key: string; name: string }[],
  answers: Record<string, unknown>[],
): CatalogField[] {
  const nameOf = new Map(names.map((n) => [n.field_key, n.name]));
  const byKey = new Map<string, CatalogField>();
  const seenForm = new Set<string>();
  for (const r of reports) {
    const formKey = r.form_key ?? "unknown";
    if (seenForm.has(formKey) || !Array.isArray(r.form_fields)) continue;
    seenForm.add(formKey);
    for (const f of r.form_fields as ReportedField[]) {
      if (!f || typeof f.key !== "string" || CONTACT.has(f.key)) continue; // name / email / phone are the lead itself
      if (f.type === "file" || f.type === "other" || f.type === "color") continue;
      const cur = byKey.get(f.key);
      if (cur) {
        if (!cur.forms.includes(formKey)) cur.forms.push(formKey);
        if (r.page_path && !cur.pages.includes(r.page_path)) cur.pages.push(r.page_path);
        if (!cur.pageLabel && f.label) cur.pageLabel = f.label;
        if (!cur.options.length && f.options?.length) cur.options = f.options;
        continue;
      }
      byKey.set(f.key, {
        key: f.key,
        rawKey: rawKeyOf(f.key),
        name: "",
        ownName: null,
        pageLabel: f.label ?? "",
        unnamed: false,
        type: f.type,
        kind: "text",
        options: f.options ?? [],
        min: typeof f.min === "number" ? f.min : null,
        max: typeof f.max === "number" ? f.max : null,
        forms: [formKey],
        pages: r.page_path ? [r.page_path] : [],
        answered: 0,
        sampled: answers.length,
      });
    }
  }
  const out = [...byKey.values()];
  for (const f of out) {
    const samples = answers.map((a) => a?.[f.rawKey]).filter((v) => v !== undefined && v !== null && v !== "");
    f.answered = samples.length;
    f.kind = valueKindOf({ type: f.type, options: f.options }, samples);
    f.ownName = nameOf.get(f.key) ?? null;
    const fromKey = isGeneratedKey(f.rawKey) ? "" : human(f.rawKey);
    f.name = f.ownName || f.pageLabel || fromKey || f.rawKey;
    f.unnamed = !f.ownName && !f.pageLabel && !fromKey;
  }
  // most answered first, then by name
  return out.sort((a, b) => b.answered - a.answered || a.name.localeCompare(b.name));
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

/**
 * The fields a person most likely means by a word or phrase ("budget", "company size"), best first. Matches the
 * owner's name, the page's label and the raw key. Empty when nothing is close: the caller then shows the
 * "name your form fields" help.
 */
export function findFields(catalog: CatalogField[], phrase: string): CatalogField[] {
  const want = words(phrase);
  if (!want.length) return [];
  const scored = catalog
    .map((f) => {
      const have = new Set([...words(f.name), ...words(f.pageLabel), ...words(f.rawKey.replace(/[_-]/g, " "))]);
      const hits = want.filter((w) => have.has(w) || [...have].some((h) => h.startsWith(w) || w.startsWith(h))).length;
      return { f, score: hits / want.length };
    })
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.f.answered - a.f.answered);
  return scored.map((x) => x.f);
}
