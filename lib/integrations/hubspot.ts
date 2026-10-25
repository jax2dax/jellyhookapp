// lib/integrations/hubspot.ts
// HubSpot (mds/build/integrations/hubspot.md): the OAuth connection of a site (tokens sealed in hubspot_connections,
// migration 27), finding a lead's contact by email, the contact record's address, and the three signatures this
// integration relies on:
//   - HubSpot's own on card requests (X-HubSpot-Signature-v3, made with the app's client secret);
//   - Jellyhook's on "Open in HubSpot" links in Slack (resolved at the click, app/go/hubspot/[leadId]);
//   - Jellyhook's on the visit-chart token the card opens in a HubSpot modal (app/embed/visit, 30 minutes).
// Jellyhook only ever reads from HubSpot (scope crm.objects.contacts.read); it never writes.
// Needs HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET (the HubSpot app's Auth tab) and CHANNEL_SECRET_KEY (sealing).
import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { openSecret, sealSecret } from "@/lib/notifications/secret";

export const HUBSPOT_SCOPES = ["oauth", "crm.objects.contacts.read"];
export const HUBSPOT_STATE_COOKIE = "jh_hubspot_oauth";
const STATE_MAX_AGE_MS = 60 * 60_000;
const API = "https://api.hubapi.com";
const HS_TIMEOUT_MS = 8000;
/** Tokens are refreshed this long before HubSpot's expiry (they last 30 minutes). */
const REFRESH_EARLY_MS = 2 * 60_000;
/** How long the visit chart opened from the card stays readable. */
export const CHART_TOKEN_MS = 30 * 60_000;
/** A card request older than this is refused (HubSpot's own rule). */
const SIGNATURE_MAX_AGE_MS = 5 * 60_000;

let adminClient: SupabaseClient | null = null;
const admin = () => (adminClient ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!));

export function hubspotConfigured(): boolean {
  return !!(process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET);
}

/** The callback address; must be listed in the HubSpot app's redirectUrls (hubspot/src/app/app-hsmeta.json). */
export function hubspotRedirectUri(origin: string): string {
  return (process.env.HUBSPOT_REDIRECT_BASE || origin).replace(/\/+$/, "") + "/api/integrations/hubspot/callback";
}

// ── Jellyhook's own signatures: one key per use, derived from the client secret ──

const keyFor = (use: string) => createHmac("sha256", process.env.HUBSPOT_CLIENT_SECRET ?? "").update("jellyhook:" + use).digest();
const sign = (use: string, body: string) => createHmac("sha256", keyFor(use)).update(body).digest("base64url");
function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

interface StatePayload {
  s: string; // site id
  u: string; // Clerk user id
  t: number; // issued at (ms)
  n: string; // nonce, also kept in an httpOnly cookie
}

/** A signed state bound to the person, the site and the browser (as for Slack, lib/notifications/slackOAuth.ts). */
export function makeState(siteId: string, userId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const body = Buffer.from(JSON.stringify({ s: siteId, u: userId, t: Date.now(), n: nonce } satisfies StatePayload)).toString("base64url");
  return { state: body + "." + sign("state", body), nonce };
}

export type StateCheck = { ok: true; state: StatePayload } | { ok: false; reason: "missing" | "tampered" | "expired" | "other-user" | "other-browser" };

export function readState(state: string | null, nonce: string | undefined, userId: string): StateCheck {
  if (!state) return { ok: false, reason: "missing" };
  const [body, sig] = state.split(".");
  if (!body || !sig || !same(sign("state", body), sig)) return { ok: false, reason: "tampered" };
  let p: StatePayload;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
  } catch {
    return { ok: false, reason: "tampered" };
  }
  if (p.u !== userId) return { ok: false, reason: "other-user" };
  if (Date.now() - p.t > STATE_MAX_AGE_MS) return { ok: false, reason: "expired" };
  if (nonce && p.n !== nonce) return { ok: false, reason: "other-browser" };
  return { ok: true, state: p };
}

/** The "Open in HubSpot" link of a lead, put in Slack messages. Resolved when clicked. */
export function hubspotLeadLink(appUrl: string, leadId: string): string {
  return appUrl.replace(/\/+$/, "") + "/go/hubspot/" + encodeURIComponent(leadId) + "?k=" + sign("lead", leadId);
}
export const leadLinkValid = (leadId: string, k: string | null) => !!k && same(sign("lead", leadId), k);

export interface ChartToken {
  s: string; // site id
  v: string; // visitor id
  l: string; // lead id (the visit with this form opens first)
  e: number; // expires (ms)
}
export function makeChartToken(t: Omit<ChartToken, "e">, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...t, e: now + CHART_TOKEN_MS })).toString("base64url");
  return body + "." + sign("chart", body);
}
export function readChartToken(token: string | null | undefined, now = Date.now()): ChartToken | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !same(sign("chart", body), sig)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ChartToken;
    return typeof t.s === "string" && typeof t.v === "string" && typeof t.l === "string" && t.e > now ? t : null;
  } catch {
    return null;
  }
}

// ── HubSpot's signature on card requests (v3) ──

/** Percent-encodings HubSpot decodes in the URL before signing (its request validation guide). */
const DECODE: Record<string, string> = { "%3A": ":", "%2F": "/", "%3F": "?", "%40": "@", "%21": "!", "%24": "$", "%27": "'", "%28": "(", "%29": ")", "%2A": "*", "%2C": ",", "%3B": ";" };

/**
 * X-HubSpot-Signature-v3: base64 HMAC-SHA256, keyed with the client secret, of method + full URL + raw body +
 * timestamp. Requests older than 5 minutes are refused.
 */
export function hubspotSignatureValid(p: { method: string; url: string; body: string; signature: string | null; timestamp: string | null; now?: number }): boolean {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret || !p.signature || !p.timestamp) return false;
  const ts = Number(p.timestamp);
  if (!Number.isFinite(ts) || Math.abs((p.now ?? Date.now()) - ts) > SIGNATURE_MAX_AGE_MS) return false;
  const url = p.url.replace(/%3A|%2F|%3F|%40|%21|%24|%27|%28|%29|%2A|%2C|%3B/gi, (m) => DECODE[m.toUpperCase()]);
  const expected = createHmac("sha256", secret).update(p.method.toUpperCase() + url + p.body + p.timestamp, "utf8").digest("base64");
  return same(expected, p.signature);
}

// ── the contact record ──

/** https://app.hubspot.com/contacts/<account>/record/0-1/<contact> (0-1 is HubSpot's id for contacts). */
export function contactUrl(uiDomain: string | null, portalId: number | string, contactId: string): string {
  const host = uiDomain && /^app(-[a-z0-9]+)?\.hubspot\.com$/.test(uiDomain) ? uiDomain : "app.hubspot.com";
  return `https://${host}/contacts/${encodeURIComponent(String(portalId))}/record/0-1/${encodeURIComponent(contactId)}`;
}

// ── OAuth ──

export function authorizeUrl(state: string, redirectUri: string): string {
  const u = new URL("https://app.hubspot.com/oauth/authorize");
  u.searchParams.set("client_id", process.env.HUBSPOT_CLIENT_ID!);
  u.searchParams.set("scope", HUBSPOT_SCOPES.join(" "));
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

type TokenAnswer = { access_token?: string; refresh_token?: string; expires_in?: number; hub_id?: number; scopes?: string[]; message?: string; status?: string };

async function tokenRequest(fields: Record<string, string>): Promise<TokenAnswer & { ok: boolean; httpStatus: number }> {
  const res = await fetch(API + "/oauth/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.HUBSPOT_CLIENT_ID!, client_secret: process.env.HUBSPOT_CLIENT_SECRET!, ...fields }),
    signal: AbortSignal.timeout(HS_TIMEOUT_MS),
  });
  const data = ((await res.json().catch(() => null)) ?? {}) as TokenAnswer;
  return { ...data, ok: res.ok && !!data.access_token, httpStatus: res.status };
}

export interface HubSpotInstall {
  portalId: number;
  uiDomain: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
}

/** Trades the code HubSpot sent back for tokens, and reads the account's id and its HubSpot address. */
export async function exchangeCode(code: string, redirectUri: string): Promise<HubSpotInstall> {
  const t = await tokenRequest({ grant_type: "authorization_code", redirect_uri: redirectUri, code });
  if (!t.ok || !t.refresh_token) throw new Error("HubSpot refused the connection: " + (t.message ?? t.status ?? t.httpStatus));
  let portalId = t.hub_id ?? null;
  let uiDomain = "app.hubspot.com";
  try {
    const res = await fetch(API + "/account-info/v3/details", { headers: { Authorization: "Bearer " + t.access_token }, signal: AbortSignal.timeout(HS_TIMEOUT_MS) });
    const info = (await res.json().catch(() => null)) as { portalId?: number; uiDomain?: string } | null;
    if (info?.uiDomain) uiDomain = info.uiDomain;
    portalId ??= info?.portalId ?? null;
  } catch {
    /* the default address; contactUrl only accepts *.hubspot.com anyway */
  }
  if (!portalId) throw new Error("HubSpot did not say which account was connected");
  return { portalId, uiDomain, accessToken: t.access_token!, refreshToken: t.refresh_token, expiresAt: new Date(Date.now() + (t.expires_in ?? 1800) * 1000).toISOString(), scopes: t.scopes ?? HUBSPOT_SCOPES };
}

// ── a site's connection ──

export interface Connection {
  id: string;
  site_id: string;
  portal_id: number;
  ui_domain: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  status: "ok" | "failing";
}
const COLS = "id, site_id, portal_id, ui_domain, access_token, refresh_token, expires_at, status";

/** The site's connection, or null (none, or the table does not exist yet: migration 27). */
export async function connectionOf(siteId: string, db: SupabaseClient = admin()): Promise<Connection | null> {
  const { data, error } = await db.from("hubspot_connections").select(COLS).eq("site_id", siteId).maybeSingle();
  if (error) return null;
  return (data as Connection) ?? null;
}

/** Every site connected to this HubSpot account (the card can show leads of each). */
export async function connectionsOfPortal(portalId: number, db: SupabaseClient = admin()): Promise<Connection[]> {
  const { data, error } = await db.from("hubspot_connections").select(COLS).eq("portal_id", portalId);
  return error ? [] : ((data ?? []) as Connection[]);
}

export async function saveConnection(siteId: string, install: HubSpotInstall, userId: string, email: string | null, db: SupabaseClient = admin()): Promise<void> {
  const row = {
    site_id: siteId,
    portal_id: install.portalId,
    ui_domain: install.uiDomain,
    access_token: sealSecret(install.accessToken),
    refresh_token: sealSecret(install.refreshToken),
    expires_at: install.expiresAt,
    scopes: install.scopes,
    status: "ok",
    last_error: null,
    connected_by: userId,
    connected_by_email: email,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from("hubspot_connections").upsert(row, { onConflict: "site_id" });
  if (error) throw new Error(error.message);
}

async function markFailing(c: Connection, why: string, db: SupabaseClient): Promise<void> {
  await db.from("hubspot_connections").update({ status: "failing", last_error: why.slice(0, 300), updated_at: new Date().toISOString() }).eq("id", c.id);
}

/** A valid access token, refreshed when it is about to expire. Throws when HubSpot refuses (app removed there). */
export async function accessToken(c: Connection, force = false, db: SupabaseClient = admin()): Promise<string> {
  if (!force && Date.parse(c.expires_at) - Date.now() > REFRESH_EARLY_MS) return openSecret(c.access_token);
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: openSecret(c.refresh_token), redirect_uri: hubspotRedirectUri(process.env.NEXT_PUBLIC_APP_URL || "https://jellyhook.com") });
  if (!t.ok) {
    if (t.httpStatus === 400 || t.httpStatus === 401) await markFailing(c, "HubSpot refused the refresh (" + (t.message ?? t.httpStatus) + "). Connect again.", db);
    throw new Error("HubSpot token refresh failed: " + t.httpStatus);
  }
  const expiresAt = new Date(Date.now() + (t.expires_in ?? 1800) * 1000).toISOString();
  const update: Record<string, unknown> = { access_token: sealSecret(t.access_token!), expires_at: expiresAt, status: "ok", last_error: null, updated_at: new Date().toISOString() };
  if (t.refresh_token) update.refresh_token = sealSecret(t.refresh_token);
  await db.from("hubspot_connections").update(update).eq("id", c.id);
  c.access_token = update.access_token as string;
  c.expires_at = expiresAt;
  return t.access_token!;
}

/** GET from HubSpot's API as this connection; one retry with a fresh token on 401. */
async function hsGet(c: Connection, path: string, timeoutMs: number, db: SupabaseClient): Promise<Response> {
  const go = async (token: string) => fetch(API + path, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(timeoutMs) });
  const res = await go(await accessToken(c, false, db));
  return res.status === 401 ? go(await accessToken(c, true, db)) : res;
}

/** The id of the contact with this email in the connected account, or null when there is none. */
export async function contactIdByEmail(c: Connection, email: string, timeoutMs = HS_TIMEOUT_MS, db: SupabaseClient = admin()): Promise<string | null> {
  const res = await hsGet(c, "/crm/v3/objects/contacts/" + encodeURIComponent(email.trim().toLowerCase()) + "?idProperty=email&properties=email", timeoutMs, db);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("HubSpot contact lookup answered " + res.status);
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return data?.id ?? null;
}

/** The email of a contact (read by Jellyhook, never taken from the card's request). */
export async function contactEmail(c: Connection, contactId: string, timeoutMs = HS_TIMEOUT_MS, db: SupabaseClient = admin()): Promise<string | null> {
  if (!/^\d{1,20}$/.test(contactId)) return null;
  const res = await hsGet(c, "/crm/v3/objects/contacts/" + contactId + "?properties=email", timeoutMs, db);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("HubSpot contact read answered " + res.status);
  const data = (await res.json().catch(() => null)) as { properties?: { email?: string | null } } | null;
  return data?.properties?.email?.trim().toLowerCase() || null;
}
