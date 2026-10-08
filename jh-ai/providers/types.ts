// jh-ai/providers/types.ts
// The seam between Ask Hook and any model vendor. translate.ts only knows this interface; a vendor is one file
// that implements it. Nothing outside providers/ may import a vendor SDK, URL or key.
import type { ModelDef } from "../models";
import type { Usage } from "../types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: ModelDef;
  messages: ChatMessage[];
  /** Groups requests that share a prompt prefix, so the provider can route them to the same cache. */
  cacheKey?: string;
}

export interface Completion {
  text: string;
  usage: Usage;
}

export type ProviderErrorKind = "auth" | "rate_limit" | "timeout" | "server" | "bad_request" | "not_configured";

/** A provider failure. The message is safe to log; it never contains a key or a prompt. */
export class ProviderError extends Error {
  constructor(
    public kind: ProviderErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ModelProvider {
  complete(req: CompletionRequest): Promise<Completion>;
}
