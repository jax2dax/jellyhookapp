// app/dev/marks-demo/page.tsx
// DEMO with FAKE data: the leads page with marks (the real components: LeadsWithMarks, MarksPanel, MarkBuilder,
// MarkBadge). Nothing here reads a database; saving, turning on/off and the AI need a signed-in site and fail here.
import { Suspense } from "react";
import { LeadsWithMarks } from "@/components/leads/LeadsWithMarks";
import { compileRule, describeRule, validateRule, type MarkRule } from "@/jh-marks/rule";
import type { MarksState, MarkView } from "@/lib/actions/marks.action";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const names = ["Anna Kebede", "Tom Reyes", "Sara Lind", "Marco Bianchi", "Lina Haddad", "Joe Park", "Ruth Alemu", "Ivan Petrov", "Mia Chen", "Dawit Tesfaye", "Nora Quinn", "Ben Okafor"];
const leads = names.map((n, i) => ({
  id: "lead" + i,
  name: n,
  email: n.toLowerCase().replace(" ", ".") + "@example.com",
  page_path: i % 3 === 0 ? "/demo" : "/contact",
  submitted_at: new Date(NOW - i * 7 * 3_600_000).toISOString(),
  qualified: i % 5 === 0 ? true : null,
}));

const mark = (id: string, name: string, color: string, rule: MarkRule | null, extra: Partial<MarkView> = {}): MarkView => {
  const r = rule ? validateRule(rule) : null;
  return {
    id, name, color, description: null, active: true, visibility: "private", sharedWith: [], rule: r,
    spec: r ? compileRule(r) : { v: 3, entity: "lead", where: [], output: { kind: "ids" } }, reads: r ? describeRule(r) : "Leads from the spring campaign (made in Hook)",
    templateKey: null, mine: true, createdByEmail: "you@example.com", createdAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T10:00:00Z", matchCount: 0, evaluatedAt: null, ...extra,
  };
};
const marks: MarkView[] = [
  mark("m1", "Pricing reader", "#22c55e", { v: 1, scope: "any", rows: [{ id: "r", order: "any", cards: [{ id: "c", path: "/pricing", match: "exact", minSeconds: 30 }] }], lead: [] }, { matchCount: 5, visibility: "team", description: "Call within the hour: they know the price." }),
  mark("m2", "General high intent", "#3b82f6", { v: 1, scope: "any", rows: [], lead: [{ id: "a", kind: "readEvery", minPct: 80 }, { id: "b", kind: "pages", min: 2 }] }, { matchCount: 4, templateKey: "high-intent" }),
  mark("m3", "Came back", "#f59e0b", { v: 1, scope: "any", rows: [], lead: [{ id: "a", kind: "visits", min: 2 }] }, { active: false, matchCount: null, templateKey: "came-back" }),
  mark("m4", "Spring campaign", "#a855f7", null, { mine: false, createdByEmail: "sara@example.com", visibility: "team", matchCount: 3 }),
];
const has: [string, string, string[]][] = [
  ["lead0", "m1", ["/pricing: 2 views, longest 3m 10s, read 100%"]],
  ["lead0", "m2", ["read at least 86% of every page", "5 pages"]],
  ["lead2", "m1", ["/pricing: 1 view, longest 45 s, read 80%"]],
  ["lead3", "m4", []],
  ["lead4", "m1", ["/pricing: 3 views, longest 1m 2s, read 100%"]],
  ["lead4", "m2", ["read at least 91% of every page", "3 pages"]],
  ["lead4", "m4", []],
  ["lead7", "m2", ["read at least 80% of every page", "2 pages"]],
  ["lead8", "m1", ["/pricing: 1 view, longest 31 s, read 64%"]],
  ["lead9", "m1", ["/pricing: 2 views, longest 50 s, read 92%"]],
  ["lead9", "m2", ["read at least 83% of every page", "4 pages"]],
  ["lead10", "m4", []],
];
const state: MarksState = {
  ok: true, ready: true, me: "user_me", marks, limit: 5,
  leadMarks: has.map(([leadId, markId, parts]) => ({ leadId, markId, parts })),
  team: [{ userId: "user_me", email: "you@example.com" }, { userId: "user_sara", email: "sara@example.com" }, { userId: "user_ben", email: "ben@example.com" }],
  pages: ["/", "/pricing", "/demo", "/contact", "/about", "/blog/", "/case-studies"],
};

export default function MarksDemoPage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
      <h1 className="mb-6 text-lg font-semibold text-foreground">Leads</h1>
      <Suspense>
        <LeadsWithMarks leads={leads} siteId="demo" marks={state} />
      </Suspense>
    </div>
  );
}
