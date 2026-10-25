// lib/acquisition/report.ts
// The Acquisition page's numbers, from a site's visits and leads. Pure (lib/actions/acquisition.action.ts reads the
// rows). Design and founder decisions: mds/build/acquisition/plan.md.
//
//   Traffic   each visitor whose visit started in the range counts once, under the source of their first visit in it.
//   Leads     each form submitted in the range counts once, under the visit that gets the credit (lib/acquisition/
//             channel.ts creditedVisit: last non-direct by default, first touch on the switch), looked for among the
//             visitor's visits up to sending, at most LOOKBACK_DAYS before it.
//   Hooked    the leads among those that a hook caught.
//   Rate      leads / visitors of that row (a row can have leads credited from visits before the range: the rate can
//             then pass 100%, and is shown capped).
// Rows: platform (Google · Ads...), inside it the campaign, inside it the ad (utm_content). Radars: shares of each group
// (traffic, leads, hooked) per platform and per campaign, so the shapes compare where your best leads come from.
import { channelOf, creditedVisit, type Channel, type CreditModel, type VisitSource } from "./channel";

export const LOOKBACK_DAYS = 90;

export interface SessionRow extends VisitSource {
  visitor_id: string | null;
  session_id: string;
  started_at: string;
}

export interface LeadRow {
  id: string;
  visitor_id: string | null;
  session_id: string | null;
  submitted_at: string;
}

export interface Counts {
  visitors: number;
  leads: number;
  hooked: number;
}

export interface AdRow extends Counts {
  name: string;
  landing: string | null;
}
export interface CampaignRow extends Counts {
  name: string;
  ads: AdRow[];
}
export interface PlatformRow extends Counts {
  label: string;
  platform: string;
  paid: boolean;
  campaigns: CampaignRow[];
}

export interface RadarPoint {
  axis: string;
  traffic: number;
  leads: number;
  hooked: number;
}

export interface AcquisitionReport {
  totals: Counts;
  rows: PlatformRow[];
  radarPlatforms: RadarPoint[];
  radarCampaigns: RadarPoint[];
}

const NO_CAMPAIGN = "(no campaign)";
const NO_AD = "(no ad named)";
const t = (s: string) => Date.parse(s);


export function buildReport(input: { sessions: SessionRow[]; leads: LeadRow[]; hooked: Set<string>; from: number; to: number; model: CreditModel; siteHost?: string | null }): AcquisitionReport {
  const { sessions, leads, hooked, from, to, model, siteHost } = input;
  const byVisitor = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!s.visitor_id || !Number.isFinite(t(s.started_at))) continue;
    const list = byVisitor.get(s.visitor_id) ?? [];
    list.push(s);
    byVisitor.set(s.visitor_id, list);
  }
  for (const list of byVisitor.values()) list.sort((a, b) => t(a.started_at) - t(b.started_at));

  // platform label -> campaign -> ad -> counts
  const tree = new Map<string, { ch: Channel; c: Counts; campaigns: Map<string, { c: Counts; ads: Map<string, { c: Counts; landing: Map<string, number> }> }> }>();
  const add = (ch: Channel, field: keyof Counts) => {
    let p = tree.get(ch.label);
    if (!p) tree.set(ch.label, (p = { ch, c: { visitors: 0, leads: 0, hooked: 0 }, campaigns: new Map() }));
    p.c[field]++;
    const cname = ch.campaign ?? NO_CAMPAIGN;
    let c = p.campaigns.get(cname);
    if (!c) p.campaigns.set(cname, (c = { c: { visitors: 0, leads: 0, hooked: 0 }, ads: new Map() }));
    c.c[field]++;
    const aname = ch.ad ?? NO_AD;
    let a = c.ads.get(aname);
    if (!a) c.ads.set(aname, (a = { c: { visitors: 0, leads: 0, hooked: 0 }, landing: new Map() }));
    a.c[field]++;
    if (ch.landing) a.landing.set(ch.landing, (a.landing.get(ch.landing) ?? 0) + 1);
  };

  const totals: Counts = { visitors: 0, leads: 0, hooked: 0 };

  // traffic: each visitor once, by their first visit in the range
  for (const list of byVisitor.values()) {
    const first = list.find((s) => t(s.started_at) >= from && t(s.started_at) <= to);
    if (!first) continue;
    totals.visitors++;
    add(channelOf(first, siteHost), "visitors");
  }

  // leads: by the credited visit
  const lookback = LOOKBACK_DAYS * 86_400_000;
  for (const l of leads) {
    const sent = t(l.submitted_at);
    if (!(sent >= from && sent <= to)) continue;
    totals.leads++;
    const isHooked = hooked.has(l.id);
    if (isHooked) totals.hooked++;
    const visits = (l.visitor_id ? byVisitor.get(l.visitor_id) ?? [] : []).filter((s) => t(s.started_at) <= sent && t(s.started_at) >= sent - lookback);
    const chans = visits.map((s) => channelOf(s, siteHost));
    const i = creditedVisit(chans, model);
    const ch = i >= 0 ? chans[i] : channelOf({ referrer: null, utm_source: null, utm_medium: null, utm_campaign: null }, siteHost);
    add(ch, "leads");
    if (isHooked) add(ch, "hooked");
  }

  const rank = (a: Counts, b: Counts) => b.leads - a.leads || b.hooked - a.hooked || b.visitors - a.visitors;
  const rows: PlatformRow[] = [...tree.values()]
    .map((p) => ({
      label: p.ch.label,
      platform: p.ch.platform,
      paid: p.ch.paid,
      ...p.c,
      campaigns: [...p.campaigns.entries()]
        .map(([name, c]) => ({
          name,
          ...c.c,
          ads: [...c.ads.entries()].map(([an, a]) => ({ name: an, ...a.c, landing: [...a.landing.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null })).sort(rank),
        }))
        .sort(rank),
    }))
    .sort(rank);

  return { totals, rows, radarPlatforms: radar(rows.map((r) => ({ axis: r.label, ...countsOf(r) }))), radarCampaigns: radar(campaignsAcross(rows)) };
}

const countsOf = (c: Counts): Counts => ({ visitors: c.visitors, leads: c.leads, hooked: c.hooked });

/** Campaigns across platforms ("Spring sale" on Meta and on Google is one point), without the no-campaign bucket. */
function campaignsAcross(rows: PlatformRow[]): (Counts & { axis: string })[] {
  const m = new Map<string, Counts>();
  for (const r of rows)
    for (const c of r.campaigns) {
      if (c.name === NO_CAMPAIGN) continue;
      const cur = m.get(c.name) ?? { visitors: 0, leads: 0, hooked: 0 };
      cur.visitors += c.visitors;
      cur.leads += c.leads;
      cur.hooked += c.hooked;
      m.set(c.name, cur);
    }
  return [...m.entries()].map(([axis, c]) => ({ axis, ...c }));
}

/**
 * At most 6 points (the biggest by leads, then traffic), each group as a % of its own total so a few hooked leads are
 * not flattened by hundreds of visitors. Fewer than 3 points is not a shape: empty.
 */
function radar(items: (Counts & { axis: string })[]): RadarPoint[] {
  const top = [...items].sort((a, b) => b.leads - a.leads || b.visitors - a.visitors).slice(0, 6);
  if (top.length < 3) return [];
  const sum = (k: keyof Counts) => top.reduce((n, x) => n + x[k], 0) || 1;
  const sv = sum("visitors");
  const sl = sum("leads");
  const sh = sum("hooked");
  const pct = (n: number, d: number) => Math.round((1000 * n) / d) / 10;
  return top.map((x) => ({ axis: x.axis, traffic: pct(x.visitors, sv), leads: pct(x.leads, sl), hooked: pct(x.hooked, sh) }));
}

/** "Meta · Ads · Spring sale · video-1": the credited source of one lead, for sales (Hooked leads, the lead page). */
export function sourceLine(ch: Channel): string {
  return [ch.label, ch.campaign, ch.ad].filter(Boolean).join(" · ");
}
