// jh-ai/translate.ts
// The whole translation, one function:
//   ask the model -> read its JSON -> build a HookSpec -> check it with the engine's own gates
//   -> if anything fails, tell the model EXACTLY what was wrong and let it try once more.
// Pure with respect to the outside world: the model comes in as a dependency, so tests run it with a fake
// and the server action runs it with OpenAI. It never touches the database, a user or a site.
import { describeSpec } from "../jh-hook/describe";
import { isHookError } from "../jh-hook/errors";
import { checkSpec } from "./check";
import { costUsd, type ModelDef } from "./models";
import { AiParseError, normalizeSpec, parseAnswer } from "./normalize";
import { systemPrompt, userMessage } from "./prompt";
import type { ChatMessage, ModelProvider } from "./providers/types";
import type { TranslateInput, TranslateResult, TranslateTrace, Usage } from "./types";

const MAX_ATTEMPTS = 2; // the first try plus one repair
const MAX_QUESTION_CHARS = 600;
/** Same prefix for everyone, so the provider's cache is shared. Bump when the static prompt's structure changes. */
const CACHE_KEY = "jh-ask-hook-v1";

export interface TranslateDeps {
  provider: ModelProvider;
  model: ModelDef;
}

const add = (a: Usage, b: Usage): Usage => ({ inputTokens: a.inputTokens + b.inputTokens, cachedTokens: a.cachedTokens + b.cachedTokens, outputTokens: a.outputTokens + b.outputTokens });

export async function translate(input: TranslateInput, deps: TranslateDeps): Promise<{ result: TranslateResult; trace: TranslateTrace }> {
  const t0 = Date.now();
  const question = input.question.trim().slice(0, MAX_QUESTION_CHARS);
  let usage: Usage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0 };
  let attempts = 0;
  let firstError: string | undefined;

  const done = (result: TranslateResult): { result: TranslateResult; trace: TranslateTrace } => ({
    result,
    trace: { model: deps.model.id, attempts, usage, costUsd: costUsd(deps.model, usage), latencyMs: Date.now() - t0, ...(firstError ? { firstError } : {}) },
  });

  if (!question) return done({ status: "failed", reason: "Type a question first." });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: userMessage({ ...input, question }) },
  ];

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    attempts++;
    const completion = await deps.provider.complete({ model: deps.model, messages, cacheKey: CACHE_KEY });
    usage = add(usage, completion.usage);

    let problem: string;
    try {
      const answer = parseAnswer(completion.text);
      if (answer.status === "clarify") return done({ status: "clarify", question: answer.question });
      if (answer.status === "unsupported") return done({ status: "unsupported", reason: answer.reason });
      const spec = normalizeSpec(answer.spec);
      checkSpec(spec);
      return done({ status: "ok", spec, assumptions: answer.assumptions ?? [], reads: describeSpec(spec) });
    } catch (e) {
      if (e instanceof AiParseError || isHookError(e)) problem = e.message;
      else throw e; // a bug here is ours, not the model's: let the caller log it
    }

    firstError ??= problem;
    // The repair turn: show the model its own reply and the exact complaint.
    messages.push({ role: "assistant", content: completion.text });
    messages.push({ role: "user", content: `That was rejected: ${problem}\nReply again with ONE corrected JSON object only, in the same format.` });
  }

  return done({ status: "failed", reason: "I could not turn that into a valid query. Try rephrasing, or build it with the builder." });
}
