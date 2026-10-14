// jh-forms/collect.ts
// Builds the timelines for a set of form interactions (a lead's, or a site's recent ones) from the raw rows. Pure.
import { buildFormTimeline, type EngagementRow, type FormTimeline, type PageViewRow } from "./timeline";

export interface FormActivity {
  id: string;
  sessionId: string;
  page: string | null;
  status: string;
  seenAt: string | null;
  timeline: FormTimeline;
}

const STATUS_RANK: Record<string, number> = { submitted: 0, abandoned: 1, started: 2, viewed: 3 };

/** Every interaction that was at least started, newest first, submitted ones before the rest of the same day. */
export function collectFormActivities(rows: EngagementRow[], pageViews: PageViewRow[], opts: { includeViewedOnly?: boolean } = {}): FormActivity[] {
  const bySession = new Map<string, PageViewRow[]>();
  for (const p of pageViews) {
    if (!p?.session_id) continue;
    const list = bySession.get(p.session_id) ?? [];
    list.push(p);
    bySession.set(p.session_id, list);
  }
  return rows
    .filter((r) => r && (opts.includeViewedOnly || r.status !== "viewed"))
    .map((r) => ({
      id: String(r.id ?? r.session_id + ":" + r.page_path + ":" + r.form_index),
      sessionId: r.session_id,
      page: r.page_path,
      status: r.status,
      seenAt: r.viewed_at,
      timeline: buildFormTimeline(r, bySession.get(r.session_id) ?? []),
    }))
    .sort((a, b) => (new Date(b.seenAt ?? 0).getTime() - new Date(a.seenAt ?? 0).getTime()) || (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
}
