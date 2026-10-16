"use client";
// components/forms/FormEngagementClient.tsx
// /platform/form-engagement in the browser: the controls at the top (which lead form, compare to, number or %), the
// dashboard of the form's current version (components/forms/FormDashboard.tsx), then every form started in that version.
// The controls live in the URL (?form=&compare=&from=&to=&show=), so a view can be shared and reloaded.
//
// Caching (founder decision 2026-10-15): the dashboard is aggregates only, so it is kept in localStorage per site and
// per choice (lib/client/cache.ts): shown at once, refreshed in the background when older than 5 minutes, or on
// "Refresh". The list below holds names, so it is NEVER cached: fetched every time.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormActivityChart } from "@/components/forms/FormActivityChart";
import { FormDashboardView, type DashboardData, type ShowMode } from "@/components/forms/FormDashboard";
import { InfoTip } from "@/components/forms/InfoTip";
import { unusualIn } from "@/jh-forms/averages";
import { getFormDashboard } from "@/lib/actions/formDashboard.action";
import { getFormEngagements, type FormEngagementItem } from "@/lib/actions/formEngagement.action";
import { cacheKey, readCache, writeCache } from "@/lib/client/cache";

const FRESH_MS = 5 * 60_000;

const fmt = (ms: number | null) => {
  if (ms === null) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60);
  return m < 60 ? m + "m " + (s % 60) + "s" : Math.floor(m / 60) + "h " + (m % 60) + "m";
};
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago";
};
const STATUS: Record<string, { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
  abandoned: { label: "Started, not submitted", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  started: { label: "In progress", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
};
const dayIso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function FormEngagementClient({ siteId }: { siteId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const params = useMemo(
    () => ({ form: sp.get("form"), compare: sp.get("compare") ?? "off", from: sp.get("from"), to: sp.get("to") }),
    [sp],
  );
  const mode: ShowMode = sp.get("show") === "pct" ? "pct" : "num";
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // the list, tagged with the form + version it belongs to: a stale list is never shown for another version
  const [list, setList] = useState<{ key: string; items: FormEngagementItem[] } | null>(null);
  const [custom, setCustom] = useState(() => ({ from: params.from ?? dayIso(Date.now() - 30 * 86_400_000), to: params.to ?? dayIso(Date.now()) }));

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const q = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") q.delete(k);
        else q.set(k, v);
      }
      router.replace(pathname + (q.size ? "?" + q : ""), { scroll: false });
    },
    [sp, router, pathname],
  );

  const load = useCallback(
    async (force: boolean) => {
      const key = cacheKey(siteId, "formDashboard", params);
      const saved = readCache<DashboardData>(key);
      // localStorage is the external system this syncs from: show the saved copy at once
      if (saved) setData(saved.value);
      if (saved && !force && Date.now() - saved.at < FRESH_MS) return;
      setLoading(true);
      const r = await getFormDashboard(params);
      setLoading(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setData(r);
      writeCache(key, r);
    },
    [siteId, params],
  );
  useEffect(() => {
    // syncs from localStorage and the server (external systems); load() sets state from the saved copy first
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, [load]);

  // the list of the current version: never cached (it holds names)
  const curVersion = data?.versions.find((v) => v.current)?.id ?? null;
  const listFilter = data ? (data.versionsReady && data.form ? { form: data.form, version: curVersion } : {}) : null;
  const listKey = listFilter ? JSON.stringify(listFilter) : null;
  useEffect(() => {
    if (!listKey) return;
    let live = true;
    getFormEngagements(JSON.parse(listKey)).then((r) => {
      if (live) setList({ key: listKey, items: r.items });
    });
    return () => {
      live = false;
    };
  }, [listKey]);
  const items = list && list.key === listKey ? list.items : null;

  const ref = data?.compare?.reference ?? null;
  const refLabel = data?.compare ? data.compare.label : undefined;

  return (
    <div className="space-y-6">
      {/* the controls: everything below follows them */}
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-xs text-muted-foreground">
        {data && data.forms.length > 1 && (
          <label className="flex items-center gap-1.5">
            Form
            <select className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" value={data.form ?? ""} onChange={(e) => setParam({ form: e.target.value, compare: null, from: null, to: null })}>
              {data.forms.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label} · {f.submitted} submitted
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1.5">
          Compare to
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            value={params.compare}
            onChange={(e) => (e.target.value === "custom" ? setParam({ compare: "custom", from: custom.from, to: custom.to }) : setParam({ compare: e.target.value, from: null, to: null }))}
          >
            <option value="off">No comparison</option>
            <option value="all">All time (every version, this one too)</option>
            {data?.versions
              .filter((v) => !v.current)
              .map((v) => (
                <option key={v.id} value={"v:" + v.id}>
                  Version {v.label}
                </option>
              ))}
            <option value="custom">Dates…</option>
          </select>
        </label>
        {params.compare === "custom" && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              From
              <input type="date" className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            </label>
            <label className="flex items-center gap-1.5">
              To
              <input type="date" className="h-8 rounded-md border bg-background px-2 text-sm text-foreground" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </label>
            <button className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground" onClick={() => setParam({ from: custom.from, to: custom.to })}>
              Apply
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          Show
          <div className="flex h-8 overflow-hidden rounded-md border text-sm" role="group" aria-label="Show numbers or percentages">
            {(["num", "pct"] as const).map((m) => (
              <button key={m} className={"px-3 " + (mode === m ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted")} onClick={() => setParam({ show: m === "num" ? null : "pct" })}>
                {m === "num" ? "Numbers" : "%"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading ? "Updating…" : data ? "Updated " + ago(data.at) : ""}
          <button className="rounded-md border px-2 py-1 text-foreground hover:bg-muted disabled:opacity-50" disabled={loading} onClick={() => void load(true)}>
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-500/40 p-4 text-sm text-red-600">{error}</p>}
      {data && !data.versionsReady && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground">Form versions are not set up yet (migration 17). Showing every form, all time, with no comparison.</p>
      )}
      {!data && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && <FormDashboardView d={data} mode={mode} />}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 pt-2 text-base font-semibold">
          Every form started{curVersion ? " in this version" : ""}
          <InfoTip>
            The newest 100. A person is named when they submitted a form at some point; everyone else is an anonymous visitor. Open one to see it field by field.
            {ref ? " Red: took much longer than most." : ""}
          </InfoTip>
        </h2>
        {items === null && data && <p className="text-sm text-muted-foreground">Loading…</p>}
        {items?.length === 0 && <p className="rounded-lg border p-6 text-sm text-muted-foreground">Nobody has started this form yet.</p>}
        <ul className="space-y-3">
          {items?.map((it) => {
            const st = STATUS[it.status] ?? { label: it.status, cls: "bg-muted text-muted-foreground" };
            const who = it.who ? it.who.name || it.who.email || "Lead" : "Anonymous visitor " + (it.visitorId ? it.visitorId.slice(0, 6) : "");
            const t = it.timeline.totals;
            const u = ref ? unusualIn(it.timeline, ref) : null;
            const odd = u ? u.fields.size + u.totals.size : 0;
            return (
              <li key={it.id} className={"rounded-lg border bg-card " + (odd ? "border-red-500/60" : "")}>
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                    <span className="min-w-40 font-medium text-foreground">
                      {it.who?.leadId ? (
                        <Link href={"/platform/leads/" + it.who.leadId} className="hover:underline">
                          {who}
                        </Link>
                      ) : (
                        who
                      )}
                    </span>
                    <span className={"rounded-full px-2 py-0.5 text-[11px] " + st.cls}>{st.label}</span>
                    {odd > 0 && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300">took much longer than most</span>}
                    {it.who?.via === "other" && <span className="text-[11px] text-muted-foreground">submitted another form</span>}
                    <span className="text-xs text-muted-foreground">{it.page || "-"}</span>
                    <span className="text-xs text-muted-foreground">{it.seenAt ? new Date(it.seenAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
                    <span className="ml-auto flex flex-wrap items-center gap-x-4 text-xs text-muted-foreground">
                      {t.spanMs !== null && <span><strong className="text-foreground">{fmt(t.spanMs)}</strong> total activity</span>}
                      <span><strong className="text-foreground">{t.fieldsTouched}</strong>{it.timeline.formFieldCount !== null ? " of " + it.timeline.formFieldCount : ""} fields</span>
                      {t.awayMs > 0 && <span className="text-violet-600 dark:text-violet-400">{fmt(t.awayMs)} away</span>}
                    </span>
                  </summary>
                  <div className="border-t px-4 py-4">
                    <FormActivityChart timeline={it.timeline} reference={ref} referenceLabel={refLabel} />
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
