// lib/notifications/secret.ts
// Slack and webhook URLs are secrets (whoever has one can post into that channel). They are stored only where the
// server can read them (no signed-in user can read notification_channels), and, when CHANNEL_SECRET_KEY is set
// (32 random bytes, base64), encrypted with AES-256-GCM on top. Without the key they are stored as they are.
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const raw = process.env.CHANNEL_SECRET_KEY;
  if (!raw) return null;
  const k = Buffer.from(raw, "base64");
  return k.length === 32 ? k : null;
}

export function sealSecret(plain: string): string {
  const k = key();
  if (!k) return plain;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}

export function openSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const k = key();
  if (!k) throw new Error("CHANNEL_SECRET_KEY is needed to read this channel's address");
  const all = Buffer.from(stored.slice(PREFIX.length), "base64");
  const d = createDecipheriv("aes-256-gcm", k, all.subarray(0, 12));
  d.setAuthTag(all.subarray(12, 28));
  return Buffer.concat([d.update(all.subarray(28)), d.final()]).toString("utf8");
}

/** "hooks.slack.com/…/AbCd" : enough to recognise a channel, useless to post to it. */
export function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + "/…/" + url.slice(-4);
  } catch {
    return "…" + url.slice(-4);
  }
}
