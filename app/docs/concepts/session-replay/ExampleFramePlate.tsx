// app/docs/concepts/session-replay/ExampleFramePlate.tsx
//
// The actual FramePlateChart component, rendered against a hand-built
// example session, with real click-to-inspect (SelectedFrameDetails) —
// the same production component the dashboard uses on a lead's page.
// Not a screenshot, not a redrawn approximation.
"use client";

import * as React from "react";
import { FramePlateChart, type TimelineItem } from "@/framePlate";
import { SelectedFrameDetails } from "@/components/leads/SelectedFrameDetails";
import { buildExampleSession } from "./exampleSession";

export function ExampleFramePlate() {
  const [selected, setSelected] = React.useState<{ item: TimelineItem; isLastVisit: boolean } | null>(null);
  // Built fresh per mount (client-side, whenever a real visitor actually
  // loads this page) via useMemo, not a module-level constant — see
  // exampleSession.ts's header comment for why that distinction is the
  // whole fix.
  const exampleSession = React.useMemo(() => buildExampleSession(), []);

  return (
    <div>
      <div className="rounded-md border border-[#1b1b18] bg-[#0a0a09] p-4">
        <FramePlateChart
          session={exampleSession}
          deviceType="desktop"
          onSelectItem={(item, meta) => setSelected(item ? { item, isLastVisit: meta.isLastVisit } : null)}
          className="w-full"
        />
      </div>
      <p className="mt-2 ff-body text-[12px] text-[#77756d]">Click any frame above. This is the exact detail panel a real dashboard shows.</p>
      {selected && (
        <div className="mt-3">
          <SelectedFrameDetails item={selected.item} isLastVisit={selected.isLastVisit} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
