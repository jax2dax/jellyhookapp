// jh-ai/providers/index.ts
import type { ProviderId } from "../models";
import { openaiProvider } from "./openai";
import type { ModelProvider } from "./types";

const PROVIDERS: Record<ProviderId, ModelProvider> = { openai: openaiProvider };

export const providerFor = (id: ProviderId): ModelProvider => PROVIDERS[id];
export { ProviderError } from "./types";
export type { ModelProvider, CompletionRequest, Completion } from "./types";
