"use client";
// components/admin/SitesTable.tsx
// Every site in one sortable table (the control room, app/admin): who it is, its traffic, its leads, its marks and
// hooks, how fast its leads reach Slack, the work it causes and its share of the monthly plans. Click a header to sort,
// a row to open the site.
import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { count, dur, promiseTone, usd, ago } from "@/lib/admin/format";

export interface SiteLine {
  id: string;
  domain: string;
  verified: boolean;
  active: boolean;
  lastEventAt: string | null;
  members: number;
  visits: number;
  pageViews: number;
  events: number;
  leads: number;
  marksOn: number;
  marks: number;
  hooksLive: number;
  slackP50: number | null;
  slackP95: number | null;
  batchP95: number | null;
  msPerLead: number | null;
  dbCallsPerLead: number | null;
  serverMs: number;
  dbMs: number;
  monthlyUsd: number;
}

type Key = keyof SiteLine;
const COLS: { key: Key; label: string; title?: string; render: (s: SiteLine) => React.ReactNode }[] = [
  { key: "members", label: "People", render: (s) => s.members },
  { key: "visits", label: "Visits", render: (s) => count(s.visits) },
  { key: "pageViews", label: "Page views", render: (s) => count(s.pageViews) },
  { key: "events", label: "Events", render: (s) => count(s.events) },
  { key: "leads", label: "Leads", render: (s) => count(s.leads) },
  { key: "marks", label: "Marks", title: "on / all", render: (s) => `${s.marksOn}/${s.marks}` },
  { key: "hooksLive", label: "Hooks", title: "live", render: (s) => s.hooksLive },
  { key: "slackP50", label: "Slack p50", title: "form to Slack, median", render: (s) => <Tone ms={s.slackP50} /> },
  { key: "slackP95", label: "Slack p95", title: "form to Slack, 95% within", render: (s) => <Tone ms={s.slackP95} /> },
  { key: "batchP95", label: "Batch p95", title: "time to check one batch of new leads (marks, hooks)", render: (s) => dur(s.batchP95) },
  { key: "msPerLead", label: "Per lead", title: "time per lead in batches", render: (s) => dur(s.msPerLead) },
  { key: "dbCallsPerLead", label: "DB calls / lead", render: (s) => (s.dbCallsPerLead === null ? "–" : Math.round(s.dbCallsPerLead)) },
  { key: "serverMs", label: "Server time", render: (s) => dur(s.serverMs) },
  { key: "dbMs", label: "DB time", render: (s) => dur(s.dbMs) },
  { key: "monthlyUsd", label: "Cost / mo", title: "its share of the monthly plans, by measured work (calculated)", render: (s) => usd(s.monthlyUsd) },
];

function Tone({ ms }: { ms: number | null }) {
  const t = promiseTone(ms);
  const cls = t === "ok" ? "text-emerald-700 dark:text-emerald-400" : t === "warn" ? "text-amber-700 dark:text-amber-400" : t === "bad" ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground";
  return <span className={cls}>{dur(ms)}</span>;
}

export function SitesTable({ sites, days }: { sites: SiteLine[]; days: number }) {
  const [sort, setSort] = React.useState<{ key: Key; desc: boolean }>({ key: "events", desc: true });
  const rows = React.useMemo(() => {
    const v = (s: SiteLine) => s[sort.key];
    return [...sites].sort((a, b) => {
      const x = v(a);
      const y = v(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x > y ? 1 : -1) * (sort.desc ? -1 : 1);
    });
  }, [sites, sort]);
  const head = (key: Key, label: string, title?: string) => (
    <th key={key} className="whitespace-nowrap px-3 py-2 text-right font-medium">
      <button type="button" title={title} onClick={() => setSort((s) => ({ key, desc: s.key === key ? !s.desc : true }))} className="inline-flex items-center gap-1 hover:text-foreground">
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </th>
  );
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="sticky left-0 bg-muted px-3 py-2 text-left font-medium">Site</th>
            {COLS.map((c) => head(c.key, c.label, c.title))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((s) => (
            <tr key={s.id} className="bg-card hover:bg-muted/30">
              <td className="sticky left-0 whitespace-nowrap bg-card px-3 py-2">
                <Link href={`/admin/sites/${s.id}?days=${days}`} className="font-medium text-foreground hover:underline">
                  {s.domain}
                </Link>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={"size-1.5 rounded-full " + (!s.active ? "bg-red-500" : s.verified ? "bg-emerald-500" : "bg-amber-500")} />
                  {!s.active ? "paused" : s.verified ? "installed" : "not verified"} · {ago(s.lastEventAt)}
                </div>
              </td>
              {COLS.map((c) => (
                <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                  {c.render(s)}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={COLS.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                No sites yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
