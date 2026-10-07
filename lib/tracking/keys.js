// lib/tracking/keys.js
// API key checks with a rotation grace period. Pure.
//
// Regenerating a key used to kill the old one instantly, so a live site lost
// data from that moment until its owner redeployed with the new key. Now the
// old key stays valid for KEY_GRACE_MS (72 hours), or until
// KEY_RETIRE_DELAY_MS after the first hit with the NEW key, whichever comes
// first (the small delay absorbs cached pages that still carry the old key).
//
// A site row carries: api_key, previous_api_key, previous_key_expires_at,
// new_key_first_hit_at. See mds/migrations/2026-10-07-ingestion-hardening.sql.

export const KEY_GRACE_MS = 72 * 60 * 60 * 1000;
export const KEY_RETIRE_DELAY_MS = 10 * 60 * 1000;

/** When the previous key stops working, as a ms timestamp (0 if there is none). */
export function previousKeyDeadline(site) {
  if (!site?.previous_api_key) return 0;
  const expires = site.previous_key_expires_at ? new Date(site.previous_key_expires_at).getTime() : 0;
  const retire = site.new_key_first_hit_at ? new Date(site.new_key_first_hit_at).getTime() + KEY_RETIRE_DELAY_MS : Infinity;
  return Math.min(expires, retire);
}

/**
 * @param {object | null} site the row found by api_key OR previous_api_key
 * @param {string} presented the key the tracker sent
 * @returns {{ ok: boolean, via: "current" | "previous" | null, confirmNewKey: boolean }}
 *   confirmNewKey: this is the first hit with the new key during a rotation (record it)
 */
export function evaluateKey(site, presented, now = Date.now()) {
  if (!site || !presented) return { ok: false, via: null, confirmNewKey: false };
  if (site.api_key === presented) {
    return { ok: true, via: "current", confirmNewKey: !!site.previous_api_key && !site.new_key_first_hit_at };
  }
  if (site.previous_api_key && site.previous_api_key === presented && now < previousKeyDeadline(site)) {
    return { ok: true, via: "previous", confirmNewKey: false };
  }
  return { ok: false, via: null, confirmNewKey: false };
}

/** What Settings shows about a rotation in progress. */
export function rotationStatus(site, now = Date.now()) {
  const deadline = previousKeyDeadline(site);
  if (!site?.previous_api_key || now >= deadline) return { active: false, deadline: 0, newKeySeen: !!site?.new_key_first_hit_at };
  return { active: true, deadline, newKeySeen: !!site.new_key_first_hit_at };
}
