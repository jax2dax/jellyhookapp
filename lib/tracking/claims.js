// lib/tracking/claims.js
// Adding a site: who may do what with a domain. Pure.
//
// The old rule was "first to register wins", which let anyone lock out the
// real owner of a domain just by typing it in first. The rule now (decided
// 2026-10-07, details in mds/audit/tracker-backend-audit-2026-10-07.md):
//
//   - Registering a domain is a CLAIM, not ownership. Several people can hold
//     a claim on the same domain at once, each with their own API key.
//   - Ownership is proven by installing the script on the real site: the
//     first claim whose tracker reports from that domain's own host becomes
//     VERIFIED, and only one verified site per domain can exist.
//   - A claim that was never verified expires after 3 days (CLAIM_TTL_MS in
//     verification.js). An expired claim stops accepting data, can be renewed
//     by its owner, and no longer blocks that person from adding another site.
//   - Once a domain is verified, anyone else who adds it joins by invitation
//     or by a matching work-email domain, or is told it is taken.
import { normalizeHost } from "./hosts.js";
import { isClaimExpired } from "./verification.js";

/** Mailbox providers: an address there says nothing about who owns a website. */
export const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com", "zoho.com", "yandex.com", "pm.me",
]);

/** What the user typed -> a bare host ("https://www.Shop.com/x" -> "shop.com"), or "" if it isn't a domain. */
export function cleanDomainInput(input) {
  const host = normalizeHost(input);
  if (!host || host.length > 253) return "";
  if (host === "localhost" || !/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return "";
  return host;
}

/**
 * Work-email auto-join: the person's email domain is the site's domain, or the
 * site is a subdomain of it (an @acme.com address joins shop.acme.com).
 * Never for mailbox providers.
 */
export function emailMatchesDomain(email, siteDomain) {
  const at = typeof email === "string" ? email.lastIndexOf("@") : -1;
  if (at < 0) return false;
  const mail = email.slice(at + 1).trim().toLowerCase();
  const site = normalizeHost(siteDomain);
  if (!mail || !site || PERSONAL_EMAIL_DOMAINS.has(mail)) return false;
  return site === mail || site.endsWith("." + mail);
}

/**
 * @param {object} p
 * @param {number} p.now
 * @param {string} p.userEmail
 * @param {Array<object>} p.sites live (not deleted) sites registered for this domain, each with
 *        id, verified, is_active, claim_started_at, created_at and `mine: boolean` (the caller is a member)
 * @param {boolean} p.hasPendingInvite the caller has a pending invitation to the verified site
 * @returns {{ kind: "already_member", site: object }
 *   | { kind: "resume", site: object, renew: boolean }
 *   | { kind: "pending_invite", site: object }
 *   | { kind: "auto_join", site: object }
 *   | { kind: "taken", site: object }
 *   | { kind: "create", competing: number }}
 */
export function decideCreateSite({ now = Date.now(), userEmail = "", sites = [], hasPendingInvite = false }) {
  const live = sites.filter((s) => s.is_active !== false);
  const verified = live.find((s) => s.verified);

  const mine = live.filter((s) => s.mine);
  const myVerified = mine.find((s) => s.verified);
  if (myVerified) return { kind: "already_member", site: myVerified };

  // One of my own claims that never got verified: pick it back up. An expired one is renewed.
  const myPending = mine.filter((s) => !s.verified).sort((a, b) => new Date(b.claim_started_at || b.created_at).getTime() - new Date(a.claim_started_at || a.created_at).getTime())[0];
  if (myPending && !verified) return { kind: "resume", site: myPending, renew: isClaimExpired(myPending, now) };

  if (verified) {
    if (hasPendingInvite) return { kind: "pending_invite", site: verified };
    if (emailMatchesDomain(userEmail, verified.domain)) return { kind: "auto_join", site: verified };
    return { kind: "taken", site: verified };
  }

  // Nobody has proven this domain yet: add another claim. Others' still-running claims are
  // counted (never named) so the person can be told the first to install wins.
  const competing = live.filter((s) => !s.mine && !s.verified && !isClaimExpired(s, now)).length;
  return { kind: "create", competing };
}
