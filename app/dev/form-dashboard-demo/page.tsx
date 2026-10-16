// app/dev/form-dashboard-demo/page.tsx
// DEMO with FAKE data: the form dashboard as the real page draws it (components/forms/FormDashboard.tsx and
// FormActivityChart). The rows (fakeData.ts) go through the real version rule (placeInVersion), the real dashboard
// assembly (assembleDashboard, fed the same answer tables the Hook queries return, computed here from the rows), the
// real medians, spreads and unusual check. Only the rows are invented, and the Hook step is replaced by plain counting.
// ?compare=off|all|v:<id>  &show=pct
import Link from "next/link";
import { FormActivityChart } from "@/components/forms/FormActivityChart";
import { FormDashboardView, type DashboardData } from "@/components/forms/FormDashboard";
import { median, placeInVersion, summarizeVersion, TOTAL_KEYS, unusualIn, versionLabel, type FormVersion, type TotalKey } from "@/jh-forms/averages";
import { collectFormActivities } from "@/jh-forms/collect";
import { assembleDashboard, type DashboardAnswers, type Rows } from "@/jh-forms/dashboard";
import { buildFormTimeline, type EngagementRow, type FieldTiming, type FormFieldDef } from "@/jh-forms/timeline";
import type { Side, VersionInfo } from "@/lib/actions/formDashboard.action";
import { fakeRows } from "./fakeData";

const DAY = 86_400_000;
const label = (k: string) => (k.startsWith("custom:") ? k.slice(7) : k);
const ms = (s?: string | null) => (s ? Date.parse(s) : null);

/** The answer tables the dashboard's Hook queries would return for these rows (demo stand-in for the database). */
function answersFrom(rows: EngagementRow[]): DashboardAnswers {
  const count = (pick: (r: EngagementRow) => string | null | undefined, list = rows): Rows => {
    const m = new Map<string, number>();
    for (const r of list) {
      const k = pick(r);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].map(([key, value]) => ({ key, value }));
  };
  const med = (list: EngagementRow[], by: (r: EngagementRow) => string | null, val: (r: EngagementRow) => number | null): Rows => {
    const m = new Map<string, number[]>();
    for (const r of list) {
      const v = val(r);
      if (v !== null) m.set(by(r) ?? "", [...(m.get(by(r) ?? "") ?? []), v]);
    }
    return [...m].map(([key, vs]) => ({ key, value: median(vs) }));
  };
  const started = rows.filter((r) => r.status !== "viewed");
  const sub = rows.filter((r) => r.status === "submitted");
  const day = (r: EngagementRow) => r.viewed_at?.slice(0, 10);
  // one entry per (form, field): touched entries from field_timings, untouched ones from the field list
  const fields = rows.flatMap((r) => {
    const ft = (r.field_timings ?? {}) as Record<string, FieldTiming>;
    const lastKey = r.last_field_type === "custom" ? "custom:" + r.last_field_key : r.last_field_type;
    const touched = Object.entries(ft).map(([key, t]) => ({ r, key, t, last: key === lastKey }));
    const rest = (r.form_fields ?? []).filter((d) => !ft[d.key]).map((d) => ({ r, key: d.key, t: null as FieldTiming | null, last: false }));
    return [...touched, ...rest].map((e) => ({ ...e, def: (r.form_fields ?? []).find((d) => d.key === e.key) }));
  });
  type E = (typeof fields)[number];
  const byField = (list: E[], val?: (e: E) => number | null): Rows => {
    const m = new Map<string, number[]>();
    for (const e of list) {
      const v = val ? val(e) : 1;
      if (v !== null) m.set(label(e.key), [...(m.get(label(e.key)) ?? []), v]);
    }
    return [...m].map(([key, vs]) => ({ key, value: val ? median(vs) : vs.length }));
  };
  const sum = (list: E[], val: (e: E) => number): Rows => {
    const m = new Map<string, number>();
    for (const e of list) m.set(label(e.key), (m.get(label(e.key)) ?? 0) + val(e));
    return [...m].map(([key, value]) => ({ key, value }));
  };
  const touched = fields.filter((e) => e.t?.firstFocusAt);
  return {
    statusCounts: count((r) => r.status),
    pagesSeen: count((r) => r.page_path),
    pagesStarted: count((r) => r.page_path, started),
    pagesSubmitted: count((r) => r.page_path, sub),
    pagesAbandoned: count((r) => r.page_path, rows.filter((r) => r.status === "abandoned")),
    pagesFillTime: med(sub, (r) => r.page_path, (r) => (ms(r.ended_at) ?? 0) - (ms(r.first_input_at) ?? 0)),
    pagesBeforeTyping: med(started, (r) => r.page_path, (r) => r.onscreen_before_start_ms ?? null),
    pagesToFirstInput: med(started, (r) => r.page_path, (r) => (ms(r.first_input_at) ?? 0) - (ms(r.viewed_at) ?? 0)),
    dailySeen: count(day),
    dailyStarted: count(day, started),
    dailySubmitted: count(day, sub),
    fieldRows: byField(fields),
    fieldTouched: byField(touched),
    fieldFocus: byField(touched, (e) => e.t!.totalFocusedMs ?? null),
    fieldHesitation: byField(touched.filter((e) => e.t!.firstKeydownAt), (e) => (ms(e.t!.firstKeydownAt) ?? 0) - (ms(e.t!.firstFocusAt) ?? 0)),
    fieldGaveUp: byField(fields.filter((e) => e.last && e.r.status === "abandoned")),
    fieldCorrected: byField(fields.filter((e) => (e.t?.edits ?? 0) > 1)),
    fieldErrors: sum(fields.filter((e) => (e.t?.errors ?? 0) > 0), (e) => e.t!.errors ?? 0),
    fieldLeftEmpty: byField(fields.filter((e) => e.t?.filled === false)),
    fieldRequired: byField(fields.filter((e) => e.def?.required)),
  } as DashboardAnswers;
}

function side(lbl: string, rows: EngagementRow[], fields: FormFieldDef[], start: number, end: number): Side {
  return {
    label: lbl,
    scope: { formKey: "id:contact" },
    days: Math.max(1, (end - start) / DAY),
    dashboard: assembleDashboard(answersFrom(rows)),
    reference: rows.some((r) => r.status === "submitted") ? summarizeVersion(rows.filter((r) => r.status === "submitted"), fields, []) : null,
    frozen: false,
  };
}

export default async function FormDashboardDemoPage({ searchParams }: { searchParams: Promise<{ compare?: string; show?: string }> }) {
  const { compare = "off", show } = await searchParams;
  const now = Date.parse("2026-10-15T12:00:00Z");

  let vs: FormVersion[] = [];
  let k = 0;
  const rowsOf = new Map<string, EngagementRow[]>();
  for (const row of fakeRows) {
    const p = placeInVersion(vs, row.form_fields ?? [], Date.parse(row.viewed_at!), () => "00000000-0000-0000-0000-00000000000" + ++k);
    vs = p.versions;
    rowsOf.set(p.versionId, [...(rowsOf.get(p.versionId) ?? []), { ...row, form_version_id: p.versionId }]);
  }
  const versions: VersionInfo[] = [...vs].reverse().map((v) => ({ id: v.id, label: versionLabel(v), startedAt: new Date(v.startedAt).toISOString(), endedAt: v.endedAt ? new Date(v.endedAt).toISOString() : null, current: v.endedAt === null, layouts: v.fingerprints.length, pages: ["/contact", "/demo"], fields: v.fields }));
  const cur = vs[vs.length - 1];
  const curRows = rowsOf.get(cur.id) ?? [];
  const current = side("Current version (" + versionLabel(cur) + ")", curRows, cur.fields, cur.startedAt, now);

  let other: Side | null = null;
  if (compare === "all") other = side("All time (every version)", [...rowsOf.values()].flat(), cur.fields, Date.parse(fakeRows[0].viewed_at!), now);
  const picked = compare.startsWith("v:") ? vs.find((v) => v.id === compare.slice(2)) : null;
  if (picked) other = side("Version " + versionLabel(picked), rowsOf.get(picked.id) ?? [], picked.fields, picked.startedAt, picked.endedAt ?? now);

  let unusual: DashboardData["unusual"] = null;
  if (other?.reference) {
    const subs = curRows.filter((r) => r.status === "submitted");
    unusual = { of: subs.length, fields: {}, totals: Object.fromEntries(TOTAL_KEYS.map((t) => [t, 0])) as Record<TotalKey, number> };
    for (const r of subs) {
      const u = unusualIn(buildFormTimeline(r, []), other.reference);
      for (const f of u.fields) unusual.fields[f] = (unusual.fields[f] ?? 0) + 1;
      for (const t of u.totals) unusual.totals[t] += 1;
    }
  }
  const data: DashboardData = {
    ok: true, forms: [{ key: "id:contact", label: "#contact", started: 0, submitted: 0 }], form: "id:contact", versions, versionsReady: true,
    compareChoice: compare === "all" ? { kind: "all" } : picked ? { kind: "version", id: picked.id } : { kind: "off" },
    current, compare: other, unusual, credits: 0, ms: 0, at: new Date(now).toISOString(),
  };
  // unusual people first, so the demo shows what a red outline looks like
  const all = collectFormActivities(curRows, []);
  const list = other?.reference ? [...all].sort((a, b) => Number(unusualIn(b.timeline, other!.reference).fields.size > 0) - Number(unusualIn(a.timeline, other!.reference).fields.size > 0)).slice(0, 12) : all.slice(0, 12);
  const href = (c: string, s = show) => "?" + new URLSearchParams({ ...(c !== "off" ? { compare: c } : {}), ...(s === "pct" ? { show: "pct" } : {}) });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
        <h1 className="text-xl font-semibold">Form engagement</h1>
        <p className="mt-1 text-sm text-muted-foreground">One lead form (#contact on /contact and /demo), changed twice. The real page has a dropdown and a calendar here; the demo uses links.</p>
      </header>
      <nav className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
        <span className="text-xs text-muted-foreground">Compare to:</span>
        {[["off", "No comparison"], ["all", "All time"], ...versions.filter((v) => !v.current).map((v) => ["v:" + v.id, "Version " + v.label])].map(([c, l]) => (
          <Link key={c} href={href(c)} className={"rounded-md px-2 py-1 " + (compare === c ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>{l}</Link>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">Show:</span>
        <Link href={href(compare, "num")} className={"rounded-md px-2 py-1 " + (show !== "pct" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>Numbers</Link>
        <Link href={href(compare, "pct")} className={"rounded-md px-2 py-1 " + (show === "pct" ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>%</Link>
      </nav>
      <FormDashboardView d={data} mode={show === "pct" ? "pct" : "num"} />
      <section className="space-y-3">
        <h2 className="pt-2 text-base font-semibold">Every form started in this version (first 12)</h2>
        <ul className="space-y-3">
          {list.map((it, i) => {
            const u = other?.reference ? unusualIn(it.timeline, other.reference) : null;
            const odd = u ? u.fields.size + u.totals.size : 0;
            return (
              <li key={it.id} className={"rounded-lg border bg-card " + (odd ? "border-red-500/60" : "")}>
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                    <span className="min-w-40 font-medium">Anonymous visitor {String(1000 + i * 37).slice(0, 4)}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{it.status}</span>
                    {odd > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300">took much longer than most</span>}
                    <span className="text-xs text-muted-foreground">{it.page}</span>
                  </summary>
                  <div className="border-t px-4 py-4">
                    <FormActivityChart timeline={it.timeline} reference={other?.reference ?? null} referenceLabel={other ? other.label : undefined} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
