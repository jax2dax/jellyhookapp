// app/platform/visitors/[visitor_id]/page.tsx
// Everything Jellyhook knows about one visitor, lead or not: where they are, their device, where they came from, every
// visit drawn as on a lead page (read-only), every form they started and the tracked clicks. Any active member of the
// site may open it. Data: lib/visitors/load.ts. Design: mds/build/visitors.md.
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { loadVisitor, loadVisitorList } from "@/lib/visitors/load";
import { countryName } from "@/lib/visitors/country";
import { formatRelativeTime } from "@/lib/leadFormat";
import { LeadSessionExplorer } from "@/components/leads/LeadSessionExplorer";
import { LeadFormsCard } from "@/components/forms/LeadFormsCard";
import { collectFormActivities } from "@/jh-forms/collect";
import { VisitorPicker } from "../VisitorPicker";

export const dynamic = "force-dynamic";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value || "–"}</div>
    </div>
  );
}

const seconds = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);

export default async function VisitorPage({ params }: { params: Promise<{ visitor_id: string }> }) {
  const user = await getAuthUser();
  const site = (await requireSite(user.id)) as { id: string };
  const visitorId = decodeURIComponent((await params).visitor_id);
  const [data, recent] = await Promise.all([loadVisitor(site.id, visitorId), loadVisitorList(site.id, "all")]);

  const back = (
    <Link href="/platform/visitors" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> Back to visitors
    </Link>
  );
  if (!data.ready) return <div className="min-h-screen bg-background p-6">{back}<p className="text-sm text-red-600">{data.error}</p></div>;

  const { visitor: v, sessions, pageViews, submissions, forms, clicks, structure } = data;
  if (!v && sessions.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        {back}
        <p className="mt-8 text-center text-sm text-muted-foreground">No visitor {visitorId} on this site.</p>
      </div>
    );
  }

  const countries = [...new Set(sessions.map((s) => s.country as string | null).filter(Boolean))] as string[];
  const totalMs = pageViews.reduce((sum, p) => sum + (Number(p.time_on_page) || 0), 0);
  const scrolls = pageViews.map((p) => Number(p.max_scroll_depth ?? p.scroll_depth)).filter((n) => Number.isFinite(n) && n > 0);
  const avgScroll = scrolls.length ? Math.round(scrolls.reduce((a, b) => a + b, 0) / scrolls.length) : null;
  const activities = collectFormActivities(forms, pageViews);
  const first = sessions[0];
  const source = v?.first_utm_source ? [v.first_utm_source, v.first_utm_medium, v.first_utm_campaign].filter(Boolean).join(" / ") : (v?.first_referrer ?? first?.referrer ?? null);
  const options = recent.rows.map((r) => ({ id: r.visitorId, label: `${r.visitorId.slice(0, 8)}… · ${countryName(r.country)} · ${formatRelativeTime(r.lastSeen)}` }));

  return (
    <div className="min-h-screen space-y-6 bg-background p-6">
      <div>
        {back}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{submissions.length ? "Visitor who sent a form" : "Anonymous visitor"}</h1>
            <span className="font-mono text-xs text-muted-foreground">{visitorId}</span>
            {submissions.length > 0 && (
              <Link href={`/platform/leads/${submissions[submissions.length - 1].id}`} className="text-xs text-primary hover:underline">
                Open the lead page
              </Link>
            )}
          </div>
          <VisitorPicker current={visitorId} options={options} />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 md:grid-cols-4 lg:grid-cols-6">
        <Fact label="Country" value={countries.length ? countries.map(countryName).join(", ") : "Unknown"} />
        <Fact label="Device" value={[v?.device_type, v?.browser, v?.os].filter(Boolean).join(" · ")} />
        <Fact label="Language" value={v?.language} />
        <Fact label="Time zone" value={first?.timezone} />
        <Fact label="Came from" value={source || "Direct"} />
        <Fact label="First page" value={v?.first_landing_path ? <span className="font-mono text-xs">{v.first_landing_path}</span> : null} />
        <Fact label="First seen" value={v?.first_seen ? `${new Date(v.first_seen).toLocaleString()} (${formatRelativeTime(v.first_seen)})` : null} />
        <Fact label="Last seen" value={v?.last_seen ? formatRelativeTime(v.last_seen) : null} />
        <Fact label="Visits" value={String(sessions.length)} />
        <Fact label="Pages viewed" value={String(pageViews.length)} />
        <Fact label="Time on site" value={seconds(totalMs)} />
        <Fact label="Average scroll" value={avgScroll === null ? null : `${avgScroll}%`} />
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">Visits</h2>
        {sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No visits recorded.</p>
        ) : (
          <Suspense fallback={<div className="py-6 text-center text-sm text-muted-foreground">Loading visits…</div>}>
            <LeadSessionExplorer
              siteId={site.id}
              visitorId={visitorId}
              deviceType={v?.device_type}
              initialSessionRows={sessions}
              initialPageViewRows={pageViews}
              initialSubmissionRows={submissions}
              initialStructureRows={structure}
              initialFormEngagementRows={forms}
              readOnly
            />
          </Suspense>
        )}
      </section>

      {activities.length > 0 ? <LeadFormsCard activities={activities} references={{}} /> : <p className="text-sm text-muted-foreground">No form started.</p>}

      {clicks.length > 0 && (
        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">Tracked clicks</h2>
          <ul className="space-y-1 text-sm">
            {clicks.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-40 shrink-0 text-muted-foreground">{new Date(c.clicked_at).toLocaleString()}</span>
                <span className="text-foreground">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.page_path}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
