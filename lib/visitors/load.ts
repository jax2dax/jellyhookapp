// lib/visitors/load.ts
// Every visitor of one site, leads or not, for the Visitors pages (app/platform/visitors). The pages call
// requireSite first (an active member of the site); this reads with the service role, so the caller must only pass
// the site id that check returned. Design: mds/build/visitors.md.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { fetchStructureRows } from "@/lib/leadSessions/structureRows";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** How many visitors the list shows, newest first. */
export const VISITOR_LIST_LIMIT = 150;

export interface VisitorListRow {
  visitorId: string;
  firstSeen: string | null;
  lastSeen: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  source: string | null;
  landing: string | null;
  visits: number;
  /** the furthest any of their forms got: started, abandoned or submitted; null when they never typed */
  form: "started" | "abandoned" | "submitted" | null;
  /** their newest lead, when they sent a form */
  leadId: string | null;
}

const FORM_RANK = { started: 1, abandoned: 2, submitted: 3 } as const;

export async function loadVisitorList(siteId: string, filter: "anonymous" | "all"): Promise<{ site: { domain: string | null; name: string | null } | null; rows: VisitorListRow[]; error?: string }> {
  const [site, visitors] = await Promise.all([
    db.from("sites").select("domain, name").eq("id", siteId).maybeSingle(),
    db.from("visitors").select("*").eq("site_id", siteId).order("last_seen", { ascending: false, nullsFirst: false }).limit(filter === "all" ? VISITOR_LIST_LIMIT : VISITOR_LIST_LIMIT * 2),
  ]);
  if (visitors.error) return { site: site.data ?? null, rows: [], error: visitors.error.message };
  const ids = [...new Set((visitors.data ?? []).map((v) => v.visitor_id as string).filter(Boolean))];
  if (!ids.length) return { site: site.data ?? null, rows: [] };

  const [subs, sessions, forms] = await Promise.all([
    db.from("form_submissions").select("id, visitor_id, submitted_at").eq("site_id", siteId).in("visitor_id", ids).order("submitted_at", { ascending: false }),
    db.from("sessions").select("visitor_id, country, started_at").eq("site_id", siteId).in("visitor_id", ids).order("started_at", { ascending: false }).limit(5000),
    db.from("form_engagement").select("visitor_id, status").eq("site_id", siteId).in("visitor_id", ids).in("status", ["started", "abandoned", "submitted"]).limit(5000),
  ]);

  const lead = new Map<string, string>();
  for (const s of subs.data ?? []) if (!lead.has(s.visitor_id)) lead.set(s.visitor_id, s.id);
  const visits = new Map<string, number>();
  const country = new Map<string, string>();
  for (const s of sessions.data ?? []) {
    visits.set(s.visitor_id, (visits.get(s.visitor_id) ?? 0) + 1);
    if (s.country && !country.has(s.visitor_id)) country.set(s.visitor_id, s.country);
  }
  const form = new Map<string, VisitorListRow["form"]>();
  for (const f of forms.data ?? []) {
    const st = f.status as keyof typeof FORM_RANK;
    const prev = form.get(f.visitor_id);
    if (!prev || FORM_RANK[st] > FORM_RANK[prev]) form.set(f.visitor_id, st);
  }

  const rows: VisitorListRow[] = [];
  for (const v of visitors.data ?? []) {
    const id = v.visitor_id as string;
    if (!id || (filter === "anonymous" && lead.has(id))) continue;
    rows.push({
      visitorId: id,
      firstSeen: v.first_seen ?? v.first_touch_at ?? null,
      lastSeen: v.last_seen ?? null,
      device: v.device_type ?? null,
      browser: v.browser ?? null,
      os: v.os ?? null,
      country: country.get(id) ?? null,
      source: v.first_utm_source ?? v.first_referrer ?? null,
      landing: v.first_landing_path ?? null,
      visits: visits.get(id) ?? 0,
      form: form.get(id) ?? null,
      leadId: lead.get(id) ?? null,
    });
    if (rows.length >= VISITOR_LIST_LIMIT) break;
  }
  return { site: site.data ?? null, rows };
}

/** Everything about one visitor, in the shapes the lead page's visit chart and form card take. */
export async function loadVisitor(siteId: string, visitorId: string) {
  const [site, visitor, sessions, pageViews, submissions, forms, clicks] = await Promise.all([
    db.from("sites").select("domain, name").eq("id", siteId).maybeSingle(),
    db.from("visitors").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("last_seen", { ascending: false }).limit(1),
    db.from("sessions").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("started_at", { ascending: true }),
    db.from("page_views").select("*").eq("site_id", siteId).eq("visitor_id", visitorId).order("entered_at", { ascending: true }),
    db.from("form_submissions").select("id, session_id, page_path, submitted_at, form_key").eq("site_id", siteId).eq("visitor_id", visitorId).order("submitted_at", { ascending: true }),
    db.from("form_engagement").select("*").eq("site_id", siteId).eq("visitor_id", visitorId),
    db.from("click_events").select("name, page_path, clicked_at").eq("site_id", siteId).eq("visitor_id", visitorId).order("clicked_at", { ascending: true }).limit(200),
  ]);
  if (sessions.error || pageViews.error) return { ready: false as const, error: (sessions.error ?? pageViews.error)!.message };
  const paths = [...new Set((pageViews.data ?? []).map((v) => v.page_path as string).filter(Boolean))];
  const structure = await fetchStructureRows(db, siteId, paths);
  return {
    ready: true as const,
    site: site.data ?? null,
    visitor: visitor.data?.[0] ?? null,
    sessions: sessions.data ?? [],
    pageViews: pageViews.data ?? [],
    submissions: submissions.data ?? [],
    forms: forms.data ?? [],
    clicks: clicks.data ?? [],
    structure,
  };
}
