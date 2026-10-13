// jh-mcp/tests/tokens.test.ts - offline. Run: npm run test:mcp
import { CONSENT_TEXT, CONSENT_VERSION, PII_CONSENT_TEXT } from "../consent";
import { DEFAULT_EXPIRY_DAYS, EXPIRY_DAYS, bearerFrom, expiryFrom, generateToken, hashToken, looksLikeToken, prefixOf, tokenState, TOKEN_PREFIX } from "../tokens";
import { can } from "../../lib/tracking/permissions.js";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const t = generateToken();
ok(t.startsWith(TOKEN_PREFIX) && looksLikeToken(t), "token: has the prefix and the expected shape");
ok(t.length === TOKEN_PREFIX.length + 43, "token: 256 bits of randomness (43 url-safe characters)");
ok(new Set(Array.from({ length: 200 }, generateToken)).size === 200, "token: 200 generated, all different");
ok(hashToken(t) === hashToken(t) && hashToken(t) !== hashToken(generateToken()) && /^[0-9a-f]{64}$/.test(hashToken(t)), "hash: stable, different per token, sha256 hex");
ok(!hashToken(t).includes(t.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + 10)), "hash: does not contain the token");
ok(prefixOf(t).length === TOKEN_PREFIX.length + 4 && t.startsWith(prefixOf(t)), "prefix: only the first characters, for recognising it in a list");
ok(!looksLikeToken("jh_mcp_short") && !looksLikeToken("abc") && !looksLikeToken(null) && !looksLikeToken(TOKEN_PREFIX + "!".repeat(43)), "looksLikeToken: rejects wrong shapes");

ok(bearerFrom("Bearer " + t) === t && bearerFrom("bearer " + t) === t, "bearer: parsed, case-insensitive scheme");
ok(bearerFrom(null) === null && bearerFrom("Basic abc") === null && bearerFrom("Bearer") === null && bearerFrom("Bearer a b") === null, "bearer: missing or malformed header gives null");

const now = Date.UTC(2026, 9, 13);
ok(tokenState({ expires_at: expiryFrom(90, now), revoked_at: null }, now) === "active", "state: active before expiry");
ok(tokenState({ expires_at: expiryFrom(90, now), revoked_at: null }, now + 91 * 86_400_000) === "expired", "state: expired after 90 days");
ok(tokenState({ expires_at: expiryFrom(90, now), revoked_at: new Date(now).toISOString() }, now) === "revoked", "state: revoked beats active");
ok(tokenState({ expires_at: expiryFrom(90, now), revoked_at: new Date(now).toISOString() }, now + 999 * 86_400_000) === "revoked", "state: revoked beats expired");
ok(JSON.stringify(EXPIRY_DAYS) === "[30,90,365]" && EXPIRY_DAYS.includes(DEFAULT_EXPIRY_DAYS as never) && !EXPIRY_DAYS.some((d) => d <= 0 || d > 365), "expiry: only 30, 90 or 365 days; there is no 'never'");

ok(can("owner", "mcp.manage_tokens") && can("admin", "mcp.manage_tokens") && !can("member", "mcp.manage_tokens") && !can("nobody", "mcp.manage_tokens"), "permissions: owner and admin may manage tokens, a member may not");
ok(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(CONSENT_VERSION) && CONSENT_TEXT.includes("AI provider") && CONSENT_TEXT.includes("hidden") && PII_CONSENT_TEXT.includes("unmasked"), "consent: versioned, says where the data goes and that personal details are hidden by default");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
