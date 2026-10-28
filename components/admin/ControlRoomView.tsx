// components/admin/ControlRoomView.tsx
// The control room's overview (app/admin): the queue right now, the 30-second promise, how many sites and people use
// Jellyhook, their traffic, leads, marks and hooks, the work they cause and what it costs, every site in a table, day
// by day charts and the database's size. Takes plain data (lib/admin/data.ts loadOverview, lib/metrics/costs.ts) so the
// real page and the fake-data demo render the same thing. Design: mds/build/control-room.md.
import Link from "next/link";
import { Live } from "./Live";
import { CopyReport } from "./CopyReport";
import { SitesTable, type SiteLine } from "./SitesTable";
import { DailyChart } from "./DailyChart";
import { bytes, count, dur, promiseTone, usd, PROMISE_MS } from "@/lib/admin/format";
import { PERIODS, type Overview } from "@/lib/admin/data";
import { allocate, perLead, type Prices } from "@/lib/metrics/costs";

type Tone = "ok" | "warn" | "bad" | "none";
const toneCls: Record<Tone, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  none: "text-foreground",
};

export function Stat({ label, value, sub, tone = "none" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"mt-0.5 text-xl font-semibold tabular-nums " + toneCls[tone]}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
      </div>
      {children}
    </section>
  );
}

export function PeriodSwitch({ days, base }: { days: number; base: string }) {
  return (
    <div className="flex h-7 items-center rounded-md border p-0.5 text-xs">
      {PERIODS.map(([d, label]) => (
        <Link key={d} href={`${base}?days=${d}`} className={"flex h-full items-center rounded px-2 " + (d === days ? "bg-primary/15 font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
          {label}
        </Link>
      ))}
    </div>
  );
}

export function ControlRoomView({ data, days, prices, base = "/admin", siteHref }: { data: Extract<Overview, { ready: true }>; days: number; prices: Prices; base?: string; siteHref?: string }) {
  const { sites, daily, now, latency, storage } = data;
  const cost = allocate(sites, prices, days);
  const sum = (k: keyof (typeof sites)[number]) => sites.reduce((n, s) => n + Number(s[k] ?? 0), 0);
  const installed = sites.filter((s) => s.verified && s.is_active).length;
  const lines: SiteLine[] = sites.map((s) => {
    const c = cost.bySite.get(s.site_id);
    const pl = perLead(s);
    return {
      id: s.site_id,
      domain: s.domain || s.name || s.site_id.slice(0, 8),
      verified: s.verified,
      active: s.is_active,
      lastEventAt: s.last_event_at,
      members: s.members,
      visits: s.visits,
      pageViews: s.page_views,
      events: s.events,
      leads: s.leads,
      marksOn: s.marks_on,
      marks: s.marks,
      hooksLive: s.hooks_live,
      slackP50: s.slack_p50_ms,
      slackP95: s.slack_p95_ms,
      batchP95: s.run_p95_ms,
      msPerLead: pl.ms,
      dbCallsPerLead: pl.dbCalls,
      serverMs: c?.serverMs ?? 0,
      dbMs: c?.dbMs ?? 0,
      monthlyUsd: c?.monthlyUsd ?? 0,
    };
  });
  const dbTotal = storage.reduce((n, r) => n + Number(r.total_bytes || 0), 0);
  const topTables = [...storage].sort((a, b) => Number(b.total_bytes) - Number(a.total_bytes)).slice(0, 8);
  const periodLabel = PERIODS.find(([d]) => d === days)?.[1] ?? days + " days";
  const p95Tone = promiseTone(latency.slack_p95_ms);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-6">
      <div id="control-room-report" className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Control room</h1>
          <p className="text-sm text-muted-foreground">Every site on Jellyhook: traffic, leads, how fast hooks reach Slack, the work it all causes and what it costs. Last {periodLabel}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodSwitch days={days} base={base} />
          <Live />
        </div>
      </header>

      <Section title="Right now" note="The lead queue and messages waiting to be sent.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Leads waiting" value={now.queue_leads} tone={now.queue_leads > 20 ? "bad" : now.queue_leads > 0 ? "warn" : "ok"} />
          <Stat label="Oldest waiting" value={dur(now.queue_oldest_ms)} tone={promiseTone(now.queue_oldest_ms)} />
          <Stat label="Messages pending" value={now.pending_messages} />
          <Stat label="Messages failed (24 h)" value={now.failed_messages_24h} tone={now.failed_messages_24h ? "bad" : "ok"} />
          <Stat label="Batches (last hour)" value={now.runs_last_hour} />
          <Stat label="Batch errors (24 h)" value={now.run_errors_24h} tone={now.run_errors_24h ? "bad" : "ok"} sub={now.queue_parked ? `${now.queue_parked} lead(s) parked after their last try` : undefined} />
        </div>
      </Section>

      <Section title={`The promise: Slack within ${PROMISE_MS / 1000} s of the form`} note="Measured from the moment the form arrived to the moment Slack accepted the message, every site together.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Median" value={dur(latency.slack_p50_ms)} tone={promiseTone(latency.slack_p50_ms)} />
          <Stat label="95% within" value={dur(latency.slack_p95_ms)} tone={p95Tone} />
          <Stat label="Slowest" value={dur(latency.slack_max_ms)} tone={promiseTone(latency.slack_max_ms)} />
          <Stat label="Over 30 s" value={latency.over_30s} sub={`of ${count(latency.sent)} sent`} tone={latency.over_30s ? "bad" : "ok"} />
          <Stat label="Batch of new leads" value={dur(latency.run_p95_ms)} sub={`95% within; median ${dur(latency.run_p50_ms)}, slowest ${dur(latency.run_max_ms)}`} />
        </div>
      </Section>

      <Section title="Where the time goes, form to Slack" note={data.stages ? "Each message's way, stage by stage (median, 95% within, slowest)." : "Needs mds/migrations/30-control-room-stages.sql. Run it in Supabase, then reload."}>
        {data.stages && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 text-left font-normal">Stage</th>
                  <th className="px-3 py-1.5 text-right font-normal">Median</th>
                  <th className="px-3 py-1.5 text-right font-normal">95% within</th>
                  <th className="px-3 py-1.5 text-right font-normal">Slowest</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(
                  [
                    ["Form submitted to lead saved (the tracker request)", "saved"],
                    ["Lead saved to hook fired (queue, mark check, hook rules)", "hook"],
                    ["Hook fired to Slack accepted (message and send)", "send"],
                    ["Whole way", "total"],
                  ] as const
                ).map(([label, k]) => (
                  <tr key={k} className={k === "total" ? "font-medium" : ""}>
                    <td className="px-3 py-1.5">{label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{dur(data.stages![`${k}_p50_ms` as const])}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{dur(data.stages![`${k}_p95_ms` as const])}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{dur(data.stages![`${k}_max_ms` as const])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Who uses Jellyhook">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <Stat label="Installed sites" value={installed} sub={`${sites.length} sites in all`} />
          <Stat label="People" value={now.people} sub="active members" />
          <Stat label="Visits" value={count(sum("visits"))} />
          <Stat label="Page views" value={count(sum("page_views"))} />
          <Stat label="Events" value={count(sum("events"))} sub={`${count(sum("requests"))} requests`} />
          <Stat label="Leads" value={count(sum("leads"))} sub={`${count(sum("leads_total"))} in all`} />
          <Stat label="Marks" value={sum("marks")} sub={`${sum("marks_on")} on`} />
          <Stat label="Hooks" value={sum("hooks_live")} sub={`live, of ${sum("hooks")}`} />
        </div>
      </Section>

      <Section title="Work and cost" note={<>Calculated: the plans (database {usd(prices.supabaseMonthlyUsd)}, server {usd(prices.vercelMonthlyUsd)} a month; set CR_SUPABASE_USD, CR_VERCEL_USD) split by measured work.</>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Server time" value={dur(cost.totals.serverMs)} sub={`${cost.totals.serverHoursPerMonth.toFixed(2)} h a month at this pace`} />
          <Stat label="Database time" value={dur(cost.totals.dbMs)} sub={`${cost.totals.dbHoursPerMonth.toFixed(2)} h a month at this pace`} />
          <Stat label="Database calls" value={count(sum("db_calls") + sum("run_db_calls"))} sub={`${count(sum("db_rows") + sum("run_db_rows") + sum("apply_db_rows"))} rows read`} />
          <Stat label="Plans a month" value={usd(cost.totals.monthlyUsd)} />
          <Stat label="Per 1,000 events" value={usd(cost.totals.usdPer1kEvents)} sub={`${count(cost.totals.eventsPerMonth)} events a month at this pace`} />
          <Stat label="Per lead" value={usd(cost.totals.usdPerLead)} sub={`${count(cost.totals.leadsPerMonth)} leads a month at this pace`} />
        </div>
      </Section>

      <Section title="Sites" note="Click a site for its days, its marks and hooks, and every batch of its leads.">
        <SitesTable sites={lines} days={days} />
        {siteHref && <p className="text-[11px] text-muted-foreground">{siteHref}</p>}
      </Section>

      <Section title="Day by day, every site">
        <div className="grid gap-3 lg:grid-cols-2">
          <DailyChart title="Traffic" data={daily as unknown as Record<string, unknown>[]} series={[{ key: "events", label: "Events", color: "#22c55e" }, { key: "visits", label: "Visits", color: "#3b82f6" }, { key: "forms", label: "Leads", color: "#f59e0b" }]} />
          <DailyChart title="Speed (95% within)" unit="s" data={daily as unknown as Record<string, unknown>[]} series={[{ key: "slack_p95_ms", label: "Form to Slack", color: "#ef4444" }, { key: "run_p95_ms", label: "Batch of leads", color: "#8b5cf6" }]} />
          <DailyChart title="Work" unit="s" data={daily as unknown as Record<string, unknown>[]} series={[{ key: "server_ms", label: "Tracker server time", color: "#0ea5e9" }, { key: "run_ms", label: "Lead batches", color: "#a855f7" }, { key: "db_ms", label: "Tracker database time", color: "#14b8a6" }]} />
          <DailyChart title="Database calls" data={daily as unknown as Record<string, unknown>[]} series={[{ key: "db_calls", label: "Tracker", color: "#14b8a6" }, { key: "run_db_calls", label: "Lead batches", color: "#a855f7" }]} />
        </div>
      </Section>

      <Section title="Database size" note="Tables and their indexes, from the database itself.">
        <div className="grid gap-3 md:grid-cols-[14rem_minmax(0,1fr)]">
          <Stat label="All tables" value={bytes(dbTotal)} />
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {topTables.map((t) => (
                  <tr key={t.table_name}>
                    <td className="px-3 py-1.5 font-mono text-xs">{t.table_name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{count(t.approx_rows)} rows</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{bytes(t.total_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
      </div>
      <CopyReport targetId="control-room-report" />
    </div>
  );
}
