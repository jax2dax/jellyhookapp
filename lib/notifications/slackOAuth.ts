// lib/notifications/slackOAuth.ts
// "Add to Slack": the OAuth v2 flow with only the incoming-webhook scope. The person picks a workspace and a channel on
// Slack's own screen; Slack answers with an incoming-webhook URL for that channel, which is stored exactly like a pasted
// one (notification_channels, sealed), so sending (lib/notifications/send.ts) does not change.
// Routes: app/api/integrations/slack/start (sends the person to Slack) and .../callback (Slack sends them back).
// Needs SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (a Slack app, see mds/build/notifications/slack-oauth.md).
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SLACK_STATE_COOKIE = "jh_slack_oauth";
const STATE_MAX_AGE_MS = 10 * 60_000;

export function slackOAuthConfigured(): boolean {
  return !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET);
}

/** The callback address; must be listed exactly under Redirect URLs in the Slack app. */
export function slackRedirectUri(origin: string): string {
  const base = (process.env.SLACK_REDIRECT_BASE || origin).replace(/\/+$/, "");
  return base + "/api/integrations/slack/callback";
}

interface StatePayload {
  s: string; // site id
  u: string; // Clerk user id
  t: number; // issued at (ms)
  n: string; // nonce, also kept in an httpOnly cookie
}

const sign = (body: string) => createHmac("sha256", process.env.SLACK_CLIENT_SECRET!).update(body).digest("base64url");

/** A signed, short-lived state: proves the callback belongs to this person, this site and this browser. */
export function makeState(siteId: string, userId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const body = Buffer.from(JSON.stringify({ s: siteId, u: userId, t: Date.now(), n: nonce } satisfies StatePayload)).toString("base64url");
  return { state: body + "." + sign(body), nonce };
}

export function readState(state: string | null, nonce: string | undefined, userId: string): StatePayload | null {
  if (!state || !nonce) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (p.u !== userId || p.n !== nonce || Date.now() - p.t > STATE_MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const u = new URL("https://slack.com/oauth/v2/authorize");
  u.searchParams.set("client_id", process.env.SLACK_CLIENT_ID!);
  u.searchParams.set("scope", "incoming-webhook");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

export type SlackInstall = { url: string; channel: string; team: string };

/** Trades the code Slack sent back for the channel's incoming-webhook URL. */
export async function exchangeCode(code: string, redirectUri: string): Promise<SlackInstall> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID!, client_secret: process.env.SLACK_CLIENT_SECRET!, code, redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    team?: { name?: string };
    incoming_webhook?: { url?: string; channel?: string };
  } | null;
  if (!data?.ok || !data.incoming_webhook?.url) throw new Error("Slack refused the connection: " + (data?.error ?? "no webhook returned"));
  return { url: data.incoming_webhook.url, channel: data.incoming_webhook.channel ?? "Slack", team: data.team?.name ?? "" };
}
