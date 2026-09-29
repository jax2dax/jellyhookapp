// components/leads/ChartLegend.tsx
//
// The "i" button above the session chart — click to reveal a color key for
// what the chart is actually drawing (frame background = outcome, bulb
// color = trigger point). Reads colors straight from framePlate's
// defaultTheme rather than hardcoding its own copies, so this stays correct
// automatically if those values ever change — none of the fields used here
// (bulbs, backgroundByOutcome, seenOnce, header, referenceLine) vary by
// device preset (see framePlate/theme/deviceThemes.ts), so defaultTheme is
// the same theme the chart itself is actually drawing with today. Once
// per-user color customization exists, both this and the chart should read
// from that same resolved theme instead — this component is already built
// against "the theme," not a duplicated palette, so that swap is contained.
"use client";

import * as React from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";
import { defaultTheme } from "@/framePlate/theme/defaultTheme";
import type { FrameOutcome } from "@/framePlate/types";

// Only outcomes real code actually assigns today — "active" and "expired"
// exist in the type/theme for future use but nothing currently produces
// them, and listing colors that never appear on a real chart would just be
// confusing.
const FRAME_LEGEND: { outcome: FrameOutcome; label: string }[] = [
  { outcome: "converted", label: "Form submitted on this page" },
  { outcome: "abandoned", label: "Form started here, never submitted" },
  { outcome: "exitedNormally", label: "Left this page normally" },
  { outcome: "away", label: "Left the site, came back later" },
  { outcome: "live", label: "Still on this page right now" },
];

const AUTO_CLOSE_MS = 20_000;

function FrameSwatch({ color }: { color: string }) {
  return <span className="inline-block h-3.5 w-5 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden />;
}

function BulbSwatch({ color }: { color: string }) {
  return <span className="inline-block h-1.5 w-4 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />;
}

function HeaderZigzagSwatch({ color }: { color: string }) {
  return (
    <svg width={20} height={10} viewBox="0 0 20 10" aria-hidden className="shrink-0">
      <polyline points="0,7 4,3 8,7 12,3 16,7 20,3" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashedLineSwatch({ color, dashArray }: { color: string; dashArray: string }) {
  return (
    <svg width={20} height={10} viewBox="0 0 20 10" aria-hidden className="shrink-0">
      <line x1={0} y1={5} x2={20} y2={5} stroke={color} strokeWidth={1.5} strokeDasharray={dashArray} />
    </svg>
  );
}

export function ChartLegend() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  const { bulbs, header, referenceLine, seenOnce, frame } = defaultTheme;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chart color key"
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Info className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Chart color key"
          className="absolute left-0 top-full z-30 mt-2 w-[min(90vw,520px)] rounded-lg border bg-white text-black shadow-lg dark:bg-black dark:text-white"
        >
          <div className="flex items-start justify-between border-b px-4 py-3">
            <div className="text-sm font-medium">Chart color key</div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2">
            {/* ── Left half: frame background = what happened on that page visit ── */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frames</div>
              <ul className="space-y-2">
                {FRAME_LEGEND.map(({ outcome, label }) => (
                  <li key={outcome} className="flex items-center gap-2.5 text-sm">
                    <FrameSwatch color={frame.backgroundByOutcome[outcome]} />
                    <span>{label}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2.5 text-sm">
                  <FrameSwatch color={seenOnce.color} />
                  <span>Content the visitor actually scrolled past</span>
                </li>
              </ul>
            </div>

            {/* ── Right half: bulbs (edge markers) + the other per-plate marks ── */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bulb</div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2.5 text-sm">
                  <BulbSwatch color={bulbs.converted.color} />
                  <span>Form&apos;s location on the page</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <BulbSwatch color={bulbs.enter.color} />
                  <span>Page entered here</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <BulbSwatch color={bulbs.exit.color} />
                  <span>Page exited here</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <BulbSwatch color={bulbs.deepestScroll.color} />
                  <span>Furthest point ever seen</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <HeaderZigzagSwatch color={header.color} />
                  <span>A heading on the page</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm">
                  <DashedLineSwatch color={referenceLine.color} dashArray={referenceLine.dashArray} />
                  <span>One device window&apos;s view height</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t px-4 py-2.5">
            <Link href="/docs/charts" className="text-sm text-primary hover:underline">
              Read docs &gt;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
