// lib/notifications/message.ts
// What a hooked-lead message says (pure, also used in the browser by the hook editor's preview): the delivery payload,
// the hook's message options, the Slack Block Kit message and the webhook body. Sending, address checks and the
// signature are in ./send.ts (server). Exact formats: mds/build/notifications/webhooks.md.

export interface DeliveryPayload {
  deliveryId: string;
  eventId: string;
  createdAt: string;
  site: { id: string; domain: string | null };
  rule: { id: string; name: string };
  title: string;
  body: string;
  marks: { id: string; name: string }[];
  /** url: the lead in Jellyhook; hubspotUrl: "Open in HubSpot" (resolved at the click, app/go/hubspot) when the site has HubSpot */
  lead: { id: string; url: string; submittedAt: string | null; hubspotUrl?: string | null };
  /** where the lead came from (credited visit) and, for an ad, its library entry. Never personal data. */
  source?: { line: string; ad: { platform: string; adId: string; title: string; thumbnailUrl: string | null; videoUrl: string | null } | null } | null;
  /** what the Slack message shows (the hook's options); every part when absent */
  options?: Partial<MessageOptions> | null;
  /** the visit with the form, in the hook's version (lib/notifications/summary.ts); absent when off or not available */
  summary?: { version: SummaryVersion; lines: string[] } | null;
  /** the pages the hook asked about: their one-line summary, or text null when not opened */
  pages?: PageSummaryLine[] | null;
}

export type SummaryVersion = "short" | "moderate" | "long";
export type PageScope = "all" | "converting";
export interface PageSummaryLine {
  path: string;
  scope: PageScope;
  text: string | null;
}

const httpUrl = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:" ? x.toString() : null;
  } catch {
    return null;
  }
};

/**
 * What a hook's Slack message shows besides its subject and message (set per hook in the hook editor, "Customize the
 * Slack message"; stored in notification_rules.message_options, migration 26). Every part is shown by default, with the
 * Moderate visit summary and no page summaries. Webhooks always receive every field that was computed: they are data
 * for another system, not a message for a person.
 */
export interface MessageOptions {
  /** "Came from: Meta · Ads · Spring sale · 2026 Core Demo Video" */
  source: boolean;
  /** the ad's thumbnail as a large image (only when the ad has one in the Ads library) */
  adImage: boolean;
  /** the "Watch the ad" button (only when the ad has a video link) */
  watchButton: boolean;
  /** the "Open the lead" button (a link into Jellyhook) */
  openButton: boolean;
  /** the small line with the hook's name, the site and the time */
  details: boolean;
  /** the visit with the form, summarized (lib/leadSessions/story.ts sessionStoryVersion) */
  summary: "off" | SummaryVersion;
  /** up to MAX_SUMMARY_PAGES page addresses to summarize ("/pricing"), each "Page not visited" when not opened */
  pages: string[];
  /** which visits the page summaries read: every visit of the lead up to the form, or only the visit with the form */
  pageScope: PageScope;
  /** where the lead opens when the site has HubSpot connected: its HubSpot contact, Jellyhook, or a button for each */
  leadLink: LeadLink;
}

export type LeadLink = "hubspot" | "jellyhook" | "both";

/** The on/off parts (the hook editor's checkboxes). */
export type MessageToggle = "source" | "adImage" | "watchButton" | "openButton" | "details";
export const MAX_SUMMARY_PAGES = 3;

export const DEFAULT_MESSAGE_OPTIONS: MessageOptions = { source: true, adImage: true, watchButton: true, openButton: true, details: true, summary: "moderate", pages: [], pageScope: "all", leadLink: "hubspot" };

/** Cleans stored or submitted options: anything missing or invalid takes its default. */
export function messageOptions(raw: unknown): MessageOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (k: MessageToggle) => (typeof o[k] === "boolean" ? (o[k] as boolean) : DEFAULT_MESSAGE_OPTIONS[k]);
  const summary = o.summary === "off" || o.summary === "short" || o.summary === "moderate" || o.summary === "long" ? o.summary : DEFAULT_MESSAGE_OPTIONS.summary;
  const pages = Array.isArray(o.pages)
    ? [...new Set(o.pages.filter((x): x is string => typeof x === "string").map((x) => x.trim().slice(0, 200)).filter((x) => x.startsWith("/")))].slice(0, MAX_SUMMARY_PAGES)
    : [];
  const pageScope = o.pageScope === "converting" ? "converting" : "all";
  const leadLink = o.leadLink === "jellyhook" || o.leadLink === "both" ? o.leadLink : "hubspot";
  return { source: pick("source"), adImage: pick("adImage"), watchButton: pick("watchButton"), openButton: pick("openButton"), details: pick("details"), summary, pages, pageScope, leadLink };
}

/**
 * The lead's buttons: "Open in HubSpot" when the site has HubSpot and the hook wants it, "Open the lead" (Jellyhook)
 * otherwise, or both. The first one is the primary (green) button.
 */
function leadButtons(p: DeliveryPayload, link: LeadLink): Record<string, unknown>[] {
  const hubspot = httpUrl(p.lead.hubspotUrl);
  const out: Record<string, unknown>[] = [];
  if (hubspot && link !== "jellyhook") out.push({ type: "button", text: { type: "plain_text", text: "Open in HubSpot" }, url: hubspot });
  if (!hubspot || link !== "hubspot") out.push({ type: "button", text: { type: "plain_text", text: hubspot ? "Open in Jellyhook" : "Open the lead" }, url: p.lead.url });
  if (out[0]) out[0].style = "primary";
  return out;
}

/** Slack's mrkdwn treats <, > and & as control characters (links, @channel): text from a site or a link is escaped. */
export const slackEscape = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** A section's text is at most 3,000 characters in Slack; kept well under. */
const SECTION_MAX = 2900;
const LINE_MAX = 600;
const clip = (t: string, max: number) => (t.length > max ? t.slice(0, max - 3).trimEnd() + "..." : t);

/** "Page not visited" or "Page not visited in this visit", by the scope it was read in. */
export const notVisited = (scope: PageScope) => (scope === "converting" ? "Page not visited in this visit" : "Page not visited");

const summaryText = (sum: NonNullable<DeliveryPayload["summary"]>) => clip("*Visit summary*\n" + sum.lines.map((l) => slackEscape(clip(l, LINE_MAX))).join("\n"), SECTION_MAX);
const pagesText = (pages: PageSummaryLine[]) =>
  clip("*Page summaries*\n" + pages.map((x) => "*" + slackEscape(clip(x.path, 200)) + ":* " + slackEscape(clip(x.text ?? notVisited(x.scope), LINE_MAX))).join("\n"), SECTION_MAX);

export type SendResult = { ok: true; status: number } | { ok: false; status: number | null; error: string };

export function slackMessage(p: DeliveryPayload) {
  const when = Math.floor(Date.parse(p.lead.submittedAt ?? p.createdAt) / 1000);
  const show = messageOptions(p.options);
  const ad = p.source?.ad ?? null;
  const thumb = show.adImage ? httpUrl(ad?.thumbnailUrl) : null;
  const video = show.watchButton ? httpUrl(ad?.videoUrl) : null;
  const line = show.source ? p.source?.line ?? null : null;
  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: p.title.slice(0, 150) } },
    { type: "section", text: { type: "mrkdwn", text: p.body } },
  ];
  // what is in the lead's head: the ad (tag, thumbnail) that brought them, so the closer can match it in 3 seconds.
  // The line comes from links (utm_campaign...), so it is escaped: a campaign named "<!channel>" never pings anyone.
  if (line) blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Came from:* " + slackEscape(line.slice(0, 280)) } });
  if (thumb) blocks.push({ type: "image", image_url: thumb, alt_text: (ad?.title ?? "The ad").slice(0, 200), title: { type: "plain_text", text: (ad?.title ?? "The ad").slice(0, 150) } });
  // what they did before sending the form, and the pages the hook asked about (computed when the hook fired)
  if (p.summary?.lines.length) blocks.push({ type: "section", text: { type: "mrkdwn", text: summaryText(p.summary) } });
  if (p.pages?.length) blocks.push({ type: "section", text: { type: "mrkdwn", text: pagesText(p.pages) } });
  if (show.details) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Hook: ${p.rule.name}${p.site.domain ? " · " + p.site.domain : ""} · <!date^${when}^{date_short} {time}|${new Date(when * 1000).toISOString()}>` }] });
  const buttons: Record<string, unknown>[] = [];
  if (show.openButton) buttons.push(...leadButtons(p, show.leadLink));
  if (video) buttons.push({ type: "button", text: { type: "plain_text", text: "Watch the ad" }, url: video });
  if (buttons.length) blocks.push({ type: "actions", elements: buttons });
  return { text: p.title + ": " + p.body + (line ? " (came from " + slackEscape(line) + ")" : ""), blocks };
}

/**
 * The message with nothing that can make Slack refuse it: subject, message, where they came from and Open the lead.
 * Sent once when Slack answers 400 to the full message (an image it cannot load, a block it rejects), so the lead still
 * reaches the channel (lib/notifications/send.ts).
 */
export function slackPlainMessage(p: DeliveryPayload) {
  const line = p.source?.line ? slackEscape(p.source.line.slice(0, 280)) : null;
  const blocks: Record<string, unknown>[] = [
    { type: "header", text: { type: "plain_text", text: p.title.slice(0, 150) || "New lead" } },
    { type: "section", text: { type: "mrkdwn", text: clip(p.body || " ", SECTION_MAX) } },
  ];
  if (line) blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Came from:* " + line } });
  const buttons = leadButtons(p, messageOptions(p.options).leadLink).filter((b) => httpUrl(b.url as string));
  if (buttons.length) blocks.push({ type: "actions", elements: buttons });
  return { text: p.title + ": " + p.body, blocks };
}

export function webhookBody(p: DeliveryPayload) {
  return {
    event: "rule.fired",
    id: p.eventId,
    created_at: p.createdAt,
    site: p.site,
    rule: p.rule,
    message: { title: p.title, body: p.body },
    marks: p.marks,
    lead: { id: p.lead.id, url: p.lead.url, submitted_at: p.lead.submittedAt, hubspot_url: p.lead.hubspotUrl ?? null },
    source: p.source
      ? { line: p.source.line, ad: p.source.ad ? { platform: p.source.ad.platform, ad_id: p.source.ad.adId, title: p.source.ad.title, thumbnail_url: p.source.ad.thumbnailUrl, video_url: p.source.ad.videoUrl } : null }
      : null,
    session_summary: p.summary ? { version: p.summary.version, lines: p.summary.lines } : null,
    page_summaries: p.pages?.length ? p.pages.map((x) => ({ path: x.path, scope: x.scope, visited: x.text !== null, text: x.text ?? notVisited(x.scope) })) : null,
  };
}
