// lib/acquisition/leadSource.ts
// Where each lead came from, as sales sees it: the credited visit (last non-direct, lib/acquisition/channel.ts) and,
// when that visit came from a named ad, the ad's entry in the site's Ads library (its tag, thumbnail and video, filled
// in by the team: migration 25). Used by Hooks -> Hooked leads and by hooked-lead messages (Slack, webhooks).
// Nothing personal: platforms, campaigns and ads only. Server only (service role).
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { channelOf, creditedVisit, type Channel, type VisitSource } from "./channel";
import { LOOKBACK_DAYS, sourceLine } from "./report";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface LeadAd {
  platform: string;
  adId: string;
  /** what to call it: the team's tag, else the ad's name, else its id */
  title: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
}

export interface LeadSource {
  /** "Meta · Ads · Spring sale · 2026 Core Demo Video" */
  line: string;
  channel: Channel;
  ad: LeadAd | null;
}

type Row = VisitSource & { visitor_id: string; started_at: string };

const BASE = "visitor_id, started_at, referrer, utm_source, utm_medium, utm_campaign";

async function visits(siteId: string, visitors: string[]): Promise<Row[]> {
  for (const cols of [BASE + ", utm_content, utm_term, click_id, landing_path, ad_name, campaign_id", BASE + ", utm_content, utm_term, click_id, landing_path", BASE]) {
    const r = await admin.from("sessions").select(cols).eq("site_id", siteId).in("visitor_id", visitors).order("started_at").limit(2000);
    if (!r.error) return (r.data ?? []) as unknown as Row[]; // older databases lack the newer columns: try with fewer
  }
  return [];
}

export async function leadSources(siteId: string, leads: { id: string; visitor_id: string | null; submitted_at: string }[], siteHost: string | null): Promise<Map<string, LeadSource>> {
  const out = new Map<string, LeadSource>();
  const visitors = [...new Set(leads.map((l) => l.visitor_id).filter((v): v is string => !!v))];
  if (!visitors.length) return out;
  const rows = await visits(siteId, visitors);
  const credited = new Map<string, Channel>();
  for (const l of leads) {
    const sent = Date.parse(l.submitted_at);
    const mine = rows.filter((s) => s.visitor_id === l.visitor_id && Date.parse(s.started_at) <= sent && Date.parse(s.started_at) >= sent - LOOKBACK_DAYS * 86_400_000);
    const chans = mine.map((s) => channelOf(s, siteHost));
    const i = creditedVisit(chans, "lastNonDirect");
    if (i >= 0) credited.set(l.id, chans[i]);
  }
  // the ads library entries of the credited ads
  const adIds = [...new Set([...credited.values()].map((c) => c.ad).filter((a): a is string => !!a))];
  const lib = new Map<string, { tag: string | null; ad_name: string | null; thumbnail_url: string | null; video_url: string | null }>();
  if (adIds.length) {
    const { data } = await admin.from("ads").select("platform, ad_id, tag, ad_name, thumbnail_url, video_url").eq("site_id", siteId).in("ad_id", adIds);
    for (const a of data ?? []) lib.set(a.platform + "|" + a.ad_id, a as never);
  }
  for (const [leadId, ch] of credited) {
    const entry = ch.ad ? lib.get(ch.platform + "|" + ch.ad) : undefined;
    const ad: LeadAd | null = ch.ad
      ? { platform: ch.platform, adId: ch.ad, title: entry?.tag || entry?.ad_name || ch.adName || ch.ad, thumbnailUrl: entry?.thumbnail_url ?? null, videoUrl: entry?.video_url ?? null }
      : null;
    out.set(leadId, { line: sourceLine(ch, entry?.tag || entry?.ad_name || null), channel: ch, ad });
  }
  return out;
}
