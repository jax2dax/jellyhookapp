// lib/tracking/tests/tracking.test.ts
// The ingestion rules: hosts, keys, verification, structure, permissions, usage.
// Run: npm run test:tracking
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { normalizeHost, hostFromEvent, hostMatchesSite, validateAllowedHost } from "../hosts.js";
import { evaluateKey, rotationStatus, KEY_GRACE_MS, KEY_RETIRE_DELAY_MS } from "../keys.js";
import { decideIngest, isClaimExpired, CLAIM_TTL_MS } from "../verification.js";
import { normalizeHeaders, fingerprint, deviceClassFromWidth, canCreateVersion, MAX_VERSIONS_PER_PAGE, MIN_VERSION_GAP_MS } from "../structure.js";
import { buildSessionsRaw } from "../../leadSessions/transform.js";
import { expandVersionsToRows } from "../../leadSessions/structureRows.js";
import { resolveStructureVersion } from "../../leadSessions/resolveStructure.js";
import { can, canManageMember, assignableRoles } from "../permissions.js";
import { hashIp, countryNameFromCode } from "../ip.js";
import { summarizeHealth } from "../health.js";
import { bytesPerRow, visitorsPerSession, storagePerEvent, queriesPerEvent, planCapacity, sumUsage } from "../costModel.js";
import { cleanDomainInput, emailMatchesDomain, decideCreateSite } from "../claims.js";
import { emptyUsage, bump, usageDelta, usageDay } from "../usage.js";

let fails = 0;
let passes = 0;
const ok = (c, m) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

// hosts
ok(normalizeHost("https://www.Example.com:8080/a?b") === "example.com", "host: url, www, port, case");
ok(normalizeHost("WWW.example.com.") === "example.com", "host: trailing dot");
ok(normalizeHost("localhost:3000") === "localhost:3000" && normalizeHost("http://localhost:3003/x") === "localhost:3003", "host: localhost keeps its port (different ports are different programs)");
ok(normalizeHost("https://example.com:8080/a") === "example.com", "host: a real website drops its port");
ok(!hostMatchesSite("localhost:3000", { domain: "localhost:3003" }) && hostMatchesSite("localhost:3003", { domain: "localhost:3003" }), "match: localhost:3000 is not a visitor of a site registered for localhost:3003");
ok(normalizeHost("") === "" && normalizeHost(null) === "", "host: empty / non-string");
ok(normalizeHost("exa mple.com") === "", "host: spaces rejected");
const site = { domain: "example.com", allowed_hosts: ["staging.other.org"] };
ok(hostMatchesSite("example.com", site) && hostMatchesSite("www.example.com", site) && hostMatchesSite("shop.example.com", site), "match: domain, www, subdomain");
ok(!hostMatchesSite("notexample.com", site) && !hostMatchesSite("example.com.evil.io", site), "match: lookalikes rejected");
ok(hostMatchesSite("staging.other.org", site) && !hostMatchesSite("other.org", site), "match: allowed host exact, parent not implied");
ok(hostFromEvent({ page_url: "https://www.example.com/x" }, null) === "example.com", "event host: page_url");
ok(hostFromEvent({}, { get: (n) => (n === "origin" ? "https://example.com" : null) }) === "example.com", "event host: Origin fallback");
ok(hostFromEvent({ host: "victim.com" }, { get: (n) => (n === "origin" ? "https://evil.io" : null) }) === "evil.io", "event host: the browser's Origin beats a host written in the body");
ok(hostFromEvent({ host: "example.com" }, { get: (n) => (n === "origin" ? "null" : null) }) === "example.com", "event host: an Origin of \"null\" is ignored");
ok(validateAllowedHost("localhost") === "localhost" && validateAllowedHost("http://app.example.com/x") === "app.example.com", "allowed host: localhost, url -> host");
ok(validateAllowedHost("nodots") === "" && validateAllowedHost("a b.com") === "", "allowed host: junk rejected");

// keys
const T0 = Date.UTC(2026, 9, 7);
const rotated = { api_key: "NEW", previous_api_key: "OLD", previous_key_expires_at: new Date(T0 + KEY_GRACE_MS).toISOString(), new_key_first_hit_at: null };
ok(evaluateKey(rotated, "NEW", T0).ok && evaluateKey(rotated, "NEW", T0).confirmNewKey, "key: new key ok, first hit flagged");
ok(evaluateKey(rotated, "OLD", T0 + 1000).ok && evaluateKey(rotated, "OLD", T0 + 1000).via === "previous", "key: old key ok inside 72 h");
ok(!evaluateKey(rotated, "OLD", T0 + KEY_GRACE_MS + 1).ok, "key: old key dead after 72 h");
const seen = { ...rotated, new_key_first_hit_at: new Date(T0).toISOString() };
ok(evaluateKey(seen, "OLD", T0 + KEY_RETIRE_DELAY_MS - 1).ok && !evaluateKey(seen, "OLD", T0 + KEY_RETIRE_DELAY_MS + 1).ok, "key: old key retires 10 min after first new-key hit");
ok(!evaluateKey(seen, "NEW", T0).confirmNewKey, "key: first hit flagged only once");
ok(!evaluateKey(rotated, "WRONG", T0).ok && !evaluateKey(null, "NEW", T0).ok && !evaluateKey(rotated, "", T0).ok, "key: wrong / missing rejected");
ok(rotationStatus(rotated, T0).active && !rotationStatus(seen, T0 + KEY_RETIRE_DELAY_MS + 1).active, "key: rotation status");
ok(!evaluateKey({ api_key: "K", previous_api_key: null }, "OLD", T0).ok, "key: no previous key, old rejected");

// verification
const fresh = { domain: "example.com", is_active: true, verified: false, deleted_at: null, claim_started_at: new Date(T0).toISOString() };
ok(decideIngest({ site: fresh, host: "example.com", now: T0 + 1000 }).verify, "verify: own host verifies");
ok(!decideIngest({ site: fresh, host: "evil.com", now: T0 + 1000 }).accept && decideIngest({ site: fresh, host: "evil.com", now: T0 + 1000 }).unmatched, "verify: foreign host rejected + counted");
ok(!decideIngest({ site: fresh, host: "example.com", now: T0 + CLAIM_TTL_MS + 1 }).accept, "verify: expired claim can't verify");
ok(isClaimExpired(fresh, T0 + CLAIM_TTL_MS + 1) && !isClaimExpired({ ...fresh, verified: true }, T0 + CLAIM_TTL_MS * 5), "verify: verified sites never expire");
const live = { ...fresh, verified: true };
ok(decideIngest({ site: live, host: "example.com" }).accept && !decideIngest({ site: live, host: "example.com" }).verify, "verify: live site accepts, doesn't re-verify");
ok(!decideIngest({ site: { ...live, is_active: false }, host: "example.com" }).accept, "verify: inactive site rejects");
ok(decideIngest({ site: live, host: "" }).accept && !decideIngest({ site: fresh, host: "", now: T0 + 1000 }).verify, "verify: no host accepted for live site, never verifies");

// structure
const raw = [
  { header_text: "  Hello   world ", header_tag: "H1", position_y: 10.4 },
  { header_text: "", header_tag: "h2", position_y: 5 },
  { header_text: "Bad tag", header_tag: "h5", position_y: 5 },
  { header_text: "Second", header_tag: "h2", position_y: 900 },
];
const hs = normalizeHeaders(raw);
ok(hs.length === 2 && hs[0].text === "Hello world" && hs[0].tag === "h1" && hs[1].i === 1, "structure: cleaned, indexed");
const fp = fingerprint(hs, 2000);
ok(fp === fingerprint(normalizeHeaders(raw.map((r) => ({ ...r, position_y: Number(r.position_y) + 3 }))), 2040), "structure: tiny shifts keep the fingerprint");
ok(fp !== fingerprint(hs, 3000), "structure: page height change = new version");
ok(fp !== fingerprint(normalizeHeaders([...raw, { header_text: "New section", header_tag: "h2", position_y: 1500 }]), 2000), "structure: added heading = new version");
ok(normalizeHeaders("nope").length === 0 && normalizeHeaders(Array(500).fill(raw[0])).length === 80, "structure: junk / cap");
ok(deviceClassFromWidth(390) === "mobile" && deviceClassFromWidth(1280) === "desktop" && deviceClassFromWidth(undefined) === "desktop", "structure: device class");

const v = (id, dc, day) => ({ id, page_path: "/", device_class: dc, first_seen_at: new Date(T0 + day * 86_400_000).toISOString() });
const versions = [v("a", "desktop", 0), v("b", "desktop", 10), v("m", "mobile", 5)];
const at = (day) => new Date(T0 + day * 86_400_000).toISOString();
ok(resolveStructureVersion(versions, { entered_at: at(3), device_class: "desktop" })?.id === "a", "resolve: visit before change uses old version");
ok(resolveStructureVersion(versions, { entered_at: at(11), device_class: "desktop" })?.id === "b", "resolve: visit after change uses new version");
ok(resolveStructureVersion(versions, { entered_at: at(11), device_class: "desktop", structure_id: "a" })?.id === "a", "resolve: structure_id wins");
ok(resolveStructureVersion(versions, { entered_at: at(1), device_class: "mobile" })?.id === "m", "resolve: visit before first capture uses oldest");
ok(resolveStructureVersion([v("a", "desktop", 0)], { entered_at: at(1), device_class: "mobile" })?.id === "a", "resolve: falls back across device class");
ok(resolveStructureVersion([], { entered_at: at(1) }) === null, "resolve: none");

// version guard: a page that changes constantly cannot grow without bound
ok(canCreateVersion({ count: 1, newestFirstSeenAt: new Date(T0 - MIN_VERSION_GAP_MS - 1).toISOString(), now: T0 }), "versions: a real change after the minimum gap becomes a version");
ok(!canCreateVersion({ count: 1, newestFirstSeenAt: new Date(T0 - 1000).toISOString(), now: T0 }), "versions: a change seconds after the last one is refused (flapping page)");
ok(!canCreateVersion({ count: MAX_VERSIONS_PER_PAGE, newestFirstSeenAt: null, now: T0 }), "versions: capped at " + MAX_VERSIONS_PER_PAGE + " per page and device");
ok(canCreateVersion({ count: 0, newestFirstSeenAt: null, now: T0 }), "versions: the first version is always allowed");

// session replay draws each visit with the structure version it was recorded under
{
  const day = (d) => new Date(T0 + d * 86_400_000).toISOString();
  const versionsRows = expandVersionsToRows([
    { id: "v1", site_id: "s", page_path: "/", device_class: "desktop", page_height: 2000, first_seen_at: day(0), headers: [{ i: 0, text: "Old headline", tag: "h1", y: 100 }] },
    { id: "v2", site_id: "s", page_path: "/", device_class: "desktop", page_height: 4000, first_seen_at: day(10), headers: [{ i: 0, text: "New headline", tag: "h1", y: 200 }, { i: 1, text: "Pricing", tag: "h2", y: 2000 }] },
  ]);
  const pv = (id, d, extra = {}) => ({ page_view_id: id, session_id: "ss", visitor_id: "vv", page_path: "/", entered_at: day(d), left_at: day(d + 0.001), page_height: 0, ...extra });
  const built = buildSessionsRaw({
    sessions: [{ session_id: "ss", visitor_id: "vv", started_at: day(1) }],
    pageViews: [pv("a", 1), pv("b", 12), pv("c", 12.5, { structure_id: "v1" })],
    pageStructure: versionsRows,
  });
  const visits = built[0].visits;
  const byId = Object.fromEntries(visits.map((x) => [x.id, x]));
  ok(byId.a.headers.length === 1 && byId.a.headers[0].text === "Old headline" && byId.a.pageHeightPx === 2000, "replay: a visit before the change keeps the OLD headers and height");
  ok(byId.b.headers.length === 2 && byId.b.headers[1].text === "Pricing" && byId.b.pageHeightPx === 4000, "replay: a visit after the change uses the NEW headers and height");
  ok(byId.c.headers.length === 1 && byId.c.headers[0].text === "Old headline", "replay: structure_id on the page view wins over the date");
  ok(Math.abs(byId.b.headers[1].y - 0.5) < 0.001, "replay: header position is relative to THAT version's page height");
  // legacy (pre-migration) rows still work
  const legacy = buildSessionsRaw({
    sessions: [{ session_id: "ss", visitor_id: "vv", started_at: day(1) }],
    pageViews: [pv("a", 1)],
    pageStructure: [{ page_path: "/", page_height: 1000, header_index: 0, header_text: "Legacy", header_tag: "h1", position_y: 100 }],
  });
  ok(legacy[0].visits[0].headers[0].text === "Legacy" && legacy[0].visits[0].pageHeightPx === 1000, "replay: legacy page_structure rows (no version) still work");
}

// derived live: a session whose tracker went quiet is drawn as ended, not "live"
{
  const nowIso = (minAgo) => new Date(Date.now() - minAgo * 60_000).toISOString();
  const open = (id, sid, enteredMinAgo) => ({ page_view_id: id, session_id: sid, visitor_id: "vv", page_path: "/", entered_at: nowIso(enteredMinAgo), left_at: null, page_height: 1000 });
  const built = buildSessionsRaw({
    sessions: [
      { session_id: "quiet", visitor_id: "vv", started_at: nowIso(60), last_activity_at: nowIso(25), ended_at: null },
      { session_id: "alive", visitor_id: "vv", started_at: nowIso(10), last_activity_at: nowIso(2), ended_at: null },
      { session_id: "done", visitor_id: "vv", started_at: nowIso(90), last_activity_at: nowIso(80), ended_at: nowIso(80) },
    ],
    pageViews: [open("p1", "quiet", 60), open("p2", "alive", 10), { ...open("p3", "done", 90), left_at: nowIso(80) }],
    pageStructure: [],
  });
  const byId = Object.fromEntries(built.map((x) => [x.id, x]));
  ok(byId.quiet.endedAt !== null && byId.quiet.visits[0].isOpen === false, "live: a session silent for 25 min is drawn as ended, its page view closed");
  ok(Math.abs(new Date(byId.quiet.visits[0].leftAt).getTime() - (Date.now() - 25 * 60_000)) < 5000, "live: the open page view ends at the last activity, not at 'now'");
  ok(byId.alive.endedAt === null && byId.alive.visits[0].isOpen === true, "live: a session active 2 min ago is live");
  ok(byId.done.endedAt !== null, "live: a closed session stays closed");
}

// permissions
ok(can("owner", "ownership.transfer") && !can("admin", "ownership.transfer") && !can("member", "members.invite"), "perm: owner/admin/member");
ok(can("admin", "site.regenerate_key") && can("admin", "members.set_role") && !can("admin", "site.delete"), "perm: admin has everything but delete/transfer");
ok(!canManageMember("admin", "owner", "members.remove") && !canManageMember("owner", "owner", "members.remove"), "perm: nobody removes the owner");
ok(!canManageMember("admin", "admin", "members.set_role") && canManageMember("owner", "admin", "members.set_role") && canManageMember("admin", "member", "members.remove"), "perm: admin cannot change admins, owner can");
ok(assignableRoles("owner").join() === "admin,member" && assignableRoles("admin").join() === "member" && assignableRoles("member").length === 0, "perm: assignable roles");
ok(!can("ghost", "site.view"), "perm: unknown role has nothing");

// ip
ok(hashIp("1.2.3.4", "salt")?.length === 64 && hashIp("1.2.3.4", "salt") === hashIp("1.2.3.4", "salt") && hashIp("1.2.3.4", "salt") !== hashIp("1.2.3.5", "salt"), "ip: stable salted hash");
ok(hashIp("1.2.3.4", "") === null && hashIp("unknown", "salt") === null && hashIp("", "salt") === null, "ip: no salt / no ip = null, never an unsalted hash");
ok(hashIp("1.2.3.4", "a") !== hashIp("1.2.3.4", "b"), "ip: salt changes the hash");
ok(countryNameFromCode("US") === "United States" && countryNameFromCode("XX") === null && countryNameFromCode("usa") === null && countryNameFromCode(undefined) === null, "ip: country code to English name");

// claims: adding a site
ok(cleanDomainInput("https://www.Shop.com/path?x=1") === "shop.com" && cleanDomainInput("localhost") === "" && cleanDomainInput("not a domain") === "" && cleanDomainInput("nodots") === "", "claims: domain input cleaned, junk and localhost refused");
ok(emailMatchesDomain("a@acme.com", "acme.com") && emailMatchesDomain("a@acme.com", "shop.acme.com") && !emailMatchesDomain("a@gmail.com", "gmail.com") && !emailMatchesDomain("a@evil.com", "acme.com"), "claims: work email joins its own domain and subdomains, never a mailbox provider or someone else");
ok(!emailMatchesDomain("a@acme.com", "notacme.com") && !emailMatchesDomain("a@sub.acme.com", "acme.com"), "claims: lookalikes and parent domains do not match");
const mk = (o) => ({ id: "x", domain: "acme.com", is_active: true, verified: false, mine: false, created_at: new Date(T0).toISOString(), claim_started_at: new Date(T0).toISOString(), ...o });
ok(decideCreateSite({ now: T0 + 1000, sites: [] }).kind === "create", "claims: a free domain is created");
ok(decideCreateSite({ now: T0 + 1000, sites: [mk({ verified: true, mine: true })] }).kind === "already_member", "claims: already a member of the verified site");
ok(decideCreateSite({ now: T0 + 1000, sites: [mk({ mine: true })] }).kind === "resume" && decideCreateSite({ now: T0 + 1000, sites: [mk({ mine: true })] }).renew === false, "claims: my running claim is resumed");
ok(decideCreateSite({ now: T0 + CLAIM_TTL_MS + 1, sites: [mk({ mine: true })] }).renew === true, "claims: my expired claim is renewed, not blocked");
ok(decideCreateSite({ now: T0 + 1000, sites: [mk({ verified: true })] }).kind === "taken", "claims: a domain verified by someone else is taken");
ok(decideCreateSite({ now: T0 + 1000, userEmail: "me@acme.com", sites: [mk({ verified: true })] }).kind === "auto_join", "claims: matching work email auto-joins the verified site");
ok(decideCreateSite({ now: T0 + 1000, hasPendingInvite: true, sites: [mk({ verified: true })] }).kind === "pending_invite", "claims: a pending invitation goes to the invite page");
{
  const d = decideCreateSite({ now: T0 + 1000, sites: [mk({ id: "a" }), mk({ id: "b" })] });
  ok(d.kind === "create" && d.competing === 2, "claims: several pending claims on one domain are allowed; the person is told how many others are racing");
  const e = decideCreateSite({ now: T0 + CLAIM_TTL_MS + 1, sites: [mk({ id: "a" })] });
  ok(e.kind === "create" && e.competing === 0, "claims: another person's expired claim does not count");
  ok(decideCreateSite({ now: T0 + 1000, sites: [mk({ id: "a", mine: true }), mk({ id: "b", verified: true })] }).kind === "taken", "claims: if someone else verified first, my pending claim loses");
}

// tracking health: found vs working
{
  const row = (check_key, details, last_event_at = null, page_path = "/") => ({ page_path, check_key, details, last_event_at });
  const by = (rows, opts) => Object.fromEntries(summarizeHealth(rows, opts).map((c) => [c.key, c]));
  let h = by([row("conversion_form", { forms: 1, marked: 1, wrong_value: 0, wrong_element: 0 }, "2026-10-07T10:00:00Z")]);
  ok(h.conversion_form.state === "working" && h.conversion_form.pages[0].state === "working", "health: a real conversion proves the form attribute works");
  h = by([row("conversion_form", { forms: 1, marked: 1 })]);
  ok(h.conversion_form.state === "waiting", "health: found but no conversion yet = waiting, not working");
  h = by([row("conversion_form", { forms: 1, marked: 0, wrong_element: 1 })]);
  ok(h.conversion_form.state === "misplaced" && /not a <form>/.test(h.conversion_form.pages[0].problems[0]), "health: data-conversion on a non-form is named as misplaced");
  h = by([row("conversion_form", { forms: 2, marked: 0 })], { specifyForm: true });
  ok(h.conversion_form.state === "misplaced", "health: specify mode and no form marked is a problem");
  h = by([row("conversion_form", { forms: 2, marked: 0 })], { specifyForm: false });
  ok(h.conversion_form.state === "none", "health: no marking needed when every form is tracked");
  h = by([row("field_attr", { marked: 3, in_form: 1, outside_form: 2 })]);
  ok(h.field_attr.state === "waiting" && h.field_attr.pages[0].problems.length === 1, "health: marked fields partly outside a form are flagged even while waiting");
  h = by([row("field_attr", { marked: 2, in_form: 0, outside_form: 2 })]);
  ok(h.field_attr.state === "misplaced", "health: marked fields all outside forms are misplaced");
  h = by([row("click_attr", { marked: 2 }, "2026-10-07T10:00:00Z", "/a"), row("click_attr", { marked: 1 }, null, "/b")]);
  ok(h.click_attr.state === "working" && h.click_attr.pages.length === 2 && /1 page working/.test(h.click_attr.summary), "health: one working page makes the check working, per-page detail kept");
  h = by([row("iframe_forms", { count: 1, event_tracked: 0, untracked: 1, providers: ["Pardot"] })]);
  ok(h.iframe_forms.state === "limited" && /cannot be tracked/.test(h.iframe_forms.pages[0].problems[0]) && /Pardot/.test(h.iframe_forms.pages[0].problems[0]), "health: an iframe form nothing can listen to is a limit, named with its provider");
  h = by([row("iframe_forms", { count: 1, event_tracked: 1, untracked: 0, providers: ["Typeform"] })]);
  ok(h.iframe_forms.state === "waiting", "health: an iframe form that announces submissions is waiting for its first one");
  h = by([row("iframe_forms", { count: 1, event_tracked: 1, untracked: 0, providers: ["Typeform"] }, "2026-10-07T10:00:00Z")]);
  ok(h.iframe_forms.state === "working", "health: a real iframe submission proves it works");
  ok(by([]).click_attr.state === "none" && /Not found/.test(by([]).click_attr.summary), "health: nothing reported = not found");
}

// cost model
{
  const storage = [
    { table_name: "page_views", approx_rows: 1000, total_bytes: 400_000 },
    { table_name: "sessions", approx_rows: 400, total_bytes: 120_000 },
    { table_name: "visitors", approx_rows: 200, total_bytes: 60_000 },
    { table_name: "empty", approx_rows: 0, total_bytes: 8192 },
  ];
  const per = bytesPerRow(storage);
  ok(per.page_views === 400 && per.sessions === 300 && !("empty" in per), "cost: bytes per row = table + indexes divided by rows; empty tables skipped");
  ok(Math.abs(visitorsPerSession(storage) - 0.5) < 1e-9, "cost: visitors per session measured from the tables");
  const totals = sumUsage([{ session_starts: 10, page_view_starts: 40, page_view_ends: 40, requests: 90, bytes_in: 9000 }, { clicks: 5, requests: 5, bytes_in: 500 }]);
  ok(totals.session_starts === 10 && totals.requests === 95 && totals.bytes_in === 9500, "cost: usage days summed");
  const e = storagePerEvent(totals, per, 0.5);
  // 10 sessions * (300 + 0.5*300) + 40 page views * 400 = 4500 + 16000 (clicks have no measured table: 0)
  ok(e.events === 95 && Math.round(e.totalBytes) === 20500 && Math.round(e.bytesPerEvent) === Math.round(20500 / 95), "cost: storage per average event from the real mix");
  ok(e.byKind.page_view_ends.bytesEach === 0, "cost: a page view end creates no row");
  ok(queriesPerEvent(totals) > 2 && queriesPerEvent({}) === 0, "cost: queries per event include the shared per-request work");
  const cap = planCapacity({ storageBudgetBytes: 8e9, retentionMonths: 12, headroom: 0.25, sites: 10, bytesPerEvent: 200 });
  ok(cap.eventsPerMonthTotal === Math.floor((8e9 * 0.75) / (200 * 12)) && cap.eventsPerMonthPerSite === Math.floor(cap.eventsPerMonthTotal / 10), "cost: capacity = usable storage / (bytes per event x months kept) / sites");
  ok(planCapacity({ storageBudgetBytes: 8e9, retentionMonths: 12, headroom: 0.25, sites: 10, bytesPerEvent: 0 }).eventsPerMonthTotal === 0, "cost: no data yet gives 0, never a division by zero");
}

// usage
const bag = emptyUsage();
bump(bag, "events"); bump(bag, "events"); bump(bag, "bytes_in", 300); bump(bag, "nonsense");
ok(JSON.stringify(usageDelta(bag)) === JSON.stringify({ events: 2, bytes_in: 300 }), "usage: delta has only changed fields, unknown ignored");
ok(usageDay(Date.UTC(2026, 9, 7, 23, 59)) === "2026-10-07", "usage: UTC day");

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
