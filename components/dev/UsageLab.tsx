// components/dev/UsageLab.tsx
// The interactive half of /dev/usage. Everything is shown in plain numbers;
// the only knobs are the plan assumptions in the capacity calculator, which
// are INPUTS (check your current Supabase / Vercel plan pages), never facts
// this page claims to know.
"use client";

import * as React from "react";
import { EVENT_KINDS, PER_REQUEST_QUERIES, planCapacity } from "@/lib/tracking/costModel";

type Day = { day: string; requests: number; events: number; session_starts: number; page_view_starts: number; page_view_ends: number; clicks: number; forms: number; engagement: number; structure: number; dropped: number; bytes_in: number };
type Totals = Record<string, number>;
type Model = { events: number; totalBytes: number; bytesPerEvent: number; byKind: Record<string, { count: number; bytesEach: number; bytesTotal: number; queriesEach: number }> };
type StorageRow = { table_name: string; approx_rows: number; total_bytes: number; table_bytes: number; index_bytes: number };
type AiGroup = { name: string; requests: number; usd: number; credits: number };
export type AiSummary = {
  requests: number;
  usd: number;
  credits: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  repaired: number;
  medianMs: number;
  todayUsd: number;
  byStatus: AiGroup[];
  byModel: AiGroup[];
  byFeature: AiGroup[];
  byDay: Array<{ day: string; requests: number; usd: number; credits: number }>;
};
type ColumnRow = { table_name: string; column_name: string; avg_bytes: number; null_fraction: number };

const fmt = (n: number, digits = 0) => (Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : "-");
function bytes(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}

// The new columns this release added, per table, for the "what did they cost" table.
const NEW_COLUMNS: Record<string, string[]> = {
  visitors: ["ip_hash", "first_referrer", "first_utm_source", "first_utm_medium", "first_utm_campaign", "first_landing_path", "first_touch_at"],
  page_views: ["viewport_width", "device_class", "structure_id"],
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {hint && <p className="mt-1 mb-4 max-w-3xl text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={`px-2 py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-2 py-1.5 ${j > 0 ? "text-right tabular-nums" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <span className="flex items-center gap-1.5">
        <input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-8 w-28 rounded-md border bg-background px-2 text-sm text-foreground" />
        {suffix && <span>{suffix}</span>}
      </span>
    </label>
  );
}

export function UsageLab(props: { domain: string; days: Day[]; totals: Totals; model: Model; queriesPerEvent: number; storage: StorageRow[]; columns: ColumnRow[]; storageAvailable: boolean; usageAvailable: boolean; ai: AiSummary | null }) {
  const { domain, days, totals, model, storage, columns } = props;

  const activeDays = days.filter((d) => d.events > 0 || d.requests > 0).length || 1;
  const eventsPerDay = totals.events / activeDays;
  const avgRequestBytes = totals.requests > 0 ? totals.bytes_in / totals.requests : 0;
  const eventsPerRequest = totals.requests > 0 ? totals.events / totals.requests : 0;

  // capacity calculator inputs: editable assumptions, not facts
  const [budgetGb, setBudgetGb] = React.useState(8);
  const [retention, setRetention] = React.useState(12);
  const [headroom, setHeadroom] = React.useState(30);
  const [sites, setSites] = React.useState(10);
  const [fnBudget, setFnBudget] = React.useState(1_000_000);
  const capacity = planCapacity({ storageBudgetBytes: budgetGb * 1e9, retentionMonths: retention, headroom: headroom / 100, sites, bytesPerEvent: model.bytesPerEvent });
  const requestsPerEvent = eventsPerRequest > 0 ? 1 / eventsPerRequest : 1;
  const computeEventsPerMonth = Math.floor(fnBudget / Math.max(requestsPerEvent, 0.0001));

  const sizeOf = (t: string) => storage.find((r) => r.table_name === t);
  const keyTables = ["page_views", "sessions", "visitors", "form_submissions", "form_engagement", "click_events", "page_structure_versions", "site_usage_daily"];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Usage and limits</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          What <strong className="text-foreground">{domain || "this site"}</strong> sends, what each event costs the database, and how to turn that into event limits. Counts are the last 30 days of{" "}
          <code className="rounded bg-muted px-1">site_usage_daily</code>; sizes are measured from the database, not assumed.
        </p>
        {!props.usageAvailable && <p className="mt-2 text-xs text-destructive">site_usage_daily could not be read. Has the 2026-10-07 migration been run?</p>}
        {!props.storageAvailable && <p className="mt-2 text-xs text-destructive">jh_storage_report() is missing, so table sizes are unavailable. Run section 10 of the migration.</p>}
      </header>

      <Section title="What this site burns" hint="An event is one entry the tracker sends: a page view is two (start and end), a visit adds a session start, a heartbeat every 5 minutes keeps a long visit alive. Dropped means rejected before storing: bots, a host the site does not accept, an expired claim.">
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Events", fmt(totals.events)],
            ["Requests", fmt(totals.requests)],
            ["Events per request", fmt(eventsPerRequest, 2)],
            ["Avg request size", bytes(avgRequestBytes)],
            ["Events per active day", fmt(eventsPerDay)],
            ["Incoming data", bytes(totals.bytes_in)],
            ["Dropped", fmt(totals.dropped)],
            ["Active days", fmt(activeDays)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border bg-muted/30 p-3">
              <div className="text-[11px] text-muted-foreground">{k}</div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{v}</div>
            </div>
          ))}
        </div>
        <Table
          head={["Day", "Requests", "Events", "Sessions", "PV start", "PV end", "Clicks", "Forms", "Engagement", "Structure", "Dropped", "Incoming"]}
          rows={days.map((d) => [d.day, fmt(d.requests), fmt(d.events), fmt(d.session_starts), fmt(d.page_view_starts), fmt(d.page_view_ends), fmt(d.clicks), fmt(d.forms), fmt(d.engagement), fmt(d.structure), fmt(d.dropped), bytes(d.bytes_in)])}
        />
        {days.length === 0 && <p className="mt-3 text-xs text-muted-foreground">No usage recorded yet. It starts counting from the first request after the migration and the new code are live.</p>}
      </Section>

      <Section
        title="What one event costs"
        hint="Rows created per event kind, the stored size of a row (table plus its indexes, measured), and the queries the route runs. Bytes per event is the weighted average over THIS site's real mix. Engagement and structure row rates are modelled, and marked."
      >
        <Table
          head={["Event kind", "Count", "Rows created", "Stored per event", "Stored total", "Queries each"]}
          rows={Object.entries(EVENT_KINDS).map(([k, def]) => [
            <span key={k}>
              {def.label}
              {"modelled" in def && def.modelled ? <span className="ml-1 text-muted-foreground">(modelled)</span> : null}
              <div className="text-[11px] text-muted-foreground">{def.note}</div>
            </span>,
            fmt(model.byKind[k]?.count ?? 0),
            Object.entries(def.rows).map(([t, n]) => `${n} ${t}`).join(", ") || "none",
            bytes(model.byKind[k]?.bytesEach ?? 0),
            bytes(model.byKind[k]?.bytesTotal ?? 0),
            def.queries,
          ])}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">Stored bytes per average event</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{bytes(model.bytesPerEvent)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">Stored per 1,000 events</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{bytes(model.bytesPerEvent * 1000)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">Queries per average event</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{fmt(props.queriesPerEvent, 2)}</div>
            <div className="text-[11px] text-muted-foreground">includes {PER_REQUEST_QUERIES} shared per request</div>
          </div>
        </div>
      </Section>

      <Section title="What the database spends (measured)" hint="Whole database, all sites, from pg_class. Bytes per row includes the table's indexes. Row counts are the planner's estimate and can lag until the next ANALYZE.">
        <Table
          head={["Table", "Rows (est.)", "Total size", "Table", "Indexes", "Bytes per row"]}
          rows={keyTables
            .map((t) => sizeOf(t))
            .filter((r): r is StorageRow => !!r)
            .map((r) => [r.table_name, fmt(r.approx_rows), bytes(r.total_bytes), bytes(r.table_bytes), bytes(r.index_bytes), r.approx_rows > 0 ? bytes(r.total_bytes / r.approx_rows) : "-"])}
        />
      </Section>

      <Section title="What the new columns cost" hint="Average stored width of each column added by the 2026-10-07 migration and how often it is filled, from the planner's statistics. Expected bytes per row = width x share filled. Statistics appear after the next ANALYZE, so a fresh migration shows nothing yet.">
        {Object.entries(NEW_COLUMNS).map(([table, cols]) => {
          const rows = cols.map((c) => columns.find((x) => x.table_name === table && x.column_name === c)).filter((x): x is ColumnRow => !!x);
          const perRow = rows.reduce((n, r) => n + r.avg_bytes * (1 - r.null_fraction), 0);
          return (
            <div key={table} className="mb-4 last:mb-0">
              <div className="mb-1 text-xs font-medium text-foreground">
                {table}: {rows.length ? `about ${fmt(perRow, 1)} bytes more per row` : "no statistics yet"}
              </div>
              {rows.length > 0 && <Table head={["Column", "Avg width", "Filled", "Expected per row"]} rows={rows.map((r) => [r.column_name, `${r.avg_bytes} B`, `${fmt((1 - r.null_fraction) * 100)}%`, `${fmt(r.avg_bytes * (1 - r.null_fraction), 1)} B`])} />}
            </div>
          );
        })}
      </Section>

      <AiSection ai={props.ai} />

      <Section
        title="Setting event limits"
        hint="Fill in what your plans actually give you (these are inputs: check the current Supabase and Vercel plan pages). The result is how many events per month a site can send before it eats the budget, using this site's measured cost per event."
      >
        <div className="mb-4 flex flex-wrap gap-4">
          <NumberField label="Database storage budget" value={budgetGb} onChange={setBudgetGb} suffix="GB" step={0.5} />
          <NumberField label="Keep data for" value={retention} onChange={setRetention} suffix="months" />
          <NumberField label="Keep free (headroom)" value={headroom} onChange={setHeadroom} suffix="%" />
          <NumberField label="Sites sharing it" value={sites} onChange={setSites} />
          <NumberField label="Function calls per month" value={fnBudget} onChange={setFnBudget} step={100000} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">Storage allows, all sites</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{fmt(capacity.eventsPerMonthTotal)} events / month</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">Storage allows, per site</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{fmt(capacity.eventsPerMonthPerSite)} events / month</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[11px] text-muted-foreground">Function calls allow, all sites</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{fmt(computeEventsPerMonth)} events / month</div>
            <div className="text-[11px] text-muted-foreground">at {fmt(eventsPerRequest, 2)} events per request</div>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          The binding limit is the smaller of the storage and function-call numbers. A sensible per-site limit is that smaller number, split across the sites you expect, with a plan tier above it for growth. Because each request carries about {fmt(eventsPerRequest, 2)} events, batching events on the tracker is what moves the function-call limit; keeping data for fewer months, or dropping heartbeats and structure rows after a while, is what moves the storage limit.
        </p>
      </Section>
    </div>
  );
}

// AI spend: the whole product (not one site), last 30 days, from the ai_requests ledger. "Feature" is the label
// that will later become the general events table (ai credit vs hook run vs ...): today only hook_translate.
function AiSection({ ai }: { ai: AiSummary | null }) {
  const usd = (n: number) => "$" + n.toFixed(n < 1 ? 4 : 2);
  return (
    <Section
      title="AI (Ask Hook)"
      hint="Every question people ask Ask Hook, from the ai_requests ledger: whole product, last 30 days. Cost is computed from the provider's token counts and the model's price in jh-ai/models.ts. Credits are what the person was charged in Hook credits (AI_USD_PER_CREDIT dollars each, at least 1). Cached input is the part of the prompt the provider served from its cache at a fraction of the price."
    >
      {!ai && <p className="text-xs text-destructive">ai_requests could not be read. Has mds/migrations/2026-10-08-ai-requests.sql been run?</p>}
      {ai && ai.requests === 0 && <p className="text-xs text-muted-foreground">No questions asked yet.</p>}
      {ai && ai.requests > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Questions", fmt(ai.requests)],
              ["Cost (30 days)", usd(ai.usd)],
              ["Cost today (UTC)", usd(ai.todayUsd)],
              ["Cost per question", usd(ai.usd / ai.requests)],
              ["Hook credits charged", fmt(ai.credits)],
              ["Input from cache", fmt((ai.cachedTokens / Math.max(1, ai.inputTokens)) * 100) + "%"],
              ["Needed a repair retry", fmt(ai.repaired) + " (" + fmt((ai.repaired / ai.requests) * 100) + "%)"],
              ["Median answer time", fmt(ai.medianMs) + " ms"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border bg-muted/30 p-3">
                <div className="text-[11px] text-muted-foreground">{k}</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{v}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Table head={["Feature", "Questions", "Cost", "Credits"]} rows={ai.byFeature.map((g) => [g.name, fmt(g.requests), usd(g.usd), fmt(g.credits)])} />
            <Table head={["Model", "Questions", "Cost", "Credits"]} rows={ai.byModel.map((g) => [g.name, fmt(g.requests), usd(g.usd), fmt(g.credits)])} />
            <Table head={["Outcome", "Questions", "Cost", "Credits"]} rows={ai.byStatus.map((g) => [g.name, fmt(g.requests), usd(g.usd), fmt(g.credits)])} />
          </div>
          <div className="mt-4">
            <Table head={["Day", "Questions", "Cost", "Credits"]} rows={ai.byDay.map((d) => [d.day, fmt(d.requests), usd(d.usd), fmt(d.credits)])} />
          </div>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Outcomes: ok = a query was produced; clarify = it asked the person a question first; unsupported = Hook cannot answer that; failed = the model could not produce a valid query even after one repair; error = the provider was unreachable. Tokens: {fmt(ai.inputTokens)} in ({fmt(ai.cachedTokens)} cached), {fmt(ai.outputTokens)} out.
          </p>
        </>
      )}
    </Section>
  );
}
