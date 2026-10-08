// jh-ai/models.ts
// The ONLY place a model name and its price live. Feature code asks for "the Ask Hook model" and gets a
// ModelDef; swapping models is changing AI_HOOK_MODEL (or the default below). Adding a provider means a
// new entry here plus a file in providers/. Prices are USD per 1M tokens, from the providers' pricing
// pages (checked 2026-10-08); update them here and nowhere else.
import type { Usage } from "./types";

export type ProviderId = "openai";

export interface ModelDef {
  id: string; // what the provider's API calls it
  provider: ProviderId;
  label: string;
  usdPerMTok: { input: number; cachedInput: number; output: number };
  /** Thinking budget. Translation is a lookup problem, not a reasoning one: keep it off (it is billed as output). */
  reasoning: "none" | "low";
  maxOutputTokens: number;
}

export const MODELS: Record<string, ModelDef> = {
  // The default: the mid tier. Vague, conceptual questions need it more than they need the saving.
  terra: {
    id: "gpt-5.6-terra",
    provider: "openai",
    label: "GPT-5.6 Terra",
    usdPerMTok: { input: 2, cachedInput: 0.2, output: 12 },
    reasoning: "none",
    maxOutputTokens: 2500,
  },
  // The cheap tier, to be adopted once the test set shows it keeps up (see mds/build/ai-hook-translate/models-and-cost.md).
  luna: {
    id: "gpt-5.6-luna",
    provider: "openai",
    label: "GPT-5.6 Luna",
    usdPerMTok: { input: 0.2, cachedInput: 0.02, output: 1.2 },
    reasoning: "none",
    maxOutputTokens: 2500,
  },
};

export const DEFAULT_MODEL_KEY = "terra";

/** The model Ask Hook uses: AI_HOOK_MODEL if it names a registry entry, else the default. */
export function resolveModel(key: string | undefined = process.env.AI_HOOK_MODEL): { key: string; def: ModelDef } {
  const k = key && MODELS[key] ? key : DEFAULT_MODEL_KEY;
  return { key: k, def: MODELS[k] };
}

export function costUsd(def: ModelDef, u: Usage): number {
  const uncached = Math.max(0, u.inputTokens - u.cachedTokens);
  const usd = (uncached * def.usdPerMTok.input + u.cachedTokens * def.usdPerMTok.cachedInput + u.outputTokens * def.usdPerMTok.output) / 1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}

/**
 * Hook credits charged for one translation. 1 credit is AI_USD_PER_CREDIT dollars (default $0.002), at least 1,
 * so AI and Hook runs share one meter. A typical Terra question is about 3 credits.
 */
export function creditsFor(usd: number, usdPerCredit = Number(process.env.AI_USD_PER_CREDIT ?? 0.002)): number {
  const per = Number.isFinite(usdPerCredit) && usdPerCredit > 0 ? usdPerCredit : 0.002;
  return Math.max(1, Math.ceil(usd / per));
}
