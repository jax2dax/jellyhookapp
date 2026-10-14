// components/forms/FormActivityChart.tsx
// One person's form, drawn: how long before they started, every field in the order used, the pauses between fields,
// the time spent on other pages, and when they left the site and came back. Input is the output of
// jh-forms/timeline.ts (buildFormTimeline); nothing here invents data. No keystrokes exist, so this shows WHEN and
// HOW LONG, never what was typed.
//
// Layout (top to bottom):
//   1. time split bar: in fields / pauses / other pages / away / unaccounted, each with its total
//   2. activity strip: everything on one line, in time order. Leaving the site is a purple block "left 4m 12s" with a
//      return marker; another page is a blue block with its path; pauses are hatched with their length
//   3. one lane per field: bar from first focus to last leave, the lighter start is the hesitation before the first
//      key; a field visited more than once is outlined dashed ("approximate"); away bands run through all lanes
// Since 2026-10-14 every visit to a field is its own bar, untouched fields get an empty dashed lane, and errors,
// "left empty" and corrections show as badges. Long gaps (hours away) are compressed to a fixed width and drawn with a break mark, so they never squash the rest.
import type { FormTimeline, Segment } from "@/jh-forms/timeline";

const W = 760; // drawing width (scales with the container)
const LABEL_W = 120;
const LANE_H = 18;
const LANE_GAP = 6;
const STRIP_H = 26;
const MAX_SHARE = 0.14; // a single gap may take at most 14 % of the plot width

const fmt = (ms: number) => {
  if (ms < 1000) return (ms / 1000).toFixed(1) + " s";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m " + (s % 60) + "s";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
};

type Piece = { from: number; to: number; squeeze: boolean };

/** A piecewise time -> x scale: long gaps (away, other pages, pauses, waiting to start) are capped to MAX_SHARE. */
function makeScale(t: FormTimeline, plotW: number) {
  const x0 = t.seenAt ?? t.firstInputAt ?? t.fields[0]?.firstFocusAt ?? 0;
  const x1 = Math.max(t.endedAt ?? x0, ...t.fields.map((f) => f.lastLeftAt), x0 + 1);
  const gaps: Piece[] = t.segments.filter((s) => s.kind === "away" || s.kind === "otherPage" || s.kind === "pause").map((s) => ({ from: s.from, to: s.to, squeeze: true }));
  if (t.seenAt !== null && t.firstInputAt !== null && t.firstInputAt > t.seenAt) gaps.push({ from: t.seenAt, to: t.firstInputAt, squeeze: true });
  gaps.sort((a, b) => a.from - b.from);
  // cut [x0, x1] into pieces: gaps (squeezable) and the rest (linear)
  const pieces: Piece[] = [];
  let cur = x0;
  for (const g of gaps) {
    const a = Math.max(g.from, cur);
    const b = Math.min(g.to, x1);
    if (b <= a) continue;
    if (a > cur) pieces.push({ from: cur, to: a, squeeze: false });
    pieces.push({ from: a, to: b, squeeze: true });
    cur = b;
  }
  if (x1 > cur) pieces.push({ from: cur, to: x1, squeeze: false });
  const total = x1 - x0;
  const cap = total * MAX_SHARE;
  const lens = pieces.map((p) => (p.squeeze ? Math.min(p.to - p.from, cap) : p.to - p.from));
  const sum = lens.reduce((n, l) => n + l, 0) || 1;
  const starts: number[] = [];
  let acc = 0;
  for (const l of lens) {
    starts.push(acc);
    acc += l;
  }
  const x = (time: number) => {
    const t2 = Math.min(Math.max(time, x0), x1);
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (t2 <= p.to || i === pieces.length - 1) {
        const span = p.to - p.from || 1;
        return LABEL_W + ((starts[i] + ((t2 - p.from) / span) * lens[i]) / sum) * plotW;
      }
    }
    return LABEL_W + plotW;
  };
  const broken = pieces.filter((p, i) => p.squeeze && lens[i] < p.to - p.from).map((p) => ({ from: p.from, to: p.to }));
  return { x, broken, x0, x1 };
}

const KIND_CLASS: Record<Segment["kind"], string> = {
  field: "fill-primary",
  move: "fill-transparent",
  pause: "fill-amber-400/70",
  otherPage: "fill-sky-500/70",
  away: "fill-violet-500/80",
};

export function FormActivityChart({ timeline: t, title }: { timeline: FormTimeline; title?: string }) {
  if (t.fields.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        {title && <div className="mb-1 font-medium text-foreground">{title}</div>}
        The form was seen{t.seenAt ? " at " + new Date(t.seenAt).toLocaleTimeString() : ""} but no field was ever clicked into.
      </div>
    );
  }
  const plotW = W - LABEL_W - 16;
  const { x, broken } = makeScale(t, plotW);
  const lanesTop = 34 + STRIP_H + 18;
  const laneCount = t.fields.length + t.untouched.length;
  const H = lanesTop + laneCount * (LANE_H + LANE_GAP) + 26;
  const away = t.segments.filter((s) => s.kind === "away");
  const tot = t.totals;
  const split = [
    { k: "In fields", v: tot.inFieldsMs, c: "bg-primary" },
    { k: "Pauses", v: tot.pausesMs, c: "bg-amber-400" },
    { k: "Other pages", v: tot.otherPagesMs, c: "bg-sky-500" },
    { k: "Away from the site", v: tot.awayMs, c: "bg-violet-500" },
    { k: "Not explained", v: tot.unaccountedMs, c: "bg-muted-foreground/30" },
  ].filter((s) => s.v > 0);
  const splitSum = split.reduce((n, s) => n + s.v, 0) || 1;

  return (
    <figure className="space-y-3">
      {title && <figcaption className="text-sm font-medium text-foreground">{title}</figcaption>}

      {/* 1. the numbers */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
        {tot.toStartMs !== null && (
          <span>
            <strong className="text-foreground">{fmt(tot.toStartMs)}</strong> from seeing the form to the first input
            {tot.onscreenBeforeStartMs !== null && (
              <>
                {" "}(<strong className="text-foreground">{fmt(tot.onscreenBeforeStartMs)}</strong> of it with the form on screen)
              </>
            )}
          </span>
        )}
        {tot.spanMs !== null && (
          <span>
            <strong className="text-foreground">{fmt(tot.spanMs)}</strong> from first input to {t.ended === "submitted" ? "submit" : t.ended === "abandoned" ? "giving up" : "now"}
          </span>
        )}
        <span>
          <strong className="text-foreground">{tot.fieldsTouched}</strong>
          {t.formFieldCount !== null ? " of " + t.formFieldCount : ""} field{(t.formFieldCount ?? tot.fieldsTouched) === 1 ? "" : "s"} touched
        </span>
        {!t.exact && <span className="text-amber-600 dark:text-amber-400">some fields were visited more than once: their bars are approximate</span>}
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="How the time was spent">
        {split.map((s) => (
          <div key={s.k} className={s.c} style={{ width: (s.v / splitSum) * 100 + "%" }} title={s.k + ": " + fmt(s.v)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {split.map((s) => (
          <span key={s.k} className="flex items-center gap-1.5">
            <span className={"inline-block size-2 rounded-full " + s.c} />
            {s.k} <strong className="text-foreground">{fmt(s.v)}</strong>
          </span>
        ))}
      </div>

      {/* 2 + 3. the drawing */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Form activity over time">
        <defs>
          <pattern id="jh-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="fill-amber-400/25" />
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-amber-500" strokeWidth="2" />
          </pattern>
        </defs>

        {/* markers: seen, first input, end */}
        {t.seenAt !== null && (
          <g>
            <line x1={x(t.seenAt)} x2={x(t.seenAt)} y1={14} y2={H - 20} className="stroke-muted-foreground/40" strokeDasharray="2 3" />
            <text x={x(t.seenAt)} y={10} className="fill-muted-foreground text-[10px]" textAnchor="start">seen</text>
          </g>
        )}
        {t.endedAt !== null && t.ended !== "open" && (
          <g>
            <line x1={x(t.endedAt)} x2={x(t.endedAt)} y1={14} y2={H - 20} className={t.ended === "submitted" ? "stroke-yellow-500" : "stroke-orange-500"} strokeWidth="1.5" />
            <text x={x(t.endedAt)} y={10} className={(t.ended === "submitted" ? "fill-yellow-600 dark:fill-yellow-400" : "fill-orange-600 dark:fill-orange-400") + " text-[10px] font-medium"} textAnchor="end">
              {t.ended === "submitted" ? "submitted" : "gave up"}
            </text>
          </g>
        )}

        {/* 2. activity strip */}
        <text x={0} y={34 + STRIP_H / 2 + 4} className="fill-muted-foreground text-[11px]">Activity</text>
        <rect x={LABEL_W} y={34} width={plotW} height={STRIP_H} rx={4} className="fill-muted/40" />
        {t.seenAt !== null && t.firstInputAt !== null && t.firstInputAt > t.seenAt && (
          <g>
            <rect x={x(t.seenAt)} y={34 + 8} width={Math.max(1, x(t.firstInputAt) - x(t.seenAt))} height={STRIP_H - 16} rx={2} className="fill-muted-foreground/25" />
            <title>Before starting: {fmt(t.firstInputAt - t.seenAt)}</title>
          </g>
        )}
        {t.segments.map((s, i) => {
          if (s.kind === "move") return null;
          const x1 = x(s.from);
          const w = Math.max(2, x(s.to) - x1);
          const fill = s.kind === "pause" ? "url(#jh-hatch)" : undefined;
          const label = s.kind === "away" ? "left " + fmt(s.ms) : s.kind === "otherPage" ? (s.path ?? "other page") + " " + fmt(s.ms) : s.kind === "pause" ? fmt(s.ms) : "";
          return (
            <g key={"s" + i}>
              <rect x={x1} y={34 + 3} width={w} height={STRIP_H - 6} rx={3} className={s.kind === "field" ? (s.approx ? "fill-primary/50" : "fill-primary") : KIND_CLASS[s.kind]} fill={fill} />
              {label && w > 36 && (
                <text x={x1 + w / 2} y={34 + STRIP_H / 2 + 4} textAnchor="middle" className={(s.kind === "pause" ? "fill-amber-900 dark:fill-amber-100" : "fill-white") + " text-[10px] font-medium"}>
                  {label}
                </text>
              )}
              {s.kind === "away" && (
                <text x={x(s.to) + 2} y={34 + STRIP_H + 11} className="fill-violet-600 text-[10px] dark:fill-violet-300">↩ back</text>
              )}
              <title>
                {s.kind === "field" ? "In a field" : s.kind === "away" ? "Away from the site" : s.kind === "otherPage" ? "On " + (s.path ?? "another page") : "Pause"}: {fmt(s.to - s.from)}
              </title>
            </g>
          );
        })}
        {broken.map((b, i) => (
          <text key={"b" + i} x={(x(b.from) + x(b.to)) / 2} y={34 - 3} textAnchor="middle" className="fill-muted-foreground text-[10px]">≈ shortened</text>
        ))}

        {/* away bands through every lane */}
        {away.map((s, i) => (
          <rect key={"aw" + i} x={x(s.from)} y={lanesTop - 4} width={Math.max(2, x(s.to) - x(s.from))} height={laneCount * (LANE_H + LANE_GAP) + 4} className="fill-violet-500/10" />
        ))}

        {/* 3. one lane per field, then the fields nobody touched */}
        {t.fields.map((f, i) => {
          const y = lanesTop + i * (LANE_H + LANE_GAP);
          const end = Math.max(...f.visits.map((v) => x(v[1])), x(f.firstFocusAt) + 3);
          const badges = [
            fmt(f.focusedMs),
            f.hesitationMs !== null && f.hesitationMs >= 500 ? fmt(f.hesitationMs) + " before typing" : "",
            !f.typed ? "nothing typed" : "",
            f.visits.length > 1 ? f.visits.length + " visits" : "",
            f.edits > 1 ? "changed " + f.edits + " times" : "",
            f.filled === false ? "left empty" : "",
            f.errors > 0 ? f.errors + " error" + (f.errors === 1 ? "" : "s") : "",
          ].filter(Boolean);
          return (
            <g key={f.key}>
              <text x={0} y={y + LANE_H / 2 + 4} className={"text-[11px] " + (f.last ? "fill-foreground font-medium" : "fill-muted-foreground")}>
                {(f.label.length > 16 ? f.label.slice(0, 15) + "…" : f.label) + (f.required ? " *" : "") + (f.last ? " ●" : "")}
              </text>
              <rect x={LABEL_W} y={y} width={plotW} height={LANE_H} rx={3} className="fill-muted/30" />
              {f.approx ? (
                <rect x={x(f.firstFocusAt)} y={y + 1} width={Math.max(3, end - x(f.firstFocusAt))} height={LANE_H - 2} rx={3} className="fill-primary/20 stroke-primary" strokeDasharray="3 2" />
              ) : (
                f.visits.map(([va, vb], j) => {
                  const p = x(va);
                  const q = Math.max(p + 3, x(vb));
                  // the lighter start (clicked in, not typing yet) belongs to the visit in which the first key came
                  const keyAt = f.hesitationMs !== null ? f.firstFocusAt + f.hesitationMs : null;
                  const k = keyAt !== null && keyAt >= va && keyAt <= vb ? Math.min(q, x(keyAt)) : j === 0 && keyAt === null ? q : p;
                  return (
                    <g key={j}>
                      <rect x={p} y={y + 1} width={Math.max(0, k - p)} height={LANE_H - 2} rx={3} className="fill-primary/35" />
                      <rect x={k} y={y + 1} width={Math.max(0, q - k)} height={LANE_H - 2} rx={3} className="fill-primary" />
                    </g>
                  );
                })
              )}
              {f.errors > 0 && <circle cx={end - 2} cy={y + 2} r={3.5} className="fill-red-500" />}
              <text x={Math.min(end + 4, W - 4)} y={y + LANE_H / 2 + 4} className={"text-[10px] " + (f.errors > 0 ? "fill-red-600 dark:fill-red-400" : "fill-muted-foreground")} textAnchor={end + 120 > W ? "end" : "start"}>
                {badges.join(" · ")}
              </text>
              <title>
                {f.label}: {fmt(f.focusedMs)} focused over {f.visits.length} visit{f.visits.length === 1 ? "" : "s"}
                {f.approx ? " (old record: bar spans first to last visit)" : ""}
                {f.hesitationMs !== null ? ", " + fmt(f.hesitationMs) + " before the first key" : ", no key pressed"}
                {f.filled === false ? ", left empty" : f.filled === true ? ", filled" : ""}
                {f.errors > 0 ? ", " + f.errors + " validation error(s)" : ""}
              </title>
            </g>
          );
        })}
        {t.untouched.map((u, i) => {
          const y = lanesTop + (t.fields.length + i) * (LANE_H + LANE_GAP);
          return (
            <g key={"u" + u.key}>
              <text x={0} y={y + LANE_H / 2 + 4} className="fill-muted-foreground/70 text-[11px]">
                {(u.label.length > 16 ? u.label.slice(0, 15) + "…" : u.label) + (u.required ? " *" : "")}
              </text>
              <rect x={LABEL_W} y={y} width={plotW} height={LANE_H} rx={3} className="fill-transparent stroke-muted-foreground/30" strokeDasharray="4 3" />
              <text x={LABEL_W + 8} y={y + LANE_H / 2 + 4} className={"text-[10px] " + (u.errors > 0 ? "fill-red-600 dark:fill-red-400" : "fill-muted-foreground")}>
                never touched{u.required ? " (required)" : ""}
                {u.errors > 0 ? " · failed validation " + u.errors + " time" + (u.errors === 1 ? "" : "s") : ""}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-primary/35" />clicked in, not typing yet</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-primary" />typing / in the field</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm border border-dashed border-primary bg-primary/20" />older record, visits not separated</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-red-500" />validation error</span>
        <span>* required</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-amber-400" />pause (1.5 s or more)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-sky-500" />another page</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-violet-500" />left the site, ↩ came back</span>
        <span>● the field they were on at the end</span>
      </div>
    </figure>
  );
}
