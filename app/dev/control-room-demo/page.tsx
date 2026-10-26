// app/dev/control-room-demo/page.tsx
// DEMO with FAKE data: the founder's control room (components/admin/ControlRoomView.tsx), to check the layout without
// a database. The real page is /admin (founder only). Every number here is made up.
import { ControlRoomView } from "@/components/admin/ControlRoomView";
import { SiteView } from "@/components/admin/SiteView";
import type { DayRow, Overview, RunRow, SiteRow } from "@/lib/admin/data";
import { DEFAULT_PRICES } from "@/lib/metrics/costs";

const site = (id: string, domain: string, scale: number, extra: Partial<SiteRow> = {}): SiteRow => ({
  site_id: id,
  domain,
  name: domain,
  created_at: "2026-10-01T09:00:00Z",
  verified: true,
  is_active: true,
  last_event_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  members: Math.max(1, Math.round(scale / 3)),
  requests: 900 * scale,
  events: 2600 * scale,
  visits: 140 * scale,
  page_views: 520 * scale,
  forms: 6 * scale,
  dropped: 12 * scale,
  bytes_in: 1_400_000 * scale,
  server_ms: 41_000 * scale,
  db_calls: 2_300 * scale,
  db_ms: 52_000 * scale,
  db_rows: 9_000 * scale,
  leads: 6 * scale,
  leads_total: 40 * scale,
  marks: 2 + scale,
  marks_on: 1 + scale,
  hooks: 2,
  hooks_live: 1,
  sent: 5 * scale,
  failed: 0,
  slack_p50_ms: 3400 + scale * 400,
  slack_p95_ms: 7000 + scale * 2600,
  slack_max_ms: 9000 + scale * 4200,
  runs: 6 * scale,
  run_leads: 6 * scale,
  run_ms: 6 * scale * (1200 + scale * 500),
  run_p95_ms: 1500 + scale * 900,
  run_wait_p95_ms: 300 + scale * 200,
  run_db_calls: 6 * scale * (60 + scale * 30),
  run_db_ms: 6 * scale * (700 + scale * 300),
  run_db_rows: 6 * scale * 900,
  run_errors: 0,
  applies: scale,
  apply_ms: scale * 4000,
  apply_db_rows: scale * 30_000,
  ...extra,
});

const sites: SiteRow[] = [
  site("a1", "jember-techs.vercel.app", 9, { slack_p95_ms: 34_000, slack_max_ms: 52_000 }),
  site("a2", "acme-roofing.com", 4),
  site("a3", "northside-dental.co", 2),
  site("a4", "studio-lumen.design", 1, { verified: false }),
  site("a5", "old-client.io", 0, { is_active: false, last_event_at: null, slack_p50_ms: null, slack_p95_ms: null, slack_max_ms: null, run_p95_ms: null, run_wait_p95_ms: null }),
];

const daily: DayRow[] = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10);
  const f = 0.6 + 0.08 * i;
  return { day: d, events: Math.round(6000 * f), visits: Math.round(330 * f), page_views: Math.round(1200 * f), forms: Math.round(14 * f), server_ms: Math.round(95_000 * f), db_calls: Math.round(5200 * f), db_ms: Math.round(120_000 * f), runs: Math.round(14 * f), run_leads: Math.round(14 * f), run_ms: Math.round(48_000 * f), run_p95_ms: 4000 + i * 600, run_db_calls: Math.round(1800 * f), sent: Math.round(11 * f), slack_p95_ms: 9000 + i * 2500 };
});

const data: Extract<Overview, { ready: true }> = {
  ready: true,
  sites,
  daily,
  now: { people: 9, queue_leads: 2, queue_oldest_ms: 4200, queue_parked: 0, pending_messages: 1, failed_messages_24h: 0, runs_last_hour: 12, run_errors_24h: 0 },
  latency: { sent: 92, slack_p50_ms: 5100, slack_p95_ms: 24_500, slack_max_ms: 52_000, over_30s: 3, runs: 96, run_p50_ms: 2900, run_p95_ms: 9800, run_max_ms: 14_200 },
  storage: [
    { table_name: "page_views", approx_rows: 182_000, total_bytes: 96_000_000 },
    { table_name: "sessions", approx_rows: 41_000, total_bytes: 22_000_000 },
    { table_name: "form_engagement", approx_rows: 9_400, total_bytes: 7_100_000 },
    { table_name: "visitors", approx_rows: 30_000, total_bytes: 6_800_000 },
    { table_name: "form_submissions", approx_rows: 2_300, total_bytes: 2_900_000 },
    { table_name: "lead_marks", approx_rows: 5_100, total_bytes: 1_200_000 },
  ],
};

const runs: RunRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  kind: i === 4 ? "mark_apply" : "leads",
  leads: i === 4 ? 310 : 1 + (i % 3),
  marks: i === 4 ? 1 : 11,
  hooks: i === 4 ? 0 : 2,
  fires: i % 4 === 0 ? 1 : 0,
  deliveries: i % 4 === 0 ? 1 : 0,
  wait_ms: i === 4 ? null : 200 + i * 90,
  marks_ms: i === 4 ? null : 3800 + i * 400,
  hooks_ms: i === 4 ? null : 600 + i * 40,
  total_ms: i === 4 ? 14_200 : 4600 + i * 450,
  db_calls: i === 4 ? 61 : 210 + i * 12,
  db_ms: i === 4 ? 6100 : 3200 + i * 300,
  db_rows: i === 4 ? 48_000 : 2100 + i * 80,
  error: i === 7 ? "statement timeout" : null,
  created_at: new Date(Date.now() - i * 37 * 60_000).toISOString(),
}));
const v2 = (steps: number, conds: number) => ({ v: 2, blocks: [{ id: "b", which: { kind: "any" }, session: Array.from({ length: conds }, (_, i) => ({ id: "c" + i, kind: "duration", n: { op: ">=", a: 30 } })), pages: { order: "sequence", steps: Array.from({ length: steps }, (_, i) => ({ id: "s" + i, path: "/p" + i, match: "exact", conds: [], link: "next" })) }, then: [] }], answers: [], form: [] });

export default async function ControlRoomDemo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await searchParams)?.site) {
    return (
      <SiteView
        data={{
          ready: true,
          site: sites[0],
          daily,
          runs,
          marks: [
            { id: "m1", name: "Pricing deep reader", active: true, rule: v2(4, 5), source: "own", created_by_email: "jb@jember.com" },
            { id: "m2", name: "Blog and homepage", active: true, rule: v2(2, 0), source: "own", created_by_email: "jb@jember.com" },
            { id: "m3", name: "Came back later", active: false, rule: v2(1, 2), source: "copy", created_by_email: "sara@jember.com" },
          ],
          hooks: [
            { id: "h1", name: "blogs and home page", active: true, mark_ids: ["m2"], channel_ids: ["c1"] },
            { id: "h2", name: "high intent lead", active: true, mark_ids: ["m1", "m3"], channel_ids: ["c1", "c2"] },
          ],
        }}
        days={7}
        monthlyUsd={27.4}
        back="/dev/control-room-demo"
        base="/dev/control-room-demo"
      />
    );
  }
  return <ControlRoomView data={data} days={7} prices={DEFAULT_PRICES} base="/dev/control-room-demo" />;
}
