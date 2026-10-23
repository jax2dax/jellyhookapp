// lib/notifications/send.ts
// Builds and posts one external message (Slack incoming webhook, or a signed generic webhook). No personal data: the
// rule's title, the body with "a new lead", the mark names, the site and a link that only works for signed-in members.
// Exact formats: mds/build/notifications/webhooks.md.
import { createHmac } from "node:crypto";

export interface DeliveryPayload {
  deliveryId: string;
  eventId: string;
  createdAt: string;
  site: { id: string; domain: string | null };
  rule: { id: string; name: string };
  title: string;
  body: string;
  marks: { id: string; name: string }[];
  lead: { id: string; url: string; submittedAt: string | null };
}

export type SendResult = { ok: true; status: number } | { ok: false; status: number | null; error: string };

const TIMEOUT_MS = 10_000;

/** A Slack incoming-webhook address, and nothing else, is accepted as a Slack channel. */
export function isSlackUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "hooks.slack.com" && u.pathname.startsWith("/services/");
  } catch {
    return false;
  }
}

/** A generic webhook: https, a real public host name (no IP addresses, no local names). */
export function isSafeWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return false;
    if (/^[\d.]+$/.test(h) || h.includes(":") || h.startsWith("[")) return false; // IPv4 / IPv6 literals
    return h.includes(".");
  } catch {
    return false;
  }
}

export function slackMessage(p: DeliveryPayload) {
  const when = Math.floor(Date.parse(p.lead.submittedAt ?? p.createdAt) / 1000);
  return {
    text: p.title + ": " + p.body,
    blocks: [
      { type: "header", text: { type: "plain_text", text: p.title.slice(0, 150) } },
      { type: "section", text: { type: "mrkdwn", text: p.body } },
      { type: "context", elements: [{ type: "mrkdwn", text: `Rule: ${p.rule.name}${p.site.domain ? " · " + p.site.domain : ""} · <!date^${when}^{date_short} {time}|${new Date(when * 1000).toISOString()}>` }] },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open the lead" }, url: p.lead.url }] },
    ],
  };
}

export function webhookBody(p: DeliveryPayload) {
  return {
    event: "rule.fired",
    id: p.eventId,
    created_at: p.createdAt,
    site: p.site,
    rule: p.rule,
    message: { title: p.title, body: p.body },
    marks: p.marks,
    lead: { id: p.lead.id, url: p.lead.url, submitted_at: p.lead.submittedAt },
  };
}

/** The signature header: t=<seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">. */
export function signature(secret: string, rawBody: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex")}`;
}

export async function post(kind: "slack" | "webhook", url: string, p: DeliveryPayload, signingSecret: string | null): Promise<SendResult> {
  if (kind === "slack" ? !isSlackUrl(url) : !isSafeWebhookUrl(url)) return { ok: false, status: null, error: "address not allowed" };
  const raw = JSON.stringify(kind === "slack" ? slackMessage(p) : webhookBody(p));
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "Jellyhook-Notifications/1" };
  if (kind === "webhook") {
    headers["X-Jellyhook-Event"] = "rule.fired";
    headers["X-Jellyhook-Delivery"] = p.deliveryId;
    if (signingSecret) headers["X-Jellyhook-Signature"] = signature(signingSecret, raw);
  }
  try {
    const res = await fetch(url, { method: "POST", headers, body: raw, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.status >= 200 && res.status < 300 ? { ok: true, status: res.status } : { ok: false, status: res.status, error: "answered " + res.status };
  } catch (e) {
    return { ok: false, status: null, error: e instanceof Error ? e.message.slice(0, 200) : "network error" };
  }
}
