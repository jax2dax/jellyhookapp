"use client";
// components/showcase/DemoLeadPage.tsx
// A sample lead's own page inside the interactive demo (/platform/leads/<id> in the demo's address bar): who they are,
// their form answers, every visit drawn with the real visit chart (FramePlateChart) and frame details
// (SelectedFrameDetails), the visits in words (lib/leadSessions/story.ts, the same text the real lead page and hook
// messages use) and the time on each form field. Built from the sample site's journeys (./sampleSite.ts), so the marks
// and hooks built in the demo and this page describe the same made-up visits. Nothing is real; the page says so.
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { FramePlateChart, type TimelineItem } from "@/framePlate";
import type { PageVisitRaw, SectionTime, SessionRaw } from "@/framePlate/types";
import { SelectedFrameDetails } from "@/components/leads/SelectedFrameDetails";
import { journeyStory, sessionStory, shortDuration } from "@/lib/leadSessions/story";
import type { Journey } from "@/jh-marks/v2/check";
import type { LeadRow } from "@/components/leads/LeadsTable";
import { headingsOf, SAMPLE_FIELDS } from "./sampleSite";

const VIEWPORT = 900;

/** The sample journey as the visit chart's sessions. Page height grows with the page's headings; scroll reaches the share seen. */
export function journeyToSessions(j: Journey): SessionRaw[] {
  return j.sessions.map((s, si) => {
    const last = si === j.sessions.length - 1;
    const visits: PageVisitRaw[] = s.pages.map((p, pi) => {
      const heads = headingsOf(p.path);
      const pageHeightPx = 1400 + heads.length * 520;
      const vFrac = VIEWPORT / pageHeightPx;
      const seen = Math.min(1, Math.max(vFrac, (p.seenPct ?? 50) / 100));
      const ms = p.ms ?? 0;
      const heard = p.headings ?? new Map<string, number>();
      const scrollTo = Math.max(0, Math.min(1, (seen - vFrac) / (1 - vFrac)));
      const headers = heads.map((h, i) => ({ text: h.text, y: Math.min(0.95, 0.04 + (i / Math.max(1, heads.length)) * 0.9) }));
      const sections: SectionTime[] = heads
        .filter((h) => heard.has(h.key))
        .map((h) => ({ text: h.text, ms: heard.get(h.key) ?? 0, entries: 1, isTop: false, subs: [] }));
      const converted = last && pi === s.pages.length - 1;
      const v: PageVisitRaw = {
        id: `${s.id}-p${pi + 1}`,
        pagePath: p.path,
        enteredAt: new Date(p.enteredAt).toISOString(),
        leftAt: new Date(p.enteredAt + ms).toISOString(),
        pageHeightPx,
        viewportHeightPx: VIEWPORT,
        scrollTrace: [
          { t: 0, y: 0 },
          { t: Math.round(ms * 0.55), y: scrollTo * 0.8 },
          { t: ms, y: scrollTo },
        ],
        headers,
        sections: sections.length ? sections : null,
        converted,
      };
      if (converted) Object.assign(v, { formTopY: Math.round(pageHeightPx * 0.35), formBottomY: Math.round(pageHeightPx * 0.8), formStatus: "submitted", formFieldCount: j.form?.fieldKeys?.length ?? 6 });
      return v;
    });
    return { id: s.id, visitorId: j.leadId, startedAt: new Date(s.startedAt).toISOString(), endedAt: new Date(s.startedAt + (s.ms ?? 0)).toISOString(), visits };
  });
}

const fieldLabel = (key: string) => (key === "name" ? "Name" : key === "email" ? "Email" : SAMPLE_FIELDS.find((f) => f.key === key)?.name ?? key);
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function DemoLeadPage({ lead, journey, onBack }: { lead: LeadRow | undefined; journey: Journey | undefined; onBack: () => void }) {
  const sessions = React.useMemo(() => (journey ? journeyToSessions(journey) : []), [journey]);
  const [open, setOpen] = React.useState(() => Math.max(0, sessions.length - 1));
  const [selected, setSelected] = React.useState<{ item: TimelineItem; isLastVisit: boolean } | null>(null);

  if (!lead || !journey) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        This sample lead does not exist.{" "}
        <button type="button" onClick={onBack} className="text-primary underline-offset-2 hover:underline">
          Back to Leads
        </button>
      </div>
    );
  }

  const pages = journey.sessions.reduce((n, s) => n + s.pages.length, 0);
  const onSite = journey.sessions.reduce((n, s) => n + (s.ms ?? 0), 0);
  const toConvert = journey.submittedAt - journey.sessions[0].startedAt;
  const answers = Object.entries(journey.answers ?? {}).filter(([k]) => k !== "name" && k !== "email");
  const timings = journey.form?.timings ? Object.entries(journey.form.timings).sort((a, b) => (a[1].firstFocusAt ?? 0) - (b[1].firstFocusAt ?? 0)) : [];
  const slowest = Math.max(1, ...timings.map(([, t]) => t.focusedMs ?? 0));
  const session = sessions[open];

  return (
    <div className="space-y-4 p-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Leads
      </button>

      {/* who */}
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{lead.name}</h2>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">Converted</span>
            {lead.qualified === true && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">Qualified</span>}
            {lead.qualified === false && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-400">Junk</span>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lead.email} · sent the form on {lead.page_path} · {when(journey.submittedAt)} · {journey.device}
          </p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">Sample data</span>
      </div>

      {/* numbers */}
      <div className="grid grid-cols-4 divide-x rounded-xl border bg-card">
        {[
          ["Visits", String(journey.sessions.length)],
          ["Pages viewed", String(pages)],
          ["Time on the site", shortDuration(onSite)],
          ["First visit to form", shortDuration(toConvert)],
        ].map(([k, v]) => (
          <div key={k} className="p-3">
            <div className="text-[11px] text-muted-foreground">{k}</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{v}</div>
          </div>
        ))}
      </div>

      <Card title="Their whole journey">
        <p className="text-sm leading-relaxed text-muted-foreground">{journeyStory(sessions, VIEWPORT)}</p>
      </Card>

      {/* each visit on the real chart */}
      <Card
        title="Visits"
        right={
          <div className="flex gap-1">
            {sessions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setOpen(i);
                  setSelected(null);
                }}
                className={"h-7 rounded-md border px-2 text-xs " + (i === open ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted")}
              >
                Visit {i + 1}
                {i === sessions.length - 1 ? " · form" : ""}
              </button>
            ))}
          </div>
        }
      >
        {session && (
          <>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{sessionStory(session, open + 1, VIEWPORT)}</p>
            <div className="rounded-lg border bg-background p-3">
              <FramePlateChart key={session.id} session={session} deviceType={journey.device === "mobile" ? "mobile" : "desktop"} onSelectItem={(item, meta) => setSelected(item ? { item, isLastVisit: meta.isLastVisit } : null)} className="w-full" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Click a page in the chart to see where they read and how long.</p>
            {selected && (
              <div className="mt-3">
                <SelectedFrameDetails item={selected.item} isLastVisit={selected.isLastVisit} onClose={() => setSelected(null)} />
              </div>
            )}
          </>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Submitted form">
          <dl className="space-y-2 text-sm">
            {answers.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] text-muted-foreground">{fieldLabel("custom:" + k)}</dt>
                <dd className="text-foreground">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Time on each form field">
          <ul className="space-y-2">
            {timings.map(([k, t]) => (
              <li key={k} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                <span className="truncate text-muted-foreground">{fieldLabel(k)}</span>
                <span className="h-1.5 rounded-full bg-muted">
                  <span className={"block h-full rounded-full " + (t.focusedMs === slowest ? "bg-primary" : "bg-muted-foreground/50")} style={{ width: ((t.focusedMs ?? 0) / slowest) * 100 + "%" }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{shortDuration(t.focusedMs ?? 0)}</span>
              </li>
            ))}
          </ul>
          {journey.form?.leftWhileFilling && <p className="mt-3 text-[11px] text-muted-foreground">They left the form while filling it and came back to finish it.</p>}
        </Card>
      </div>
    </div>
  );
}
