// jh-mcp/config.ts
// Per-token settings, chosen when a token is created: which tools it may use, and its own (lower) limits. The
// server-wide limits (environment variables MCP_MAX_ROWS, MCP_MAX_CREDITS, MCP_CALLS_PER_MINUTE, MCP_CALLS_PER_DAY) are
// CEILINGS: a token's setting can only be lower, never higher. Stored as jsonb in mcp_tokens.config. Pure, no database.
export const TOOL_NAMES = ["get_schema", "list_pages", "validate_hook", "describe_hook", "run_hook"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export interface TokenConfig {
  /** Tools this token may use. Missing = all of them. */
  tools?: ToolName[];
  maxRows?: number;
  maxCredits?: number;
  callsPerMinute?: number;
  callsPerDay?: number;
}

export interface Ceilings {
  maxRows: number;
  maxCredits: number;
  callsPerMinute: number;
  callsPerDay: number;
}

export interface EffectiveConfig extends Ceilings {
  tools: Set<ToolName>;
}

const LIMIT_KEYS = ["maxRows", "maxCredits", "callsPerMinute", "callsPerDay"] as const;

/** Untrusted input (from the browser, or the jsonb column) -> a clean config. Unknown keys and bad values are dropped. */
export function cleanConfig(input: unknown): TokenConfig {
  const out: TokenConfig = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  const raw = input as Record<string, unknown>;
  if (Array.isArray(raw.tools)) {
    const picked = TOOL_NAMES.filter((t) => (raw.tools as unknown[]).includes(t));
    // all five (or none valid) is the same as "no restriction": store nothing
    if (picked.length > 0 && picked.length < TOOL_NAMES.length) out.tools = picked;
  }
  for (const k of LIMIT_KEYS) {
    const n = Number(raw[k]);
    if (raw[k] !== undefined && raw[k] !== null && raw[k] !== "" && Number.isFinite(n) && n >= 1) out[k] = Math.floor(n);
  }
  return out;
}

/** The settings that actually apply: the token's value, capped by the server ceiling. */
export function effectiveConfig(config: TokenConfig, ceilings: Ceilings): EffectiveConfig {
  const pick = (k: (typeof LIMIT_KEYS)[number]) => Math.min(config[k] ?? ceilings[k], ceilings[k]);
  return {
    tools: new Set(config.tools && config.tools.length > 0 ? config.tools : TOOL_NAMES),
    maxRows: pick("maxRows"),
    maxCredits: pick("maxCredits"),
    callsPerMinute: pick("callsPerMinute"),
    callsPerDay: pick("callsPerDay"),
  };
}

/** One line for the token list in Settings. */
export function describeConfig(config: TokenConfig): string {
  const parts: string[] = [];
  parts.push(config.tools ? "tools: " + config.tools.join(", ") : "all tools");
  if (config.maxRows) parts.push(config.maxRows + " rows");
  if (config.maxCredits) parts.push(config.maxCredits + " credits per run");
  if (config.callsPerMinute) parts.push(config.callsPerMinute + "/min");
  if (config.callsPerDay) parts.push(config.callsPerDay + "/day");
  return parts.join(" · ");
}
