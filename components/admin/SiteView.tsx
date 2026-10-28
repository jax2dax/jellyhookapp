// components/admin/SiteView.tsx
// One site in the control room (app/admin/sites/[id]): its numbers for the period, day by day charts, its marks with
// how heavy each is (lib/metrics/markWeight.ts), its hooks, and the last 50 batches of its leads with what each took.
// Plain data in, so the fake-data demo renders the same thing.
import Link from "next/link";
import { Live } from "./Live";
import { CopyReport } from "./CopyReport";
import { DailyChart } from "./DailyChart";
import { PeriodSwitch, Section, Stat } from "./ControlRoomView";
import { ago, bytes, count, dur, promiseTone, usd } from "@/lib/admin/format";
import type { SiteDetail } from "@/lib/admin/data";
import { perLead } from "@/lib/metrics/costs";
import { markWeight } from "@/lib/metrics/markWeight";

export function SiteView({ data, days, monthlyUsd, back = "/admin", base }: { data: Extract<SiteDetail, { ready: true }>; days: number; monthlyUsd: number | null; back?: string; base: string }) {
  const { site: s, daily, runs, marks, hooks } = data;
  const pl = perLead(s);
  const markName = new Map(marks.map((m) => [m.id, m.name]));
  const weights = marks.map((m) => ({ ...m, w: markWeight(m.rule) })).sort((a, b) => b.w.conditions - a.w.conditions);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 p-6">
      <div id="control-room-report" className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`${back}?days=${days}`} className="text-xs text-muted-foreground hover:text-foreground">
            ← Control room
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{s.domain || s.name}</h1>
          <p className="text-sm text-muted-foreground">
            {s.is_active ? (s.verified ? "Installed" : "Not verified yet") : "Paused"} · {s.members} people · created {new Date(s.created_at).toLocaleDateString()} · last event {ago(s.last_event_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodSwitch days={days} base={base} />
          <Live />
        </div>
      </header>

      <Section title="Traffic and leads">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <Stat label="Visits" value={count(s.visits)} />
          <Stat label="Page views" value={count(s.page_views)} />
          <Stat label="Events" value={count(s.events)} sub={`${count(s.dropped)} dropped`} />
          <Stat label="Leads" value={count(s.leads)} sub={`${count(s.leads_total)} in all`} />
          <Stat label="Marks" value={s.marks} sub={`${s.marks_on} on`} />
          <Stat label="Hooks" value={s.hooks_live} sub={`live, of ${s.hooks}`} />
          <Stat label="Slack sent" value={s.sent} sub={`${s.failed} failed`} tone={s.failed ? "bad" : "none"} />
          <Stat label="Cost / month" value={usd(monthlyUsd)} sub="its share, calculated" />
        </div>
      </Section>

      <Section title="Speed">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Form to Slack, median" value={dur(s.slack_p50_ms)} tone={promiseTone(s.slack_p50_ms)} />
          <Stat label="Form to Slack, 95%" value={dur(s.slack_p95_ms)} tone={promiseTone(s.slack_p95_ms)} />
          <Stat label="Slowest" value={dur(s.slack_max_ms)} tone={promiseTone(s.slack_max_ms)} />
          <Stat label="Batch, 95%" value={dur(s.run_p95_ms)} sub={`${s.runs} batches, ${s.run_errors} failed`} />
          <Stat label="Queue wait, 95%" value={dur(s.run_wait_p95_ms)} />
          <Stat label="Per lead" value={dur(pl.ms)} sub={pl.dbCalls === null ? "no batches" : `${Math.round(pl.dbCalls)} DB calls, ${count(pl.dbRows)} rows`} />
        </div>
      </Section>

      <Section title="Work">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Tracker server time" value={dur(s.server_ms)} sub={`${count(s.requests)} requests`} />
          <Stat label="Tracker database" value={dur(s.db_ms)} sub={`${count(s.db_calls)} calls, ${count(s.db_rows)} rows`} />
          <Stat label="Lead batches" value={dur(s.run_ms)} sub={`${count(s.run_db_calls)} calls, ${count(s.run_db_rows)} rows`} />
          <Stat label="Marks applied to old leads" value={dur(s.apply_ms)} sub={`${s.applies} times, ${count(s.apply_db_rows)} rows read`} />
          <Stat label="Data received" value={bytes(s.bytes_in)} />
          <Stat label="DB time per lead" value={dur(s.run_leads ? s.run_db_ms / s.run_leads : null)} />
        </div>
      </Section>

      <Section title="Day by day">
        <div className="grid gap-3 lg:grid-cols-3">
          <DailyChart title="Traffic" data={daily as unknown as Record<string, unknown>[]} series={[{ key: "events", label: "Events", color: "#22c55e" }, { key: "visits", label: "Visits", color: "#3b82f6" }, { key: "forms", label: "Leads", color: "#f59e0b" }]} />
          <DailyChart title="Speed (95% within)" unit="s" data={daily as unknown as Record<string, unknown>[]} series={[{ key: "slack_p95_ms", label: "Form to Slack", color: "#ef4444" }, { key: "run_p95_ms", label: "Batch", color: "#8b5cf6" }]} />
          <DailyChart title="Work" unit="s" data={daily as unknown as Record<string, unknown>[]} series={[{ key: "server_ms", label: "Tracker", color: "#0ea5e9" }, { key: "run_ms", label: "Lead batches", color: "#a855f7" }]} />
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Marks, heaviest first" note="Marks that are on are checked for every new lead (v3: off means not checked).">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Mark</th>
                  <th className="px-3 py-2 text-right font-medium">Visits</th>
                  <th className="px-3 py-2 text-right font-medium">Pages</th>
                  <th className="px-3 py-2 text-right font-medium">Conditions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {weights.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-1.5">
                      {m.name} {!m.active && <span className="text-[11px] text-muted-foreground">(off)</span>}
                      <div className="text-[11px] text-muted-foreground">{m.created_by_email ?? ""}{m.source && m.source !== "own" ? " · " + m.source : ""}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{m.w.visits}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{m.w.pages}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{m.w.conditions}</td>
                  </tr>
                ))}
                {!weights.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                      No marks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Hooks">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Hook</th>
                  <th className="px-3 py-2 text-left font-medium">Marks it needs</th>
                  <th className="px-3 py-2 text-right font-medium">Channels</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {hooks.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-1.5">
                      {h.name} {!h.active && <span className="text-[11px] text-muted-foreground">(paused)</span>}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{(h.mark_ids ?? []).map((id) => markName.get(id) ?? "a removed mark").join(", ")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{(h.channel_ids ?? []).length}</td>
                  </tr>
                ))}
                {!hooks.length && (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                      No hooks.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title="Last 50 batches" note="A batch is the new leads checked together: every mark, then every live hook.">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                {["When", "Kind", "Leads", "Marks", "Hooks", "Notified", "Messages", "Waited", "Marks took", "Hooks took", "Total", "DB calls", "DB time", "Rows"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-2.5 py-2 text-right font-medium first:text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((r) => (
                <tr key={r.id} className={r.error ? "bg-red-500/5" : undefined} title={r.error ?? undefined}>
                  <td className="whitespace-nowrap px-2.5 py-1.5">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-2.5 py-1.5 text-right">{r.kind === "leads" ? "new leads" : "mark applied"}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{r.leads}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{r.marks}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{r.hooks}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{r.fires}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{r.deliveries}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{dur(r.wait_ms)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{dur(r.marks_ms)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{dur(r.hooks_ms)}</td>
                  <td className={"px-2.5 py-1.5 text-right font-medium tabular-nums " + (r.error ? "text-red-600 dark:text-red-400" : "")}>{dur(r.total_ms)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{r.db_calls}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{dur(r.db_ms)}</td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{count(r.db_rows)}</td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={14} className="px-3 py-4 text-center text-muted-foreground">
                    No batches yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
      </div>
      <CopyReport targetId="control-room-report" />
    </div>
  );
}
