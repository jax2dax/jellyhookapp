// lib/notifications/tests/send.test.ts - outside messages (lib/notifications/send.ts): formats, address checks, signature.
// Run: npx jiti lib/notifications/tests/send.test.ts
import { createHmac } from "node:crypto";
import { isSafeWebhookUrl, isSlackUrl, messageOptions, post, signature, slackMessage, slackPlainMessage, webhookBody, type DeliveryPayload } from "../send";

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

// ── where the lead came from: the ad's tag, thumbnail and "Watch the ad" (2026-10-24) ──
{
  const withAd: DeliveryPayload = { ...p, source: { line: "Meta · Ads · Spring sale · 2026 Core Demo Video", ad: { platform: "Meta", adId: "1202", title: "2026 Core Demo Video", thumbnailUrl: "https://x.supabase.co/storage/v1/object/public/ad-thumbnails/s1/abc.jpg", videoUrl: "https://www.facebook.com/ads/library/?id=1202" } } };
  const m = slackMessage(withAd) as unknown as { text: string; blocks: { type: string; text?: { text: string }; image_url?: string; elements?: { text?: { text: string }; url?: string }[] }[] };
  const types = m.blocks.map((b) => b.type).join(",");
  ok(types === "header,section,section,image,context,actions", "blocks: title, message, came from, thumbnail, hook line, buttons (" + types + ")");
  ok(m.blocks[2].text?.text === "*Came from:* Meta · Ads · Spring sale · 2026 Core Demo Video", "the 'Came from' line names the ad by its tag");
  ok(m.blocks[3].image_url?.endsWith("/abc.jpg") === true, "the thumbnail is shown as an image");
  const actions = m.blocks[5].elements ?? [];
  ok(actions.length === 2 && actions[1].text?.text === "Watch the ad" && actions[1].url === "https://www.facebook.com/ads/library/?id=1202", "a Watch the ad button next to Open the lead");
  ok(m.text.includes("(came from Meta · Ads"), "the fallback text says where they came from");
  const noThumb = slackMessage({ ...withAd, source: { line: "Google · Search", ad: null } }) as unknown as { blocks: { type: string }[] };
  ok(noThumb.blocks.map((b) => b.type).join(",") === "header,section,section,context,actions", "no ad: only the text line, no image");
  const bad = slackMessage({ ...withAd, source: { line: "x", ad: { ...withAd.source!.ad!, thumbnailUrl: "javascript:alert(1)", videoUrl: "ftp://x" } } }) as unknown as { blocks: { type: string; elements?: unknown[] }[] };
  ok(!bad.blocks.some((b) => b.type === "image") && (bad.blocks[bad.blocks.length - 1].elements ?? []).length === 1, "a link that is not http(s) is never sent");
  const wb = webhookBody(withAd);
  ok(wb.source?.ad?.title === "2026 Core Demo Video" && wb.source?.ad?.video_url?.startsWith("https://") === true, "the webhook carries the source and the ad too");
}

// ── the hook's message options (migration 26): every part can be hidden; defaults show everything ──
{
  const full: DeliveryPayload = { ...p, source: { line: "Meta · Ads · Spring sale · Core Demo", ad: { platform: "Meta", adId: "1", title: "Core Demo", thumbnailUrl: "https://x.co/a.jpg", videoUrl: "https://x.co/v" } } };
  const types = (o: object) => (slackMessage({ ...full, options: o }) as unknown as { blocks: { type: string }[] }).blocks.map((b) => b.type).join(",");
  ok(types({}) === "header,section,section,image,context,actions", "no options: everything shown");
  ok(types({ source: false }) === "header,section,image,context,actions", "Came from hidden");
  ok(types({ adImage: false }) === "header,section,section,context,actions", "thumbnail hidden");
  ok(types({ details: false }) === "header,section,section,image,actions", "the hook / site / time line hidden");
  ok(types({ openButton: false, watchButton: false }) === "header,section,section,image,context", "both buttons hidden: no button row at all");
  const onlyWatch = slackMessage({ ...full, options: { openButton: false } }) as unknown as { blocks: { type: string; elements?: { text?: { text: string } }[] }[] };
  ok(onlyWatch.blocks[onlyWatch.blocks.length - 1].elements?.length === 1 && onlyWatch.blocks[onlyWatch.blocks.length - 1].elements?.[0].text?.text === "Watch the ad", "Open the lead hidden, Watch the ad kept");
  ok(!(slackMessage({ ...full, options: { source: false } }) as { text: string }).text.includes("came from"), "a hidden Came from is not in the fallback text either");
  ok(JSON.stringify(messageOptions({ source: false, adImage: "no", junk: 1 })) === JSON.stringify({ source: false, adImage: true, watchButton: true, openButton: true, details: true, summary: "moderate", pages: [], pageScope: "all", leadLink: "hubspot", repeat: "daily" }), "stored options are cleaned (non-booleans take the default)");
  ok(webhookBody({ ...full, options: { source: false } }).source?.line === "Meta · Ads · Spring sale · Core Demo", "webhooks always get every field");
}

// ── the visit summary and page summaries (2026-10-25, mds/build/notifications/session-summary.md) ──
type Blocks = { blocks: { type: string; text?: { text: string }; elements?: unknown[] }[]; text: string };
{
  const d = messageOptions(undefined);
  ok(d.summary === "moderate" && d.pages.length === 0 && d.pageScope === "all", "default: Moderate summary, no pages, every visit");
  ok(messageOptions({ summary: "loud" }).summary === "moderate", "an unknown version takes the default");
  const cleaned = messageOptions({ pages: ["/a", "nope", "/a", "/b", "/c", "/d", 5], pageScope: "converting" });
  ok(JSON.stringify(cleaned.pages) === JSON.stringify(["/a", "/b", "/c"]) && cleaned.pageScope === "converting", "pages: addresses only, no repeats, at most 3");
  ok(messageOptions({ summary: "off" }).summary === "off", "the summary can be switched off");
  ok(messageOptions({ repeat: "every" }).repeat === "every" && messageOptions({ repeat: "x" }).repeat === "daily" && messageOptions(undefined).repeat === "daily", "repeat: every time, or once a day (the default)");

  const withSummary: DeliveryPayload = {
    ...p,
    summary: { version: "moderate", lines: ["Their 4th visit: / (20s) → /pricing (1m 4s).", 'The most on "<!channel> & co" on /pricing (55s).'] },
    pages: [{ path: "/pricing", scope: "all", text: '1m 4s; most on "Business" (55s)' }, { path: "/careers", scope: "all", text: null }, { path: "/demo", scope: "converting", text: null }],
  };
  const m = slackMessage(withSummary) as unknown as Blocks;
  const texts = m.blocks.map((b) => b.text?.text ?? "");
  const sumText = texts.find((t) => t.startsWith("*Visit summary*")) ?? "";
  ok(sumText.split("\n").length === 3, "the summary is one section, one line per point");
  ok(sumText.includes("&lt;!channel&gt; &amp; co") && !sumText.includes("<!channel>"), "text from the site is escaped: no @channel, no links");
  const pagesText = texts.find((t) => t.startsWith("*Page summaries*")) ?? "";
  ok(pagesText.includes("*/pricing:* 1m 4s") && pagesText.includes("*/careers:* Page not visited") && pagesText.includes("*/demo:* Page not visited in this visit"), "page summaries, with Page not visited");
  const kinds = m.blocks.map((b) => (b.text?.text ?? b.type).slice(0, 9));
  ok(kinds.indexOf("*Visit su") < kinds.indexOf("*Page sum") && m.blocks[m.blocks.length - 1].type === "actions", "summary, then pages, then the buttons");
  ok(!JSON.stringify(slackMessage({ ...withSummary, summary: null, pages: null })).includes("Visit summary"), "no summary when the hook has none");
  const long = slackMessage({ ...withSummary, summary: { version: "long", lines: Array.from({ length: 40 }, () => "x".repeat(900)) } }) as unknown as Blocks;
  ok(long.blocks.every((b) => (b.text?.text ?? "").length <= 3000), "a section never passes Slack's 3,000 characters");
  const evil = slackMessage({ ...p, source: { line: "Meta · Ads · <!channel>", ad: null } }) as unknown as Blocks;
  ok(!JSON.stringify(evil).includes("<!channel>"), "the came-from line is escaped too (it comes from links)");

  const hookBody = webhookBody(withSummary);
  ok(hookBody.session_summary?.version === "moderate" && hookBody.session_summary.lines.length === 2, "webhooks get the summary");
  ok(hookBody.page_summaries?.[1].visited === false && hookBody.page_summaries[1].text === "Page not visited", "webhooks get page summaries with visited true or false");
  ok(webhookBody(p).session_summary === null && webhookBody(p).page_summaries === null, "webhooks: null when the hook asked for none");

  const plain = slackPlainMessage(withSummary) as unknown as Blocks;
  ok(!JSON.stringify(plain).includes("Visit summary") && !plain.blocks.some((b) => b.type === "image") && JSON.stringify(plain).includes("Open the lead"), "the plain message: no summary, no image, still Open the lead");
}

const run = async () => {
  // Slack refuses the full message (400): the plain one is sent once and the delivery counts as sent
  const realFetch = globalThis.fetch;
  const bodies: string[] = [];
  const answer = (statuses: number[]) => {
    let i = 0;
    bodies.length = 0;
    globalThis.fetch = (async (_u: unknown, init?: { body?: unknown }) => {
      bodies.push(String(init?.body ?? ""));
      return new Response("", { status: statuses[i++] ?? 500 });
    }) as typeof fetch;
  };
  const payload: DeliveryPayload = { ...p, summary: { version: "short", lines: ["Their first visit: / (5s)."] } };
  const slackUrl = "https://hooks.slack.com/services/T0/B0/XYZ";
  answer([400, 200]);
  const r1 = await post("slack", slackUrl, payload, null);
  ok(r1.ok && bodies.length === 2 && bodies[0].includes("Visit summary") && !bodies[1].includes("Visit summary"), "Slack 400: sent again as the plain message");
  answer([400, 400]);
  const r2 = await post("slack", slackUrl, payload, null);
  ok(!r2.ok && bodies.length === 2, "both refused: a failure, retried later as usual");
  answer([500]);
  const r3 = await post("slack", slackUrl, payload, null);
  ok(!r3.ok && bodies.length === 1, "Slack down (500): no plain resend, the retry schedule handles it");
  answer([400]);
  const r4 = await post("webhook", "https://hooks.zapier.com/hooks/catch/1/abc", payload, "s");
  ok(!r4.ok && bodies.length === 1, "webhooks are not resent as a plain message");
  globalThis.fetch = realFetch;

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
};
run();
