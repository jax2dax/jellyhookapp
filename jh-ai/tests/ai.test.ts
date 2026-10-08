// jh-ai/tests/ai.test.ts
// No network, no key: everything about Ask Hook that can be proven offline. Run: npm run test:ai
// What needs a real model (does it produce the right query?) is measured by `npm run ai:eval`.
import { FIELD_GROUPS, SCHEMA, type EntityKey } from "../../jh-hook/schema";
import { checkSpec } from "../check";
import { EXAMPLES, EVAL_PAGES, EVAL_TODAY } from "../examples";
import { GLOSSARY } from "../glossary";
import { costUsd, creditsFor, MODELS, resolveModel } from "../models";
import { normalizeSpec, parseAnswer, stripForModel } from "../normalize";
import { buildPromptCard } from "../promptCard";
import { systemPrompt, userMessage } from "../prompt";
import { ProviderError, type ModelProvider } from "../providers/types";
import { translate } from "../translate";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) {
    passes++;
    console.log("ok:", m);
  } else {
    fails++;
    console.log("FAIL:", m);
  }
};

const throws = (fn: () => unknown, rx: RegExp): boolean => {
  try {
    fn();
    return false;
  } catch (e) {
    return rx.test(e instanceof Error ? e.message : String(e));
  }
};

// ── the prompt card follows the schema ────────────────────────────────────
{
  const card = buildPromptCard();
  const entities = Object.keys(SCHEMA) as EntityKey[];
  ok(entities.every((e) => card.includes(`ENTITY ${e} =`)), "card: every entity is in the card");
  ok(entities.every((e) => Object.keys(SCHEMA[e].fields).every((k) => card.includes(`  ${k} (`))), "card: every field of every entity is in the card");
  ok(entities.every((e) => Object.keys(SCHEMA[e].relations).every((r) => card.includes(`${r} -> `))), "card: every relation is in the card");
  ok(entities.every((e) => FIELD_GROUPS[e].every((g) => g.fields.every((k) => card.includes(`  ${k} (`)))), "card: every grouped field is present");
}

// ── glossary only names things that exist ─────────────────────────────────
{
  const missing: string[] = [];
  for (const g of GLOSSARY)
    for (const ref of g.refs) {
      const [entity, name] = ref.split(".");
      const def = SCHEMA[entity as EntityKey];
      if (!def || (!def.fields[name] && !def.relations[name])) missing.push(ref);
    }
  ok(missing.length === 0, "glossary: every referenced field or relation exists" + (missing.length ? " (missing: " + missing.join(", ") + ")" : ""));
}

// ── every expected answer in the test set is a query the engine accepts ───
{
  let good = 0;
  const bad: string[] = [];
  for (const ex of EXAMPLES) {
    if (ex.expect.status !== "ok") continue;
    try {
      const spec = normalizeSpec(ex.expect.spec);
      checkSpec(spec);
      if (ex.current) checkSpec(normalizeSpec(ex.current));
      good++;
    } catch (e) {
      bad.push(`${ex.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  ok(bad.length === 0, `examples: all ${good} expected queries are valid and compile` + (bad.length ? "\n   " + bad.join("\n   ") : ""));
  // One rule for count vs list, so the test set cannot contradict itself: "how many / number of / count" = a count; otherwise rows.
  const inconsistent = EXAMPLES.filter((e) => e.expect.status === "ok" && !e.current).filter((e) => {
    const out = (e.expect as unknown as { spec: { output: { kind: string } } }).spec.output.kind;
    const asksCount = /how many|number of|\bcount\b/i.test(e.question);
    return (out === "count" || out === "countDistinct") !== asksCount && (out === "count" || out === "ids");
  });
  ok(inconsistent.length === 0, "examples: count only when the question asks how many, otherwise the rows" + (inconsistent.length ? " (breaks: " + inconsistent.map((e) => e.id).join(", ") + ")" : ""));
  {
    const badAlt: string[] = [];
    for (const e of EXAMPLES) for (const a of e.alt ?? []) { try { checkSpec(normalizeSpec(a)); } catch (err) { badAlt.push(e.id + ": " + (err instanceof Error ? err.message : err)); } }
    ok(badAlt.length === 0, "examples: every accepted alternative is a valid query" + (badAlt.length ? " " + badAlt.join("; ") : ""));
  }
  ok(EXAMPLES.length >= 45, `examples: the test set has ${EXAMPLES.length} questions`);
  ok(new Set(EXAMPLES.map((e) => e.id)).size === EXAMPLES.length, "examples: ids are unique");
  ok(EXAMPLES.some((e) => e.expect.status === "clarify") && EXAMPLES.some((e) => e.expect.status === "unsupported") && EXAMPLES.some((e) => e.current), "examples: clarify, unsupported and edit cases are covered");
}

// ── parsing what a model says ─────────────────────────────────────────────
{
  ok(parseAnswer('{"status":"ok","spec":{"entity":"session"}}').status === "ok", "parse: plain JSON");
  ok(parseAnswer('Sure!\n```json\n{"status":"clarify","question":"Which dates?"}\n```').status === "clarify", "parse: JSON inside a code fence and chatter");
  ok(throws(() => parseAnswer("I think you want sessions"), /not JSON/), "parse: prose is rejected");
  ok(throws(() => parseAnswer('{"status":"maybe"}'), /status/), "parse: an unknown status is rejected");
  ok(throws(() => parseAnswer('{"status":"ok"}'), /spec/), 'parse: "ok" without a spec is rejected');
  const long = parseAnswer(JSON.stringify({ status: "ok", spec: {}, assumptions: Array(20).fill("x".repeat(500)) }));
  ok(long.status === "ok" && (long.assumptions?.length ?? 0) <= 5 && (long.assumptions?.[0].length ?? 0) <= 200, "parse: assumptions are capped");
}

// ── building a spec ───────────────────────────────────────────────────────
{
  const spec = normalizeSpec({
    entity: "session",
    meta: { name: "ignored" },
    order: { mode: "manual" },
    where: [
      { kind: "field", field: "converted", op: "isTrue" },
      { kind: "related", relation: "pageViews", where: [{ field: "page", op: "=", value: "/pricing" }] },
      { mode: "or", where: [{ field: "country", op: "=", value: "Germany" }] },
    ],
    output: { kind: "count" },
  });
  const ids: string[] = [];
  const walk = (cs: { id: string; where?: unknown[] }[]) => cs.forEach((c) => { ids.push(c.id); if (c.where) walk(c.where as never); });
  walk(spec.where as never);
  ok(spec.v === 3 && !("meta" in spec) && !("order" in spec), "normalize: version added, names and manual order dropped");
  ok(new Set(ids).size === 5 && ids.every(Boolean), "normalize: every condition gets a unique id");
  ok((spec.where[1] as { kind: string }).kind === "related" && (spec.where[2] as { kind: string }).kind === "group", "normalize: a missing kind is inferred from its shape");
  const sub = normalizeSpec({ entity: "pageView", where: [{ kind: "field", field: "visitor", op: "in", value: { hook: { entity: "lead", where: [{ kind: "field", field: "name", op: "contains", value: "hanna" }], output: { kind: "values", field: "visitor" } } } }], output: { kind: "count" } });
  const v = (sub.where[0] as { value: { hook: { v: number; where: { id: string }[] } } }).value.hook;
  ok(v.v === 3 && v.where[0].id !== (sub.where[0] as { id: string }).id, "normalize: sub-queries get a version and their own ids");
  ok(throws(() => normalizeSpec({ where: [], output: { kind: "count" } }), /entity/), "normalize: a missing entity is reported");
  ok(throws(() => normalizeSpec({ entity: "session", where: "x", output: { kind: "count" } }), /list/), "normalize: where must be a list");
  const model = stripForModel(spec) as { v?: unknown; where: { id?: unknown }[] };
  ok(model.v === undefined && model.where.every((c) => c.id === undefined), "stripForModel: no version, no ids");
}

// ── the engine's own gates catch what the model gets wrong ────────────────
{
  const bad = (raw: unknown) => {
    try {
      checkSpec(normalizeSpec(raw));
      return "";
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  ok(/not a field/.test(bad({ entity: "session", where: [{ kind: "field", field: "bounceRate", op: ">", value: 1 }], output: { kind: "count" } })), "check: an invented field is rejected");
  ok(/can't be used/.test(bad({ entity: "session", where: [{ kind: "field", field: "converted", op: ">", value: 1 }], output: { kind: "count" } })), "check: an operator that does not fit the type is rejected");
  ok(/duration/.test(bad({ entity: "pageView", where: [{ kind: "field", field: "visitDuration", op: ">", value: 5 }], output: { kind: "count" } })) || bad({ entity: "pageView", where: [{ kind: "field", field: "visitDuration", op: ">", value: 5 }], output: { kind: "count" } }) === "", "check: a bare number for a duration is handled");
  ok(/list/.test(bad({ entity: "session", where: [{ kind: "field", field: "utmSource", op: "in", value: "google" }], output: { kind: "count" } })), "check: a text where a list is needed is rejected");
}

// ── translate(), with a fake model ────────────────────────────────────────
const U = { inputTokens: 3000, cachedTokens: 2900, outputTokens: 120 };
const fake = (replies: (string | Error)[]): { provider: ModelProvider; calls: { messages: { role: string; content: string }[] }[] } => {
  const calls: { messages: { role: string; content: string }[] }[] = [];
  let i = 0;
  return {
    calls,
    provider: {
      async complete(req) {
        calls.push({ messages: req.messages.map((m) => ({ ...m })) });
        const r = replies[Math.min(i++, replies.length - 1)];
        if (r instanceof Error) throw r;
        return { text: r, usage: U };
      },
    },
  };
}
const model = MODELS.terra;
const input = { question: "how many sessions converted", pages: EVAL_PAGES, today: EVAL_TODAY };
const GOOD = JSON.stringify({ status: "ok", spec: { entity: "session", where: [{ kind: "field", field: "converted", op: "isTrue" }], output: { kind: "count" } }, assumptions: ["counted all time"] });
const WRONG_FIELD = JSON.stringify({ status: "ok", spec: { entity: "session", where: [{ kind: "field", field: "didConvert", op: "isTrue" }], output: { kind: "count" } } });

(async () => {
  {
    const f = fake([GOOD]);
    const { result, trace } = await translate(input, { provider: f.provider, model });
    ok(result.status === "ok" && result.reads.includes("number of sessions") && result.assumptions[0] === "counted all time", "translate: a good reply becomes a checked query that reads back as a sentence");
    ok(trace.attempts === 1 && trace.usage.inputTokens === 3000 && trace.costUsd > 0, "translate: usage and cost are recorded");
    ok(f.calls[0].messages[0].role === "system" && f.calls[0].messages[1].content.includes("QUESTION: how many sessions converted"), "translate: the request is a system prompt plus the question");
  }
  {
    const f = fake([WRONG_FIELD, GOOD]);
    const { result, trace } = await translate(input, { provider: f.provider, model });
    ok(result.status === "ok" && trace.attempts === 2 && !!trace.firstError, "translate: a wrong field is repaired on the second try");
    ok(trace.usage.inputTokens === 6000, "translate: both attempts are billed");
    const repair = f.calls[1].messages;
    ok(repair.length === 4 && repair[2].role === "assistant" && /rejected/.test(repair[3].content) && /didConvert/.test(repair[3].content), "translate: the retry shows the model its reply and the exact complaint");
  }
  {
    const f = fake(["Sure, here you go: sessions", GOOD]);
    const { result, trace } = await translate(input, { provider: f.provider, model });
    ok(result.status === "ok" && trace.attempts === 2, "translate: prose instead of JSON is retried");
  }
  {
    const f = fake([WRONG_FIELD, WRONG_FIELD]);
    const { result, trace } = await translate(input, { provider: f.provider, model });
    ok(result.status === "failed" && trace.attempts === 2, "translate: two bad replies end in a plain failure, not a loop");
  }
  {
    const { result, trace } = await translate(input, { provider: fake(['{"status":"clarify","question":"Which dates?"}']).provider, model });
    ok(result.status === "clarify" && result.question === "Which dates?" && trace.attempts === 1, "translate: a clarifying question is passed through without retrying");
  }
  {
    const { result } = await translate(input, { provider: fake(['{"status":"unsupported","reason":"Use Compare."}']).provider, model });
    ok(result.status === "unsupported" && result.reason === "Use Compare.", "translate: unsupported is passed through");
  }
  {
    const f = fake([GOOD]);
    const { result } = await translate({ ...input, question: "   " }, { provider: f.provider, model });
    ok(result.status === "failed" && f.calls.length === 0, "translate: an empty question never reaches the model");
  }
  {
    let thrown = "";
    try {
      await translate(input, { provider: fake([new ProviderError("rate_limit", "rate limited", 429)]).provider, model });
    } catch (e) {
      thrown = e instanceof ProviderError ? e.kind : "other";
    }
    ok(thrown === "rate_limit", "translate: a provider failure reaches the caller (the action decides what to tell the person)");
  }
  {
    const f = fake([GOOD]);
    await translate({ ...input, question: "x".repeat(5000) }, { provider: f.provider, model });
    ok(f.calls[0].messages[1].content.length < 1500, "translate: a huge question is cut before it is sent");
  }

  // ── the static prompt ───────────────────────────────────────────────────
  {
    const a = systemPrompt();
    const b = systemPrompt();
    ok(a === b, "prompt: the system prompt is identical on every call (it is what gets cached)");
    ok(!a.includes(EVAL_TODAY) && !/\b20\d\d-\d\d-\d\d\b/.test(a.replace(/2026-09-0\d|2026-09-30/g, "")), "prompt: nothing per-request (no current date) is in the cached part");
    const tokens = Math.round(a.length / 3.6);
    console.log(`   system prompt: ${a.length} characters, about ${tokens} tokens (the cached part)`);
    ok(tokens > 1200 && tokens < 12000, "prompt: the cached part is big enough to cache and small enough to afford");
    const u = userMessage({ question: "q", pages: Array.from({ length: 80 }, (_, i) => `/p${i}`), today: EVAL_TODAY });
    ok(u.split(",").length <= 27, "prompt: at most 25 site pages are sent");
    ok(userMessage({ question: "q", current: { v: 3, entity: "session", where: [], output: { kind: "count" } } }).includes("CURRENT QUERY"), "prompt: a query being adjusted is included");
  }

  // ── models and money ────────────────────────────────────────────────────
  {
    const usd = costUsd(MODELS.terra, { inputTokens: 3300, cachedTokens: 3000, outputTokens: 350 });
    // 300 uncached * $2 + 3000 cached * $0.2 + 350 out * $12, per million
    ok(Math.abs(usd - (300 * 2 + 3000 * 0.2 + 350 * 12) / 1e6) < 1e-9, "cost: cached input is billed at the cached rate");
    ok(creditsFor(0.0001) === 1 && creditsFor(0.0054, 0.002) === 3 && creditsFor(0.0054, 0) === 3, "credits: at least 1, one credit per $0.002 by default");
    ok(resolveModel("luna").key === "luna" && resolveModel("nonsense").key === "terra" && resolveModel(undefined).def.id === "gpt-5.6-terra", "models: the registry resolves, unknown names fall back to the default");
    ok(MODELS.terra.reasoning === "none", "models: thinking is off by default (it is billed as output)");
  }

  console.log(`\n${passes} passed, ${fails} failed`);
  if (fails) process.exit(1);
})();
