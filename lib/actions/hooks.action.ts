// lib/actions/hooks.action.ts
// Hooked leads: the leads a hook (a notification rule, lib/actions/notifications.action.ts) caught, newest first, one
// row per lead with every hook that caught it. From notification_events (one per hook and lead). Any active member of
// the site sees them. Used by Hooks → Hooked leads and the dashboard.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { channelOf, creditedVisit, type VisitSource } from "@/lib/acquisition/channel";
import { LOOKBACK_DAYS, sourceLine } from "@/lib/acquisition/report";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface HookedLead {
  leadId: string;
  name: string | null;
  email: string | null;
  page: string | null;
  submittedAt: string | null;
  /** when the first hook caught them */
  hookedAt: string;
  hooks: { id: string; name: string }[];
  /** where they came from, credited like the Acquisition page (last non-direct): "Meta · Ads · Spring sale · video-1" */
  source: string | null;
}

/** For each lead, the source credited for it (last non-direct visit up to sending). */
async function sourcesOf(siteId: string, leads: { id: string; visitor_id: string | null; submitted_at: string }[], siteHost: string | null): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const visitors = [...new Set(leads.map((l) => l.visitor_id).filter((v): v is string => !!v))];
  if (!visitors.length) return out;
  const base = "visitor_id, started_at, referrer, utm_source, utm_medium, utm_campaign";
  const read = async (cols: string) => {
    const r = await admin.from("sessions").select(cols).eq("site_id", siteId).in("visitor_id", visitors).order("started_at").limit(1000);
    return { data: (r.data ?? []) as unknown as (VisitSource & { visitor_id: string; started_at: string })[], error: r.error };
  };
  let res = await read(base + ", utm_content, utm_term, click_id, landing_path");
  if (res.error) res = await read(base); // before migration 24
  const rows = res.data;
  for (const l of leads) {
    const sent = Date.parse(l.submitted_at);
    const visits = rows.filter((s) => s.visitor_id === l.visitor_id && Date.parse(s.started_at) <= sent && Date.parse(s.started_at) >= sent - LOOKBACK_DAYS * 86_400_000);
    const chans = visits.map((s) => channelOf(s, siteHost));
    const i = creditedVisit(chans, "lastNonDirect");
    if (i >= 0) out.set(l.id, sourceLine(chans[i]));
  }
  return out;
}

export async function loadHookedLeads(limit = 100): Promise<{ ok: true; ready: boolean; leads: HookedLead[] } | { ok: false; error: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
    const siteId = await siteOrThrow();
    const { data: member } = await admin.from("site_members").select("user_id").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (!member) return { ok: false, error: "You are not a member of this site." };
    const { data: events, error } = await admin.from("notification_events").select("rule_id, lead_id, created_at").eq("site_id", siteId).order("created_at", { ascending: false }).limit(Math.min(500, limit * 5));
    if (error) {
      if (/notification_events/.test(error.message)) return { ok: true, ready: false, leads: [] };
      throw new Error(error.message);
    }
    const leadIds = [...new Set((events ?? []).map((e) => e.lead_id as string))].slice(0, limit);
    const ruleIds = [...new Set((events ?? []).map((e) => e.rule_id as string))];
    if (!leadIds.length) return { ok: true, ready: true, leads: [] };
    const [leadsRes, rulesRes, siteRes] = await Promise.all([
      admin.from("form_submissions").select("id, visitor_id, name, email, page_path, submitted_at").eq("site_id", siteId).in("id", leadIds),
      admin.from("notification_rules").select("id, name").eq("site_id", siteId).in("id", ruleIds),
      admin.from("sites").select("domain").eq("id", siteId).maybeSingle(),
    ]);
    const sources = await sourcesOf(siteId, (leadsRes.data ?? []) as { id: string; visitor_id: string | null; submitted_at: string }[], (siteRes.data?.domain as string) ?? null).catch(() => new Map<string, string>());
    const lead = new Map((leadsRes.data ?? []).map((l) => [l.id as string, l]));
    const rule = new Map((rulesRes.data ?? []).map((r) => [r.id as string, r.name as string]));
    const out: HookedLead[] = [];
    for (const id of leadIds) {
      const l = lead.get(id);
      if (!l) continue; // the lead was deleted
      const mine = (events ?? []).filter((e) => e.lead_id === id);
      const hooks = [...new Map(mine.map((e) => [e.rule_id as string, { id: e.rule_id as string, name: rule.get(e.rule_id as string) ?? "A deleted hook" }])).values()];
      out.push({
        leadId: id,
        name: (l.name as string) ?? null,
        email: (l.email as string) ?? null,
        page: (l.page_path as string) ?? null,
        submittedAt: (l.submitted_at as string) ?? null,
        hookedAt: mine.reduce((a, e) => ((e.created_at as string) < a ? (e.created_at as string) : a), mine[0].created_at as string),
        hooks,
        source: sources.get(id) ?? null,
      });
    }
    return { ok: true, ready: true, leads: out };
  } catch (e) {
    console.error("[hooks] load failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Hooked leads could not be loaded." };
  }
}
