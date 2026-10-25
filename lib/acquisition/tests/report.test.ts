// lib/acquisition/tests/report.test.ts. Run: npx jiti lib/acquisition/tests/report.test.ts (part of npm run test:marks)
import { buildReport, sourceLine, type LeadRow, type SessionRow } from "../report";
import { channelOf } from "../channel";

let passes = 0;
let fails = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) passes++;
  else fails++;
  console.log((cond ? "ok: " : "FAIL: ") + msg);
};
const day = (d: number, h = 10) => new Date(Date.UTC(2026, 9, d, h)).toISOString();
const s = (visitor: string, d: number, x: Partial<SessionRow> = {}): SessionRow => ({ visitor_id: visitor, session_id: visitor + d, started_at: day(d), referrer: null, utm_source: null, utm_medium: null, utm_campaign: null, ...x });
const fbAd = { utm_source: "facebook", utm_medium: "cpc", utm_campaign: "Spring sale", utm_content: "video-1", landing_path: "/offer" };
const ggAd = { click_id: "google", utm_campaign: "Brand search", utm_content: "ad-a" };

const sessions: SessionRow[] = [
  // A: Facebook ad (day 2), Google ad (day 5), direct (day 8) -> sent on day 8
  s("A", 2, fbAd),
  s("A", 5, ggAd),
  s("A", 8),
  // B: Facebook ad (day 3), direct (day 6) -> sent on day 6, hooked
  s("B", 3, fbAd),
  s("B", 6),
  // C: Google search only, no lead
  s("C", 4, { referrer: "https://www.google.com/" }),
  // D: direct only, sent day 7
  s("D", 7),
  // E: visited before the range only (day 1 is outside from = day 2)
  s("E", 1, fbAd),
];
const leads: LeadRow[] = [
  { id: "LA", visitor_id: "A", session_id: "A8", submitted_at: day(8, 11) },
  { id: "LB", visitor_id: "B", session_id: "B6", submitted_at: day(6, 11) },
  { id: "LD", visitor_id: "D", session_id: "D7", submitted_at: day(7, 11) },
];
const range = { from: Date.parse(day(2, 0)), to: Date.parse(day(31, 23)) };
const r = buildReport({ sessions, leads, hooked: new Set(["LB"]), ...range, model: "lastNonDirect" });
const row = (label: string) => r.rows.find((x) => x.label === label);

ok(r.totals.visitors === 4 && r.totals.leads === 3 && r.totals.hooked === 1, "totals: 4 visitors in range (E is before it), 3 leads, 1 hooked");
ok(row("Google · Ads")?.leads === 1, "A: Facebook ad, Google ad, direct -> credited to Google · Ads (last non-direct)");
ok(row("Meta · Ads")?.leads === 1 && row("Meta · Ads")?.hooked === 1, "B: Facebook ad then direct -> Meta · Ads, and it was hooked");
ok(row("Direct")?.leads === 1, "D: only direct -> Direct");
ok(row("Meta · Ads")?.visitors === 2 && row("Google · Search")?.visitors === 1, "traffic by each visitor's first visit in the range (A and B first came from the Facebook ad)");
const spring = row("Meta · Ads")?.campaigns.find((c) => c.name === "Spring sale");
ok(spring?.ads[0]?.name === "video-1" && spring?.ads[0]?.landing === "/offer", "inside the platform: campaign, then the ad with its landing page");
ok(r.rows[0].leads >= r.rows[r.rows.length - 1].leads, "rows sorted by leads first");

const first = buildReport({ sessions, leads, hooked: new Set(["LB"]), ...range, model: "first" });
ok(first.rows.find((x) => x.label === "Meta · Ads")?.leads === 2 && !first.rows.find((x) => x.label === "Google · Ads")?.leads, "first touch: A and B both go to the Facebook ad");

ok(r.radarPlatforms.length >= 3 && Math.round(r.radarPlatforms.reduce((n, p) => n + p.leads, 0)) === 100, "platform radar: shares of each group, leads add up to 100%");
ok(r.radarCampaigns.length === 0, "campaign radar: fewer than 3 campaigns is not a shape (empty)");
ok(sourceLine(channelOf({ referrer: null, ...fbAd })) === "Meta · Ads · Spring sale · video-1", "the line sales read for a hooked lead");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
