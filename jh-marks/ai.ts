// jh-marks/ai.ts
// "Enter with AI" for marks: a sentence ("read pricing for at least 30 seconds, then booked a demo") -> a mark rule in
// the builder's own chips (jh-marks/rule.ts), never a free-form Hook query: whatever the AI makes can be seen and
// edited in the builder. Same shape as jh-ai/translate.ts: ask, read the JSON, check it with validateRule, and on a
// mistake tell the model exactly what was wrong and let it try once more. Pure: the model comes in as a dependency.
import { costUsd, type ModelDef } from "../jh-ai/models";
import type { ChatMessage, ModelProvider } from "../jh-ai/providers/types";
import type { Usage } from "../jh-ai/types";
import { describeRule, RuleError, validateRule, type MarkRule } from "./rule";

const MAX_ATTEMPTS = 2;
const MAX_CHARS = 400;
const CACHE_KEY = "jh-mark-v1";

export type MarkAiResult =
  | { status: "ok"; rule: MarkRule; name: string | null; /** the mark's purpose, in plain words (fills the Purpose box) */ purpose: string | null; reads: string; assumptions: string[] }
  | { status: "clarify"; question: string }
  | { status: "unsupported"; reason: string }
  | { status: "failed"; reason: string };

export interface MarkAiTrace {
  model: string;
  attempts: number;
  usage: Usage;
  costUsd: number;
  latencyMs: number;
}

/** The fixed part of the prompt: the rule language, the limits, and how to answer. Identical for every call (cached). */
export function markSystemPrompt(): string {
  return `You turn a sentence about website visitors into a "mark": conditions a lead (a person who sent a form) must meet.
Reply with ONE JSON object and nothing else.

THE MARK (JSON)
{"scope": "any" | "converting" | "all", "rows": [ROW...], "lead": [CHIP...]}
- scope: which visits count. "any" = every visit before they sent the form (default). "converting" = only the visit they sent the form in. "all" = every visit before sending must meet every row.
- Only what happened BEFORE sending the form ever counts.
ROW = {"order": "any" | "sequence", "cards": [CARD...]}   (1 to 4 cards)
- "any": every card's page was seen (any order). "sequence": seen one after another in ONE visit (2+ cards).
CARD = {"path": "/pricing", "match": "exact" | "startsWith", "minSeconds"?: int, "minReadPct"?: 1-100, "minTimes"?: int >= 2, "timesIn"?: "visits" | "visit"}
- minSeconds and minReadPct are about ONE view of that page. minTimes counts views (across visits, or in one visit). No minTimes in a sequence row.
- "startsWith" for a section, like "/blog/" for every blog post.
CHIP (about the lead as a whole), one of:
{"kind":"visits","min":int}  came at least this many times
{"kind":"pages","min":int}  saw at least this many pages
{"kind":"readEvery","minPct":1-100}  read at least this share of EVERY page they saw
{"kind":"totalTime","minSeconds":int}  time on the site
{"kind":"source","value":"google"}  came from (matched in the referrer or utm source, lower case)
{"kind":"device","value":"desktop"|"mobile"}
{"kind":"formTime","op":"under"|"over","seconds":int}  time to fill the form
Every row and every chip must be true (AND). There is no OR: if asked for OR, reply "unsupported".
Limits: 6 rows, 8 chips. Use only page paths from the site list when one fits; otherwise the path the person wrote.

ANSWER (exactly one of)
{"status":"ok","mark":{...},"name":"Short name, 1-4 words","purpose":"One plain sentence for a salesperson: who these leads are and why they matter (max 160 characters, no jargon, no numbers repeated from the conditions)","assumptions":["what you assumed, if anything"]}
{"status":"clarify","question":"one short question"}   only when a key number or page is truly unknowable
{"status":"unsupported","reason":"what cannot be expressed"}

Reasonable defaults when the sentence is vague: "spent time" = 30 s, "read" = 80%, "came back" = visits 2, "many pages" = pages 4.

EXAMPLES
"read pricing for at least 30 seconds, then booked a demo" ->
{"status":"ok","mark":{"scope":"any","rows":[{"order":"sequence","cards":[{"path":"/pricing","match":"exact","minSeconds":30},{"path":"/demo","match":"exact"}]}],"lead":[]},"name":"Pricing then demo","purpose":"Read the pricing and then went to book a demo: they are weighing the price, so a quick call can close it.","assumptions":["the demo page is /demo"]}
"came back at least twice from google and read most of every page" ->
{"status":"ok","mark":{"scope":"any","rows":[],"lead":[{"kind":"visits","min":2},{"kind":"source","value":"google"},{"kind":"readEvery","minPct":80}]},"name":"Engaged Google returner","purpose":"Found you on Google, came back and read carefully: a researched, interested lead worth a prompt reply.","assumptions":["most = 80%"]}
"looked at 3 blog posts" ->
{"status":"ok","mark":{"scope":"any","rows":[{"order":"any","cards":[{"path":"/blog/","match":"startsWith","minTimes":3}]}],"lead":[]},"name":"Blog reader","purpose":"Spent time on several blog posts first: they are learning about the problem, so lead with advice, not a price.","assumptions":[]}`;
}

function userMessage(sentence: string, pages: string[]): string {
  return `Site pages (most visited first): ${pages.length ? pages.join(", ") : "(none known)"}\nSentence: ${sentence}`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parse(text: string): Record<string, unknown> {
  const t = text.trim();
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a === -1 || b <= a) throw new RuleError("the reply was not JSON");
  try {
    const raw = JSON.parse(t.slice(a, b + 1));
    if (!isObj(raw)) throw new RuleError("the reply was not a JSON object");
    return raw;
  } catch (e) {
    throw e instanceof RuleError ? e : new RuleError("the reply was not valid JSON");
  }
}

const add = (a: Usage, b: Usage): Usage => ({ inputTokens: a.inputTokens + b.inputTokens, cachedTokens: a.cachedTokens + b.cachedTokens, outputTokens: a.outputTokens + b.outputTokens });

export async function translateMark(sentence: string, pages: string[], deps: { provider: ModelProvider; model: ModelDef }): Promise<{ result: MarkAiResult; trace: MarkAiTrace }> {
  const t0 = Date.now();
  const s = sentence.trim().slice(0, MAX_CHARS);
  let usage: Usage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0 };
  let attempts = 0;
  const done = (result: MarkAiResult) => ({ result, trace: { model: deps.model.id, attempts, usage, costUsd: costUsd(deps.model, usage), latencyMs: Date.now() - t0 } });
  if (!s) return done({ status: "failed", reason: "Describe the lead first." });

  const messages: ChatMessage[] = [
    { role: "system", content: markSystemPrompt() },
    { role: "user", content: userMessage(s, pages.slice(0, 25)) },
  ];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts++;
    const c = await deps.provider.complete({ model: deps.model, messages, cacheKey: CACHE_KEY });
    usage = add(usage, c.usage);
    let problem: string;
    try {
      const raw = parse(c.text);
      if (raw.status === "clarify" && typeof raw.question === "string") return done({ status: "clarify", question: raw.question.slice(0, 300) });
      if (raw.status === "unsupported") return done({ status: "unsupported", reason: typeof raw.reason === "string" ? raw.reason.slice(0, 300) : "That can't be made into a mark." });
      if (raw.status !== "ok" || !isObj(raw.mark)) throw new RuleError('expected {"status":"ok","mark":{...}}');
      const rule = validateRule({ v: 1, ...raw.mark });
      const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 40) : null;
      const purpose = typeof raw.purpose === "string" && raw.purpose.trim() ? raw.purpose.trim().slice(0, 200) : null;
      const assumptions = Array.isArray(raw.assumptions) ? raw.assumptions.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 160)).slice(0, 4) : [];
      return done({ status: "ok", rule, name, purpose, reads: describeRule(rule), assumptions });
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      problem = e.message;
    }
    messages.push({ role: "assistant", content: c.text });
    messages.push({ role: "user", content: `That was rejected: ${problem}\nReply again with ONE corrected JSON object only.` });
  }
  return done({ status: "failed", reason: "I couldn't turn that into a mark. Try rephrasing, or build it with the keys below." });
}
