// lib/actions/hookAi.action.ts
// Ask Hook: the server entry point. The browser sends a sentence (and the query currently in the builder);
// everything else is decided here, on the server:
//   who is asking and which site (the same rule as every Hook action: the current site, active members only),
//   whether they may ask (allowance, daily dollar cap, kill switch, key present),
//   what the model is allowed to see (the field list, the site's top page paths, the sentence, the current
//   query: NEVER visitor rows),
//   what it cost (recorded in the ledger, charged as Hook credits).
// A HookError-style message goes back verbatim; anything unexpected becomes a reference code, like Hook runs.
"use server";

import { auth } from "@clerk/nextjs/server";
import { hookLog, refCode } from "@/jh-hook/debug";
import { migrateSpec } from "@/jh-hook/migrate";
import type { HookSpec } from "@/jh-hook/types";
import { creditsFor, resolveModel } from "@/jh-ai/models";
import { providerFor, ProviderError } from "@/jh-ai/providers";
import { translate } from "@/jh-ai/translate";
import type { TranslateResult, TranslateTrace } from "@/jh-ai/types";
import { checkQuota, recordRequest } from "@/lib/ai/ledger";
import { listSitePages } from "@/lib/actions/hook.action";
import { siteOrThrow } from "@/lib/hook/site";

const MAX_QUESTION = 600;
const MAX_CURRENT_BYTES = 20_000;

export interface AskHookUsage {
  /** Hook credits this question cost. */
  credits: number;
  usedToday: number;
  limitToday: number;
}

export type AskHookResponse = { ok: true; result: TranslateResult; usage: AskHookUsage } | { ok: false; error: string; ref?: string };

/** Page paths worth telling the model about: real paths only, no query strings, nothing that looks like an id or an email. */
function usablePaths(rows: { path: string }[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const p = (r.path || "").split("?")[0].split("#")[0];
    if (!p.startsWith("/") || p.length > 60 || /@|[0-9a-f]{8,}|\d{6,}/i.test(p)) continue;
    if (!out.includes(p)) out.push(p);
    if (out.length >= 25) break;
  }
  return out;
}

function friendly(e: ProviderError): string {
  switch (e.kind) {
    case "rate_limit":
      return "Ask Hook is busy right now. Try again in a moment.";
    case "timeout":
      return "Ask Hook took too long. Try again, or build the question with the builder.";
    case "not_configured":
    case "auth":
      return "Ask Hook is not available right now.";
    default:
      return "Ask Hook could not answer that. Try again, or build the question with the builder.";
  }
}

export async function askHookAction(question: string, current?: HookSpec | null): Promise<AskHookResponse> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again to use Ask Hook." };
  const q = typeof question === "string" ? question.trim() : "";
  if (!q) return { ok: false, error: "Type a question first." };
  if (q.length > MAX_QUESTION) return { ok: false, error: `Keep the question under ${MAX_QUESTION} characters.` };

  let siteId = "";
  try {
    siteId = await siteOrThrow();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No site is available." };
  }

  if (process.env.AI_ENABLED === "0" || !process.env.OPENAI_API_KEY) return { ok: false, error: "Ask Hook is not available right now." };

  // The current query: untrusted like any query, so it is upgraded and size-limited before it is shown to the model.
  let currentSpec: HookSpec | null = null;
  if (current) {
    try {
      if (JSON.stringify(current).length > MAX_CURRENT_BYTES) return { ok: false, error: "The query in the builder is too large to adjust with Ask Hook." };
      currentSpec = migrateSpec(current).spec;
    } catch {
      currentSpec = null; // an unreadable query is simply ignored: the person is asking for a new one
    }
  }

  const quota = await checkQuota(userId);
  if (!quota.ok) {
    if (quota.reason === "user_limit") return { ok: false, error: `You've used today's ${quota.limitToday} Ask Hook questions. They reset at midnight UTC.` };
    return { ok: false, error: "Ask Hook is not available right now." };
  }

  const { key, def } = resolveModel();
  const t0 = Date.now();
  let trace: TranslateTrace | null = null;
  let result: TranslateResult;
  try {
    const pages = usablePaths(await listSitePages());
    const out = await translate({ question: q, current: currentSpec, pages }, { provider: providerFor(def.provider), model: def });
    result = out.result;
    trace = out.trace;
  } catch (e) {
    const failed = e instanceof ProviderError;
    const ref = refCode();
    hookLog.error("ask failed", { ref, site: siteId.slice(0, 8), kind: failed ? e.kind : "bug", error: e instanceof Error ? e.message : String(e) });
    await recordRequest({ userId, siteId, status: "error", trace: null, model: def.id, credits: 0, questionChars: q.length });
    return failed ? { ok: false, error: friendly(e), ref } : { ok: false, error: `Something went wrong on our side. Reference ${ref}.`, ref };
  }

  const credits = creditsFor(trace.costUsd);
  await recordRequest({
    userId,
    siteId,
    status: result.status,
    trace,
    model: def.id,
    credits,
    questionChars: q.length,
    question: q,
    spec: result.status === "ok" ? result.spec : undefined,
  });
  console.info("[ask-hook]", JSON.stringify({ site: siteId.slice(0, 8), model: key, status: result.status, attempts: trace.attempts, usd: trace.costUsd, credits, ms: Date.now() - t0, cached: trace.usage.cachedTokens, input: trace.usage.inputTokens }));
  return { ok: true, result, usage: { credits, usedToday: quota.usedToday + 1, limitToday: quota.limitToday } };
}

/** What the box shows before the first question: today's allowance. */
export async function askHookStatus(): Promise<{ available: boolean; usedToday: number; limitToday: number }> {
  const { userId } = await auth();
  if (!userId || process.env.AI_ENABLED === "0" || !process.env.OPENAI_API_KEY) return { available: false, usedToday: 0, limitToday: 0 };
  const q = await checkQuota(userId);
  return { available: q.ok || q.reason === "user_limit", usedToday: q.usedToday, limitToday: q.limitToday };
}
