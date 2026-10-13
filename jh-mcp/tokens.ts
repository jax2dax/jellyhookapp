// jh-mcp/tokens.ts
// MCP access tokens: generating, hashing, and the rules for when one may be used. Pure (node:crypto only), no
// database, so it is fully testable offline. The database side is lib/actions/mcpTokens.action.ts (creating and
// revoking from Settings) and lib/mcp/auth.ts (checking a token on a call).
//
// A token looks like  jh_mcp_<43 random url-safe characters>  (256 bits). Only its SHA-256 is stored. Because the
// token is long and random, a plain hash lookup is safe (nothing to brute-force); no salt or slow hash is needed.
import { createHash, randomBytes } from "node:crypto";

export const TOKEN_PREFIX = "jh_mcp_";
/** Characters of the token kept in plain text so a person can tell tokens apart in a list. */
export const PREFIX_SHOWN = TOKEN_PREFIX.length + 4;

/** Expiry choices offered in Settings (days). There is deliberately no "never". */
export const EXPIRY_DAYS = [30, 90, 365] as const;
export const DEFAULT_EXPIRY_DAYS = 90;

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Looks like one of our tokens (cheap check before touching the database). */
export function looksLikeToken(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(TOKEN_PREFIX) && v.length === TOKEN_PREFIX.length + 43 && /^[A-Za-z0-9_-]+$/.test(v.slice(TOKEN_PREFIX.length));
}

export function prefixOf(token: string): string {
  return token.slice(0, PREFIX_SHOWN);
}

export interface TokenRow {
  expires_at: string;
  revoked_at: string | null;
}

export type TokenState = "active" | "expired" | "revoked";

export function tokenState(row: TokenRow, now = Date.now()): TokenState {
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= now) return "expired";
  return "active";
}

export function expiryFrom(days: number, now = Date.now()): string {
  return new Date(now + days * 86_400_000).toISOString();
}

/** The Authorization header's bearer token, or null. */
export function bearerFrom(header: string | null | undefined): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return m ? m[1] : null;
}
