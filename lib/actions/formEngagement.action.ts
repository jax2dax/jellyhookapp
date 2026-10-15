// lib/actions/formEngagement.action.ts
// Data for /platform/form-engagement: every form interaction on the current site that was at least started, newest
// first, with the page views of each session (for pauses, other pages and time away). With a form (and its current
// version) given: only that form's rows of that version, any age. Without: the last 30 days of every form (before
// 17-form-versions.sql has run).
//
// Identity: a person is named when that VISITOR submitted a form at any time (in this visit or a later one): the
// row then shows their name and links to their lead. A visitor who never submitted anything stays anonymous
// ("Visitor ab12cd"): their form activity is still listed, only who they are is not known.
// Reads with the signed-in user's login (RLS) and pins every query to the site from requireSite.
"use server";

import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { createSupabaseClient } from "@/lib/supabase";
import { collectFormActivities, type FormActivity } from "@/jh-forms/collect";
import type { EngagementRow, PageViewRow } from "@/jh-forms/timeline";

const DAYS = 30;
const LIMIT = 100;

export interface FormEngagementItem extends FormActivity {
  /**
   * The person, when this visitor ever submitted a form: name or email, their lead id, and whether THIS form is the
   * one they submitted ("this") or they submitted another one at some point ("other"). null = anonymous.
   */
  who: { name: string | null; email: string | null; leadId: string; via: "this" | "other" } | null;
  visitorId: string | null;
}

type Sub = { id: string; session_id: string | null; visitor_id: string | null; name: string | null; email: string | null; page_path: string | null; submitted_at: string | null };

export async function getFormEngagements(filter: { form?: string | null; version?: string | null } = {}): Promise<{ items: FormEngagementItem[]; days: number | null }> {
  const user = await getAuthUser();
  const site = (await requireSite(user.id)) as { id: string };
  const supabase = createSupabaseClient();
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const scoped = typeof filter.form === "string" && filter.form.length > 0 && filter.form.length <= 300;

  let q = supabase.from("form_engagement").select("*").eq("site_id", site.id).neq("status", "viewed");
  if (scoped) {
    q = q.eq("form_key", filter.form!);
    if (typeof filter.version === "string" && /^[0-9a-f-]{36}$/i.test(filter.version)) q = q.eq("form_version_id", filter.version);
  } else q = q.gte("viewed_at", since);
  const { data: rows, error } = await q.order("viewed_at", { ascending: false }).limit(LIMIT);
  if (error) {
    console.error("[form-engagement] form_engagement:", error.message);
    return { items: [], days: scoped ? null : DAYS };
  }
  const sessionIds = [...new Set((rows ?? []).map((r) => r.session_id).filter(Boolean))];
  const visitorIds = [...new Set((rows ?? []).map((r) => r.visitor_id).filter(Boolean))];
  const [pv, subs] = await Promise.all([
    sessionIds.length
      ? supabase.from("page_views").select("page_view_id, session_id, page_path, entered_at, left_at").eq("site_id", site.id).in("session_id", sessionIds)
      : Promise.resolve({ data: [] as PageViewRow[] }),
    // every submission by these visitors, at any time: a later submission names an earlier, abandoned form
    visitorIds.length
      ? supabase.from("form_submissions").select("id, session_id, visitor_id, name, email, page_path, submitted_at").eq("site_id", site.id).in("visitor_id", visitorIds).order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [] as Sub[] }),
  ]);

  const activities = collectFormActivities((rows ?? []) as EngagementRow[], (pv.data ?? []) as PageViewRow[]);
  const visitorOf = new Map((rows ?? []).map((r) => [String(r.id), (r.visitor_id as string | null) ?? null]));
  const subsByVisitor = new Map<string, Sub[]>();
  for (const s of (subs.data ?? []) as Sub[]) {
    if (!s.visitor_id) continue;
    subsByVisitor.set(s.visitor_id, [...(subsByVisitor.get(s.visitor_id) ?? []), s]);
  }

  const items: FormEngagementItem[] = activities.map((a) => {
    const visitorId = visitorOf.get(a.id) ?? null;
    const theirs = visitorId ? subsByVisitor.get(visitorId) ?? [] : [];
    // the submission of THIS form: same session and page; otherwise their most recent submission (newest first)
    const own = a.status === "submitted" ? theirs.find((s) => s.session_id === a.sessionId && (s.page_path === a.page || !s.page_path)) : undefined;
    const pick = own ?? theirs[0];
    return {
      ...a,
      visitorId,
      who: pick ? { name: pick.name, email: pick.email, leadId: pick.id, via: own ? "this" : "other" } : null,
    };
  });
  return { items, days: scoped ? null : DAYS };
}
