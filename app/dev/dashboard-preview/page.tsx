"use client";
// app/dev/dashboard-preview/page.tsx
// DEMO with FAKE data: the top of the dashboard (header, number tiles, sales block) with the sample site of the home
// page demo (components/showcase), inside a sandbox so the tiles' numbers come from here. Charts are not included
// (they read the database). For checking the dashboard's look without signing in.
import * as React from "react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ActiveNowCard } from "@/components/dashboard/ActiveNowTile";
import { WindowStatTile } from "@/components/dashboard/WindowStatTile";
import { SalesSectionView } from "@/components/dashboard/SalesSectionView";
import { Sandbox, type SandboxValue } from "@/components/sandbox/sandbox";
import { DemoStore } from "@/components/showcase/demoStore";
import type { StatMetric, StatWindow, WindowStat } from "@/lib/actions/dashboardStats.action";

const STATS: Record<StatMetric, Record<StatWindow, [number, number | null, string?]>> = {
  leads: { "24h": [5, 3], "7d": [12, 15], "30d": [41, 33], all: [128, null] },
  conversionRate: { "24h": [4.2, 3.1, "5 of 119 visitors"], "7d": [3.8, 4.4, "12 of 316 visitors"], "30d": [3.5, 3.0, "41 of 1,171 visitors"], all: [3.3, null, "128 of 3,880 visitors"] },
  sessions: { "24h": [184, 160], "7d": [1210, 1302], "30d": [4890, 4410], all: [15230, null] },
  pageViews: { "24h": [512, 498], "7d": [3388, 3105], "30d": [13870, 12020], all: [44102, null] },
};

export default function DashboardPreview() {
  const [store] = React.useState(() => new DemoStore());
  const sandbox: SandboxValue = React.useMemo(
    () => ({
      navigate: () => {},
      location: { pathname: "/platform/dashboard", search: "" },
      actions: {
        getWindowStat: async (_site: string, metric: StatMetric, window: StatWindow): Promise<WindowStat> => {
          await new Promise((r) => setTimeout(r, 500));
          const [current, previous, detail] = STATS[metric][window];
          return { metric, window, current, previous, ...(detail ? { detail } : {}) };
        },
      },
    }),
    [],
  );
  const marks = store.marks.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, color: m.color, count: m.matchCount ?? 0 }));
  const latest = store.leads.slice(0, 8).map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    page_path: l.page_path,
    submitted_at: l.submitted_at!,
    badges: store.marks.filter((m) => m.active).flatMap((m) => (store.results.get(m.id) ?? []).filter((r) => r.leadId === l.id).map((r) => ({ mark: { id: m.id, name: m.name, color: m.color }, parts: r.parts }))),
  }));
  return (
    <Sandbox value={sandbox}>
      <div className="min-h-screen bg-background p-6">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
        <div className="mx-auto w-full max-w-[1400px]">
          <DashboardHeader name="Sample Studio" domain="studio.example.com" active />
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <ActiveNowCard count={3} />
            <WindowStatTile siteId="sample" metric="leads" icon="userCheck" label="Leads" allowAll noun="form submissions" info="Forms submitted in the chosen window." />
            <WindowStatTile siteId="sample" metric="conversionRate" icon="percent" label="Conversion rate" allowAll noun="conversions" info="People who sent a form, divided by people who visited." />
            <WindowStatTile siteId="sample" metric="sessions" icon="users" label="Sessions" allowAll noun="sessions" info="Visits that started in the window." />
            <WindowStatTile siteId="sample" metric="pageViews" icon="eye" label="Page views" allowAll noun="page views" info="Every page opened in the window." />
          </div>
          <SalesSectionView hooked={{ ok: true, ready: true, leads: store.hooked }} marks={marks} latest={latest} totalLeads={store.leads.length} />
        </div>
      </div>
    </Sandbox>
  );
}
