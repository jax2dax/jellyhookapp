// lib/actions/hooks.action.ts
// Hooked leads: the leads a hook (a notification rule, lib/actions/notifications.action.ts) caught, newest first, one
// row per lead with every hook that caught it. From notification_events (one per hook and lead). Any active member of
// the site sees them. Used by Hooks → Hooked leads and the dashboard.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";

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
    const [leadsRes, rulesRes] = await Promise.all([
      admin.from("form_submissions").select("id, name, email, page_path, submitted_at").eq("site_id", siteId).in("id", leadIds),
      admin.from("notification_rules").select("id, name").eq("site_id", siteId).in("id", ruleIds),
    ]);
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
      });
    }
    return { ok: true, ready: true, leads: out };
  } catch (e) {
    console.error("[hooks] load failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Hooked leads could not be loaded." };
  }
}
