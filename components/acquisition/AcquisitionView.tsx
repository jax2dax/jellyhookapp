"use client";
// components/acquisition/AcquisitionView.tsx
// The Acquisition page: where leads come from. Platforms first (Google · Ads, Meta · Ads, Google · Search, Direct...),
// sorted by the leads they brought; open one for its campaigns, a campaign for its ads (utm_content) and where they
// landed. Two radars compare the share of normal traffic, of leads and of hooked leads by platform and by campaign.
// Range and credit model live in the address (?range=30&credit=first). Data: lib/actions/acquisition.action.ts.
// Founder decisions: credit = last non-direct by default, first touch on the switch; paid and free split; mds/build/acquisition/plan.md.
import * as React from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { loadAcquisition } from "@/lib/actions/acquisition.action";
import type { AcquisitionReport, Counts, PlatformRow, RadarPoint } from "@/lib/acquisition/report";
import { oneOf, useUrlState } from "@/lib/urlState";

const RANGES = [
  ["7", "7 days"],
  ["30", "30 days"],
  ["90", "90 days"],
  ["all", "All time"],
] as const;

const radarConfig: ChartConfig = {
  traffic: { label: "Normal traffic", color: "#38bdf8" },
  leads: { label: "Converted", color: "#22c55e" },
  hooked: { label: "Hooked leads", color: "#f59e0b" },
};

const rate = (c: Counts) => (c.visitors > 0 ? Math.min(100, Math.round((1000 * c.leads) / c.visitors) / 10) + "%" : c.leads ? "n/a" : "0%");

function Switch<V extends string>({ value, options, onChange, label }: { value: V; options: readonly (readonly [V, string])[]; onChange: (v: V) => void; label: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border text-xs" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={"px-2.5 py-1 " + (value === v ? "bg-primary/15 font-medium text-foreground" : "text-muted-foreground hover:bg-muted")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Nums({ c, strong }: { c: Counts; strong?: boolean }) {
  const cell = "w-20 shrink-0 text-right tabular-nums " + (strong ? "text-foreground" : "text-muted-foreground");
  return (
    <>
      <span className={cell}>{c.visitors.toLocaleString()}</span>
      <span className={cell + (strong ? " font-semibold" : "")}>{c.leads}</span>
      <span className={cell}>{rate(c)}</span>
      <span className={"w-20 shrink-0 text-right tabular-nums " + (c.hooked ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{c.hooked}</span>
    </>
  );
}

function PlatformLine({ row }: { row: PlatformRow }) {
  const [open, setOpen] = React.useState(false);
  const [openCampaign, setOpenCampaign] = React.useState<Set<string>>(new Set());
  return (
    <li>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50" aria-expanded={open}>
        <ChevronRight className={"size-3.5 shrink-0 text-muted-foreground transition-transform " + (open ? "rotate-90" : "")} />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {row.label}
          {row.paid && <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">paid</span>}
        </span>
        <Nums c={row} strong />
      </button>
      {open && (
        <ul className="border-t bg-muted/20">
          {row.campaigns.map((c) => {
            const on = openCampaign.has(c.name);
            return (
              <li key={c.name}>
                <button
                  type="button"
                  onClick={() => setOpenCampaign((s) => { const n = new Set(s); if (on) n.delete(c.name); else n.add(c.name); return n; })}
                  className="flex w-full items-center gap-2 py-2 pl-9 pr-3 text-left text-sm hover:bg-muted/50"
                  aria-expanded={on}
                >
                  <ChevronRight className={"size-3 shrink-0 text-muted-foreground transition-transform " + (on ? "rotate-90" : "")} />
                  <span className="min-w-0 flex-1 truncate text-foreground/90">{c.name}</span>
                  <Nums c={c} />
                </button>
                {on &&
                  c.ads.map((a) => (
                    <div key={a.name} className="flex items-center gap-2 py-1.5 pl-16 pr-3 text-xs">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-foreground/85">{a.adName ?? a.name}</span>
                        {a.adName && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{a.name}</span>}
                        {a.landing && <span className="ml-2 text-muted-foreground">landed on {a.landing}</span>}
                      </span>
                      <Nums c={a} />
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function RadarCard({ title, description, points }: { title: string; description: string; points: RadarPoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {points.length < 3 ? (
          <div className="flex h-72 items-center justify-center text-center text-sm text-muted-foreground">Needs at least 3 sources with visitors or leads in this range.</div>
        ) : (
          <ChartContainer config={radarConfig} className="h-72 w-full">
            <RadarChart data={points}>
              <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <span className="flex w-full justify-between gap-4"><span className="text-muted-foreground">{radarConfig[name as keyof typeof radarConfig]?.label}</span><span className="font-mono tabular-nums">{value}%</span></span>} />} />
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <Radar dataKey="traffic" stroke="var(--color-traffic)" fill="var(--color-traffic)" fillOpacity={0.12} strokeWidth={1.5} strokeDasharray="4 3" />
              <Radar dataKey="leads" stroke="var(--color-leads)" fill="var(--color-leads)" fillOpacity={0.2} strokeWidth={2} />
              <Radar dataKey="hooked" stroke="var(--color-hooked)" fill="var(--color-hooked)" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ChartContainer>
        )}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {Object.entries(radarConfig).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: c.color }} /> {c.label}
            </span>
          ))}
          <span>Each shape is the share of its own group. Where green or yellow reach past blue, that source brings better leads than average.</span>
        </p>
      </CardContent>
    </Card>
  );
}

export function AcquisitionView() {
  const [url, setUrl] = useUrlState({ range: "30", credit: "last" });
  const range = oneOf(url.range, ["7", "30", "90", "all"] as const, "30");
  const credit = oneOf(url.credit, ["last", "first"] as const, "last");
  // the answer is kept with the choices it was made for: a new range or credit shows the spinner until its own answer
  const key = range + "|" + credit;
  const [loaded, setLoaded] = React.useState<{ key: string; value: { report: AcquisitionReport; adFields: boolean } | { error: string } } | null>(null);

  React.useEffect(() => {
    let live = true;
    loadAcquisition(range === "all" ? 0 : Number(range), credit === "first" ? "first" : "lastNonDirect").then((r) => live && setLoaded({ key, value: r.ok ? { report: r.report, adFields: r.adFields } : { error: r.error } }));
    return () => {
      live = false;
    };
  }, [range, credit, key]);

  const data = loaded && loaded.key === key ? loaded.value : null;
  const report = data && "report" in data ? data.report : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Switch label="Range" value={range} options={RANGES} onChange={(v) => setUrl({ range: v })} />
        <Switch
          label="Which visit gets the credit"
          value={credit}
          options={[
            ["last", "Last non-direct"],
            ["first", "First touch"],
          ]}
          onChange={(v) => setUrl({ credit: v })}
        />
        <span className="text-xs text-muted-foreground">
          {credit === "last" ? "A lead counts for the last ad or link that brought them before converting. Direct visits never take the credit." : "A lead counts for whatever first brought them to you."}
        </span>
      </div>

      {data === null ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
        </div>
      ) : "error" in data ? (
        <p className="text-sm text-red-600">{data.error}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Visitors", report!.totals.visitors.toLocaleString()],
              ["Leads", String(report!.totals.leads)],
              ["Conversion rate", rate(report!.totals)],
              ["Hooked leads", String(report!.totals.hooked)],
            ].map(([k, v]) => (
              <Card key={k} className="gap-1 px-4 py-3">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-xl font-semibold tabular-nums text-foreground">{v}</span>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Where leads come from</CardTitle>
              <CardDescription>
                Platforms by the leads they brought. Open one for its campaigns, a campaign for its ads.
                {!data.adFields && " Ads and keywords appear once the database is updated (migration 24) and new visits arrive."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {!report!.rows.length ? (
                <p className="px-6 py-6 text-center text-sm text-muted-foreground">No visits in this range.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 border-b px-3 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="w-3.5" />
                    <span className="flex-1">Source</span>
                    <span className="w-20 text-right">Visitors</span>
                    <span className="w-20 text-right">Leads</span>
                    <span className="w-20 text-right">Rate</span>
                    <span className="w-20 text-right">Hooked</span>
                  </div>
                  <ul className="divide-y">
                    {report!.rows.map((r) => (
                      <PlatformLine key={r.label} row={r} />
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RadarCard title="By platform" description="Normal traffic, converted leads and hooked leads, as shares of each group." points={report!.radarPlatforms} />
            <RadarCard title="By campaign" description="The same three groups across your campaigns (utm_campaign)." points={report!.radarCampaigns} />
          </div>
        </>
      )}
    </div>
  );
}
