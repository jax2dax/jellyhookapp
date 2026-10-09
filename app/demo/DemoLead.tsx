// app/demo/DemoLead.tsx
//
// A made-up lead page, rendered with the same visit chart and frame-details components the real lead page uses
// (FramePlateChart, SelectedFrameDetails). Client component so frames are clickable, like the real thing.
// Everything on it comes from ./sampleLead.ts and is labelled as sample data.
"use client";

import * as React from "react";
import { FramePlateChart, type TimelineItem } from "@/framePlate";
import { SelectedFrameDetails } from "@/components/leads/SelectedFrameDetails";
import { buildSampleSession, SAMPLE_FIELD_TIMINGS, SAMPLE_LEAD } from "./sampleLead";

const PANEL = "border border-[#1b1b18] bg-[#0a0a09]";
const LABEL = "ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]";

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-4">
      <div className={LABEL}>{label}</div>
      <div className="mt-2 ff-display text-2xl leading-none text-[#f4f2ea]">{value}</div>
      <div className="mt-1 ff-body text-[11px] text-[#77756d]">{sub}</div>
    </div>
  );
}

export function DemoLead() {
  const session = React.useMemo(() => buildSampleSession(), []);
  const [selected, setSelected] = React.useState<{ item: TimelineItem; isLastVisit: boolean } | null>(null);
  const slowest = Math.max(...SAMPLE_FIELD_TIMINGS.map((f) => f.seconds));

  return (
    <div className="space-y-6">
      {/* profile */}
      <div className={`${PANEL} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="ff-display text-2xl text-[#f4f2ea]">{SAMPLE_LEAD.name}</h2>
              <span className="border border-[var(--lime)]/40 px-2 py-0.5 ff-mono text-[10px] uppercase tracking-[0.18em] text-[var(--lime)]">Converted</span>
            </div>
            <p className="mt-1 ff-body text-[13px] text-[#8b8980]">
              {SAMPLE_LEAD.email} · {SAMPLE_LEAD.company}
            </p>
          </div>
          <span className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#5f5d57]">Sample data</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SAMPLE_LEAD.details.map((d) => (
            <div key={d.key} className="border border-[#1b1b18] bg-[#0f0f0d] px-2.5 py-1 ff-body text-[12px]">
              <span className="text-[#77756d]">{d.key}: </span>
              <span className="text-[#e9e7e0]">{d.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* at a glance (numbers match the made-up visit below) */}
      <div className={`${PANEL} grid grid-cols-2 divide-x divide-y divide-[#1b1b18] sm:grid-cols-4 sm:divide-y-0`}>
        <Stat label="Pages read" value="4" sub="in one visit" />
        <Stat label="Time engaged" value="12m" sub="total time on page" />
        <Stat label="Avg scroll" value="80%" sub="of each page" />
        <Stat label="Time to convert" value="38m" sub="first page to form" />
      </div>

      {/* the visit chart (real component) */}
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="ff-display text-xl text-[#f4f2ea]">The visit, page by page</h3>
          <span className={LABEL}>Click a frame</span>
        </div>
        <p className="mb-3 max-w-2xl ff-body text-[13px] leading-relaxed text-[#8b8980]">
          Each column is one page this person visited. The green bands show what they scrolled past, the bright frame is where
          the form was submitted, and the purple gap is time away from the site. It is a chart, not a video.
        </p>
        <div className={`${PANEL} p-4`}>
          <FramePlateChart
            session={session}
            deviceType="desktop"
            onSelectItem={(item, meta) => setSelected(item ? { item, isLastVisit: meta.isLastVisit } : null)}
            className="w-full"
          />
        </div>
        {selected && (
          <div className="mt-3">
            <SelectedFrameDetails item={selected.item} isLastVisit={selected.isLastVisit} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>

      {/* field timing */}
      <div className={`${PANEL} p-5`}>
        <h3 className="ff-display text-xl text-[#f4f2ea]">Time on each form field</h3>
        <p className="mt-1 ff-body text-[13px] text-[#8b8980]">In the order they filled them in. The longest bar is where they paused.</p>
        <ul className="mt-4 space-y-3">
          {SAMPLE_FIELD_TIMINGS.map((f) => (
            <li key={f.label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_3rem] items-center gap-3">
              <span className="truncate ff-body text-[12px] text-[#c9c7bd]">{f.label}</span>
              <span className="h-2 bg-[#1b1b18]">
                <span className={`block h-full ${f.seconds === slowest ? "bg-[var(--lime)]" : "bg-[#5f5d57]"}`} style={{ width: `${(f.seconds / slowest) * 100}%` }} />
              </span>
              <span className="text-right ff-mono text-[11px] text-[#8b8980]">{f.seconds}s</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
