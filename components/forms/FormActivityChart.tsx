// components/forms/FormActivityChart.tsx
// One person's form, drawn: how long before they started, every field in the order used, the pauses between fields,
// the time spent on other pages, and when they left the site and came back. Input is the output of
// jh-forms/timeline.ts (buildFormTimeline); nothing here invents data. No keystrokes exist, so this shows WHEN and
// HOW LONG, never what was typed.
//
// Layout (top to bottom):
//   1. one row of labelled number tiles (before typing, total, in fields, pausing, other pages, away, fields): no sentences
//   2. TIMELINE: the whole form on one line, in time order, inside its own boxed block (it summarises the rows below; it is
//      not one of them). Leaving the site is a purple block "left 4m 12s" with a return marker; another page is blue
//      with its path; pauses are hatched with their length
//   3. FIELDS: numbered rows below a rule, one per field in the order used. Each bar carries its own text INSIDE it:
//      "13 s · 5 s before typing" when it fits, else "13 s", else the seconds just after the bar. The lighter start of a bar
//      is the time before typing. Away bands run through all rows.
// Since 2026-10-14 every visit to a field is its own bar, untouched fields get an empty dashed lane, and errors,
// "left empty" and corrections show as badges. Long gaps (hours away) are compressed to a fixed width and drawn with a break mark, so they never squash the rest.
// With a `reference` (a comparison is selected, or a lead's form against its form's history): each tile also shows the
// difference from the typical successful submission, and anything unusual (well above typical, jh-forms/averages.ts
// isUnusual) is outlined in red: the tile, and the field's row. Without one, nothing is flagged.
import { totalsOf, unusualIn, type TotalKey, type VersionSummary } from "@/jh-forms/averages";
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

// ── text that fits ────────────────────────────────────────────────────────────────────────────────────────
// A label is written INSIDE a bar when it fits; otherwise the shorter form; otherwise it goes after the bar.
// (~5.4 px per character at 10 px type; the drawing is 760 units wide and scales with the container.)
const CHAR_W = 5.4;
const fits = (text: string, width: number) => text.length * CHAR_W + 8 <= width;
// tighter, for the few characters of a split label ("2 s") that must sit in a short light part
const fitsTight = (text: string, width: number) => text.length * CHAR_W + 2 <= width;

function Stat({ label, value, dot, hint, delta, unusual }: { label: string; value: string; dot?: string; hint?: string; delta?: string | null; unusual?: boolean }) {
  return (
    <div className={"min-w-[6.5rem] rounded-md border bg-muted/20 px-3 py-2 " + (unusual ? "border-red-500 ring-1 ring-red-500/60" : "")} title={hint}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {dot && <span className={"inline-block size-2 rounded-full " + dot} />}
        {label}
      </div>
      <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{value}</div>
      {delta && <div className={"text-[10px] tabular-nums " + (unusual ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{delta}</div>}
    </div>
  );
}

/** "+31 s vs typical", "-4 s vs typical", "typical" (within a second) */
const vsTypical = (value: number | null, typical: number | null | undefined) => {
  if (value === null || typical === null || typical === undefined) return null;
  const d = value - typical;
  if (Math.abs(d) < 1000) return "about typical";
  return (d > 0 ? "+" : "-") + fmt(Math.abs(d)) + " vs typical";
};

export function FormActivityChart({ timeline: t, title, reference, referenceLabel }: { timeline: FormTimeline; title?: string; reference?: VersionSummary | null; referenceLabel?: string }) {
  if (t.fields.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        {title && <div className="mb-1 font-medium text-foreground">{title}</div>}
        The form was seen{t.seenAt ? " at " + new Date(t.seenAt).toLocaleTimeString() : ""} but no field was ever clicked into.
      </div>
    );
  }
  const tot = t.totals;
  const plotW = W - LABEL_W - 16;
  const { x, broken } = makeScale(t, plotW);

  // vertical layout of the drawing: a TIMELINE block, a rule, then the FIELDS block (numbered rows)
  const TOP = 16; // room for the markers (seen / submitted)
  const NAMES_H = 13; // the row of field names above the timeline bars
  const stripTop = TOP + 16;
  const barTop = stripTop + NAMES_H;
  const fieldsHeaderY = stripTop + NAMES_H + STRIP_H + 30;
  const lanesTop = fieldsHeaderY + 12;
  const laneCount = t.fields.length + t.untouched.length;
  const H = lanesTop + laneCount * (LANE_H + LANE_GAP) + 8;
  const away = t.segments.filter((s) => s.kind === "away");

  // One row of numbers, in the order things happened: before typing, then the form itself, then what was not the form.
  const ending = t.ended === "submitted" ? "submitted" : t.ended === "abandoned" ? "given up" : "now";
  const unusual = unusualIn(t, reference ?? null);
  const values = totalsOf(t);
  const cmp = (k: TotalKey) => (reference ? { delta: vsTypical(values[k], reference.spread?.totals[k]?.median), unusual: unusual.totals.has(k) } : {});
  const stats = [
    tot.toStartMs !== null && { ...cmp("beforeTyping"), label: "Before typing", value: fmt(tot.onscreenBeforeStartMs ?? tot.toStartMs), hint: tot.onscreenBeforeStartMs !== null ? "Time the form was on screen before the first thing was typed" + (tot.toStartMs !== null && tot.toStartMs > tot.onscreenBeforeStartMs ? " (" + fmt(tot.toStartMs) + " passed in total, including time scrolled away)" : "") : "From the form coming on screen to the first input" },
    tot.spanMs !== null && { ...cmp("span"), label: "Total activity on form", value: fmt(tot.spanMs), hint: "From the first input until the form was " + ending + ", including pauses, other pages and time away" },
    { label: "Fields engaged", value: tot.fieldsTouched + (t.formFieldCount !== null ? " of " + t.formFieldCount : ""), hint: "Fields clicked into, of all the form's fields" },
    { ...cmp("inFields"), label: "In fields", value: fmt(tot.inFieldsMs), dot: "bg-primary", hint: "Time with a field clicked into" },
    tot.pausesMs > 0 && { ...cmp("pauses"), label: "Pausing", value: fmt(tot.pausesMs), dot: "bg-amber-400", hint: "Gaps of 1.5 s or more between fields, on the form's page" },
    tot.otherPagesMs > 0 && { ...cmp("otherPages"), label: "On other pages", value: fmt(tot.otherPagesMs), dot: "bg-sky-500" },
    tot.awayMs > 0 && { ...cmp("away"), label: "Away from the site", value: fmt(tot.awayMs), dot: "bg-violet-500", hint: "Tab hidden or on another website" },
  ].filter(Boolean) as { label: string; value: string; dot?: string; hint?: string; delta?: string | null; unusual?: boolean }[];

  return (
    <figure className="space-y-3">
      {title && <figcaption className="text-sm font-medium text-foreground">{title}</figcaption>}

      {/* 1. the numbers: one row of labelled tiles, no sentences */}
      <div className="flex flex-wrap gap-2">
        {stats.map((st) => (
          <Stat key={st.label} {...st} />
        ))}
      </div>
      {reference && (
        <p className="text-[11px] text-muted-foreground">
          Compared with {referenceLabel ?? "the typical successful submission"}.{" "}
          {unusual.fields.size + unusual.totals.size > 0 ? <span className="font-medium text-red-600 dark:text-red-400">Outlined in red: unusual, well above what is typical.</span> : "Nothing unusual."}
        </p>
      )}
      {!t.exact && <p className="text-[11px] text-amber-600 dark:text-amber-400">Older record: some fields were visited more than once, so their bars are approximate.</p>}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Form activity over time">
        <defs>
          <pattern id="jh-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="fill-amber-400/25" />
            <line x1="0" y1="0" x2="0" y2="6" className="stroke-amber-500" strokeWidth="2" />
          </pattern>
        </defs>

        {/* ── TIMELINE: the whole form on one line. It is a summary of the rows below, not one of them. ── */}
        <rect x={0} y={stripTop - 2} width={W} height={STRIP_H + 4 + NAMES_H} rx={5} className="fill-muted/25 stroke-border" />
        <text x={10} y={barTop + STRIP_H / 2 + 3} className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Timeline</text>

        {/* markers: seen, end */}
        {t.seenAt !== null && (
          <g>
            <line x1={x(t.seenAt)} x2={x(t.seenAt)} y1={TOP - 4} y2={H - 4} className="stroke-muted-foreground/30" strokeDasharray="2 3" />
            <text x={x(t.seenAt)} y={TOP - 6} className="fill-muted-foreground text-[10px]" textAnchor="start">seen</text>
          </g>
        )}
        {t.endedAt !== null && t.ended !== "open" && (
          <g>
            <line x1={x(t.endedAt)} x2={x(t.endedAt)} y1={TOP - 4} y2={H - 4} className={t.ended === "submitted" ? "stroke-yellow-500" : "stroke-orange-500"} strokeWidth="1.5" />
            <text x={x(t.endedAt)} y={TOP - 6} className={(t.ended === "submitted" ? "fill-yellow-600 dark:fill-yellow-400" : "fill-orange-600 dark:fill-orange-400") + " text-[10px] font-medium"} textAnchor="end">
              {t.ended === "submitted" ? "submitted" : "gave up"}
            </text>
          </g>
        )}

        {t.seenAt !== null && t.firstInputAt !== null && t.firstInputAt > t.seenAt && (
          <g>
            <rect x={x(t.seenAt)} y={barTop + 5} width={Math.max(1, x(t.firstInputAt) - x(t.seenAt))} height={STRIP_H - 10} rx={2} className="fill-muted-foreground/25" />
            <title>{"Before starting: " + fmt(t.firstInputAt - t.seenAt)}</title>
          </g>
        )}
        {t.segments.map((s, i) => {
          if (s.kind === "move") return null;
          const x1 = x(s.from);
          const w = Math.max(2, x(s.to) - x1);
          const fill = s.kind === "pause" ? "url(#jh-hatch)" : undefined;
          const dur = fmt(s.to - s.from);
          const long = s.kind === "away" ? "left " + dur : s.kind === "otherPage" ? (s.path ?? "other page") + " " + dur : dur;
          const label = fits(long, w) ? long : fits(dur, w) ? dur : "";
          return (
            <g key={"s" + i}>
              <rect x={x1} y={barTop + 2} width={w} height={STRIP_H - 4} rx={3} className={s.kind === "field" ? (s.approx ? "fill-primary/50" : "fill-primary") : KIND_CLASS[s.kind]} fill={fill} />
              {s.kind === "field" &&
                (() => {
                  const idx = t.fields.findIndex((f) => f.key === s.key);
                  const f = idx >= 0 ? t.fields[idx] : null;
                  if (!f || w < 12) return null; // too narrow for even "1."
                  const full = idx + 1 + ". " + f.label;
                  const cutId = "jh-cut-" + (title ?? "x").length + "-" + i;
                  const needed = full.length * 5.4;
                  const overflow = needed > w - 4;
                  // centred over the block; when too long: as much of it as fits, fading out towards the right end
                  return (
                    <g>
                      {overflow && (
                        <defs>
                          <linearGradient id={cutId + "-g"} x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0" stopColor="white" />
                            <stop offset={Math.max(0.35, 1 - 16 / Math.max(w - 4, 1))} stopColor="white" />
                            <stop offset="1" stopColor="white" stopOpacity="0" />
                          </linearGradient>
                          <mask id={cutId + "-m"} maskUnits="userSpaceOnUse" x={x1 + 2} y={stripTop} width={Math.max(w - 4, 1)} height={NAMES_H}>
                            <rect x={x1 + 2} y={stripTop} width={Math.max(w - 4, 1)} height={NAMES_H} fill={"url(#" + cutId + "-g)"} />
                          </mask>
                        </defs>
                      )}
                      <text
                        x={overflow ? x1 + 2 : x1 + w / 2}
                        y={stripTop + 8}
                        textAnchor={overflow ? "start" : "middle"}
                        className="fill-foreground text-[9.5px] font-medium"
                        mask={overflow ? "url(#" + cutId + "-m)" : undefined}
                      >
                        {full}
                      </text>
                    </g>
                  );
                })()}
              {label && (
                <text x={x1 + w / 2} y={barTop + STRIP_H / 2 + 3} textAnchor="middle" className={(s.kind === "pause" ? "fill-amber-900 dark:fill-amber-100" : "fill-white") + " text-[10px] font-medium"}>
                  {label}
                </text>
              )}
              {s.kind === "away" && <text x={x(s.to) + 3} y={barTop + STRIP_H + 12} className="fill-violet-600 text-[10px] dark:fill-violet-300">↩ back</text>}
              <title>{(s.kind === "field" ? "In a field" : s.kind === "away" ? "Away from the site" : s.kind === "otherPage" ? "On " + (s.path ?? "another page") : "Pause") + ": " + fmt(s.to - s.from)}</title>
            </g>
          );
        })}
        {broken.map((b, i) => (
          <text key={"b" + i} x={(x(b.from) + x(b.to)) / 2} y={stripTop - 5} textAnchor="middle" className="fill-muted-foreground text-[10px]">≈ shortened</text>
        ))}

        {/* ── FIELDS: numbered rows, one per field, in the order used ── */}
        <line x1={0} x2={W} y1={fieldsHeaderY - 12} y2={fieldsHeaderY - 12} className="stroke-border" />
        <text x={0} y={fieldsHeaderY + 2} className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Fields, in the order used</text>

        {away.map((s, i) => (
          <rect key={"aw" + i} x={x(s.from)} y={lanesTop - 3} width={Math.max(2, x(s.to) - x(s.from))} height={laneCount * (LANE_H + LANE_GAP)} className="fill-violet-500/10" />
        ))}

        {t.fields.map((f, i) => {
          const y = lanesTop + i * (LANE_H + LANE_GAP);
          const end = Math.max(...f.visits.map((v) => x(v[1])), x(f.firstFocusAt) + 3);
          // other facts about the field, after the bar (the times are inside it)
          const badges = [
            !f.typed ? "nothing typed" : "",
            f.visits.length > 1 ? f.visits.length + " visits" : "",
            f.edits > 1 ? "changed " + f.edits + " times" : "",
            f.filled === false ? "left empty" : "",
            f.errors > 0 ? f.errors + " error" + (f.errors === 1 ? "" : "s") : "",
          ].filter(Boolean);
          const keyAt = f.hesitationMs !== null ? f.firstFocusAt + f.hesitationMs : null;
          const hesitation = f.hesitationMs !== null && f.hesitationMs >= 500 ? f.hesitationMs : null;
          const odd = unusual.fields.has(f.key);
          const typical = reference?.spread?.fields[f.key]?.median ?? null;
          return (
            <g key={f.key}>
              <text x={0} y={y + LANE_H / 2 + 4} className={"text-[11px] " + (odd ? "fill-red-600 font-medium dark:fill-red-400" : f.last ? "fill-foreground font-medium" : "fill-muted-foreground")}>
                <tspan className="fill-muted-foreground/60">{i + 1}. </tspan>
                {(f.label.length > 14 ? f.label.slice(0, 13) + "…" : f.label) + (f.required ? " *" : "") + (f.last ? " ●" : "")}
              </text>
              <rect x={LABEL_W} y={y} width={plotW} height={LANE_H} rx={3} className={odd ? "fill-red-500/5 stroke-red-500" : "fill-muted/30"} strokeWidth={odd ? 1.5 : undefined} />
              {f.approx ? (
                (() => {
                  const p = x(f.firstFocusAt);
                  const w = Math.max(3, end - p);
                  const txt = fmt(f.focusedMs);
                  return (
                    <g>
                      <rect x={p} y={y + 1} width={w} height={LANE_H - 2} rx={3} className="fill-primary/20 stroke-primary" strokeDasharray="3 2" />
                      {fits(txt, w) && <text x={p + w / 2} y={y + LANE_H / 2 + 3.5} textAnchor="middle" className="fill-foreground text-[10px] font-medium">{txt}</text>}
                    </g>
                  );
                })()
              ) : (
                f.visits.map(([va, vb], j) => {
                  const p = x(va);
                  const q = Math.max(p + 3, x(vb));
                  const w = q - p;
                  const k = keyAt !== null && keyAt >= va && keyAt <= vb ? Math.min(q, x(keyAt)) : j === 0 && keyAt === null ? q : p;
                  const mine = vb - va; // this visit's seconds
                  const withHesitation = hesitation !== null && keyAt !== null && keyAt >= va && keyAt <= vb;
                  // "13 s · 5 s before typing" when it fits, else "13 s", else nothing inside
                  // The light start is the time before typing and the solid part is the time typing: each carries its OWN seconds,
                  // so they add up to the visit ("2 s" + "11 s" = 13 s). If the light part is too short for its seconds, the
                  // old single text on the solid part is used ("13 s (2 s before typing)", or just "13 s").
                  const dimW = k - p;
                  const solidW = q - k;
                  const splitText = withHesitation && fitsTight(fmt(hesitation!), dimW);
                  const dimText = splitText ? fmt(hesitation!) : "";
                  const solidSplit = splitText ? fmt(Math.max(0, mine - hesitation!)) : "";
                  const full = fmt(mine) + (withHesitation ? " (" + fmt(hesitation!) + " before typing)" : "");
                  const text = splitText ? (fitsTight(solidSplit, solidW) ? solidSplit : "") : fits(full, w) ? full : fits(fmt(mine), w) ? fmt(mine) : "";
                  const cx = splitText ? k + solidW / 2 : text && solidW >= text.length * CHAR_W + 8 ? k + solidW / 2 : p + w / 2;
                  return (
                    <g key={j}>
                      <rect x={p} y={y + 1} width={Math.max(0, k - p)} height={LANE_H - 2} rx={3} className="fill-primary/35" />
                      <rect x={k} y={y + 1} width={Math.max(0, q - k)} height={LANE_H - 2} rx={3} className="fill-primary" />
                      {dimText && (
                        <text x={p + dimW / 2} y={y + LANE_H / 2 + 3.5} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
                          {dimText}
                        </text>
                      )}
                      {text && (
                        <text x={cx} y={y + LANE_H / 2 + 3.5} textAnchor="middle" className="fill-primary-foreground text-[10px] font-medium" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.25)", strokeWidth: 2 }}>
                          {text}
                        </text>
                      )}
                    </g>
                  );
                })
              )}
              {/* a visit too narrow for its seconds: the seconds sit just after the bar instead */}
              {!f.approx && f.visits.length === 1 && !fits(fmt(f.visits[0][1] - f.visits[0][0]), Math.max(3, end - x(f.visits[0][0]))) && (
                <text x={Math.min(end + 4, W - 4)} y={y + LANE_H / 2 + 3.5} className="fill-muted-foreground text-[10px]" textAnchor={end + 40 > W ? "end" : "start"}>
                  {fmt(f.focusedMs)}
                </text>
              )}
              {f.errors > 0 && <circle cx={end - 2} cy={y + 2} r={3.5} className="fill-red-500" />}
              {badges.length > 0 &&
                (() => {
                  // The other facts (visits, corrections, left empty, errors) go in a free stretch of THIS row, never over a bar:
                  // after the last bar, in a gap between visits, or before the first bar. The first stretch they fit in; if none
                  // fits the whole text, as many of them as fit (the tooltip has all).
                  const secondsAfter = !f.approx && f.visits.length === 1 && !fits(fmt(f.visits[0][1] - f.visits[0][0]), Math.max(3, end - x(f.visits[0][0])));
                  const bars = (f.approx ? [[x(f.firstFocusAt), end]] : f.visits.map(([va, vb]) => [x(va), Math.max(x(va) + 3, x(vb))])).sort((p, q) => p[0] - q[0]) as [number, number][];
                  const free: [number, number][] = [];
                  let cur = LABEL_W + 4;
                  for (const [p, q] of bars) {
                    if (p - 6 > cur) free.push([cur, p - 6]);
                    cur = Math.max(cur, q + 6);
                  }
                  if (W - 4 > cur + (secondsAfter ? 40 : 0)) free.push([cur + (secondsAfter ? 40 : 0), W - 4]);
                  const widest = (list: string[]) => list.join(" · ");
                  let chosen: { from: number; text: string } | null = null;
                  for (let n = badges.length; n >= 1 && !chosen; n--) {
                    const text = widest(badges.slice(0, n));
                    const need = text.length * CHAR_W + 8;
                    const spot = [...free].reverse().find(([p, q]) => q - p >= need); // prefer the right-most stretch
                    if (spot) chosen = { from: spot[0] + 2, text: text + (n < badges.length ? " …" : "") };
                  }
                  if (!chosen) return null;
                  return (
                    <text x={chosen.from} y={y + LANE_H / 2 + 3.5} className={"text-[10px] " + (f.errors > 0 ? "fill-red-600 dark:fill-red-400" : "fill-muted-foreground")}>
                      {chosen.text}
                    </text>
                  );
                })()}
              {/* one string: an SVG <title> with several text children does not hydrate the same as the server's HTML */}
              <title>
                {`${f.label}: ${fmt(f.focusedMs)} focused over ${f.visits.length} visit${f.visits.length === 1 ? "" : "s"}` +
                  (f.approx ? " (old record: bar spans first to last visit)" : "") +
                  (f.hesitationMs !== null ? ", " + fmt(f.hesitationMs) + " before the first key" : ", no key pressed") +
                  (f.filled === false ? ", left empty" : f.filled === true ? ", filled" : "") +
                  (f.errors > 0 ? ", " + f.errors + " validation error(s)" : "") +
                  (typical !== null ? ". Typical: " + fmt(typical) + (odd ? " (unusual)" : "") : "")}
              </title>
            </g>
          );
        })}

        {t.untouched.map((u, i) => {
          const y = lanesTop + (t.fields.length + i) * (LANE_H + LANE_GAP);
          return (
            <g key={"u" + u.key}>
              <text x={0} y={y + LANE_H / 2 + 4} className="fill-muted-foreground/70 text-[11px]">
                <tspan className="fill-muted-foreground/40">{t.fields.length + i + 1}. </tspan>
                {(u.label.length > 14 ? u.label.slice(0, 13) + "…" : u.label) + (u.required ? " *" : "")}
              </text>
              <rect x={LABEL_W} y={y} width={plotW} height={LANE_H} rx={3} className="fill-transparent stroke-muted-foreground/30" strokeDasharray="4 3" />
              <text x={LABEL_W + 8} y={y + LANE_H / 2 + 3.5} className={"text-[10px] " + (u.errors > 0 ? "fill-red-600 dark:fill-red-400" : "fill-muted-foreground")}>
                never touched{u.required ? " (required)" : ""}
                {u.errors > 0 ? " · failed validation " + u.errors + " time" + (u.errors === 1 ? "" : "s") : ""}
              </text>
            </g>
          );
        })}
      </svg>

      {/* the key: what the colours and the text inside the bars mean */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-primary/35" />clicked in, not typing yet</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-primary" />typing</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-amber-400" />pause</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-sky-500" />another page</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm bg-violet-500" />left the site (↩ came back)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-red-500" />validation error</span>
        <span>In a bar: light part = seconds before typing, solid part = seconds typing (together: the time in the field)</span>
        <span>* required · ● the field they were on at the end</span>
        {reference && <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-4 rounded-sm border border-red-500" />unusual: well above the typical successful submission</span>}
      </div>
    </figure>
  );
}
