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
  lead: { id: string; url: string; submittedAt: string | null };
  /** where the lead came from (credited visit) and, for an ad, its library entry. Never personal data. */
  source?: { line: string; ad: { platform: string; adId: string; title: string; thumbnailUrl: string | null; videoUrl: string | null } | null } | null;
  /** what the Slack message shows (the hook's options); every part when absent */
  options?: Partial<MessageOptions> | null;
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
 * Slack message"; stored in notification_rules.message_options, migration 26). Everything is shown by default. Webhooks
 * always receive every field: they are data for another system, not a message for a person.
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
}

export const DEFAULT_MESSAGE_OPTIONS: MessageOptions = { source: true, adImage: true, watchButton: true, openButton: true, details: true };

/** Cleans stored or submitted options: anything missing or not a boolean takes its default. */
export function messageOptions(raw: unknown): MessageOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (k: keyof MessageOptions) => (typeof o[k] === "boolean" ? (o[k] as boolean) : DEFAULT_MESSAGE_OPTIONS[k]);
  return { source: pick("source"), adImage: pick("adImage"), watchButton: pick("watchButton"), openButton: pick("openButton"), details: pick("details") };
}

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
  // what is in the lead's head: the ad (tag, thumbnail) that brought them, so the closer can match it in 3 seconds
  if (line) blocks.push({ type: "section", text: { type: "mrkdwn", text: "*Came from:* " + line.slice(0, 280) } });
  if (thumb) blocks.push({ type: "image", image_url: thumb, alt_text: (ad?.title ?? "The ad").slice(0, 200), title: { type: "plain_text", text: (ad?.title ?? "The ad").slice(0, 150) } });
  if (show.details) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Hook: ${p.rule.name}${p.site.domain ? " · " + p.site.domain : ""} · <!date^${when}^{date_short} {time}|${new Date(when * 1000).toISOString()}>` }] });
  const buttons: Record<string, unknown>[] = [];
  if (show.openButton) buttons.push({ type: "button", text: { type: "plain_text", text: "Open the lead" }, url: p.lead.url, style: "primary" });
  if (video) buttons.push({ type: "button", text: { type: "plain_text", text: "Watch the ad" }, url: video });
  if (buttons.length) blocks.push({ type: "actions", elements: buttons });
  return { text: p.title + ": " + p.body + (line ? " (came from " + line + ")" : ""), blocks };
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
    lead: { id: p.lead.id, url: p.lead.url, submitted_at: p.lead.submittedAt },
    source: p.source
      ? { line: p.source.line, ad: p.source.ad ? { platform: p.source.ad.platform, ad_id: p.source.ad.adId, title: p.source.ad.title, thumbnail_url: p.source.ad.thumbnailUrl, video_url: p.source.ad.videoUrl } : null }
      : null,
  };
}
