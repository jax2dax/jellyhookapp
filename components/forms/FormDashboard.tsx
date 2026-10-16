// components/forms/FormDashboard.tsx
// The form dashboard (presentation only). It always shows the CURRENT version of the form, over its whole life. When a
// comparison is chosen at the top (all time, an older version, or dates), every card also shows the other side and the
// change, the healthy reference (the median successful submission of that side) is drawn above the current one, and the
// field table marks what changed. Without a comparison nothing is compared or flagged.
// Data: lib/actions/formDashboard.action.ts. Rules: mds/build/form-study/averages-and-versions.md.
// No chart library: plain bars, so it stays light and prints well. Empty (not zero) is shown as "-".
import { MIN_COMPARE_STARTED, type AvgField } from "@/jh-forms/averages";
import type { FieldRow } from "@/jh-forms/dashboard";
import type { DashboardResponse, Side } from "@/lib/actions/formDashboard.action";
import { fmtMs, Journey } from "./FormAverages";

export type DashboardData = Extract<DashboardResponse, { ok: true }>;
export type ShowMode = "num" | "pct";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "-" : Math.round(v * 100) + "%");
const n = (v: number) => v.toLocaleString();
const perDay = (v: number) => (v >= 10 ? Math.round(v).toString() : v.toFixed(1));

type Tone = "good" | "bad" | "flat";
const TONE: Record<Tone, string> = { good: "text-emerald-600 dark:text-emerald-400", bad: "text-red-600 dark:text-red-400", flat: "text-muted-foreground" };
/** up is good for most cards; for "not submitted" and the times, up is bad */
const toneOf = (diff: number, upIsGood: boolean, eps = 0): Tone => (Math.abs(diff) <= eps ? "flat" : diff > 0 === upIsGood ? "good" : "bad");
const arrow = (diff: number) => (diff > 0 ? "▲" : diff < 0 ? "▼" : "");

interface CardCmp {
  other: string;
  change: string | null;
  tone: Tone;
  title?: string;
}

function Card({ label, value, sub, cmp, tone }: { label: string; value: string; sub?: string; cmp?: CardCmp | null; tone?: string }) {
  return (
    <div className="min-w-36 flex-1 rounded-lg border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"mt-1 text-2xl font-semibold tabular-nums " + (tone ?? "text-foreground")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      {cmp && (
        <div className="mt-1.5 space-y-0.5 border-t pt-1.5 text-[11px] tabular-nums" title={cmp.title}>
          <div className={tone ?? "text-foreground"}>{cmp.other}</div>
          {cmp.change && <div className={"font-medium " + TONE[cmp.tone]}>{cmp.change}</div>}
        </div>
      )}
    </div>
  );
}

/** Enough started forms on both sides to compare at all (decision 6). */
function comparable(cur: Side, other: Side | null): boolean {
  return !!other && cur.dashboard.funnel.started >= MIN_COMPARE_STARTED && other.dashboard.funnel.started >= MIN_COMPARE_STARTED;
}

/** A count card: in "num" the count (compared per day, since the two sides span different lengths); in "pct" its rate. */
function countCmp(mode: ShowMode, cur: { count: number; rate: number | null; days: number }, other: { count: number; rate: number | null; days: number } | null, ok: boolean, upIsGood: boolean, rateWord: string): CardCmp | null {
  if (!other) return null;
  if (mode === "pct" && cur.rate !== null && other.rate !== null) {
    const diff = Math.round((cur.rate - other.rate) * 100);
    return {
      other: "vs " + pct(other.rate),
      change: ok ? (diff === 0 ? "no change" : arrow(diff) + " " + Math.abs(diff) + "% " + (diff > 0 ? "higher" : "lower")) : "too few to compare",
      tone: ok ? toneOf(diff, upIsGood) : "flat",
      title: `${pct(cur.rate)} vs ${pct(other.rate)} ${rateWord}: a difference of ${Math.abs(diff)} percentage points`,
    };
  }
  // counts are not compared as a change: two periods of different length always differ. The change is the rate.
  const diff = cur.rate !== null && other.rate !== null ? Math.round((cur.rate - other.rate) * 100) : null;
  return {
    other: "vs " + n(other.count),
    change: diff === null ? null : !ok ? "too few to compare" : diff === 0 ? "same rate" : arrow(diff) + " " + Math.abs(diff) + "% " + (diff > 0 ? "higher" : "lower") + " rate",
    tone: ok && diff !== null ? toneOf(diff, upIsGood) : "flat",
    title: rateWord ? `${pct(cur.rate)} vs ${pct(other.rate)} ${rateWord}` : undefined,
  };
}

function timeCmp(cur: number | null | undefined, other: number | null | undefined, ok: boolean): CardCmp | null {
  if (other === undefined) return null;
  if (cur === null || cur === undefined || other === null) return { other: "vs " + fmtMs(other), change: null, tone: "flat" };
  const d = cur - other;
  return {
    other: "vs " + fmtMs(other),
    change: !ok ? "too few to compare" : Math.abs(d) < 1000 ? "about the same" : fmtMs(Math.abs(d)) + (d < 0 ? " faster" : " slower"),
    tone: ok ? toneOf(d, false, 999) : "flat",
  };
}

function Cards({ d, mode }: { d: DashboardData; mode: ShowMode }) {
  const cur = d.current;
  const oth = d.compare;
  const f = cur.dashboard.funnel;
  const g = oth?.dashboard.funnel ?? null;
  const ok = comparable(cur, oth);
  const side = (s: Side, count: number, rate: number | null) => ({ count, rate, days: s.days });
  const abandonedOf = (x: typeof f) => (x.started > 0 ? x.abandoned / x.started : null);
  const day = (count: number) => " · " + perDay(count / cur.days) + "/day";
  return (
    <div className="flex flex-wrap gap-3">
      <Card label="Saw the form" value={n(f.seen)} sub={"on screen" + day(f.seen)} cmp={g && oth && countCmp("num", side(cur, f.seen, null), side(oth, g.seen, null), ok, true, "")} />
      <Card label="Started" value={mode === "pct" ? pct(f.startRate) : n(f.started)} sub={(mode === "pct" ? n(f.started) + " of " + n(f.seen) + " seen" : pct(f.startRate) + " of those seen") + day(f.started)} cmp={g && oth && countCmp(mode, side(cur, f.started, f.startRate), side(oth, g.started, g.startRate), ok, true, "of those seen")} />
      <Card label="Submitted" value={mode === "pct" ? pct(f.completionRate) : n(f.submitted)} sub={(mode === "pct" ? n(f.submitted) + " of " + n(f.started) + " started" : pct(f.completionRate) + " of those started") + day(f.submitted)} tone="text-yellow-600 dark:text-yellow-400" cmp={g && oth && countCmp(mode, side(cur, f.submitted, f.completionRate), side(oth, g.submitted, g.completionRate), ok, true, "of those started")} />
      <Card
        label="Quit the form"
        value={mode === "pct" ? pct(abandonedOf(f)) : n(f.abandoned)}
        sub={(mode === "pct" ? n(f.abandoned) + " of " + n(f.started) + " started" : pct(abandonedOf(f)) + " of those started") + day(f.abandoned) + (f.inProgress > 0 ? " · " + f.inProgress + " still in progress" : "")}
        tone="text-orange-600 dark:text-orange-400"
        cmp={g && oth && countCmp(mode, side(cur, f.abandoned, abandonedOf(f)), side(oth, g.abandoned, abandonedOf(g)), ok, false, "of those started")}
      />
      <Card label="Median total time" value={fmtMs(cur.reference?.form.fillMs)} sub="first input to submit" cmp={oth && timeCmp(cur.reference?.form.fillMs, oth.reference?.form.fillMs ?? null, ok)} />
      <Card label="Before typing" value={fmtMs(cur.reference?.form.beforeTypingMs)} sub="form on screen, nothing typed yet" cmp={oth && timeCmp(cur.reference?.form.beforeTypingMs, oth.reference?.form.beforeTypingMs ?? null, ok)} />
    </div>
  );
}

/** The current version's fields, in its order: Hook numbers (by field name) joined with the median journey (by key). */
function fieldRows(d: DashboardData): { key: string; name: string; hook: FieldRow | undefined; avg: AvgField | undefined; other: FieldRow | undefined; otherAvg: AvgField | undefined }[] {
  const cur = d.current;
  const label = (k: string) => (k.startsWith("custom:") ? k.slice(7) || "field" : k);
  const keys = cur.reference?.fields.map((f) => f.key) ?? d.versions.find((v) => v.current)?.fields.map((f) => f.key) ?? cur.dashboard.fields.map((f) => f.name);
  const known = new Set(keys.map(label));
  const extra = cur.dashboard.fields.filter((f) => !known.has(f.name)).map((f) => f.name);
  return [...keys, ...extra].map((key) => {
    const name = label(key);
    return {
      key,
      name,
      hook: cur.dashboard.fields.find((f) => f.name === name),
      avg: cur.reference?.fields.find((f) => f.key === key),
      other: d.compare?.dashboard.fields.find((f) => f.name === name),
      otherAvg: d.compare?.reference?.fields.find((f) => f.key === key),
    };
  });
}

function Delta({ cur, other, ok, upIsGood = false, kind = "ms" }: { cur: number | null | undefined; other: number | null | undefined; ok: boolean; upIsGood?: boolean; kind?: "ms" | "share" }) {
  if (!ok || cur === null || cur === undefined || other === null || other === undefined) return null;
  const d = cur - other;
  const text = kind === "share" ? (Math.round(d * 100) === 0 ? "same" : (d > 0 ? "+" : "-") + Math.abs(Math.round(d * 100)) + "%") : Math.abs(d) < 1000 ? "same" : (d > 0 ? "+" : "-") + fmtMs(Math.abs(d));
  const tone = text === "same" ? "flat" : toneOf(d, upIsGood);
  return <div className={"text-[10px] " + TONE[tone]} title={"vs " + (kind === "share" ? pct(other) : fmtMs(other))}>{text}</div>;
}

function FieldTable({ d }: { d: DashboardData }) {
  const rows = fieldRows(d);
  const ok = comparable(d.current, d.compare);
  const ab = d.current.dashboard.funnel.abandoned;
  const abOther = d.compare?.dashboard.funnel.abandoned ?? 0;
  const u = d.unusual;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-232 text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 text-right font-medium" title="People who clicked into it, of those who started the form">Used</th>
            <th className="px-3 py-2 text-right font-medium" title="Median time in the field, submitted forms typed by hand">Time in it</th>
            <th className="px-3 py-2 text-right font-medium" title="Median time from clicking in to the first key">Before typing</th>
            <th className="px-3 py-2 text-right font-medium" title="Of those who paused 1.5 s or more after the field: their median pause, and how many they were">Pause after</th>
            <th className="px-3 py-2 text-right font-medium" title="Submitted without ever clicking into it">Skipped</th>
            <th className="px-3 py-2 text-right font-medium" title="Abandoned forms that ended on this field">Quit here</th>
            <th className="px-3 py-2 text-right font-medium" title="Times the browser refused a submit because of this field">Errors</th>
            <th className="px-3 py-2 text-right font-medium" title="Filled with no key press: autofill, a password manager or paste. Not part of the times.">Autofill or paste</th>
            {u && <th className="px-3 py-2 text-right font-medium" title={"Submitted forms of the current version whose time in this field is well above the reference (of the newest " + u.of + ")"}>Took much longer than most</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const gave = r.hook?.gaveUp ?? 0;
            const share = ab > 0 ? gave / ab : null;
            const otherShare = abOther > 0 ? (r.other?.gaveUp ?? 0) / abOther : null;
            const odd = u ? u.fields[r.key] ?? 0 : 0;
            return (
              <tr key={r.key} className="border-t align-top">
                <td className="px-3 py-2 font-medium text-foreground">
                  {i + 1}. {r.name}
                  {r.hook?.required && <span className="ml-1 text-muted-foreground" title="required">*</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.hook ? (
                    <>
                      {pct(r.hook.reach)}
                      <div className="text-[10px] text-muted-foreground">{r.hook.touched} of {r.hook.rows}</div>
                    </>
                  ) : "-"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtMs(r.avg?.inFieldMs)}
                  <Delta cur={r.avg?.inFieldMs} other={r.otherAvg?.inFieldMs} ok={ok} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtMs(r.avg?.hesitationMs)}
                  <Delta cur={r.avg?.hesitationMs} other={r.otherAvg?.hesitationMs} ok={ok} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.avg?.pauseAfterMs == null ? <span className="text-muted-foreground">none</span> : <>{fmtMs(r.avg.pauseAfterMs)} <span className="text-[10px] text-muted-foreground">({pct(r.avg.pausedShare)})</span></>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {pct(r.avg?.skippedShare ?? null)}
                  <Delta cur={r.avg?.skippedShare} other={r.otherAvg?.skippedShare} ok={ok} kind="share" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {gave > 0 ? <>{gave} <span className="text-[10px] text-muted-foreground">({pct(share)})</span></> : <span className="text-muted-foreground">0</span>}
                  <Delta cur={share} other={otherShare} ok={ok} kind="share" />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.hook?.errors || <span className="text-muted-foreground">0</span>}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.avg?.filledWithoutTyping || <span className="text-muted-foreground">0</span>}</td>
                {u && <td className={"px-3 py-2 text-right tabular-nums " + (odd > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>{odd}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GiveUps({ d }: { d: DashboardData }) {
  const rows = fieldRows(d).filter((r) => (r.hook?.gaveUp ?? 0) > 0 || (r.other?.gaveUp ?? 0) > 0);
  const ab = d.current.dashboard.funnel.abandoned;
  const abOther = d.compare?.dashboard.funnel.abandoned ?? 0;
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nobody has stopped part-way in this version yet.</p>;
  return (
    <div className="space-y-2">
      {rows
        .sort((a, b) => (b.hook?.gaveUp ?? 0) - (a.hook?.gaveUp ?? 0))
        .map((r) => {
          const share = ab > 0 ? (r.hook?.gaveUp ?? 0) / ab : 0;
          const other = d.compare && abOther > 0 ? (r.other?.gaveUp ?? 0) / abOther : null;
          return (
            <div key={r.key} className="grid grid-cols-[7rem_1fr_6rem] items-center gap-2 text-sm">
              <span className="truncate text-muted-foreground" title={r.name}>{r.name}</span>
              <span className="relative h-4 overflow-hidden rounded bg-muted/40">
                <span className="block h-full rounded bg-orange-500" style={{ width: share * 100 + "%" }} />
                {other !== null && <span className="absolute top-0 h-full w-0.5 bg-foreground/70" style={{ left: "calc(" + other * 100 + "% - 1px)" }} title={"Comparison: " + pct(other)} />}
              </span>
              <span className="text-right text-xs tabular-nums">
                {r.hook?.gaveUp ?? 0} <span className="text-muted-foreground">({pct(share)})</span>
              </span>
            </div>
          );
        })}
      <p className="text-[11px] text-muted-foreground">Of the people who quit, the share who stopped at each field{d.compare ? ". The dark line is the comparison." : "."}</p>
    </div>
  );
}

/** "Oct 11" */
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What the comparison is called in plain words: before the change, typical (all time), or the chosen dates. */
function compareName(d: DashboardData): { short: string; since: string | null } {
  const c = d.compareChoice;
  const curVersion = d.versions.find((v) => v.current);
  if (c.kind === "version") {
    const prev = d.versions.filter((v) => !v.current)[0];
    if (prev && prev.id === c.id && curVersion) return { short: "Before your change", since: "Since you changed the form on " + shortDay(curVersion.startedAt) };
    const v = d.versions.find((x) => x.id === c.id);
    return { short: "Version " + (v?.label ?? ""), since: "Compared with the version " + (v?.label ?? "") };
  }
  if (c.kind === "all") return { short: "Typical (all time)", since: "Compared with all time" };
  if (c.kind === "custom") return { short: "Typical (" + c.from + " to " + c.to + ")", since: "Compared with " + c.from + " to " + c.to };
  return { short: "", since: null };
}

/** The answer first: how many finish, where the rest stop, and what changed. */
function Summary({ d }: { d: DashboardData }) {
  const f = d.current.dashboard.funnel;
  const g = d.compare?.dashboard.funnel ?? null;
  const top = [...d.current.dashboard.fields].sort((a, b) => b.gaveUp - a.gaveUp)[0];
  const share = top && f.abandoned > 0 ? top.gaveUp / f.abandoned : 0;
  const oneIn = share > 0 ? Math.max(1, Math.round(1 / share)) : null;
  const name = compareName(d);
  const ok = comparable(d.current, d.compare);
  const a = d.current.reference?.form.fillMs;
  const b = d.compare?.reference?.form.fillMs;
  const dt = a != null && b != null ? a - b : null;
  return (
    <div className="space-y-1.5 rounded-lg border bg-card px-5 py-4 text-base text-foreground">
      <p>
        <strong>{pct(f.completionRate)}</strong> of people who start your form send it.
        {top && top.gaveUp > 0 && (
          <>
            {" "}Most who quit stop at <strong>{top.name}</strong>
            {oneIn ? <span className="text-muted-foreground"> ({oneIn === 1 ? "almost all of them" : "1 in " + oneIn})</span> : null}.
          </>
        )}
      </p>
      {g && name.since && (
        <p>
          {name.since}:{" "}
          {ok ? (
            <>
              <strong>{pct(f.completionRate)}</strong> finish it (was {pct(g.completionRate)}).
              {dt !== null && Math.abs(dt) >= 1000 ? ` People spend ${fmtMs(Math.abs(dt))} ${dt < 0 ? "less" : "more"} on it.` : ""}
            </>
          ) : (
            <span className="text-muted-foreground">too few forms yet to compare ({n(f.started)} vs {n(g.started)} started, 30 needed on each side).</span>
          )}
        </p>
      )}
    </div>
  );
}

export function FormDashboardView({ d, mode }: { d: DashboardData; mode: ShowMode }) {
  const cur = d.current;
  const oth = d.compare;
  const curVersion = d.versions.find((v) => v.current);
  const pages = curVersion?.pages.length ? curVersion.pages : cur.dashboard.pages.map((p) => p.page);
  const keys = cur.reference?.fields.map((f) => f.key);
  const name = compareName(d);
  if (cur.dashboard.funnel.seen === 0) return <p className="rounded-lg border p-6 text-sm text-muted-foreground">Nobody has seen this form yet since it was last changed.</p>;
  return (
    <div className="space-y-8">
      <p className="text-xs text-muted-foreground">
        {curVersion ? "This form since " + shortDay(curVersion.startedAt) : "This form, all time"}
        {pages.length ? " · on " + pages.join(", ") : ""}
      </p>

      <Summary d={d} />

      <Cards d={d} mode={mode} />

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Where people quit</h2>
        <GiveUps d={d} />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">How long a typical sender takes</h2>
        {oth && (
          <div className="rounded-lg border border-emerald-500/40 bg-card p-4">
            <div className="mb-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">{name.short}</div>
            {oth.reference ? <Journey fields={oth.reference.fields} typed={oth.reference.typed} keys={keys} /> : <p className="text-sm text-muted-foreground">Nobody sent the form in this period.</p>}
          </div>
        )}
        <div className="rounded-lg border bg-card p-4">
          {oth && <div className="mb-3 text-xs font-medium text-muted-foreground">Now</div>}
          {cur.reference ? <Journey fields={cur.reference.fields} typed={cur.reference.typed} /> : <p className="text-sm text-muted-foreground">Nobody has sent the form yet since it was last changed.</p>}
        </div>
        {cur.reference && cur.reference.withoutTyping > 0 && <p className="text-xs text-muted-foreground">{cur.reference.withoutTyping} of {cur.reference.sampled} used autofill or paste; their times are left out.</p>}
      </section>

      <details className="group rounded-lg border">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground">
          Field details <span className="ml-1 text-xs font-normal text-muted-foreground group-open:hidden">show</span>
        </summary>
        <div className="space-y-2 border-t p-4">
          <FieldTable d={d} />
          <p className="text-xs text-muted-foreground">* required. Times are for people who sent the form, typed by hand.</p>
        </div>
      </details>
    </div>
  );
}
