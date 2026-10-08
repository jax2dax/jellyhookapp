// jh-ai/providers/openai.ts
// OpenAI over plain HTTPS (no SDK: one fewer dependency, and the whole call is readable here). Server only.
// Uses Chat Completions with JSON mode: the model's reply is checked by Hook's own validator, not by OpenAI's
// strict schema mode, because Hook queries nest deeper than strict mode allows (mds/build/ai-hook-translate/).
import { ProviderError, type Completion, type CompletionRequest, type ModelProvider } from "./types";

const URL = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 45_000;
const RETRY_WAIT_MS = 800;

async function once(req: CompletionRequest, key: string): Promise<Completion> {
  let res: Response;
  try {
    res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: req.model.id,
        messages: req.messages,
        response_format: { type: "json_object" },
        max_completion_tokens: req.model.maxOutputTokens,
        reasoning_effort: req.model.reasoning,
        ...(req.cacheKey ? { prompt_cache_key: req.cacheKey } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new ProviderError("timeout", "the model took too long");
    throw new ProviderError("server", "could not reach the model provider");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = (j.error?.message ?? "").slice(0, 300);
    } catch {}
    if (res.status === 401 || res.status === 403) throw new ProviderError("auth", "the model provider rejected the API key", res.status);
    if (res.status === 429) throw new ProviderError("rate_limit", `rate limited${detail ? ": " + detail : ""}`, 429);
    if (res.status >= 500) throw new ProviderError("server", `provider error ${res.status}`, res.status);
    throw new ProviderError("bad_request", `provider refused the request (${res.status})${detail ? ": " + detail : ""}`, res.status);
  }

  const j = (await res.json()) as {
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
  };
  const choice = j.choices?.[0];
  const text = choice?.message?.content ?? "";
  if (!text) throw new ProviderError("server", `the model returned no text${choice?.finish_reason ? " (" + choice.finish_reason + ")" : ""}`);
  return {
    text,
    usage: {
      inputTokens: j.usage?.prompt_tokens ?? 0,
      cachedTokens: j.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      outputTokens: j.usage?.completion_tokens ?? 0,
    },
  };
}

export const openaiProvider: ModelProvider = {
  async complete(req) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new ProviderError("not_configured", "OPENAI_API_KEY is not set");
    try {
      return await once(req, key);
    } catch (e) {
      // One retry for the transient kinds, never for a bad key or a bad request.
      if (e instanceof ProviderError && (e.kind === "rate_limit" || e.kind === "server")) {
        await new Promise((r) => setTimeout(r, RETRY_WAIT_MS));
        return once(req, key);
      }
      throw e;
    }
  },
};
