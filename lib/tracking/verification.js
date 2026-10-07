// lib/tracking/verification.js
// Is this event allowed in, and does it verify the site? Pure.
//
// Rules (decided 2026-10-07, see mds/audit/tracker-backend-audit-2026-10-07.md):
//  1. A site is VERIFIED only when an event arrives from its own domain (or
//     an allowed host). A hit from any other website does not verify it.
//  2. Events from a host that doesn't match are not stored. They are
//     counted and the host is remembered, so the owner sees "we received data
//     from staging.example.org" and can allow it.
//  3. A claim on a domain that was never verified expires CLAIM_TTL_MS (3
//     days) after it started. An expired claim can't verify; its owner can
//     renew it. Whoever verifies a domain first owns it.
//  4. An inactive site accepts nothing (silently, so trackers never error).
import { hostMatchesSite } from "./hosts.js";

export const CLAIM_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export function claimExpiresAt(site) {
  return new Date(site.claim_started_at || site.created_at || 0).getTime() + CLAIM_TTL_MS;
}

export function isClaimExpired(site, now = Date.now()) {
  return !site.verified && now > claimExpiresAt(site);
}

/**
 * @returns {{ accept: boolean, verify: boolean, unmatched: boolean, reason: "ok" | "inactive" | "host_mismatch" | "claim_expired" }}
 */
export function decideIngest({ site, host, now = Date.now() }) {
  if (!site || !site.is_active || site.deleted_at) return { accept: false, verify: false, unmatched: false, reason: "inactive" };
  // An unknown host (a client that sent no URL, Origin or Referer) is let in,
  // for old trackers and server-side senders, but can never verify a site.
  if (!host) return { accept: !isClaimExpired(site, now), verify: false, unmatched: false, reason: isClaimExpired(site, now) ? "claim_expired" : "ok" };
  if (!hostMatchesSite(host, site)) return { accept: false, verify: false, unmatched: true, reason: "host_mismatch" };
  if (isClaimExpired(site, now)) return { accept: false, verify: false, unmatched: false, reason: "claim_expired" };
  return { accept: true, verify: !site.verified, unmatched: false, reason: "ok" };
}
