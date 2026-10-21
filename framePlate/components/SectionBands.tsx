// framePlate/components/SectionBands.tsx
//
// The "by section" look of the plate: a heat map of where the visitor's time went, instead of the green seen bands.
//   - The page is tiled by its sections (a main heading and what is under it), each at its place on the page, 90% of the
//     plate wide and centred (5% margin each side). The deeper the green, the more time it was on screen; a section
//     nobody reached is left as plain plate.
//   - Main headings on the same row sit side by side and share that width.
//   - The smaller headings under a main heading are mini-plates inside its band, with their own time. A main
//     heading's time is the sum of its own and its sub-headings': its colour is the ceiling, each sub-heading gets
//     the parent's colour scaled by its part of the parent's time, so it is never deeper than its parent.
//     view "sections-main" leaves the mini-plates out and shows only the main sections.
// Pure drawing from VisitGeometry.sections (the time per heading is page_views.heading_time, see
// lib/tracking/headingTime.js); it knows nothing about where they came from.
"use client";

import * as React from "react";
import type { FramePlateTheme, PlateView, SectionTime, VisitGeometry } from "../types";

/** "<1s", "45s", "3m 20s", "12m", "1h 5m" */
export function sectionDuration(ms: number): string {
  if (ms <= 0) return "0s";
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  if (m < 10) return m + "m" + (s % 60 ? " " + (s % 60) + "s" : "");
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

/** true for the two section views (the seen bands are the other one). */
export const isSectionView = (view: PlateView | undefined): boolean => view === "sections" || view === "sections-main";

const FONT = 9;
const MARGIN = 0.05; // of the plate width, each side
const COL_GAP = 3;
const clip = (text: string, maxPx: number, font: number) => {
  const max = Math.max(1, Math.floor(maxPx / (font * 0.56)));
  return text.length <= max ? text : text.slice(0, Math.max(1, max - 1)).trimEnd() + "…";
};
// light text with a dark outline: readable on every green and on the plain plate, in light or dark mode
const TEXT = { fill: "#fff", stroke: "#000", strokeOpacity: 0.65, strokeWidth: 2.2, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };
// main headings and their time are light blue, so they never read as one of the smaller headings
const H1_TEXT = { ...TEXT, fill: "#bfdbfe" };

// the heat ramp: a pale green for a little time down to a deep, dark green for the most time (of this visit's sections)
const LOW = [112, 184, 128];
const HIGH = [0, 32, 10];
export function heatColor(share: number): string {
  const t = Math.pow(Math.min(1, Math.max(0, share)), 0.75);
  const c = LOW.map((l, i) => Math.round(l + (HIGH[i] - l) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** Sections that can be drawn (they know their place on the page). */
export function placedSections(visit: Pick<VisitGeometry, "sections">): SectionTime[] {
  return (visit.sections ?? []).filter((s) => typeof s.y0 === "number" && typeof s.y1 === "number" && (s.y1 as number) > (s.y0 as number));
}

export function SectionBands({ visit, width, height, view }: { visit: VisitGeometry; width: number; height: number; theme: FramePlateTheme; view?: PlateView }) {
  const uid = React.useId().replace(/[:]/g, "");
  const sections = placedSections(visit);
  const withSubs = view !== "sections-main";
  const maxMs = Math.max(0, ...sections.map((s) => s.ms));
  const x0 = width * MARGIN;
  const full = width * (1 - 2 * MARGIN);
  return (
    <g aria-label="time per section">
      {sections.map((s, i) => {
        const y = (s.y0 as number) * height;
        const h = Math.max(0.5, ((s.y1 as number) - (s.y0 as number)) * height);
        const cols = Math.max(1, s.cols ?? 1);
        const colW = (full - COL_GAP * (cols - 1)) / cols;
        const bx = x0 + (s.col ?? 0) * (colW + COL_GAP);
        const share = maxMs > 0 ? s.ms / maxMs : 0;
        const subs = withSubs && cols === 1 ? s.subs.filter((x) => typeof x.y0 === "number" && typeof x.y1 === "number" && (x.y1 as number) > (x.y0 as number)) : [];
        // With its sub-headings drawn, the section's own band (the part between its heading and the first sub-heading,
        // and around the mini-plates) is coloured by its OWN time: the total minus what the sub-headings got. Without
        // them, the band is coloured by the section's total.
        const subsMs = subs.reduce((n, x) => n + x.ms, 0);
        const ownMs = subs.length ? Math.max(0, s.ms - subsMs) : s.ms;
        const bandShare = s.ms > 0 ? share * (ownMs / s.ms) : 0;
        const name = s.isTop ? "Top of page" : (s.text ?? "");
        const time = s.ms > 0 ? sectionDuration(s.ms) : "";
        const twoLines = h >= 24 || !time;
        const timeW = time.length * FONT * 0.6 + 6;
        // the heading stays on one line, never wider than its band: a long one fades out at the right edge
        const nameW = Math.max(10, colW - 8 - (twoLines ? 0 : timeW));
        const overflows = name.length * FONT * 0.6 > nameW;
        const fadeId = "fade-" + uid + "-" + i;
        return (
          <g key={i}>
            <rect x={bx} y={y + 0.5} width={colW} height={Math.max(0, h - 1)} rx={2} fill={ownMs > 0 ? heatColor(bandShare) : s.ms > 0 && subs.length ? heatColor(0) : "none"} stroke="#fff" strokeOpacity={s.ms > 0 ? 0.3 : 0.16} strokeWidth={0.6} strokeDasharray={s.ms > 0 ? undefined : "2 2"} />
            {h >= 10 && (
              <g opacity={s.ms > 0 ? 1 : 0.5}>
                {overflows && (
                  <defs>
                    <linearGradient id={fadeId + "-g"} x1="0" x2="1" y1="0" y2="0">
                      <stop offset={0} stopColor="#fff" />
                      <stop offset={Math.max(0, (nameW - 16) / nameW)} stopColor="#fff" />
                      <stop offset={1} stopColor="#000" />
                    </linearGradient>
                    <mask id={fadeId}>
                      <rect x={bx + 4} y={y} width={nameW} height={FONT + 6} fill={`url(#${fadeId}-g)`} />
                    </mask>
                  </defs>
                )}
                <text x={bx + 4} y={y + FONT + 2} fontSize={FONT} fontWeight={700} {...H1_TEXT} mask={overflows ? `url(#${fadeId})` : undefined}>
                  {name}
                </text>
                {time && (
                  <text x={twoLines ? bx + 4 : bx + colW - 4} y={twoLines ? y + FONT * 2 + 3 : y + FONT + 2} fontSize={FONT} textAnchor={twoLines ? "start" : "end"} {...H1_TEXT}>
                    {time}
                  </text>
                )}
              </g>
            )}
            {/* the smaller headings: mini-plates inside the section, each with its own time, never deeper than the section */}
            {subs.map((x, j) => {
              const labelRoom = twoLines ? FONT * 2 + 6 : FONT + 4; // keep the section's own label readable
              const top = Math.max((x.y0 as number) * height, y + labelRoom);
              const bottom = (x.y1 as number) * height;
              const sh = bottom - top - 1.5;
              if (sh < 2) return null;
              const subShare = s.ms > 0 ? Math.min(share, share * (x.ms / s.ms)) : 0;
              return (
                <g key={j}>
                  <rect x={bx + 3} y={top + 0.75} width={colW - 6} height={sh} rx={1.5} fill={x.ms > 0 ? heatColor(subShare) : "none"} stroke="#fff" strokeOpacity={x.ms > 0 ? 0.55 : 0.18} strokeWidth={0.6} strokeDasharray={x.ms > 0 ? undefined : "2 2"} />
                  {sh >= 10 && (
                    <text x={bx + 7} y={top + 0.75 + 8.5} fontSize={8} {...TEXT} opacity={x.ms > 0 ? 1 : 0.5}>
                      {clip((x.text ?? "") + (x.ms > 0 ? " · " + sectionDuration(x.ms) : ""), colW - 14, 8)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/** The hover card's lines: every section that got time (with its smaller headings unless they are hidden). */
export function SectionTooltipBody({ visit, withSubs = true }: { visit: Pick<VisitGeometry, "sections">; withSubs?: boolean }) {
  const list = (visit.sections ?? []).filter((s) => s.ms > 0).sort((a, b) => b.ms - a.ms).slice(0, 8);
  if (!list.length) return <div style={{ opacity: 0.7 }}>no time recorded on any section</div>;
  return (
    <div style={{ marginTop: 2 }}>
      {list.map((s, i) => (
        <div key={i} style={{ marginTop: 3 }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{s.isTop ? "Top of page" : (s.text ?? "a heading no longer on the page")}</span>
            <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {sectionDuration(s.ms)}
              {s.entries > 1 ? " · back x" + (s.entries - 1) : ""}
            </span>
          </div>
          {withSubs &&
            s.subs
              .filter((x) => x.ms > 0)
              .sort((a, b) => b.ms - a.ms)
              .slice(0, 3)
              .map((x, j) => (
                <div key={j} style={{ display: "flex", gap: 6, justifyContent: "space-between", paddingLeft: 8, opacity: 0.8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.text ?? "a heading no longer on the page"}</span>
                  <span style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{sectionDuration(x.ms)}</span>
                </div>
              ))}
        </div>
      ))}
    </div>
  );
}
