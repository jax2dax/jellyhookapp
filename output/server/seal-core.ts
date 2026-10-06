// output/server/seal-core.ts
// The sealing itself, with the key passed in, so it can be tested on its
// own (output/tests). output/server/seal.ts adds the server-only key.
// AES-256-GCM: encrypted (the id inside can't be read) and authenticated
// (a token can't be forged or edited). Bound to a site and a kind, and
// expires after 24 hours.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { HookError } from "../../jh-hook/errors";

export const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const b64u = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function sealWith(key: Buffer, siteId: string, kind: string, data: unknown, now = Date.now()): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(JSON.stringify({ s: siteId, k: kind, d: data, t: now }), "utf8"), c.final()]);
  return b64u(Buffer.concat([iv, c.getAuthTag(), body]));
}

export function openWith<T>(key: Buffer, siteId: string, kind: string, token: string, now = Date.now()): T {
  let json: { s: string; k: string; d: T; t: number };
  try {
    const raw = unb64u(String(token));
    const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    json = JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8"));
  } catch {
    throw new HookError("These results can't be loaded any more. Run the hook again.");
  }
  if (json.s !== siteId || json.k !== kind) throw new HookError("These results belong to a different site or view. Run the hook again.");
  if (now - json.t > TOKEN_MAX_AGE_MS) throw new HookError("These results are more than a day old. Run the hook again to load more.");
  return json.d;
}
