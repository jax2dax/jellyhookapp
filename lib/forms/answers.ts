// lib/forms/answers.ts
// Form answers as marks use them (mds/build/marks/marks-v2-plan.md): reading a number or a range out of what a visitor
// typed or picked ("$5,000", "5k", "$1k - $5k", "under 10k", "30+"), comparing it ("any part qualifies", founder
// 2026-10-24), matching choices, and deciding what kind of value a field holds. Pure: no database, no browser.
//
// Answers live in form_submissions.raw_data as { "<name|id|placeholder>": "<text>" }. A field in a form's field list
// (form_engagement.form_fields) has the key "custom:<same name>" (or "email" / "name" / "phone" for those three).

export type ValueKind = "number" | "choice" | "multi" | "yesno" | "date" | "text";

/** A number or a range. null on a side = open ("under 10k" has no bottom, "30+" no top). */
export interface NumRange {
  min: number | null;
  max: number | null;
}

export type NumOp = ">=" | ">" | "<=" | "<" | "=" | "between";

/** The answer's key in raw_data for a field-list key ("custom:budget" -> "budget"). */
export function rawKeyOf(fieldKey: string): string {
  return fieldKey.startsWith("custom:") ? fieldKey.slice(7) : fieldKey;
}

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mm: 1e6, million: 1e6, mn: 1e6, b: 1e9, bn: 1e9, billion: 1e9 };

/** One number with its scale word, from text like "5,000", "1.5k", "2 million", "1.000.000". null when none. */
function parseOne(raw: string): number | null {
  // a digit glued to letters or "_" ("tier_2", "q3") is a name, not a number
  const m = raw.match(/(?<![a-z_\d])(-?\d[\d,.\s]*\d|-?\d)\s*(k|thousand|mm|m|million|mn|bn|b|billion)?\b/i);
  if (!m) return null;
  let digits = m[1].replace(/\s/g, "");
  // "1.000.000" or "1.000" with no comma: dots are thousands separators; otherwise commas are
  if (/^\d{1,3}(\.\d{3})+$/.test(digits) && !digits.includes(",")) digits = digits.replace(/\./g, "");
  else digits = digits.replace(/,/g, "");
  const n = Number(digits);
  if (!Number.isFinite(n)) return null;
  const scale = m[2] ? SCALE[m[2].toLowerCase()] ?? 1 : 1;
  return n * scale;
}

/**
 * Reads a number or a range from an answer. Returns null when the answer has no number.
 *   "5000", "$5,000", "€30", "30%"          -> 5000..5000 (one number = a range of one)
 *   "1k-5k", "$1,000 – $5,000", "10 to 20" -> both ends
 *   "under 10k", "less than 10000", "< 10k" -> ..10000
 *   "over 50k", "50k+", "more than 50000"   -> 50000..
 */
export function parseNumberRange(answer: unknown): NumRange | null {
  if (typeof answer === "number") return Number.isFinite(answer) ? { min: answer, max: answer } : null;
  if (typeof answer !== "string") return null;
  const t = answer.toLowerCase().replace(/[$€£¥₹]|usd|eur|gbp|dollars?|euros?|per month|\/mo(nth)?|\/yr|per year|a month|a year/g, " ").trim();
  if (!t || !/(?<![a-z_\d])\d/.test(t)) return null;
  // a range: two numbers around "-", "–", "—" or "to"
  const parts = t.split(/\s*(?:–|—|\bto\b|(?<=\d\s*(?:k|m|b|bn|mm|thousand|million)?)\s*-\s*(?=\d))\s*/i).filter((x) => /\d/.test(x));
  if (parts.length === 2) {
    let a = parseOne(parts[0]);
    const b = parseOne(parts[1]);
    // "1-5k": the scale written once applies to both ends
    const scaleB = parts[1].match(/\d\s*(k|thousand|mm|m|million|mn|bn|b|billion)\b/i);
    if (a !== null && b !== null && scaleB && !/[a-z]/i.test(parts[0].replace(/\d|[.,\s]/g, "")) && a < b / SCALE[scaleB[1].toLowerCase()] * 1.0001) {
      a = a * SCALE[scaleB[1].toLowerCase()];
    }
    if (a !== null && b !== null) return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const n = parseOne(t);
  if (n === null) return null;
  if (/\b(under|below|less than|up to|upto|max(imum)?|at most|no more than)\b|^<|<\s*\d/.test(t)) return { min: null, max: n };
  if (/\b(over|above|more than|at least|min(imum)?|from)\b|^>|>\s*\d|\d\s*(k|m|b)?\s*\+/.test(t)) return { min: n, max: null };
  return { min: n, max: n };
}

const lo = (r: NumRange) => (r.min === null ? -Infinity : r.min);
const hi = (r: NumRange) => (r.max === null ? Infinity : r.max);

/**
 * Does the answer's number or range meet the condition? Any part of a range qualifies (founder 2026-10-24):
 * "$1k-$5k" meets ">= 3000" (5,000 is), meets "<= 2000" (1,000 is), meets "= 4000" (inside), and "between 4k and 9k"
 * (they overlap).
 */
export function matchNumber(answer: NumRange | null, op: NumOp, a: number, b?: number): boolean {
  if (!answer) return false;
  switch (op) {
    case ">=":
      return hi(answer) >= a;
    case ">":
      return hi(answer) > a;
    case "<=":
      return lo(answer) <= a;
    case "<":
      return lo(answer) < a;
    case "=":
      return lo(answer) <= a && a <= hi(answer);
    case "between": {
      const top = b ?? a;
      return lo(answer) <= Math.max(a, top) && hi(answer) >= Math.min(a, top);
    }
  }
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** The picked values of an answer: one for a dropdown/radio, several for checkboxes (stored "a, b"). */
export function pickedValues(answer: unknown): string[] {
  if (typeof answer !== "string" || !answer.trim()) return [];
  return answer.split(/\s*,\s*/).map(norm).filter(Boolean);
}

/** Is one of `values` (an option's value or its visible text) among what was picked? */
export function matchChoice(answer: unknown, values: string[], options?: { v: string; l: string }[]): boolean {
  const picked = pickedValues(answer);
  if (!picked.length) return false;
  // a person writes the visible text ("$1k-$5k"), the page sends the option's value ("tier_2"): accept both
  const wanted = new Set<string>();
  for (const v of values) {
    wanted.add(norm(v));
    for (const o of options ?? []) {
      if (norm(o.l) === norm(v) || norm(o.v) === norm(v)) {
        wanted.add(norm(o.v));
        wanted.add(norm(o.l));
      }
    }
  }
  return picked.some((p) => wanted.has(p));
}

/**
 * What kind of value a field holds, from its input type, its choices and (for text inputs) what people actually
 * typed: a text box where most answers are numbers ("Budget") is treated as a number.
 */
export function valueKindOf(field: { type: string; options?: unknown[] }, samples: unknown[] = []): ValueKind {
  const t = field.type;
  if (t === "number" || t === "range") return "number";
  if (t === "date" || t === "datetime-local" || t === "month" || t === "week") return "date";
  if (t === "select" || t === "radio") {
    // a dropdown of ranges ("$1k-$5k", "$5k-$10k") compares as numbers too; its options say so
    const opts = (field.options ?? []) as { v: string; l: string }[];
    if (opts.length >= 2 && opts.filter((o) => parseNumberRange(o.l || o.v)).length >= Math.ceil(opts.length * 0.7)) return "number";
    return "choice";
  }
  if (t === "checkbox") return (field.options?.length ?? 0) > 1 ? "multi" : "yesno";
  const filled = samples.filter((x) => typeof x === "string" && x.trim());
  if (filled.length >= 3 && filled.filter((x) => parseNumberRange(x)).length / filled.length >= 0.7) return "number";
  return "text";
}

/**
 * The number an answer stands for, using the field's options when the page sent an option value ("tier_2") whose
 * visible text holds the range ("$1k-$5k").
 */
export function answerRange(answer: unknown, options?: { v: string; l: string }[]): NumRange | null {
  if (typeof answer === "string" && options?.length) {
    const o = options.find((x) => norm(x.v) === norm(answer));
    const fromLabel = o ? parseNumberRange(o.l) : null;
    if (fromLabel) return fromLabel;
  }
  return parseNumberRange(answer);
}
