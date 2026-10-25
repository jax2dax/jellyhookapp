// lib/acquisition/tests/channel.test.ts. Run: npx jiti lib/acquisition/tests/channel.test.ts (part of npm run test:marks)
import { channelOf, creditedVisit, type VisitSource } from "../channel";

let passes = 0;
let fails = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) passes++;
  else fails++;
  console.log((cond ? "ok: " : "FAIL: ") + msg);
};
const v = (x: Partial<VisitSource>): VisitSource => ({ referrer: null, utm_source: null, utm_medium: null, utm_campaign: null, ...x });
const label = (x: Partial<VisitSource>, site?: string) => channelOf(v(x), site).label;

// ── reading a visit ──
ok(label({ click_id: "google" }) === "Google · Ads", "a Google click id = Google · Ads, even without UTMs");
ok(label({ click_id: "meta", utm_source: "newsletter" }) === "Meta · Ads", "the click id beats a wrong utm_source");
ok(label({ utm_source: "facebook", utm_medium: "cpc" }) === "Meta · Ads", "facebook + cpc = Meta · Ads");
ok(label({ utm_source: "ig", utm_medium: "paid_social" }) === "Meta · Ads", "ig + paid_social = Meta · Ads");
ok(label({ utm_source: "facebook", utm_medium: "social" }) === "Meta · Social", "facebook + social = Meta · Social (free)");
ok(label({ utm_source: "google", utm_medium: "organic" }) === "Google · Search", "google + organic = Google · Search");
ok(label({ utm_source: "linkedin", utm_medium: "Paid" }) === "LinkedIn · Ads", "medium in any case");
ok(label({ utm_source: "mailchimp", utm_medium: "email" }) === "Email", "a newsletter = Email");
ok(label({ utm_source: "partnerblog" }) === "partnerblog · Link", "an unknown utm_source keeps its own name");
ok(label({ referrer: "https://www.google.com/" }) === "Google · Search", "google.com referrer = Google · Search");
ok(label({ referrer: "https://www.google.co.uk/search?q=x" }) === "Google · Search", "google.co.uk too");
ok(label({ referrer: "https://l.facebook.com/l.php?u=x" }) === "Meta · Social", "Facebook's link shim = Meta · Social");
ok(label({ referrer: "https://t.co/abc" }) === "X · Social", "t.co = X");
ok(label({ referrer: "https://chatgpt.com/" }) === "AI assistants · Answer", "ChatGPT = AI assistants");
ok(label({ referrer: "https://someblog.com/post" }) === "Referral · someblog.com", "another site = Referral, by host");
ok(label({ referrer: "https://www.mysite.com/pricing" }, "mysite.com") === "Direct", "a referrer from the site itself = Direct");
ok(label({}) === "Direct", "nothing = Direct");
const full = channelOf(v({ utm_source: "facebook", utm_medium: "cpc", utm_campaign: "Spring sale", utm_content: "video-1", utm_term: "crm", landing_path: "/offer" }));
ok(full.campaign === "Spring sale" && full.ad === "video-1" && full.term === "crm" && full.landing === "/offer" && full.paid, "campaign, ad, keyword and landing page are kept");

ok(channelOf(v({ click_id: "google", campaign_id: "2134", utm_content: "678" })).campaign === "Campaign 2134", "a Google campaign known only by its id");
ok(channelOf(v({ utm_campaign: "Spring", campaign_id: "2134" })).campaign === "Spring", "the name wins over the id");
ok(channelOf(v({ utm_source: "facebook", utm_medium: "paid_social", utm_content: "1202", ad_name: "Core Demo v3" })).adName === "Core Demo v3", "the ad's name from ad_name");

// ── credit ──
const fb = channelOf(v({ utm_source: "facebook", utm_medium: "cpc" }));
const gg = channelOf(v({ click_id: "google" }));
const dir = channelOf(v({}));
ok(creditedVisit([fb, gg, dir], "lastNonDirect") === 1, "founder's example: Facebook ad, Google ad, Direct -> Google (last non-direct)");
ok(creditedVisit([fb, gg, dir], "first") === 0, "first touch -> Facebook");
ok(creditedVisit([fb, dir, dir], "lastNonDirect") === 0, "Facebook ad then Direct twice -> Facebook, never Direct");
ok(creditedVisit([dir, dir], "lastNonDirect") === 1, "only Direct visits -> Direct");
ok(creditedVisit([], "lastNonDirect") === -1, "no visits -> none");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
