// output/server/seal.ts
// Sealed tokens: how the canvas asks for "the next 6 sessions" without the
// browser ever holding raw ids. See seal-core.ts for the format (AES-256-GCM,
// bound to the site and the view, 24-hour expiry). The key comes from
// HOOK_TOKEN_SECRET, or is derived from the Supabase service role key when
// that isn't set; it never leaves the server.
import "server-only";
import { createHash } from "node:crypto";
import { openWith, sealWith } from "./seal-core";

let cached: Buffer | null = null;
function key(): Buffer {
  if (cached) return cached;
  const secret = process.env.HOOK_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("No secret for sealed canvas tokens (set HOOK_TOKEN_SECRET)");
  cached = createHash("sha256").update(`${secret}:hook-canvas-v1`).digest();
  return cached;
}

export const seal = (siteId: string, kind: string, data: unknown) => sealWith(key(), siteId, kind, data);
export const open = <T,>(siteId: string, kind: string, token: string) => openWith<T>(key(), siteId, kind, token);
