// lib/actions/formActivities.action.ts
// Data for /platform/form-activities: every form interaction on the current site that was at least started, newest
// first, with the page views of each session (for pauses, other pages and time away) and the lead's name when the
// person submitted. Reads with the signed-in user's login (RLS) and pins every query to the site from requireSite.
"use server";

import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { createSupabaseClient } from "@/lib/supabase";
import { collectFormActivities, type FormActivity } from "@/jh-forms/collect";
import type { EngagementRow, PageViewRow } from "@/jh-forms/timeline";

const DAYS = 30;
const LIMIT = 100;

export interface FormActivityItem extends FormActivity {
  /** the lead's name or email when this session submitted a form, else null (shown as an anonymous visitor) */
  who: { name: string | null; email: string | null; leadId: string | null } | null;
  visitorId: string | null;
}

export async function getFormActivities(): Promise<{ items: FormActivityItem[]; siteDomain: string | null; days: number }> {
  const user = await getAuthUser();
  const site = (await requireSite(user.id)) as { id: string; domain?: string };
  const supabase = createSupabaseClient();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

  const { data: rows, error } = await supabase
    .from("form_engagement")
    .select("*")
    .eq("site_id", site.id)
    .neq("status", "viewed")
    .gte("viewed_at", since)
    .order("viewed_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    console.error("[form-activities] form_engagement:", error.message);
    return { items: [], siteDomain: site.domain ?? null, days: DAYS };
  }
  const sessionIds = [...new Set((rows ?? []).map((r) => r.session_id).filter(Boolean))];
  const [pv, subs] = sessionIds.length
    ? await Promise.all([
        supabase.from("page_views").select("page_view_id, session_id, page_path, entered_at, left_at").eq("site_id", site.id).in("session_id", sessionIds),
        supabase.from("form_submissions").select("id, session_id, name, email, page_path, submitted_at").eq("site_id", site.id).in("session_id", sessionIds),
      ])
    : [{ data: [] as PageViewRow[] }, { data: [] as { id: string; session_id: string; name: string | null; email: string | null; page_path: string | null }[] }];

  const activities = collectFormActivities((rows ?? []) as EngagementRow[], (pv.data ?? []) as PageViewRow[]);
  const visitorOf = new Map((rows ?? []).map((r) => [String(r.id), r.visitor_id as string | null]));
  const items: FormActivityItem[] = activities.map((a) => {
    // a submitted interaction belongs to the submission of the same session and page
    const s = a.status === "submitted" ? (subs.data ?? []).find((x) => x.session_id === a.sessionId && (x.page_path === a.page || !x.page_path)) : null;
    return { ...a, who: s ? { name: s.name, email: s.email, leadId: s.id } : null, visitorId: visitorOf.get(a.id) ?? null };
  });
  return { items, siteDomain: site.domain ?? null, days: DAYS };
}
