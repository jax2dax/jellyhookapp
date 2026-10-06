// silhouette/components/SilhouetteFigure.tsx
// Draws one silhouette figure (a session row or a single page) as SVG, in
// FramePlate's own colours (framePlate/theme/defaultTheme.ts) so the preview
// reads as "the chart you'll get", just not filled in yet. Pure render: no
// state, no effects. Hover text uses native SVG <title>, which costs nothing
// until hovered.
"use client";

import { defaultTheme } from "../../framePlate/theme/defaultTheme";
import type { Figure, HeaderSpec, Item, PlateSpec, Share, VisitItem } from "../types";

const T = defaultTheme;
const C = {
  converted: T.frame.backgroundByOutcome.converted,
  abandoned: T.frame.backgroundByOutcome.abandoned,
  live: T.frame.backgroundByOutcome.live,
  away: T.frame.backgroundByOutcome.away,
  seen: T.seenOnce.color,
  seenTwice: T.seenTwice.color,
  enter: T.bulbs.enter.color,
  exit: T.bulbs.exit.color,
  deepest: T.bulbs.deepestScroll.color,
  bulbConverted: T.bulbs.converted.color,
  form: T.formMiniPlate.color,
  formSubmitted: T.formMiniPlate.submittedColor,
  // Outlines use the theme's TEXT colours, not FramePlate's plate border:
  // the silhouette is mostly outline, and the plate border (#3a3a3a in dark
  // mode, a pale pink in light) disappears on the card background. The
  // text colour is near-white in dark mode (the "white dashed plate") and
  // dark grey in light mode, so the same drawing reads in both.
  line: "var(--fp-text, #e6e6e6)",
  lineSoft: "var(--fp-text-muted, #bdbdbd)",
  plate: "var(--fp-plate, #111111)",
  text: "var(--fp-text-muted, #bdbdbd)",
  label: "var(--fp-text, #e6e6e6)",
  anchor: "#22d3ee",
  not: "#ef4444",
};

/** Geometry per scale. Sub-hooks draw at about three quarters. */
const SIZE = {
  main: { frameH: 124, plateW: 26, plateH: 86, minFrameW: 44, maxFrameW: 82, gap: 8, awayW: 22, stubW: 18, labelH: 14, captionH: 14 },
  sub: { frameH: 96, plateW: 20, plateH: 66, minFrameW: 34, maxFrameW: 62, gap: 6, awayW: 17, stubW: 14, labelH: 12, captionH: 12 },
  page: { frameH: 210, plateW: 52, plateH: 156, minFrameW: 120, maxFrameW: 120, gap: 0, awayW: 0, stubW: 0, labelH: 16, captionH: 16 },
};
type Size = (typeof SIZE)["main"];

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function matchesPattern(path: string, h: Extract<HeaderSpec, { kind: "pattern" }>): boolean {
  const p = path.toLowerCase();
  const t = h.text.toLowerCase();
  return h.op === "contains" ? p.includes(t) : h.op === "startsWith" ? p.startsWith(t) : p.endsWith(t);
}

/** The header label and the hover list of the pages it could be. */
export function headerText(h: HeaderSpec, sitePaths: string[]): { label: string; hover: string } {
  const list = (ps: string[]) => (ps.length ? ps.slice(0, 40).join("\n") + (ps.length > 40 ? `\n…and ${ps.length - 40} more` : "") : "no pages recorded yet");
  const n = sitePaths.length;
  switch (h.kind) {
    case "exact":
      return { label: h.path, hover: h.path };
    case "oneOf":
      return { label: `${h.paths.length} pages`, hover: `One of:\n${list(h.paths)}` };
    case "except": {
      const rest = sitePaths.filter((p) => !h.paths.includes(p));
      return { label: n ? `${rest.length}+` : "not " + trunc(h.paths.join(", "), 10), hover: `Any page except ${h.paths.join(", ")}:\n${list(rest)}` };
    }
    case "pattern": {
      const m = sitePaths.filter((p) => matchesPattern(p, h));
      const word = h.op === "contains" ? "contains" : h.op === "startsWith" ? "starts with" : "ends with";
      return { label: n ? `${m.length} · ${trunc(h.text, 8)}` : `*${trunc(h.text, 8)}*`, hover: `Page address ${word} "${h.text}":\n${list(m)}` };
    }
    default:
      return { label: n ? `${n}+` : "any", hover: n ? `Any page of this site (${n}):\n${list(sitePaths)}` : "Any page of this site" };
  }
}

function frameWidth(v: VisitItem, s: Size): number {
  const w = v.frame.weight ?? 0.35;
  return Math.round(s.minFrameW + (s.maxFrameW - s.minFrameW) * w);
}

function itemWidth(it: Item, s: Size): number {
  if (it.kind === "away") return it.certainty === "more" ? s.stubW : s.awayW;
  if (it.certainty === "more") return s.stubW;
  return frameWidth(it, s);
}

function shareText(sh: Share): string {
  if (sh.atLeast !== undefined && sh.atMost !== undefined) return sh.atLeast === sh.atMost ? `${sh.atLeast}%` : `${sh.atLeast}-${sh.atMost}%`;
  if (sh.atLeast !== undefined) return `≥${sh.atLeast}%`;
  if (sh.atMost !== undefined) return `≤${sh.atMost}%`;
  return "?";
}

function Plate({ p, x, y, w, h, uid }: { p: PlateSpec; x: number; y: number; w: number; h: number; uid: string }) {
  const known = p.header.kind === "exact";
  const band = (sh: Share | undefined, color: string, inset: number, name: string) => {
    if (!sh) return null;
    const to = sh.atLeast ?? sh.atMost ?? 30;
    const bh = (h * Math.max(4, Math.min(100, to))) / 100;
    return (
      <g>
        <title>{`${name}: ${shareText(sh)}`}</title>
        <rect x={x + inset} y={y} width={w - inset * 2} height={bh} fill={color} opacity={sh.atLeast !== undefined ? 0.85 : 0.45} />
        <line x1={x + inset} x2={x + w - inset} y1={y + bh} y2={y + bh} stroke={color} strokeWidth={1} strokeDasharray={sh.atLeast !== undefined && sh.atMost === undefined ? "2,2" : undefined} />
      </g>
    );
  };
  const bulb = (pos: number | true | undefined, color: string, len: number, name: string) => {
    if (pos === undefined) return null;
    const py = y + (h * (pos === true ? 50 : pos)) / 100;
    return (
      <g opacity={pos === true ? 0.55 : 1}>
        <title>{pos === true ? `${name} (mentioned)` : `${name} at ${Math.round(pos)}% down the page`}</title>
        <rect x={x + w - 1} y={py - 1.5} width={len} height={3} rx={1.5} fill={color} />
      </g>
    );
  };
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={C.plate} stroke={C.line} strokeOpacity={known ? 0.9 : 0.75} strokeDasharray={known ? undefined : "3,3"} strokeWidth={known ? 1.4 : 1.2} />
      {band(p.seen, C.seen, 0, "Share of page seen")}
      {band(p.seenTwice, C.seenTwice, 3, "Share of page seen 2x+")}
      {p.notSeen && (
        <g>
          <title>{`Share never seen: ${shareText(p.notSeen)}`}</title>
          <rect x={x} y={y + h - (h * (p.notSeen.atLeast ?? p.notSeen.atMost ?? 30)) / 100} width={w} height={(h * (p.notSeen.atLeast ?? p.notSeen.atMost ?? 30)) / 100} fill={`url(#${uid}-unseen)`} />
        </g>
      )}
      {p.form && (
        <g>
          <title>{`A form on this page${p.form === "any" ? "" : `: ${p.form}`}`}</title>
          <rect
            x={x + w * 0.19}
            y={y + h * 0.55}
            width={w * 0.62}
            height={Math.max(4, h * 0.1)}
            rx={1}
            fill={p.form === "submitted" ? C.formSubmitted : p.form === "abandoned" ? C.abandoned : C.form}
          />
        </g>
      )}
      {bulb(p.bulbs.enter, C.enter, 7, "Entered")}
      {bulb(p.bulbs.deepest, C.deepest, 13, "Furthest point")}
      {bulb(p.bulbs.exit, C.exit, 9, "Left")}
      {p.bulbs.converted && bulb(60, C.bulbConverted, 18, "Converted")}
      {p.notes.length > 0 && (
        <g>
          <title>{`Must not be: ${p.notes.join("; ")}`}</title>
          <path d={`M ${x + w - 12} ${y} L ${x + w} ${y} L ${x + w} ${y + 12} Z`} fill={`url(#${uid}-not)`} stroke={C.not} strokeWidth={0.8} />
        </g>
      )}
    </g>
  );
}

function Visit({ v, x, s, sitePaths, uid, glow }: { v: VisitItem; x: number; s: Size; sitePaths: string[]; uid: string; glow: boolean }) {
  const top = s.labelH;
  const fw = frameWidth(v, s);
  if (v.certainty === "more") {
    return (
      <g className={glow ? "jh-silhouette-glow" : undefined}>
        <title>And possibly more pages</title>
        <rect x={x} y={top} width={s.stubW} height={s.frameH} rx={4} fill="none" stroke={C.lineSoft} strokeOpacity={0.8} strokeDasharray="2,3" />
        <text x={x + s.stubW / 2} y={top + s.frameH / 2 + 4} textAnchor="middle" fontSize={13} fill={C.text}>+</text>
      </g>
    );
  }
  const outcomeFill = v.frame.outcome === "converted" ? C.converted : v.frame.outcome === "abandoned" ? C.abandoned : v.frame.outcome === "live" ? C.live : null;
  const head = headerText(v.plate.header, sitePaths);
  const ph = v.plate.tall ? Math.min(s.frameH - 12, s.plateH * 1.15) : s.plateH;
  return (
    <g opacity={v.certainty === "maybe" ? 0.42 : 1} className={glow ? "jh-silhouette-glow" : undefined}>
      <title>{[v.anchor ? "This page view" : null, v.caption, v.certainty === "maybe" ? "may or may not exist (inside a range)" : null, head.hover, v.frame.duration ? `time on page ${v.frame.duration}` : null].filter(Boolean).join("\n")}</title>
      <text x={x + fw / 2} y={top - 4} textAnchor="middle" fontSize={s === SIZE.page ? 11 : 9} fill={C.label}>
        {trunc(head.label, s === SIZE.page ? 20 : Math.max(6, Math.floor(fw / 6)))}
      </text>
      <rect
        x={x}
        y={top}
        width={fw}
        height={s.frameH}
        rx={4}
        fill={outcomeFill ?? "none"}
        fillOpacity={outcomeFill ? 0.4 : 0}
        stroke={v.anchor ? C.anchor : (outcomeFill ?? C.lineSoft)}
        strokeOpacity={outcomeFill || v.anchor ? 1 : 0.7}
        strokeWidth={v.anchor ? 2 : 1.2}
        strokeDasharray={outcomeFill || v.anchor ? undefined : "4,3"}
      />
      <Plate p={v.plate} x={x + (fw - s.plateW) / 2} y={top + (s.frameH - ph) / 2} w={s.plateW} h={ph} uid={uid} />
      {v.certainty === "maybe" && (
        <text x={x + fw - 5} y={top + 11} textAnchor="end" fontSize={9} fill={C.text}>?</text>
      )}
      <text x={x + fw / 2} y={top + s.frameH + 11} textAnchor="middle" fontSize={8.5} fill={C.text}>
        {trunc([v.frame.duration, v.anchor ? "this page view" : v.caption].filter(Boolean).join(" · "), Math.max(8, Math.floor(fw / 4.5)))}
      </text>
    </g>
  );
}

export function SilhouetteFigure({ figure, sitePaths, changed }: { figure: Figure; sitePaths: string[]; changed: ReadonlySet<string> }) {
  const s = figure.kind === "page" ? SIZE.page : SIZE[figure.scale];
  const uid = `sil-${figure.key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const items: Item[] = figure.kind === "page" ? [figure.item] : figure.items;
  const widths = items.map((it) => itemWidth(it, s));
  const totalW = widths.reduce((a, b) => a + b, 0) + s.gap * Math.max(0, items.length - 1) + 4;
  // x position of each item, computed up front (render stays pure)
  const xs = widths.map((_, i) => 2 + widths.slice(0, i).reduce((a, b) => a + b + s.gap, 0));
  const totalH = s.labelH + s.frameH + s.captionH;
  return (
    <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} role="img" aria-label={figure.title} className="block max-w-none">
      <defs>
        <pattern id={`${uid}-not`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke={C.not} strokeWidth={2} />
        </pattern>
        <pattern id={`${uid}-unseen`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={4} stroke={C.text} strokeWidth={1} opacity={0.5} />
        </pattern>
      </defs>
      {items.map((it, i) => {
        const at = xs[i];
        const glow = changed.has(it.key);
        if (it.kind === "away") {
          return (
            <g key={it.key} opacity={it.certainty === "maybe" ? 0.42 : 1} className={glow ? "jh-silhouette-glow" : undefined}>
              <title>{`Away from the site${it.duration ? ` (${it.duration})` : ""}${it.certainty === "maybe" ? ", may or may not happen" : ""}`}</title>
              <rect x={at} y={s.labelH + 8} width={widths[i]} height={s.frameH - 16} rx={3} fill={C.away} fillOpacity={0.55} stroke={C.away} strokeDasharray={it.certainty === "more" ? "2,3" : undefined} />
              <text x={at + widths[i] / 2} y={s.labelH + s.frameH + 11} textAnchor="middle" fontSize={8} fill={C.text}>{it.certainty === "more" ? "+" : "away"}</text>
            </g>
          );
        }
        return <Visit key={it.key} v={it} x={at} s={s} sitePaths={sitePaths} uid={uid} glow={glow} />;
      })}
      {figure.kind === "session" && figure.live && <rect x={1} y={s.labelH - 2} width={totalW - 2} height={s.frameH + 4} rx={6} fill="none" stroke={C.live} strokeWidth={1.5} />}
      {figure.excluded && (
        <g>
          <title>Excluded: matching rows must NOT look like this</title>
          <rect x={0} y={s.labelH} width={totalW} height={s.frameH} fill={`url(#${uid}-not)`} opacity={0.35} />
        </g>
      )}
    </svg>
  );
}
