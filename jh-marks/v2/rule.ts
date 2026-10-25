// jh-marks/v2/rule.ts
// Marks v2: a mark is a small tree of VISIT BLOCKS (one block = one visit, like one visit chart), plus conditions on the
// form's ANSWERS and on how the form was FILLED. Everything listed must be true. Design and the founder's decisions:
// mds/build/marks/marks-v2-plan.md. Pure: types, validation, plain English. The checker is ./check.ts.
//
//   Block        one visit. `which` says which visit (the converting one by default), `session` holds conditions on the
//                visit as a whole, `pages` the pages seen in it (any order, or a sequence), `then` the blocks that must
//                happen in LATER visits ("then, in a later visit...").
//   Root blocks  independent of each other; each must be true.
//   Answers      what the lead answered in the form ("Budget >= 3000").
//   Form         how the form was filled (fill time, hesitation before typing in a field, edits...).
// Only what happened BEFORE the form was sent counts.

export type NumOp = ">=" | ">" | "<=" | "<" | "=" | "between";
/** A number condition. Durations in seconds, shares in percent (0-100), counts as counts. */
export interface NumCond {
  op: NumOp;
  a: number;
  b?: number;
}

/** A heading on the site, identified the way the tracker identifies it (lib/tracking/headingTime.js keyOfText). */
export interface HeadingRef {
  key: string;
  text: string;
  /** the page it was picked from (for display; the key matches it on any page) */
  page?: string;
}

/** Which visit a ROOT block is about. */
export type RootWhich =
  | { kind: "converting" } // the visit the form was sent in (the default)
  | { kind: "last" } // the last visit up to sending: the same visit, named the way some people think of it
  | { kind: "any" } // any visit up to sending
  | { kind: "first" } // the visitor's first visit ever
  | { kind: "nth"; n: NumCond } // visit number (1 = first visit ever): = 4, > 4, < 4, between 4 and 5
  | { kind: "every" }; // every visit up to sending (advanced)

/** Which visit a THEN block is about: always after its parent block's visit. */
export type ThenWhich = { kind: "later" } | { kind: "nth"; n: NumCond };

export type SessionCond =
  | { id: string; kind: "duration"; n: NumCond } // visit length, seconds
  | { id: string; kind: "pages"; n: NumCond } // page views in the visit
  | { id: string; kind: "heading"; heading: HeadingRef; state: "seen" | "notSeen"; n?: NumCond } // across the visit, seconds
  | { id: string; kind: "headingShare"; heading: HeadingRef; n: NumCond } // % of the visit's heading time
  | { id: string; kind: "source"; value: string } // came from: referrer or utm source contains
  // came from an ad or platform (lib/acquisition/channel.ts): platform ("" = any), paid / free / either, and the
  // campaign and ad (utm_campaign, utm_content) containing these words
  | { id: string; kind: "channel"; platform: string; paid: "any" | "paid" | "free"; campaign?: string; ad?: string }
  | { id: string; kind: "device"; value: "desktop" | "mobile" };

export type PageCond =
  | { id: string; kind: "time"; n: NumCond } // seconds on one view of the page
  | { id: string; kind: "seen"; n: NumCond } // % of the page seen in one view
  | { id: string; kind: "views"; n: NumCond } // views of this page in the visit (not in a sequence)
  | { id: string; kind: "heading"; heading: HeadingRef; state: "seen" | "notSeen"; n?: NumCond } // on this page, seconds. notSeen = never on screen for 1 s or more (passing it does not count)
  | { id: string; kind: "headingShare"; heading: HeadingRef; n: NumCond }; // % of this page's heading time

export interface PageStep {
  id: string;
  path: string;
  match: "exact" | "startsWith";
  conds: PageCond[];
  /** in a sequence, how this step follows the one before: the very next page, or any later page of the visit */
  link: "next" | "later";
}

export interface PageGroup {
  order: "any" | "sequence";
  steps: PageStep[];
}

export interface Block {
  id: string;
  which: RootWhich | ThenWhich;
  session: SessionCond[];
  pages: PageGroup | null;
  then: Block[];
}

export type AnswerCond =
  | { id: string; field: string; name: string; kind: "number"; n: NumCond; options?: { v: string; l: string }[] }
  | { id: string; field: string; name: string; kind: "choice"; op: "is" | "isNot"; values: string[]; options?: { v: string; l: string }[] }
  | { id: string; field: string; name: string; kind: "multi"; values: string[]; options?: { v: string; l: string }[] }
  | { id: string; field: string; name: string; kind: "yesno"; checked: boolean }
  | { id: string; field: string; name: string; kind: "text"; op: "contains" | "empty" | "notEmpty"; value?: string };

export type FormCond =
  | { id: string; kind: "fillTime"; n: NumCond } // first key to sending, seconds
  | { id: string; kind: "timeToStart"; n: NumCond } // from seeing the form to the first key, seconds
  | { id: string; kind: "emptyFields"; n: NumCond } // fields of the form never filled
  | { id: string; kind: "errors"; n: NumCond } // times the browser refused the form for an invalid field
  | { id: string; kind: "leftWhileFilling"; value: boolean } // opened another page or was away 10 s+ while filling
  | { id: string; kind: "fieldHesitation"; field: string; name: string; n: NumCond } // seconds from clicking into the field to typing
  | { id: string; kind: "fieldTime"; field: string; name: string; n: NumCond } // seconds in the field, all visits to it
  | { id: string; kind: "fieldEdits"; field: string; name: string; n: NumCond } // times it was changed
  | { id: string; kind: "fieldEmpty"; field: string; name: string; value: boolean }; // left empty

export interface MarkRuleV2 {
  v: 2;
  blocks: Block[];
  answers: AnswerCond[];
  form: FormCond[];
}

export const LIMITS = { blocks: 6, depth: 3, conds: 8, steps: 6, answers: 6, form: 6 };

export const emptyRuleV2 = (): MarkRuleV2 => ({ v: 2, blocks: [], answers: [], form: [] });
export const isRuleV2 = (x: unknown): x is MarkRuleV2 => !!x && typeof x === "object" && (x as { v?: unknown }).v === 2;

let seq = 0;
export const newId = (p = "x") => p + Date.now().toString(36).slice(-4) + (++seq).toString(36);

// ── validation ───────────────────────────────────────────────────────────────

export class RuleV2Error extends Error {}

const OPS: NumOp[] = [">=", ">", "<=", "<", "=", "between"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const id = (v: unknown, p: string) => (typeof v === "string" && v ? v.slice(0, 40) : newId(p));

function num(x: unknown, lo: number, hi: number, what: string): NumCond {
  const c = x as Partial<NumCond> | null;
  const op = OPS.includes(c?.op as NumOp) ? (c!.op as NumOp) : ">=";
  const a = Number(c?.a);
  if (!Number.isFinite(a) || a < lo || a > hi) throw new RuleV2Error(`${what} must be a number between ${lo} and ${hi}.`);
  if (op !== "between") return { op, a };
  const b = Number(c?.b);
  if (!Number.isFinite(b) || b < lo || b > hi) throw new RuleV2Error(`${what}: the second number of "between" must be between ${lo} and ${hi}.`);
  return { op, a: Math.min(a, b), b: Math.max(a, b) };
}

const SECONDS = 86_400;
const COUNT = 10_000;

function heading(x: unknown): HeadingRef {
  const h = x as Partial<HeadingRef> | null;
  const key = str(h?.key, 12);
  const text = str(h?.text, 120);
  if (!key || !/^[0-9a-z]{1,8}(#\d{1,2})?$/.test(key) || !text) throw new RuleV2Error("Pick a heading from the page.");
  const page = str(h?.page, 200);
  return page ? { key, text, page } : { key, text };
}

export function cleanPath(p: unknown): string {
  let s = str(p, 200);
  if (!s) throw new RuleV2Error("A page needs an address like /pricing.");
  try {
    if (/^https?:\/\//i.test(s)) s = new URL(s).pathname;
  } catch {
    /* keep as typed */
  }
  s = s.split("?")[0].split("#")[0];
  return s.startsWith("/") ? s : "/" + s;
}

function sessionCond(x: unknown): SessionCond {
  const c = x as Record<string, unknown>;
  const i = id(c?.id, "s");
  switch (c?.kind) {
    case "duration":
      return { id: i, kind: "duration", n: num(c.n, 0, SECONDS, "Visit length (seconds)") };
    case "pages":
      return { id: i, kind: "pages", n: num(c.n, 0, COUNT, "Pages") };
    case "heading": {
      const state = c.state === "notSeen" ? "notSeen" : "seen";
      return state === "seen" && c.n ? { id: i, kind: "heading", heading: heading(c.heading), state, n: num(c.n, 0, SECONDS, "Time on the heading (seconds)") } : { id: i, kind: "heading", heading: heading(c.heading), state };
    }
    case "headingShare":
      return { id: i, kind: "headingShare", heading: heading(c.heading), n: num(c.n, 0, 100, "Share of reading time (%)") };
    case "source": {
      const value = str(c.value, 80).toLowerCase();
      if (!value) throw new RuleV2Error("Say where they came from, like google.");
      return { id: i, kind: "source", value };
    }
    case "device":
      return { id: i, kind: "device", value: c.value === "mobile" ? "mobile" : "desktop" };
    case "channel": {
      const platform = str(c.platform, 60);
      const paid = c.paid === "paid" || c.paid === "free" ? c.paid : "any";
      const campaign = str(c.campaign, 120);
      const ad = str(c.ad, 120);
      if (!platform && paid === "any" && !campaign && !ad) throw new RuleV2Error("Say where they came from: a platform, paid or free, a campaign or an ad.");
      return { id: i, kind: "channel", platform, paid, ...(campaign ? { campaign } : {}), ...(ad ? { ad } : {}) };
    }
  }
  throw new RuleV2Error("Unknown visit condition.");
}

function pageCond(x: unknown, inSequence: boolean): PageCond {
  const c = x as Record<string, unknown>;
  const i = id(c?.id, "p");
  switch (c?.kind) {
    case "time":
      return { id: i, kind: "time", n: num(c.n, 0, SECONDS, "Time on the page (seconds)") };
    case "seen":
      return { id: i, kind: "seen", n: num(c.n, 0, 100, "Share of the page seen (%)") };
    case "views":
      if (inSequence) throw new RuleV2Error("Times viewed cannot be used inside a sequence of pages.");
      return { id: i, kind: "views", n: num(c.n, 0, COUNT, "Times viewed") };
    case "heading": {
      const state = c.state === "notSeen" || c.state === "passed" ? "notSeen" : "seen";
      return state === "seen" && c.n ? { id: i, kind: "heading", heading: heading(c.heading), state, n: num(c.n, 0, SECONDS, "Time on the heading (seconds)") } : { id: i, kind: "heading", heading: heading(c.heading), state };
    }
    case "headingShare":
      return { id: i, kind: "headingShare", heading: heading(c.heading), n: num(c.n, 0, 100, "Share of the page's reading time (%)") };
  }
  throw new RuleV2Error("Unknown page condition.");
}

function pageGroup(x: unknown): PageGroup | null {
  const g = x as Partial<PageGroup> | null;
  const stepsIn = Array.isArray(g?.steps) ? g!.steps : [];
  if (!stepsIn.length) return null;
  if (stepsIn.length > LIMITS.steps) throw new RuleV2Error(`At most ${LIMITS.steps} pages in one visit.`);
  const order = g?.order === "sequence" && stepsIn.length > 1 ? "sequence" : "any";
  const steps = stepsIn.map((s, n): PageStep => {
    const condsIn = Array.isArray(s?.conds) ? s.conds : [];
    if (condsIn.length > LIMITS.conds) throw new RuleV2Error(`At most ${LIMITS.conds} conditions on one page.`);
    return {
      id: id(s?.id, "st"),
      path: cleanPath(s?.path),
      match: s?.match === "startsWith" ? "startsWith" : "exact",
      conds: condsIn.map((c) => pageCond(c, order === "sequence")),
      link: n > 0 && order === "sequence" && s?.link === "next" ? "next" : "later",
    };
  });
  return { order, steps };
}

function block(x: unknown, depth: number): Block {
  const b = x as Partial<Block> | null;
  if (depth > LIMITS.depth) throw new RuleV2Error(`At most ${LIMITS.depth} visits in a row ("then").`);
  const w = b?.which as Record<string, unknown> | undefined;
  let which: RootWhich | ThenWhich;
  if (depth === 1) {
    which =
      w?.kind === "any" || w?.kind === "first" || w?.kind === "every" || w?.kind === "last"
        ? { kind: w.kind }
        : w?.kind === "nth"
          ? { kind: "nth", n: num(w.n, 1, 1000, "Visit number") }
          : { kind: "converting" };
  } else {
    which = w?.kind === "nth" ? { kind: "nth", n: num(w.n, 1, 1000, "Visit number") } : { kind: "later" };
  }
  const sessionIn = Array.isArray(b?.session) ? b!.session : [];
  if (sessionIn.length > LIMITS.conds) throw new RuleV2Error(`At most ${LIMITS.conds} conditions on one visit.`);
  const thenIn = Array.isArray(b?.then) ? b!.then : [];
  const out: Block = { id: id(b?.id, "b"), which, session: sessionIn.map(sessionCond), pages: pageGroup(b?.pages), then: thenIn.map((t) => block(t, depth + 1)) };
  if (!out.session.length && !out.pages && !out.then.length && depth > 1) throw new RuleV2Error("A later visit needs at least one condition.");
  return out;
}

function answer(x: unknown): AnswerCond {
  const c = x as Record<string, unknown>;
  const i = id(c?.id, "a");
  const field = str(c?.field, 107);
  const name = str(c?.name, 60) || field;
  if (!field) throw new RuleV2Error("Pick a form field.");
  const options = Array.isArray(c?.options) ? (c.options as { v: unknown; l: unknown }[]).slice(0, 50).map((o) => ({ v: str(o?.v, 80), l: str(o?.l, 80) })) : undefined;
  const values = Array.isArray(c?.values) ? (c.values as unknown[]).map((v) => str(v, 80)).filter(Boolean).slice(0, 20) : [];
  switch (c?.kind) {
    case "number":
      return { id: i, field, name, kind: "number", n: num(c.n, -1e12, 1e12, name), ...(options ? { options } : {}) };
    case "choice":
      if (!values.length) throw new RuleV2Error(`Pick at least one choice for ${name}.`);
      return { id: i, field, name, kind: "choice", op: c.op === "isNot" ? "isNot" : "is", values, ...(options ? { options } : {}) };
    case "multi":
      if (!values.length) throw new RuleV2Error(`Pick at least one choice for ${name}.`);
      return { id: i, field, name, kind: "multi", values, ...(options ? { options } : {}) };
    case "yesno":
      return { id: i, field, name, kind: "yesno", checked: c.checked !== false };
    case "text": {
      const op = c.op === "empty" || c.op === "notEmpty" ? c.op : "contains";
      const value = str(c.value, 80);
      if (op === "contains" && !value) throw new RuleV2Error(`Say what ${name} should contain.`);
      return op === "contains" ? { id: i, field, name, kind: "text", op, value } : { id: i, field, name, kind: "text", op };
    }
  }
  throw new RuleV2Error("Unknown answer condition.");
}

function formCond(x: unknown): FormCond {
  const c = x as Record<string, unknown>;
  const i = id(c?.id, "f");
  const field = str(c?.field, 107);
  const name = str(c?.name, 60) || field;
  const needField = () => {
    if (!field) throw new RuleV2Error("Pick a form field.");
  };
  switch (c?.kind) {
    case "fillTime":
      return { id: i, kind: "fillTime", n: num(c.n, 0, SECONDS, "Time filling the form (seconds)") };
    case "timeToStart":
      return { id: i, kind: "timeToStart", n: num(c.n, 0, SECONDS, "Time before starting the form (seconds)") };
    case "emptyFields":
      return { id: i, kind: "emptyFields", n: num(c.n, 0, 100, "Fields left empty") };
    case "errors":
      return { id: i, kind: "errors", n: num(c.n, 0, 1000, "Errors") };
    case "leftWhileFilling":
      return { id: i, kind: "leftWhileFilling", value: c.value !== false };
    case "fieldHesitation":
      needField();
      return { id: i, kind: "fieldHesitation", field, name, n: num(c.n, 0, SECONDS, `Time before typing in ${name} (seconds)`) };
    case "fieldTime":
      needField();
      return { id: i, kind: "fieldTime", field, name, n: num(c.n, 0, SECONDS, `Time in ${name} (seconds)`) };
    case "fieldEdits":
      needField();
      return { id: i, kind: "fieldEdits", field, name, n: num(c.n, 0, 1000, `Times ${name} was changed`) };
    case "fieldEmpty":
      needField();
      return { id: i, kind: "fieldEmpty", field, name, value: c.value !== false };
  }
  throw new RuleV2Error("Unknown form condition.");
}

/** Checks and cleans a v2 rule from anywhere (builder, AI, database). Throws RuleV2Error with a message for people. */
export function validateRuleV2(x: unknown): MarkRuleV2 {
  const r = x as Partial<MarkRuleV2> | null;
  if (!r || typeof r !== "object") throw new RuleV2Error("The mark is empty.");
  const blocksIn = Array.isArray(r.blocks) ? r.blocks : [];
  const answersIn = Array.isArray(r.answers) ? r.answers : [];
  const formIn = Array.isArray(r.form) ? r.form : [];
  if (blocksIn.length > LIMITS.blocks) throw new RuleV2Error(`At most ${LIMITS.blocks} visits.`);
  if (answersIn.length > LIMITS.answers) throw new RuleV2Error(`At most ${LIMITS.answers} answer conditions.`);
  if (formIn.length > LIMITS.form) throw new RuleV2Error(`At most ${LIMITS.form} form conditions.`);
  const out: MarkRuleV2 = { v: 2, blocks: blocksIn.map((b) => block(b, 1)), answers: answersIn.map(answer), form: formIn.map(formCond) };
  const total = countBlocks(out.blocks);
  if (total > LIMITS.blocks * 2) throw new RuleV2Error("Too many visits in this mark.");
  if (!out.blocks.length && !out.answers.length && !out.form.length) throw new RuleV2Error("Add at least one condition.");
  return out;
}

export function countBlocks(blocks: Block[]): number {
  return blocks.reduce((n, b) => n + 1 + countBlocks(b.then), 0);
}

// ── plain English ────────────────────────────────────────────────────────────

const OP_WORD: Record<NumOp, string> = { ">=": "at least", ">": "more than", "<=": "at most", "<": "less than", "=": "exactly", between: "between" };

export function fmtSec(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

export function describeNum(n: NumCond, unit: "s" | "%" | "" = ""): string {
  const f = (v: number) => (unit === "s" ? fmtSec(v) : unit === "%" ? `${v}%` : v.toLocaleString("en-US"));
  return n.op === "between" ? `between ${f(n.a)} and ${f(n.b ?? n.a)}` : `${OP_WORD[n.op]} ${f(n.a)}`;
}

const ord = (n: number) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");

export function describeWhich(w: RootWhich | ThenWhich): string {
  switch (w.kind) {
    case "converting":
      return "the visit they sent the form in";
    case "last":
      return "their last visit";
    case "any":
      return "any visit";
    case "first":
      return "their first visit";
    case "every":
      return "every visit";
    case "later":
      return "a later visit";
    case "nth":
      if (w.n.op === "=") return `their ${ord(w.n.a)} visit`;
      if (w.n.op === "between") return `their ${ord(w.n.a)} to ${ord(w.n.b ?? w.n.a)} visit`;
      return `a visit ${w.n.op === ">" || w.n.op === ">=" ? "after" : "before"} their ${ord(w.n.a)}${w.n.op === ">=" || w.n.op === "<=" ? " (or that one)" : ""}`;
  }
}

function describeSession(c: SessionCond): string {
  switch (c.kind) {
    case "duration":
      return `stayed ${describeNum(c.n, "s")}`;
    case "pages":
      return `saw ${describeNum(c.n)} pages`;
    case "heading":
      return c.state === "notSeen" ? `never read "${c.heading.text}"` : c.n ? `read "${c.heading.text}" for ${describeNum(c.n, "s")}` : `read "${c.heading.text}"`;
    case "headingShare":
      return `gave "${c.heading.text}" ${describeNum(c.n, "%")} of their reading time`;
    case "source":
      return `came from ${c.value}`;
    case "device":
      return `on ${c.value}`;
    case "channel": {
      const what = [c.platform || "any platform", c.paid === "paid" ? "ad" : c.paid === "free" ? "(free)" : ""].filter(Boolean).join(" ");
      return `came from ${what}` + (c.campaign ? `, campaign "${c.campaign}"` : "") + (c.ad ? `, ad "${c.ad}"` : "");
    }
  }
}

function describePageCond(c: PageCond): string {
  switch (c.kind) {
    case "time":
      return `for ${describeNum(c.n, "s")}`;
    case "seen":
      return `seeing ${describeNum(c.n, "%")} of it`;
    case "views":
      return `${describeNum(c.n)} times`;
    case "heading":
      return c.state === "notSeen" ? `not reading "${c.heading.text}"` : c.n ? `reading "${c.heading.text}" for ${describeNum(c.n, "s")}` : `reading "${c.heading.text}"`;
    case "headingShare":
      return `giving "${c.heading.text}" ${describeNum(c.n, "%")} of the page's reading time`;
  }
}

function describeStep(s: PageStep): string {
  const page = s.match === "startsWith" ? `a page under ${s.path}` : s.path;
  return [page, ...s.conds.map(describePageCond)].join(", ");
}

export function describeBlock(b: Block, indent = ""): string[] {
  const parts: string[] = [];
  parts.push(...b.session.map(describeSession));
  if (b.pages) {
    const steps = b.pages.steps.map(describeStep);
    parts.push(
      b.pages.order === "sequence"
        ? "saw " + steps.map((s, i) => (i === 0 ? s : (b.pages!.steps[i].link === "next" ? "then right after " : "then later ") + s)).join(", ")
        : "saw " + steps.join("; and "),
    );
  }
  const head = `${indent}${indent ? "in" : "In"} ${describeWhich(b.which)}: ${parts.length ? parts.join("; ") : "(no conditions yet)"}.`;
  return [head, ...b.then.flatMap((t) => describeBlock(t, "Then, "))];
}

function describeAnswer(c: AnswerCond): string {
  switch (c.kind) {
    case "number":
      return `${c.name} ${describeNum(c.n)}`;
    case "choice":
      return `${c.name} ${c.op === "isNot" ? "is not" : "is"} ${c.values.join(" or ")}`;
    case "multi":
      return `${c.name} includes ${c.values.join(" or ")}`;
    case "yesno":
      return `${c.name} ${c.checked ? "checked" : "not checked"}`;
    case "text":
      return c.op === "contains" ? `${c.name} contains "${c.value}"` : `${c.name} ${c.op === "empty" ? "left empty" : "filled in"}`;
  }
}

function describeForm(c: FormCond): string {
  switch (c.kind) {
    case "fillTime":
      return `filled the form in ${describeNum(c.n, "s")}`;
    case "timeToStart":
      return `started typing ${describeNum(c.n, "s")} after seeing the form`;
    case "emptyFields":
      return `left ${describeNum(c.n)} fields empty`;
    case "errors":
      return `had ${describeNum(c.n)} form errors`;
    case "leftWhileFilling":
      return c.value ? "left the form while filling it" : "filled the form without leaving it";
    case "fieldHesitation":
      return `waited ${describeNum(c.n, "s")} before typing in ${c.name}`;
    case "fieldTime":
      return `spent ${describeNum(c.n, "s")} in ${c.name}`;
    case "fieldEdits":
      return `changed ${c.name} ${describeNum(c.n)} times`;
    case "fieldEmpty":
      return c.value ? `left ${c.name} empty` : `filled in ${c.name}`;
  }
}

/** The whole mark in plain English, one line per visit, then answers and form. */
export function describeRuleV2(r: MarkRuleV2): string[] {
  const lines = r.blocks.flatMap((b) => describeBlock(b));
  if (r.answers.length) lines.push("Answered: " + r.answers.map(describeAnswer).join("; ") + ".");
  if (r.form.length) lines.push("Form: " + r.form.map(describeForm).join("; ") + ".");
  return lines;
}
