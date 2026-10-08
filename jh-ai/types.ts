// jh-ai/types.ts
// "Ask Hook": turn a person's own words into a Hook query. See mds/build/ai-hook-translate/.
import type { HookSpec } from "../jh-hook/types";

/** What the model is allowed to answer with (the envelope). Parsed from its JSON. */
export type ModelAnswer =
  | { status: "ok"; spec: unknown; assumptions?: string[] }
  | { status: "clarify"; question: string }
  | { status: "unsupported"; reason: string };

export interface Usage {
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
}

/** What the person (and the UI) gets back. Never contains a key, a prompt or a raw model reply. */
export type TranslateResult =
  | {
      status: "ok";
      spec: HookSpec;
      /** Short notes on anything the model assumed ("treated 'last month' as the last 30 days"). */
      assumptions: string[];
      /** The query read back as a sentence (jh-hook/describe.ts), so it can be checked before running. */
      reads: string;
    }
  | { status: "clarify"; question: string }
  | { status: "unsupported"; reason: string }
  | { status: "failed"; reason: string };

/** What one translation cost, for the ledger and /dev/usage. */
export interface TranslateTrace {
  model: string;
  attempts: number;
  usage: Usage;
  costUsd: number;
  latencyMs: number;
  /** The first validator complaint, if the model needed a repair retry. */
  firstError?: string;
}

export interface TranslateInput {
  question: string;
  /** The query currently in the builder, when the person is adjusting it. */
  current?: HookSpec | null;
  /** The site's most-viewed page paths, so "the pricing page" can become "/pricing". */
  pages?: string[];
  /** UTC "now" (ISO date), injected so tests are deterministic. */
  today?: string;
}
