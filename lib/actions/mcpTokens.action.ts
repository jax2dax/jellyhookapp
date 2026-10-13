// lib/actions/mcpTokens.action.ts
// Creating, listing and revoking MCP access tokens from Settings. Owner and admin only (permission
// "mcp.manage_tokens"). The token itself is returned ONCE, by createMcpToken; only its hash is stored.
// Plan and rules: mds/build/mcp/plan.md.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { CONSENT_VERSION } from "@/jh-mcp/consent";
import { DEFAULT_EXPIRY_DAYS, EXPIRY_DAYS, expiryFrom, generateToken, hashToken, prefixOf, tokenState, type TokenState } from "@/jh-mcp/tokens";
import { can } from "@/lib/tracking/permissions";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const MAX_ACTIVE_TOKENS_PER_SITE = 10;
const MAX_LABEL = 60;

export interface McpTokenInfo {
  id: string;
  label: string;
  prefix: string;
  allowPii: boolean;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  state: TokenState;
}

async function authorize(siteId: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
  if (!siteId) return { ok: false, error: "No site selected." };
  const { data: m } = await admin.from("site_members").select("role").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!m) return { ok: false, error: "You do not have access to this site." };
  if (!can(m.role, "mcp.manage_tokens")) return { ok: false, error: "Only the site owner or an admin can manage AI access tokens." };
  return { ok: true, userId };
}

export async function listMcpTokens(siteId: string): Promise<{ ok: true; tokens: McpTokenInfo[] } | { ok: false; error: string }> {
  const a = await authorize(siteId);
  if (!a.ok) return a;
  const { data, error } = await admin
    .from("mcp_tokens")
    .select("id, label, token_prefix, allow_pii, created_at, expires_at, revoked_at, last_used_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("[mcp] list tokens:", error.message);
    return { ok: false, error: "Could not load the tokens. Has mds/migrations/2026-10-13-mcp-tokens.sql been run?" };
  }
  return {
    ok: true,
    tokens: (data ?? []).map((r) => ({ id: r.id, label: r.label, prefix: r.token_prefix, allowPii: r.allow_pii, createdAt: r.created_at, expiresAt: r.expires_at, lastUsedAt: r.last_used_at, state: tokenState(r) })),
  };
}

export async function createMcpToken(
  siteId: string,
  input: { label: string; consent: boolean; allowPii: boolean; piiConsent: boolean; expiresInDays: number },
): Promise<{ ok: true; token: string; info: McpTokenInfo } | { ok: false; error: string }> {
  const a = await authorize(siteId);
  if (!a.ok) return a;

  const label = typeof input?.label === "string" ? input.label.trim().slice(0, MAX_LABEL) : "";
  if (!label) return { ok: false, error: "Give the token a name, for example the app it is for." };
  // Both boxes are enforced here, not only in the screen: a request without them is refused.
  if (input.consent !== true) return { ok: false, error: "Tick the box to confirm you understand where the data goes." };
  if (input.allowPii && input.piiConsent !== true) return { ok: false, error: "Tick the second box to allow personal details." };
  const days = (EXPIRY_DAYS as readonly number[]).includes(input.expiresInDays) ? input.expiresInDays : DEFAULT_EXPIRY_DAYS;

  const { count, error: countError } = await admin.from("mcp_tokens").select("id", { count: "exact", head: true }).eq("site_id", siteId).is("revoked_at", null).gt("expires_at", new Date().toISOString());
  if (countError) {
    console.error("[mcp] count tokens:", countError.message);
    return { ok: false, error: "Could not create the token. Has mds/migrations/2026-10-13-mcp-tokens.sql been run?" };
  }
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS_PER_SITE) return { ok: false, error: `This site already has ${MAX_ACTIVE_TOKENS_PER_SITE} active tokens. Revoke one first.` };

  const token = generateToken();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("mcp_tokens")
    .insert({
      site_id: siteId,
      created_by: a.userId,
      label,
      token_hash: hashToken(token),
      token_prefix: prefixOf(token),
      allow_pii: input.allowPii === true,
      consent_at: now,
      consent_version: CONSENT_VERSION,
      expires_at: expiryFrom(days),
    })
    .select("id, label, token_prefix, allow_pii, created_at, expires_at, revoked_at, last_used_at")
    .single();
  if (error || !data) {
    console.error("[mcp] create token:", error?.message);
    return { ok: false, error: "Could not create the token. Try again." };
  }
  revalidatePath("/platform/settings");
  return {
    ok: true,
    token,
    info: { id: data.id, label: data.label, prefix: data.token_prefix, allowPii: data.allow_pii, createdAt: data.created_at, expiresAt: data.expires_at, lastUsedAt: data.last_used_at, state: tokenState(data) },
  };
}

export async function revokeMcpToken(siteId: string, tokenId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await authorize(siteId);
  if (!a.ok) return a;
  const { data, error } = await admin.from("mcp_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", tokenId).eq("site_id", siteId).is("revoked_at", null).select("id");
  if (error) {
    console.error("[mcp] revoke token:", error.message);
    return { ok: false, error: "Could not revoke the token. Try again." };
  }
  if (!data || data.length === 0) return { ok: false, error: "That token was already revoked or does not exist." };
  revalidatePath("/platform/settings");
  return { ok: true };
}
