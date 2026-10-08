# Sites, verification, keys and roles (2026-10-07)

For developers. How adding a site, proving it, rotating its key and the team
roles work. Public wording is on `/docs/installation`, `/docs/reference/settings`
and `/docs/reference/team`. Reasons: `mds/reports/tracker-backend-audit-2026-10-07.md`.

## The model in one paragraph

Adding a domain is a **claim**, not ownership. Many people can hold a claim on one
domain, each with their own site row and API key. Ownership is **proven** by the tracker
reporting from the domain's own host; the first claim to prove it becomes `verified` and
owns the domain (one verified live site per domain, enforced by a unique index). A claim
never proven **expires after 3 days**: it stops accepting data, its owner can renew it,
and it stops blocking that person from adding another site.

## Host matching (`lib/tracking/hosts.js`)

- A site accepts events whose host is its `domain`, any subdomain of it, or any host in
  `sites.allowed_hosts` (and subdomains of those). `www.` is ignored on both sides.
- The host is the browser's `Origin` header when present (page JavaScript cannot forge it),
  else the host the tracker wrote in the body, then `page_url`, then `Referer`.
- A non-matching host: the event is **not stored**, the request still returns 200 (a tracker
  never errors on a customer's page), and `last_unmatched_host`, `last_unmatched_at`,
  `unmatched_count` are updated so the owner sees it and can allow it.
- No host at all (old trackers, server-side senders): accepted for a verified site, but it can
  **never verify** a site.
- Host matching stops mistakes and casual abuse of a public key. It is not authentication: a
  non-browser client can claim any host.
- Local testing: `localhost` is not a registrable domain, so add it under Allowed hosts.
  `validateAllowedHost` accepts a real hostname, `localhost` or an IPv4 address.

## Verification and claims

Decision: `decideIngest` in `lib/tracking/verification.js`.

| Situation | Accept | Verify | Note |
|---|---|---|---|
| site inactive or deleted | no | no | silent |
| host not allowed | no | no | counted as unmatched |
| claim expired (unverified and older than 3 days) | no | no | `claim_started_at` (else `created_at`) + 3 days |
| host allowed, site unverified | yes | **yes** | sets `verified = true` where `verified = false` |
| host allowed, site verified | yes | no | |

If two claims on one domain verify at once, the unique index
`sites_verified_domain_key` lets one win; the other's update fails with 23505 and its events are
dropped (`applySiteEffects` returns `verifiedOk: false`).

Adding a site (`createSite` in `lib/actions/site-management.actions.js`, decision in
`lib/tracking/claims.js`, `decideCreateSite`):

| Case | Result |
|---|---|
| not a domain (`cleanDomainInput`) | `{ invalidDomain }` |
| I already belong to the verified site | `alreadyMember` |
| I hold an unverified claim on it | `reclaimed` (renewed if expired) |
| someone else verified it, I have a pending invite | redirect to the invite page |
| someone else verified it, my work email matches the domain | joined as member |
| someone else verified it, no way in | `alreadyExists` (only the domain is returned, never their key) |
| nobody verified it | a new claim is created; `competing` = other unexpired claims, told to the person |

Before creating, the person's own expired unverified claims are soft-deleted
(`archiveExpiredAttempts`) so they "start fresh" and are not stopped by the one-site free plan.
If someone else verifies first, my pending claim becomes a dead end: adding the domain again
says "taken".

Email-domain auto-join (`emailMatchesDomain`): the email domain equals the site domain, or the
site is a subdomain of the email domain; never for a mailbox provider
(`PERSONAL_EMAIL_DOMAINS`).

Changing a site's domain (`updateSiteDomain`) resets `verified = false`, starts a new 3-day
claim and clears the unmatched counters: the new domain has to be proven. Events from the old
host are dropped until then.

`renewClaim(siteId)` (owner or admin) restarts the clock on an unverified claim.
`getSiteVerificationStatus(siteId)` (members only) feeds the waiting screen: verified, expired,
expiry time and the last unmatched host.

## API key rotation (`lib/tracking/keys.js`)

Columns: `api_key`, `previous_api_key`, `previous_key_expires_at`, `key_rotated_at`,
`new_key_first_hit_at`.

- `regenerateApiKey`: new `api_key`; the old one becomes `previous_api_key`, valid for
  `KEY_GRACE_MS` = **72 hours**; `new_key_first_hit_at` is cleared. The update is conditional on
  the old key (a concurrent regenerate does nothing instead of overwriting).
- `evaluateKey`: the current key is always valid. The previous key is valid while
  `now < min(previous_key_expires_at, new_key_first_hit_at + 10 minutes)`.
- The first event with the new key sets `new_key_first_hit_at`. Ten minutes later the old key
  stops working (the delay absorbs pages still serving the old script from a cache).
  This is shorter than the 72 hours on purpose: once the site has been seen on the new key
  there is nothing to protect. **Deviation to know:** the old key can retire after about 10 minutes
  rather than 72 hours.
- Regenerating again during a rotation replaces `previous_api_key`: only the key being retired
  stays valid, never a chain.
- Queries by key use `api_key.eq.K,previous_api_key.eq.K` after checking K is a short url-safe
  token (no injection into the filter).
- The redeploy gap is closed by the grace period: between "regenerate" and "the site is
  redeployed with the new script", events with the old key still arrive and are recorded.

## Roles and permissions (`lib/tracking/permissions.js`)

One table decides everything; every action in `lib/actions/settings.actions.js` asks it
(`authorize(siteId, permission)`), and the Settings UI asks the same functions to hide controls.
The server check is the real one.

| Permission | owner | admin | member |
|---|---|---|---|
| `site.view` | yes | yes | yes |
| `site.rename`, `site.change_domain`, `site.toggle_tracking`, `site.regenerate_key`, `site.manage_hosts` | yes | yes | no |
| `members.invite`, `members.remove`, `members.set_role` | yes | yes | no |
| `site.delete`, `ownership.transfer` | yes | **no** | no |

Rules on top (`canManageMember`, `assignableRoles`):

- Nobody removes or changes the owner; the owner changes only by `transferOwnership`.
- An admin cannot change another admin's role. An admin may create and remove members.
- The owner may invite as admin or member; an admin may invite members only.
- Nobody changes their own role or removes themselves.
- `transferOwnership` (owner only): the target must be an active member (not a pending
  invite). Writes the new owner first, then demotes the old owner to admin, then updates the legacy
  `sites.user_id`. If the demotion fails the target is put back; a failure part-way leaves two
  owners, never none. Not atomic; a database function would be needed for that.
- Roles are plain `site_members.role` text values (`owner`, `admin`, `member`). **To add a role or
  make permissions custom per role**: edit `ROLE_PERMISSIONS` (and `ROLES`) in
  `lib/tracking/permissions.js`. Nothing else enforces role names.

`getMySiteRole(siteId)` returns the caller's role (also backfills a legacy owner row).
`roleOf` only accepts `status = 'active'` rows.

## Settings screen (what the owner sees)

- **Tracking** card: verified or "waiting" with the claim expiry, last event time, Renew button
  when expired.
- **Allowed hosts**: the list, add/remove, and the "events from X were not recorded, allow X"
  notice with its count.
- **Attribute check**: `data-conversion`, `data-track-field`, `data-track-click`, each Working /
  Found, waiting / Misplaced / Not found, per page (`lib/tracking/health.js`).
- **API key** card: regenerate (owner and admin) and the rotation notice with time left.
- **Team**: role selector, "Make owner", invite with role.
- The old "Event Limit" figure is gone from Settings; see `/dev/usage`.
