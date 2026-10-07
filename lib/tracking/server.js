// lib/tracking/server.js
// Helpers shared by the tracker ingestion routes (/api/track, /api/track-form,
// /api/track-form-engagement, /api/track-structure). Server only: these talk
// to the database. The decisions themselves live in the pure modules next to
// this file (hosts, keys, verification, ...), which have their own tests.
import { hostFromEvent } from "./hosts.js";
import { evaluateKey } from "./keys.js";
import { decideIngest } from "./verification.js";
import { usageDelta, usageDay } from "./usage.js";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

/** A real API key is a UUID, but accept any short url-safe token so older keys keep working. */
const KEY_SHAPE = /^[A-Za-z0-9_-]{8,64}$/;

/** What an id from the tracker (visitor, session, page view) must look like. */
const ID_SHAPE = /^[A-Za-z0-9_-]{8,64}$/;

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_EVENTS_PER_REQUEST = 25;

export function cleanId(v) {
  return typeof v === "string" && ID_SHAPE.test(v) ? v : null;
}

/** A trimmed string of at most `max` characters, or null. */
export function cleanStr(v, max = 500) {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s || null;
}

/** A finite number inside [min, max], else null. */
export function cleanNum(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

/** An ISO time from the tracker, only if it is not in the future and not older than `maxAgeMs`. */
export function cleanTime(v, now = Date.now(), maxAgeMs = 48 * 3600_000) {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t) || t > now + 60_000 || t < now - maxAgeMs) return null;
  return new Date(t);
}

/**
 * Looks the site up by key (current OR previous, during a key rotation) and
 * decides whether this request may write. Never throws on bad input.
 * @returns {{ site: object|null, key: object, decision: object, host: string }}
 */
export async function authorizeRequest(supabase, { apiKey, event, headers, now = Date.now() }) {
  const host = hostFromEvent(event, headers);
  const none = { site: null, key: { ok: false, via: null, confirmNewKey: false }, decision: { accept: false, verify: false, unmatched: false, reason: "invalid_key" }, host };
  if (typeof apiKey !== "string" || !KEY_SHAPE.test(apiKey)) return none;

  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, user_id, domain, is_active, verified, specify_form, deleted_at, created_at, claim_started_at, api_key, previous_api_key, previous_key_expires_at, new_key_first_hit_at, allowed_hosts, last_event_at, unmatched_count")
    .or(`api_key.eq.${apiKey},previous_api_key.eq.${apiKey}`)
    .limit(2);
  if (error || !sites || sites.length === 0) return none;

  // A key can only be current for one site; if an old key somehow also matches
  // another site's current key, the current one wins.
  const site = sites.find((s) => s.api_key === apiKey) ?? sites[0];
  const key = evaluateKey(site, apiKey, now);
  if (!key.ok) return { ...none, site };
  return { site, key, decision: decideIngest({ site, host, now }), host };
}

/** Everything that happens to the sites row after an authorised request, in as few writes as possible. */
export async function applySiteEffects(supabase, { site, key, decision, host, now = Date.now() }) {
  const patch = {};
  if (decision.verify) patch.verified = true;
  if (key.confirmNewKey) patch.new_key_first_hit_at = new Date(now).toISOString();
  if (decision.accept && (!site.last_event_at || now - new Date(site.last_event_at).getTime() > 60_000)) patch.last_event_at = new Date(now).toISOString();
  if (decision.unmatched) {
    patch.last_unmatched_host = host.slice(0, 253);
    patch.last_unmatched_at = new Date(now).toISOString();
    patch.unmatched_count = (site.unmatched_count || 0) + 1;
  }
  if (Object.keys(patch).length === 0) return { verifiedOk: true };

  let q = supabase.from("sites").update(patch).eq("id", site.id);
  // Never un-verify, and only flip verified once: the partial unique index
  // sites_verified_domain_key lets just one site per domain become verified.
  if (decision.verify) q = q.eq("verified", false);
  const { error } = await q;
  if (error) {
    if (decision.verify && error.code === "23505") {
      console.warn(`[track] site ${site.id} could not verify: its domain is already verified by another site`);
      return { verifiedOk: false };
    }
    console.error("[track] site update failed:", error.message);
  } else if (decision.verify) {
    console.log("[track] site verified from its own host:", site.id);
  }
  return { verifiedOk: !(decision.verify && error) };
}

/** Adds this request's counters to site_usage_daily. Never throws. */
export async function flushUsage(supabase, siteId, bag, now = Date.now()) {
  try {
    const delta = usageDelta(bag);
    if (Object.keys(delta).length === 0) return;
    const { error } = await supabase.rpc("jh_usage_add", { p_site: siteId, p_day: usageDay(now), p: delta });
    if (error) console.error("[usage] jh_usage_add failed:", error.message);
  } catch (err) {
    console.error("[usage] flush failed:", err);
  }
}

/** The client IP as the platform reports it. */
export function clientIp(headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/**
 * A real event proves a tracking feature works: stamp tracking_health.last_event_at.
 * check_key: 'conversion_form' | 'field_attr' | 'click_attr'. Never throws.
 */
export async function markHealthEvent(supabase, siteId, pagePath, checkKey, now = Date.now()) {
  try {
    const iso = new Date(now).toISOString();
    const { error } = await supabase
      .from("tracking_health")
      .upsert({ site_id: siteId, page_path: (pagePath || "/").slice(0, 500), check_key: checkKey, last_seen_at: iso, last_event_at: iso }, { onConflict: "site_id,page_path,check_key", ignoreDuplicates: false });
    if (error) console.error("[health] mark failed:", error.message);
  } catch (err) {
    console.error("[health] mark failed:", err);
  }
}
