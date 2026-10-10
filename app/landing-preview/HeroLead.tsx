// app/landing-preview/HeroLead.tsx
//
// The hero visual of the landing-page preview: the made-up sample lead (app/demo/sampleLead.ts) drawn by the real
// visit chart and the real page-details panel, with a plain-sentence summary on top so it reads in a few seconds.
// Wrapped in `.dark` so the chart and panel use their dark tokens even when the visitor's system theme is light
// (the marketing pages are always dark).
//
// Keyboard and touch: the chart's frames are mouse-only, so a page list under it selects the same items. The converted
// page starts selected, so the value shows without any interaction.
"use client";

import * as React from "react";
import { FramePlateChart, buildTimeline, formatFrameDuration, type TimelineItem } from "@/framePlate";
import { SelectedFrameDetails } from "@/components/leads/SelectedFrameDetails";
import { buildSampleSession, SAMPLE_FIELD_TIMINGS, SAMPLE_LEAD } from "@/app/demo/sampleLead";

type VisitItem = Extract<TimelineItem, { kind: "visit" }>;

// Readable names for the sample fixture's paths (a cold reader takes "/" for a bug).
const PAGE_NAME: Record<string, string> = { "/": "Home", "/features": "Features", "/pricing": "Pricing", "/demo-request": "Demo request" };

export function HeroLead() {
  const session = React.useMemo(() => buildSampleSession(), []);
  const visits = React.useMemo(() => buildTimeline(session).filter((i): i is VisitItem => i.kind === "visit"), [session]);
  const converted = visits.find((v) => v.outcome === "converted") ?? visits[visits.length - 1] ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(converted?.id ?? null);
  const selected = visits.find((v) => v.id === selectedId) ?? null;
  const lastId = visits[visits.length - 1]?.id;
  const slowest = SAMPLE_FIELD_TIMINGS.reduce((a, f) => (f.seconds > a.seconds ? f : a), SAMPLE_FIELD_TIMINGS[0]);

  return (
    <div className="dark">
      <div className="border border-[#1b1b18] bg-[#0a0a09]">
        <div className="flex items-center justify-between gap-3 border-b border-[#1b1b18] px-4 py-3">
          <span className="truncate ff-mono text-[11px] uppercase tracking-[0.2em] text-[#8b8980]">Lead page · {SAMPLE_LEAD.name}</span>
          <span className="shrink-0 border border-[#5f5d57] bg-[#0f0f0d] px-2 py-0.5 ff-mono text-[11px] uppercase tracking-[0.2em] text-[#8b8980]">Sample data</span>
        </div>

        <p className="px-4 pt-4 ff-body text-[17px] leading-[1.5] text-[#f4f2ea]">
          Read the home page, Features and Pricing, left for 26 minutes, came back and sent the demo form. Longest field: &ldquo;{slowest.label}&rdquo; (
          {slowest.seconds} s).
        </p>

        <div className="overflow-x-auto px-2 pt-3" aria-hidden="true">
          <FramePlateChart
            session={session}
            deviceType="desktop"
            onSelectItem={(item) => {
              if (item && item.kind === "visit") setSelectedId(item.id);
            }}
            className="w-full"
          />
        </div>

        <div className="border-t border-[#1b1b18] px-4 py-3">
          <div className="mb-2 ff-mono text-[11px] uppercase tracking-[0.2em] text-[#8b8980]">Pages, in order</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Pages in this sample visit">
            {visits.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedId(v.id)}
                aria-pressed={v.id === selectedId}
                data-track-click="landing-sample-page"
                className={`min-h-11 border px-3 py-2 text-left ff-mono text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lime)] ${
                  v.id === selectedId ? "border-[var(--lime)] text-[#f4f2ea]" : "border-[#5f5d57] text-[#9d9b92] hover:text-[#f4f2ea]"
                }`}
              >
                {PAGE_NAME[v.pagePath] ?? v.pagePath} · {v.outcome === "converted" ? "form sent" : formatFrameDuration(v.durationMs)}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="px-4 pb-4">
            <SelectedFrameDetails item={selected} isLastVisit={selected.id === lastId} onClose={() => setSelectedId(null)} />
          </div>
        )}

        <div className="border-t border-[#1b1b18] px-4 py-4">
          <div className="mb-3 ff-mono text-[11px] uppercase tracking-[0.2em] text-[#8b8980]">Time on each form field</div>
          <ul className="space-y-2">
            {SAMPLE_FIELD_TIMINGS.map((f) => (
              <li key={f.label} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_2.5rem] items-center gap-3">
                <span className="truncate ff-body text-[12px] text-[#9d9b92]">{f.label}</span>
                <span className="h-2 bg-[#1b1b18]" aria-hidden="true">
                  <span className={`block h-full ${f === slowest ? "bg-[var(--lime)]" : "bg-[#5f5d57]"}`} style={{ width: `${(f.seconds / slowest.seconds) * 100}%` }} />
                </span>
                <span className="text-right ff-mono text-[12px] text-[#9d9b92]">{f.seconds}s</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 ff-body text-[14px] text-[#8b8980]">A made-up lead, drawn by the same page your real leads get.</p>
    </div>
  );
}
