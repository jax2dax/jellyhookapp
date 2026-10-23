// lib/notifications/tests/send.test.ts - outside messages (lib/notifications/send.ts): formats, address checks, signature.
// Run: npx jiti lib/notifications/tests/send.test.ts
import { createHmac } from "node:crypto";
import { isSafeWebhookUrl, isSlackUrl, signature, slackMessage, webhookBody, type DeliveryPayload } from "../send";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const p: DeliveryPayload = {
  deliveryId: "d1", eventId: "e1", createdAt: "2026-10-22T09:00:01Z", site: { id: "s1", domain: "acme.com" }, rule: { id: "r1", name: "Hot Lead new" },
  title: "Hot Lead new", body: "A new lead fulfills Pricing reader, Came back requirements",
  marks: [{ id: "m1", name: "Pricing reader" }, { id: "m2", name: "Came back" }],
  lead: { id: "L1", url: "https://jellyhook.com/platform/leads/L1", submittedAt: "2026-10-22T09:00:00Z" },
};
const slack = JSON.stringify(slackMessage(p));
const hook = JSON.stringify(webhookBody(p));
ok(slackMessage(p).text === "Hot Lead new: A new lead fulfills Pricing reader, Came back requirements", "Slack fallback text = title + body");
ok(slack.includes("Open the lead") && slack.includes("https://jellyhook.com/platform/leads/L1"), "Slack has the Open the lead button");
ok(!/anna|@|phone|reason|minSeconds|pricing\b.*30/i.test(slack + hook), "no personal data and no mark conditions in either message");
ok(webhookBody(p).event === "rule.fired" && webhookBody(p).marks.length === 2 && !("name" in webhookBody(p).lead), "webhook body: event, marks by name, lead without contact details");

const sig = signature("secret", hook, 1761123600);
const [tPart, vPart] = sig.split(",");
const expected = createHmac("sha256", "secret").update("1761123600." + hook).digest("hex");
ok(tPart === "t=1761123600" && vPart === "v1=" + expected, "signature = HMAC-SHA256 of '<t>.<body>' (a receiver can check it)");

ok(isSlackUrl("https://hooks.slack.com/services/T0/B0/XYZ"), "a Slack incoming webhook is accepted");
ok(!isSlackUrl("https://evil.com/services/x") && !isSlackUrl("http://hooks.slack.com/services/x") && !isSlackUrl("https://hooks.slack.com/other"), "anything else is not a Slack channel");
ok(isSafeWebhookUrl("https://hooks.zapier.com/hooks/catch/1/abc"), "a public https webhook is accepted");
for (const bad of ["http://example.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://[::1]/x", "https://db.internal/x", "https://user:pw@example.com/x", "https://intranet/x"]) {
  ok(!isSafeWebhookUrl(bad), "refused: " + bad);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
