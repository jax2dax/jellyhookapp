// jh-marks/v2/ai.ts
// "Enter with AI" for marks v2: a sentence -> a v2 rule (./rule.ts) the builder shows and the person checks.
// What the model is told (and never more):
//   - the site's top pages;
//   - the site's FORM FIELDS (key, name, kind, choices, limits; never anyone's answers), so "budget > $30" maps to the
//     right field without asking;
//   - only the HEADINGS the sentence seems to name: the server picks out quoted phrases and "... section" phrases and
//     matches them to the site's stored headings (matchHeadings, a cheap text match, no AI); the top few matches per
//     phrase are sent, never the whole list;
//   - a small glossary of sales words mapped to measures ("hesitation" = time before typing in a field).
// Answers: ok (a rule), clarify (one question, e.g. how many seconds counts as hesitation), missingField (the person
// named a field their forms do not have: the builder opens the "name your form fields" popup), unsupported.
// Pure: the model comes in as a dependency. Same repair loop as jh-marks/ai.ts.
import { costUsd, type ModelDef } from "../../jh-ai/models";
import type { ChatMessage, ModelProvider } from "../../jh-ai/providers/types";
import type { Usage } from "../../jh-ai/types";
import { describeRuleV2, RuleV2Error, validateRuleV2, type Block, type HeadingRef, type MarkRuleV2 } from "./rule";

const MAX_ATTEMPTS = 2;
const MAX_CHARS = 400;
const CACHE_KEY = "jh-mark-v2";

export interface AiField {
  key: string;
  name: string;
  kind: string;
  options?: { v: string; l: string }[];
  min?: number | null;
  max?: number | null;
}

export interface AiHeading {
  key: string;
  text: string;
  page: string;
}

export type MarkAiV2Result =
  | { status: "ok"; rule: MarkRuleV2; name: string | null; purpose: string | null; reads: string[]; assumptions: string[] }
  | { status: "clarify"; question: string }
  | { status: "missingField"; field: string; reason: string }
  | { status: "unsupported"; reason: string }
  | { status: "failed"; reason: string };

export interface MarkAiV2Trace {
  model: string;
  attempts: number;
  usage: Usage;
  costUsd: number;
  latencyMs: number;
}

// ── which headings a sentence names ──────────────────────────────────────────

const STOP = new Set(["the", "a", "an", "my", "our", "their", "of", "on", "in", "at", "to", "and", "for", "page", "pages", "they", "them", "then", "was", "is", "with", "where", "what", "we", "have", "read", "saw", "seen", "spent", "visited", "went", "looked", "checked", "straight", "also", "that", "this", "time", "more", "than", "least", "seconds"]);
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/**
 * The parts of a sentence that name a part of a page: anything in quotes first ("Hero", 'Pricing plans', “Offers”),
 * then the words just before "section", "part", "heading" or "block" ("the what we do section" -> "what we do").
 */
export function sectionPhrases(sentence: string): string[] {
  const out: string[] = [];
  for (const m of sentence.matchAll(/["“”'‘’]([^"“”'‘’]{2,60})["“”'‘’]/g)) out.push(m[1].trim());
  const unquoted = sentence.replace(/["“”'‘’][^"“”'‘’]{2,60}["“”'‘’]/g, " ");
  for (const m of unquoted.matchAll(/((?:[a-z0-9&-]+\s+){1,4})(?:section|part|heading|block|area)s?\b/gi)) {
    const phrase = m[1]
      .trim()
      .split(/\s+/)
      .filter((w) => !STOP.has(w.toLowerCase()) || w.toLowerCase() === "what" || w.toLowerCase() === "we")
      .join(" ")
      .replace(/^(the|a|an|my|our|their|on|in|at)\s+/i, "");
    if (phrase && phrase.length >= 2) out.push(phrase);
  }
  return [...new Set(out.map((p) => p.trim()).filter(Boolean))].slice(0, 6);
}

/** For each phrase, the site's headings that fit it best (shared words, then a substring), at most `per` each. */
export function matchHeadings(phrases: string[], headings: AiHeading[], per = 5): { phrase: string; matches: AiHeading[] }[] {
  return phrases.map((phrase) => {
    const want = words(phrase);
    const lower = phrase.toLowerCase();
    const scored = headings
      .map((h) => {
        const have = new Set(words(h.text));
        const shared = want.filter((w) => have.has(w) || [...have].some((x) => x.startsWith(w) || w.startsWith(x))).length;
        const sub = h.text.toLowerCase().includes(lower) || lower.includes(h.text.toLowerCase()) ? 1 : 0;
        return { h, score: (want.length ? shared / want.length : 0) + sub };
      })
      .filter((x) => x.score >= 0.5)
      .sort((a, b) => b.score - a.score || a.h.text.length - b.h.text.length);
    return { phrase, matches: scored.slice(0, per).map((x) => x.h) };
  });
}

// ── the prompt ───────────────────────────────────────────────────────────────

/** The fixed part (cached): the v2 language, the glossary, how to answer. */
export function markSystemPromptV2(): string {
  return `You turn a sentence about website visitors into a "mark": conditions a lead (a person who sent a form) must meet. Reply with ONE JSON object and nothing else.

THE MARK
{"blocks":[BLOCK...], "answers":[ANSWER...], "form":[FORM...]}   everything listed must be true. Only what happened BEFORE sending the form counts.
BLOCK = one visit: {"which":WHICH, "session":[SESSION...], "pages":PAGES|null, "then":[BLOCK...]}
- WHICH (top-level block): {"kind":"converting"} (DEFAULT: the visit they sent the form in) | {"kind":"any"} | {"kind":"first"} | {"kind":"nth","n":NUM} (visit number, 1 = their first visit ever) | {"kind":"every"}
- "then" = blocks that happened in a LATER visit. Their WHICH: {"kind":"later"} (default) | {"kind":"nth","n":NUM}
- Two top-level blocks are independent visits, both required. Use "then" only when the sentence says later / came back / afterwards.
SESSION (about the visit as a whole), one of:
 {"kind":"duration","n":NUM}  visit length, seconds
 {"kind":"pages","n":NUM}  pages seen in the visit
 {"kind":"heading","heading":H,"state":"seen"|"notSeen","n"?:NUM}  a heading read anywhere in the visit (n = seconds)
 {"kind":"headingShare","heading":H,"n":NUM}  % of the visit's reading time on that heading
 {"kind":"source","value":"google"}  came from (referrer or utm source, lower case)
 {"kind":"device","value":"desktop"|"mobile"}
PAGES = {"order":"any"|"sequence","steps":[STEP...]}   "sequence" = in this order in the same visit
STEP = {"path":"/pricing","match":"exact"|"startsWith","link":"next"|"later","conds":[PAGECOND...]}
- link (sequence only, from the 2nd step): "next" = the very next page ("straight to", "right after", "then immediately"); "later" = any later page of the visit (default "later" unless the sentence says straight/right after/immediately).
PAGECOND: {"kind":"time","n":NUM} seconds on the page | {"kind":"seen","n":NUM} % of the page seen | {"kind":"views","n":NUM} times viewed in the visit (not in a sequence) | {"kind":"heading","heading":H,"state":"seen"|"notSeen","n"?:NUM} | {"kind":"headingShare","heading":H,"n":NUM}
NUM = {"op":">="|">"|"<="|"<"|"="|"between","a":number,"b"?:number}
H = {"key":"...","text":"...","page":"/..."}   ONLY a heading from HEADING MATCHES, copied exactly. Never invent a key.
ANSWER (what they answered in the form; "field" = a key from FORM FIELDS, copied exactly):
 {"field":KEY,"name":NAME,"kind":"number","n":NUM}   for number fields (budget, company size...). A range answer matches when any part qualifies.
 {"field":KEY,"name":NAME,"kind":"choice","op":"is"|"isNot","values":["visible text of a choice"]}
 {"field":KEY,"name":NAME,"kind":"multi","values":[...]}   checkbox groups
 {"field":KEY,"name":NAME,"kind":"yesno","checked":true|false}
 {"field":KEY,"name":NAME,"kind":"text","op":"contains"|"empty"|"notEmpty","value"?:"..."}
FORM (how they filled the form they sent):
 {"kind":"fillTime","n":NUM} seconds from first key to sending | {"kind":"timeToStart","n":NUM} seconds from seeing the form to typing | {"kind":"emptyFields","n":NUM} | {"kind":"errors","n":NUM} | {"kind":"leftWhileFilling","value":true|false}
 {"kind":"fieldHesitation","field":KEY,"name":NAME,"n":NUM} seconds from clicking into the field to typing | {"kind":"fieldTime","field":KEY,"name":NAME,"n":NUM} seconds in the field | {"kind":"fieldEdits","field":KEY,"name":NAME,"n":NUM} | {"kind":"fieldEmpty","field":KEY,"name":NAME,"value":true|false}
 (for FORM, KEY may also be "email", "name" or "phone")

SALES WORDS -> MEASURES
hesitation / hesitated / thought about it = fieldHesitation (time before typing in that field); no hesitation = fieldHesitation "<=" a few seconds.
rushed / quick / fast form = fillTime short. took their time / careful = fillTime long.
second thoughts / changed their mind = fieldEdits >= 2. struggled = errors >= 1 or fieldEdits >= 2.
came back / returned = a "then" block {"kind":"later"} or WHICH nth >= 2. first time / new visitor = WHICH first.
read / studied a section = heading seen (with seconds when given). skipped / ignored a section = heading notSeen.
browsed / looked around = pages. deep / long visit = duration.
When such a word has no number ("no hesitation on the budget field", "a quick form"), and no default below fits, ask ONE question naming the measure: {"status":"clarify","question":"How many seconds before typing in Budget counts as hesitation?"}

DEFAULTS when vague: "spent time" = 30 s on a page, "read" a section = seen for 10 s, "read most of" = 80% seen, "came back" = a later visit, "many pages" = 4.

ANSWER (exactly one of)
{"status":"ok","mark":{...},"name":"1-4 words","purpose":"One plain sentence about the LEAD, past tense, what they did and decided. Max 160 characters, no numbers from the conditions","assumptions":["what you assumed"]}
{"status":"clarify","question":"one short question"}
{"status":"missingField","field":"the word they used, e.g. budget","reason":"Your forms have no field for budget. Fields: Company size, Service, Message."}   when they name a form field that is not in FORM FIELDS
{"status":"unsupported","reason":"what cannot be expressed"}   e.g. OR between conditions, dates, anything after sending

EXAMPLE
Sentence: leads that read our "What we do" section for more than 20 seconds on the home page, then went straight to pricing and read "Offers" at least 20 seconds, with a budget over $30
FORM FIELDS: custom:field_4 "Monthly budget" number
HEADING MATCHES: "What we do" -> {"key":"k1","text":"What we do","page":"/"}; "Offers" -> {"key":"k2","text":"Our offers","page":"/pricing"}
{"status":"ok","mark":{"blocks":[{"which":{"kind":"converting"},"session":[],"pages":{"order":"sequence","steps":[{"path":"/","match":"exact","link":"later","conds":[{"kind":"heading","heading":{"key":"k1","text":"What we do","page":"/"},"state":"seen","n":{"op":">","a":20}}]},{"path":"/pricing","match":"exact","link":"next","conds":[{"kind":"heading","heading":{"key":"k2","text":"Our offers","page":"/pricing"},"state":"seen","n":{"op":">=","a":20}}]}]},"then":[]}],"answers":[{"field":"custom:field_4","name":"Monthly budget","kind":"number","n":{"op":">","a":30}}],"form":[]},"name":"Offer reader","purpose":"Learned what you do, then went straight to your offers and read them closely, with the budget for it.","assumptions":[]}`;
}

/** The per-request part: pages, fields, heading matches, the sentence. */
export function userMessageV2(sentence: string, ctx: { pages: string[]; fields: AiField[]; headings: { phrase: string; matches: AiHeading[] }[] }): string {
  const fields = ctx.fields.length
    ? ctx.fields
        .slice(0, 40)
        .map((f) => {
          const opts = f.options?.length ? ` choices: ${f.options.slice(0, 12).map((o) => o.l || o.v).join(" | ")}` : "";
          const lim = f.min != null || f.max != null ? ` from ${f.min ?? "any"} to ${f.max ?? "any"}` : "";
          return `${f.key} "${f.name}" ${f.kind}${opts}${lim}`;
        })
        .join("\n")
    : "(none known)";
  const heads = ctx.headings.length
    ? ctx.headings.map((h) => `"${h.phrase}" -> ${h.matches.length ? h.matches.map((m) => JSON.stringify(m)).join("; ") : "(no heading on the site matches)"}`).join("\n")
    : "(the sentence names no part of a page)";
  return `SITE PAGES (most visited first): ${ctx.pages.length ? ctx.pages.join(", ") : "(none known)"}
FORM FIELDS:
${fields}
HEADING MATCHES:
${heads}
Sentence: ${sentence}`;
}

// ── the call ─────────────────────────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parse(text: string): Record<string, unknown> {
  const t = text.trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b <= a) throw new RuleV2Error("the reply was not JSON");
  try {
    const raw = JSON.parse(t.slice(a, b + 1));
    if (!isObj(raw)) throw new RuleV2Error("the reply was not a JSON object");
    return raw;
  } catch (e) {
    throw e instanceof RuleV2Error ? e : new RuleV2Error("the reply was not valid JSON");
  }
}

const CONTACT = new Set(["email", "name", "phone"]);

/** Extra checks the language alone cannot make: every field and heading must be one the model was given. */
function checkRefs(rule: MarkRuleV2, fields: AiField[], headings: AiHeading[]): void {
  const fieldKeys = new Set(fields.map((f) => f.key));
  for (const a of rule.answers) if (!fieldKeys.has(a.field)) throw new RuleV2Error(`answers: field "${a.field}" is not in FORM FIELDS`);
  for (const f of rule.form) if ("field" in f && !fieldKeys.has(f.field) && !CONTACT.has(f.field)) throw new RuleV2Error(`form: field "${f.field}" is not in FORM FIELDS`);
  const headingKeys = new Set(headings.map((h) => h.key));
  const refs: HeadingRef[] = [];
  const walk = (b: Block) => {
    for (const c of b.session) if ("heading" in c) refs.push(c.heading);
    for (const s of b.pages?.steps ?? []) for (const c of s.conds) if ("heading" in c) refs.push(c.heading);
    b.then.forEach(walk);
  };
  rule.blocks.forEach(walk);
  for (const h of refs) if (!headingKeys.has(h.key)) throw new RuleV2Error(`heading "${h.text}" (${h.key}) is not in HEADING MATCHES; use one from there or ask`);
}

const add = (a: Usage, b: Usage): Usage => ({ inputTokens: a.inputTokens + b.inputTokens, cachedTokens: a.cachedTokens + b.cachedTokens, outputTokens: a.outputTokens + b.outputTokens });

export async function translateMarkV2(
  sentence: string,
  ctx: { pages: string[]; fields: AiField[]; headings: AiHeading[] },
  deps: { provider: ModelProvider; model: ModelDef },
): Promise<{ result: MarkAiV2Result; trace: MarkAiV2Trace }> {
  const t0 = Date.now();
  const s = sentence.trim().slice(0, MAX_CHARS);
  let usage: Usage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0 };
  let attempts = 0;
  const done = (result: MarkAiV2Result) => ({ result, trace: { model: deps.model.id, attempts, usage, costUsd: costUsd(deps.model, usage), latencyMs: Date.now() - t0 } });
  if (!s) return done({ status: "failed", reason: "Describe the lead first." });

  const matched = matchHeadings(sectionPhrases(s), ctx.headings);
  const offered = matched.flatMap((m) => m.matches);
  const messages: ChatMessage[] = [
    { role: "system", content: markSystemPromptV2() },
    { role: "user", content: userMessageV2(s, { pages: ctx.pages.slice(0, 25), fields: ctx.fields, headings: matched }) },
  ];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts++;
    const c = await deps.provider.complete({ model: deps.model, messages, cacheKey: CACHE_KEY });
    usage = add(usage, c.usage);
    let problem: string;
    try {
      const raw = parse(c.text);
      if (raw.status === "clarify" && typeof raw.question === "string") return done({ status: "clarify", question: raw.question.slice(0, 300) });
      if (raw.status === "missingField") {
        const field = typeof raw.field === "string" ? raw.field.slice(0, 60) : "that field";
        const names = ctx.fields.slice(0, 8).map((f) => f.name).join(", ");
        return done({ status: "missingField", field, reason: typeof raw.reason === "string" ? raw.reason.slice(0, 300) : `Your forms have no field for ${field}.${names ? " Fields: " + names + "." : ""}` });
      }
      if (raw.status === "unsupported") return done({ status: "unsupported", reason: typeof raw.reason === "string" ? raw.reason.slice(0, 300) : "That can't be made into a mark." });
      if (raw.status !== "ok" || !isObj(raw.mark)) throw new RuleV2Error('expected {"status":"ok","mark":{...}}');
      const rule = validateRuleV2({ v: 2, blocks: [], answers: [], form: [], ...raw.mark });
      checkRefs(rule, ctx.fields, offered);
      const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 40) : null;
      const purpose = typeof raw.purpose === "string" && raw.purpose.trim() ? raw.purpose.trim().slice(0, 200) : null;
      const assumptions = Array.isArray(raw.assumptions) ? raw.assumptions.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 160)).slice(0, 4) : [];
      return done({ status: "ok", rule, name, purpose, reads: describeRuleV2(rule), assumptions });
    } catch (e) {
      if (!(e instanceof RuleV2Error)) throw e;
      problem = e.message;
    }
    messages.push({ role: "assistant", content: c.text });
    messages.push({ role: "user", content: `That was rejected: ${problem}\nReply again with ONE corrected JSON object only.` });
  }
  return done({ status: "failed", reason: "I couldn't turn that into a mark. Try rephrasing, or build it by hand." });
}
