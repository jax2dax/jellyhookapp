// lib/acquisition/channel.ts
// Where a visit came from, in the words sales use: a PLATFORM (Google, Meta, LinkedIn...), split into paid and free
// ("Google · Ads" vs "Google · Search"), then the campaign and the ad. And which visit gets the CREDIT for a lead.
// Pure. Founder decisions 2026-10-24: credit = last non-direct by default (first touch on a switch); Direct never gets
// credit when anything else brought them; paid and free are separate rows.
//
// How a visit is read, strongest signal first:
//   1. the ad network's click id on the landing URL (gclid, fbclid, ...): paid, and that network
//   2. utm_source (+ utm_medium: cpc / paid / ppc / display / paid_social ... = paid)
//   3. the referrer's host (google.* = Google Search, l.facebook.com = Meta social, chatgpt.com = AI assistants...)
//   4. nothing: Direct
// Campaign = utm_campaign, ad = utm_content, keyword = utm_term (when the link carried them).

export interface VisitSource {
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  click_id?: string | null;
  landing_path?: string | null;
  /** from the tracking templates: the ad's name ({{ad.name}}) and the campaign's id */
  ad_name?: string | null;
  campaign_id?: string | null;
}

export interface Channel {
  /** "Google", "Meta", "LinkedIn", "Microsoft", "TikTok", "X", "YouTube", "Reddit", "AI assistants", "Email", "Referral", "Direct", or the utm_source as written */
  platform: string;
  paid: boolean;
  /** platform and kind, the row a person reads: "Google · Ads", "Google · Search", "Meta · Ads", "Meta · Social", "Referral · example.com", "Direct" */
  label: string;
  campaign: string | null;
  /** the ad network's ad id (utm_content: {{ad.id}}, {creative}, __CID__), or whatever utm_content held */
  ad: string | null;
  /** the ad's name when the link carried it (ad_name) */
  adName: string | null;
  term: string | null;
  landing: string | null;
  direct: boolean;
}

const PAID_MEDIA = /^(cpc|ppc|paid|paid[_-]?search|paid[_-]?social|paidsocial|sem|display|cpm|cpv|banner|ads?|retargeting|remarketing|social[_-]?paid|programmatic|video[_-]?ads?)$/i;

// utm_source spellings -> platform
const SOURCE_ALIASES: [RegExp, string][] = [
  [/^(google|googleads|google[_-]?ads|adwords|gads|google_cpc|youtube_ads)$/i, "Google"],
  [/^(facebook|fb|instagram|ig|meta|facebook_ads|fb_ads|ig_ads|messenger|audience_network)$/i, "Meta"],
  [/^(linkedin|li|lnkd|linkedin_ads)$/i, "LinkedIn"],
  [/^(bing|microsoft|msn|bing_ads|microsoft_ads)$/i, "Microsoft"],
  [/^(tiktok|tt|tiktok_ads)$/i, "TikTok"],
  [/^(twitter|x|t\.co|twitter_ads|x_ads)$/i, "X"],
  [/^(youtube|yt)$/i, "YouTube"],
  [/^(reddit|reddit_ads)$/i, "Reddit"],
  [/^(email|e-mail|newsletter|mailchimp|klaviyo|sendgrid|hubspot_email|brevo|convertkit|substack)$/i, "Email"],
  [/^(chatgpt|chatgpt\.com|openai|perplexity|claude|gemini|copilot)$/i, "AI assistants"],
];

// referrer host -> [platform, free kind]
const REFERRER_HOSTS: [RegExp, string, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "Google", "Search"],
  [/(^|\.)bing\.com$/, "Microsoft", "Search"],
  [/(^|\.)(duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z.]+|ecosia\.org|baidu\.com|search\.brave\.com)$/, "Other search", "Search"],
  [/(^|\.)(facebook\.com|fb\.com|instagram\.com|messenger\.com|threads\.net)$/, "Meta", "Social"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "LinkedIn", "Social"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "X", "Social"],
  [/(^|\.)(tiktok\.com)$/, "TikTok", "Social"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube", "Social"],
  [/(^|\.)(reddit\.com)$/, "Reddit", "Social"],
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/, "AI assistants", "Answer"],
  [/(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/, "Email", "Email"],
];

const CLICK_PLATFORM: Record<string, string> = { google: "Google", meta: "Meta", microsoft: "Microsoft", tiktok: "TikTok", linkedin: "LinkedIn", x: "X" };

const clean = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return s ? s.slice(0, 200) : null;
};

function host(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** One visit's source. `siteHost`: the site's own domain, so a referrer from the site itself counts as Direct. */
export function channelOf(v: VisitSource, siteHost?: string | null): Channel {
  // Google has no macro for the campaign's name: a campaign known only by its id is shown as "Campaign <id>"
  const campaign = clean(v.utm_campaign) ?? (clean(v.campaign_id) ? "Campaign " + clean(v.campaign_id) : null);
  const ad = clean(v.utm_content);
  const term = clean(v.utm_term);
  const landing = clean(v.landing_path);
  const adName = clean(v.ad_name);
  const base = { campaign, ad, adName, term, landing };
  const medium = (v.utm_medium ?? "").trim().toLowerCase();
  const sourceRaw = (v.utm_source ?? "").trim();

  // 1. an ad click id: paid on that network
  const clickPlatform = v.click_id ? CLICK_PLATFORM[v.click_id] : undefined;
  if (clickPlatform) return { ...base, platform: clickPlatform, paid: true, label: clickPlatform + " · Ads", direct: false };

  // 2. utm_source
  if (sourceRaw) {
    const platform = SOURCE_ALIASES.find(([re]) => re.test(sourceRaw))?.[1] ?? sourceRaw.toLowerCase().slice(0, 60);
    const paid = PAID_MEDIA.test(medium);
    const kind = paid ? "Ads" : platform === "Email" || medium === "email" ? "Email" : /social/.test(medium) ? "Social" : /organic|seo/.test(medium) ? "Search" : medium ? medium.slice(0, 30) : "Link";
    if (platform === "Email") return { ...base, platform, paid, label: paid ? "Email · Ads" : "Email", direct: false };
    return { ...base, platform, paid, label: platform + " · " + kind, direct: false };
  }

  // 3. the referrer
  const h = host(v.referrer);
  const own = siteHost ? siteHost.toLowerCase().replace(/^www\./, "") : null;
  if (h && h !== own && !(own && h.endsWith("." + own))) {
    const hit = REFERRER_HOSTS.find(([re]) => re.test(h));
    if (hit) return { ...base, platform: hit[1], paid: false, label: hit[2] === "Email" ? "Email" : hit[1] + " · " + hit[2], direct: false };
    return { ...base, platform: "Referral", paid: false, label: "Referral · " + h, direct: false };
  }

  // 4. nothing
  return { ...base, platform: "Direct", paid: false, label: "Direct", direct: true };
}

export type CreditModel = "lastNonDirect" | "first";

/**
 * Which of a lead's visits (up to and including the one they sent the form in, oldest first) gets the credit.
 *   lastNonDirect  the latest visit that did not come Direct (Direct only when every visit was Direct). The default:
 *                  a Facebook ad, then a Google ad, then typing the address -> Google.
 *   first          the first visit.
 * Returns the index into `visits`, or -1 when there are none.
 */
export function creditedVisit(channels: Channel[], model: CreditModel): number {
  if (!channels.length) return -1;
  if (model === "first") return 0;
  for (let i = channels.length - 1; i >= 0; i--) if (!channels[i].direct) return i;
  return channels.length - 1;
}
