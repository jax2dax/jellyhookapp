// lib/mcp/auth.ts
// Who is calling the MCP route, whether they may call now, and the record of what they did. Server only, service
// role (mcp_tokens and mcp_calls have no policy, so the browser can never read them).
//
// Fails closed: if the token table cannot be read, nothing runs (503). A token is accepted only when it is active
// (not revoked, not expired) AND its site still exists, is switched on and is not deleted.
// Limits (environment, with defaults): MCP_CALLS_PER_MINUTE 30, MCP_CALLS_PER_DAY 500, MCP_MAX_CREDITS 20, MCP_MAX_ROWS 50.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cleanConfig, effectiveConfig, type EffectiveConfig } from "@/jh-mcp/config";
import { bearerFrom, hashToken, looksLikeToken, tokenState } from "@/jh-mcp/tokens";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const positive = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
export const CALLS_PER_MINUTE = () => positive(process.env.MCP_CALLS_PER_MINUTE, 30);
export const CALLS_PER_DAY = () => positive(process.env.MCP_CALLS_PER_DAY, 500);
export const MAX_CREDITS = () => positive(process.env.MCP_MAX_CREDITS, 20);
export const MAX_ROWS = () => positive(process.env.MCP_MAX_ROWS, 50);

export interface Caller {
  tokenId: string;
  siteId: string;
  allowPii: boolean;
  /** The token's own settings, already capped by the server-wide ceilings. */
  config: EffectiveConfig;
}

export type AuthResult = { ok: true; caller: Caller } | { ok: false; status: 401 | 404 | 503; message: string };

export async function authenticate(req: Request): Promise<AuthResult> {
  if (process.env.MCP_ENABLED !== "1") return { ok: false, status: 404, message: "Not found" };
  const token = bearerFrom(req.headers.get("authorization"));
  if (!looksLikeToken(token)) return { ok: false, status: 401, message: "Missing or malformed token. Create one in Jellyhook Settings, under AI access." };

  const { data: row, error } = await admin
    .from("mcp_tokens")
    .select("id, site_id, allow_pii, expires_at, revoked_at, last_used_at, config")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    console.error("[mcp] token lookup failed, refusing:", error.message);
    return { ok: false, status: 503, message: "Temporarily unavailable." };
  }
  // The same message for "no such token", "revoked" and "expired" on purpose: do not help someone guess.
  if (!row || tokenState(row) !== "active") return { ok: false, status: 401, message: "This token is not valid. It may be revoked or expired. Create a new one in Jellyhook Settings." };

  const { data: site, error: siteError } = await admin.from("sites").select("id, is_active, deleted_at").eq("id", row.site_id).maybeSingle();
  if (siteError) {
    console.error("[mcp] site lookup failed, refusing:", siteError.message);
    return { ok: false, status: 503, message: "Temporarily unavailable." };
  }
  if (!site || site.deleted_at || site.is_active === false) return { ok: false, status: 401, message: "This token is not valid. The site is no longer available." };

  // "last used" is for the person's list in Settings: written at most once a minute, not on every call.
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    await admin.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  }
  const config = effectiveConfig(cleanConfig(row.config), { maxRows: MAX_ROWS(), maxCredits: MAX_CREDITS(), callsPerMinute: CALLS_PER_MINUTE(), callsPerDay: CALLS_PER_DAY() });
  return { ok: true, caller: { tokenId: row.id, siteId: row.site_id, allowPii: row.allow_pii === true, config } };
}

/** Counts this token's calls in the last minute and the last day. Over a limit, or unreadable: not allowed. */
export async function checkRate(tokenId: string, limits: { perMinute: number; perDay: number }): Promise<{ ok: true } | { ok: false; message: string }> {
  const now = Date.now();
  const [minute, day] = await Promise.all([
    admin.from("mcp_calls").select("id", { count: "exact", head: true }).eq("token_id", tokenId).gte("created_at", new Date(now - 60_000).toISOString()),
    admin.from("mcp_calls").select("id", { count: "exact", head: true }).eq("token_id", tokenId).gte("created_at", new Date(now - 86_400_000).toISOString()),
  ]);
  if (minute.error || day.error) {
    console.error("[mcp] call ledger unreadable, refusing:", (minute.error ?? day.error)?.message);
    return { ok: false, message: "Temporarily unavailable." };
  }
  if ((minute.count ?? 0) >= limits.perMinute) return { ok: false, message: `Too many calls: the limit is ${limits.perMinute} a minute for this token. Wait a minute and try again.` };
  if ((day.count ?? 0) >= limits.perDay) return { ok: false, message: `Daily limit reached: ${limits.perDay} calls a day for this token. It resets on a rolling 24 hours.` };
  return { ok: true };
}

/** One row per tool call. Never throws: a ledger hiccup must not turn a good answer into an error (it is logged). */
export async function recordCall(caller: Caller, o: { kind: string; status: string; credits: number; rows: number | null; ms: number; error?: string }): Promise<void> {
  const { error } = await admin.from("mcp_calls").insert({
    token_id: caller.tokenId,
    site_id: caller.siteId,
    kind: o.kind,
    status: o.status,
    credits: o.credits,
    rows_returned: o.rows,
    latency_ms: o.ms,
    error: o.error ? o.error.slice(0, 200) : null,
  });
  if (error) console.error("[mcp] could not write the call record:", error.message);
}
