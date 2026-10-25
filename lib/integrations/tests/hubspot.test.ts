/* eslint-disable @typescript-eslint/no-explicit-any -- stand-ins for HubSpot and the database */
// lib/integrations/tests/hubspot.test.ts - the HubSpot integration's signatures, links, tokens and contact lookups
// (lib/integrations/hubspot.ts, mds/build/integrations/hubspot.md). Run: npm run test:marks
// "server-only" is replaced by an empty module (it throws outside a Next server build).
import { createJiti } from "jiti";
import { createHmac } from "node:crypto";
import { join } from "node:path";

process.env.HUBSPOT_CLIENT_ID = "client-id";
process.env.HUBSPOT_CLIENT_SECRET = "client-secret";
const root = process.cwd();
const jiti = createJiti(join(root, "lib/integrations/tests/hubspot.test.ts"), { alias: { "server-only": join(root, "lib/notifications/tests/emptyModule.ts"), "@": root } });

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const run = async () => {
  const hs = (await jiti.import(join(root, "lib/integrations/hubspot.ts"))) as typeof import("../hubspot");
  const msg = (await jiti.import(join(root, "lib/notifications/message.ts"))) as typeof import("../../notifications/message");

  // ── HubSpot's v3 signature on card requests ──
  const now = Date.now();
  const url = "https://jellyhook.com/api/hubspot/card?portalId=123&userId=9&userEmail=rep%40acme.com&appId=77";
  const body = '{"contactId":"501"}';
  const sig = (u: string, b: string, t: number) => createHmac("sha256", "client-secret").update("POST" + u + b + t).digest("base64");
  // HubSpot signs the URL with some characters decoded (%40 -> @)
  const signedAs = "https://jellyhook.com/api/hubspot/card?portalId=123&userId=9&userEmail=rep@acme.com&appId=77";
  ok(hs.hubspotSignatureValid({ method: "POST", url, body, signature: sig(signedAs, body, now), timestamp: String(now), now }), "a request signed by HubSpot is accepted (with HubSpot's URL decoding)");
  ok(!hs.hubspotSignatureValid({ method: "POST", url, body: '{"contactId":"502"}', signature: sig(signedAs, body, now), timestamp: String(now), now }), "another contact in the body: refused");
  ok(!hs.hubspotSignatureValid({ method: "POST", url: url.replace("123", "124"), body, signature: sig(signedAs, body, now), timestamp: String(now), now }), "another account in the URL: refused");
  ok(!hs.hubspotSignatureValid({ method: "POST", url, body, signature: sig(signedAs, body, now - 6 * 60_000), timestamp: String(now - 6 * 60_000), now }), "older than 5 minutes: refused");
  ok(!hs.hubspotSignatureValid({ method: "POST", url, body, signature: null, timestamp: String(now), now }), "no signature: refused");

  // ── "Open in HubSpot" links in Slack ──
  const lead = "3f62d8b1-7817-4556-a475-472de5e14712";
  const link = hs.hubspotLeadLink("https://jellyhook.com/", lead);
  const k = new URL(link).searchParams.get("k");
  ok(link.startsWith("https://jellyhook.com/go/hubspot/" + lead + "?k="), "the link: " + link.slice(0, 60) + "...");
  ok(hs.leadLinkValid(lead, k), "its signature checks");
  ok(!hs.leadLinkValid("00000000-0000-0000-0000-000000000000", k) && !hs.leadLinkValid(lead, null) && !hs.leadLinkValid(lead, k + "x"), "another lead, no signature or a changed one: refused");

  // ── the visit-chart token ──
  const t = hs.makeChartToken({ s: "site1", v: "visitor1", l: lead }, now);
  ok(hs.readChartToken(t, now + 60_000)?.v === "visitor1", "the chart token opens for 30 minutes");
  ok(hs.readChartToken(t, now + 31 * 60_000) === null, "and not after");
  const [b] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ s: "site2", v: "visitor9", l: lead, e: now + 1e9 })).toString("base64url") + "." + t.split(".")[1];
  ok(hs.readChartToken(forged, now) === null && hs.readChartToken(b, now) === null && hs.readChartToken(null, now) === null, "a forged, unsigned or missing token: refused");
  ok(!hs.leadLinkValid(lead, t.split(".")[1]), "a chart signature is not a link signature (one key per use)");

  // ── OAuth state ──
  const { state, nonce } = hs.makeState("site1", "user1");
  ok(hs.readState(state, nonce, "user1").ok, "the state comes back for the same person and browser");
  ok((hs.readState(state, nonce, "user2") as any).reason === "other-user", "another person: refused");
  ok((hs.readState(state, "other", "user1") as any).reason === "other-browser", "another browser: refused");
  ok((hs.readState(state.slice(0, -2) + "xx", nonce, "user1") as any).reason === "tampered", "a changed state: refused");
  ok(hs.authorizeUrl(state, "https://jellyhook.com/api/integrations/hubspot/callback").includes("scope=oauth+crm.objects.contacts.read"), "asks only to read contacts");

  // ── the contact record ──
  ok(hs.contactUrl("app.hubspot.com", 123, "501") === "https://app.hubspot.com/contacts/123/record/0-1/501", "contact record address");
  ok(hs.contactUrl("app-eu1.hubspot.com", 123, "501").startsWith("https://app-eu1.hubspot.com/"), "EU accounts keep their address");
  ok(hs.contactUrl("evil.com", 123, "501").startsWith("https://app.hubspot.com/"), "anything but a HubSpot address is replaced");

  // ── tokens and lookups, against a stand-in HubSpot and database ──
  const updates: any[] = [];
  const db: any = { from: () => ({ update: (u: any) => ({ eq: async () => { updates.push(u); return { error: null }; } }) }) };
  const calls: string[] = [];
  const realFetch = globalThis.fetch;
  const answers: Record<string, () => Response> = {};
  globalThis.fetch = (async (u: any, init?: any) => {
    const key = String(u).replace("https://api.hubapi.com", "");
    calls.push((init?.method ?? "GET") + " " + key.split("?")[0] + " " + (init?.headers?.Authorization ?? ""));
    const a = Object.entries(answers).find(([p]) => key.startsWith(p));
    return a ? a[1]() : new Response("{}", { status: 500 });
  }) as typeof fetch;
  const fresh = (): any => ({ id: "c1", site_id: "site1", portal_id: 123, ui_domain: "app.hubspot.com", access_token: "old-token", refresh_token: "refresh-1", expires_at: new Date(now + 20 * 60_000).toISOString(), status: "ok" });

  answers["/crm/v3/objects/contacts/ada%40acme.com"] = () => new Response(JSON.stringify({ id: "501" }), { status: 200 });
  ok((await hs.contactIdByEmail(fresh(), "Ada@Acme.com ", 1000, db)) === "501" && calls[0].endsWith("Bearer old-token"), "contact by email, lower-cased, with the stored token");

  answers["/crm/v3/objects/contacts/none%40acme.com"] = () => new Response("{}", { status: 404 });
  ok((await hs.contactIdByEmail(fresh(), "none@acme.com", 1000, db)) === null, "no contact with that email: null");

  calls.length = 0;
  answers["/oauth/v3/token"] = () => new Response(JSON.stringify({ access_token: "new-token", expires_in: 1800 }), { status: 200 });
  const old = { ...fresh(), expires_at: new Date(now + 30_000).toISOString() };
  await hs.contactIdByEmail(old, "ada@acme.com", 1000, db);
  ok(calls[0].startsWith("POST /oauth/v3/token") && calls[1].endsWith("Bearer new-token") && updates.some((u) => u.access_token === "new-token"), "a token about to expire is refreshed first and stored");

  calls.length = 0;
  let first = true;
  answers["/crm/v3/objects/contacts/retry%40acme.com"] = () => {
    if (first) { first = false; return new Response("{}", { status: 401 }); }
    return new Response(JSON.stringify({ id: "777" }), { status: 200 });
  };
  ok((await hs.contactIdByEmail(fresh(), "retry@acme.com", 1000, db)) === "777" && calls.some((c) => c.startsWith("POST /oauth/v3/token")), "a 401 refreshes the token and tries once more");

  updates.length = 0;
  answers["/oauth/v3/token"] = () => new Response(JSON.stringify({ status: "BAD_REFRESH_TOKEN", message: "missing or invalid refresh token" }), { status: 400 });
  let threw = false;
  try { await hs.accessToken({ ...fresh(), expires_at: new Date(now).toISOString() }, false, db); } catch { threw = true; }
  ok(threw && updates.some((u) => u.status === "failing"), "HubSpot refusing the refresh (app removed) marks the connection failing");

  answers["/crm/v3/objects/contacts/501"] = () => new Response(JSON.stringify({ properties: { email: " Ada@Acme.com " } }), { status: 200 });
  ok((await hs.contactEmail(fresh(), "501", 1000, db)) === "ada@acme.com", "a contact's email is read from HubSpot");
  ok((await hs.contactEmail(fresh(), "../../oauth", 1000, db)) === null, "a contact id that is not a number is never sent to HubSpot");
  globalThis.fetch = realFetch;

  // ── Slack: Open in HubSpot ──
  const p: any = { deliveryId: "d", eventId: "e", createdAt: new Date(now).toISOString(), site: { id: "s", domain: null }, rule: { id: "r", name: "Hot" }, title: "Hot", body: "A new lead", marks: [], lead: { id: lead, url: "https://jellyhook.com/platform/leads/" + lead, submittedAt: null, hubspotUrl: link } };
  const buttons = (o: any) => ((msg.slackMessage({ ...p, options: o }) as any).blocks.find((x: any) => x.type === "actions")?.elements ?? []).map((e: any) => e.text.text + (e.style ? "*" : ""));
  ok(JSON.stringify(buttons({})) === JSON.stringify(["Open in HubSpot*"]), "with HubSpot: Open in HubSpot by default");
  ok(JSON.stringify(buttons({ leadLink: "jellyhook" })) === JSON.stringify(["Open in Jellyhook*"]), "or Jellyhook");
  ok(JSON.stringify(buttons({ leadLink: "both" })) === JSON.stringify(["Open in HubSpot*", "Open in Jellyhook"]), "or both, HubSpot first");
  ok(JSON.stringify(buttons({ openButton: false })) === "[]", "hidden when the lead button is off");
  const noHub = ((msg.slackMessage({ ...p, lead: { ...p.lead, hubspotUrl: null } }) as any).blocks.find((x: any) => x.type === "actions").elements as any[]).map((e) => e.text.text);
  ok(JSON.stringify(noHub) === JSON.stringify(["Open the lead"]), "without HubSpot: Open the lead, as before");
  ok(JSON.stringify(msg.slackPlainMessage(p)).includes("Open in HubSpot"), "the plain fallback keeps Open in HubSpot");
  ok(msg.webhookBody(p).lead.hubspot_url === link, "webhooks get hubspot_url");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
};
run();
