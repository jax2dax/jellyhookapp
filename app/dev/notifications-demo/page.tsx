// app/dev/notifications-demo/page.tsx
// DEMO with FAKE data: the Notifications page's three tabs (components/notifications), stacked. Buttons that save call
// the real server and fail here (no signed-in site); this page is for looking.
import { Inbox } from "@/components/notifications/Inbox";
import { Rules } from "@/components/notifications/Rules";
import { Channels } from "@/components/notifications/Channels";
import type { InboxItem, RulesState } from "@/lib/actions/notifications.action";

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const marks = [
  { id: "m1", name: "Pricing reader", color: "#22c55e", active: true, mine: true, source: "own" },
  { id: "m2", name: "Came back", color: "#f59e0b", active: true, mine: true, source: "copy" },
  { id: "m3", name: "General high intent", color: "#3b82f6", active: false, mine: true, source: "own" },
  { id: "m4", name: "Big budget", color: "#ec4899", active: true, mine: false, source: "own" },
];
const items: InboxItem[] = [
  { id: "n1", title: "Hot Lead new", body: "Anna Kebede matched Pricing reader, Came back", leadId: "L1", ruleId: "r1", marks: [marks[0], marks[1]].map(({ id, name, color }) => ({ id, name, color })), createdAt: ago(3), readAt: null },
  { id: "n2", title: "Pricing readers", body: "Tom Reyes matched Pricing reader", leadId: "L2", ruleId: "r2", marks: [{ id: "m1", name: "Pricing reader", color: "#22c55e" }], createdAt: ago(55), readAt: null },
  { id: "n3", title: "Hot Lead new", body: "Sara Lind matched Pricing reader, Came back", leadId: "L3", ruleId: "r1", marks: [marks[0], marks[1]].map(({ id, name, color }) => ({ id, name, color })), createdAt: ago(60 * 26), readAt: ago(60 * 20) },
];
const state: RulesState = {
  ready: true, me: "u1", canManageChannels: true,
    sampleAd: null, limit: 10, marks,
  members: [{ userId: "u1", email: "you@example.com" }, { userId: "u2", email: "sara@example.com" }, { userId: "u3", email: "ben@example.com" }],
  groups: [{ id: "g1", name: "Deal pipeline", color: "#22c55e" }],
  channels: [{ id: "c1", kind: "slack", name: "#sales", hint: "hooks.slack.com/…/9xQe", status: "ok", lastError: null }, { id: "c2", kind: "webhook", name: "HubSpot via Zapier", hint: "hooks.zapier.com/…/a1b2", status: "failing", lastError: "answered 410" }],
  rules: [
    { id: "r1", name: "Hot Lead new", title: "Hot Lead new", body: "", markIds: ["m1", "m2"], recipients: [], channelIds: ["c1"], addToGroupId: "g1", active: true, mine: true, canEdit: true, createdByEmail: "you@example.com", firedThisWeek: 4, messageOptions: { source: true, adImage: true, watchButton: true, openButton: true, details: true } },
    { id: "r2", name: "Pricing readers", title: "Pricing readers", body: "", markIds: ["m1"], recipients: ["u2"], channelIds: [], addToGroupId: null, active: true, mine: false, canEdit: false, createdByEmail: "sara@example.com", firedThisWeek: 11, messageOptions: { source: true, adImage: true, watchButton: true, openButton: true, details: true } },
    { id: "r3", name: "High intent", title: "High intent", body: "", markIds: ["m3"], recipients: [], channelIds: [], addToGroupId: null, active: true, mine: true, canEdit: true, createdByEmail: "you@example.com", firedThisWeek: 0, messageOptions: { source: true, adImage: true, watchButton: true, openButton: true, details: true } },
  ],
};

export default function NotificationsDemoPage() {
  return (
    <div className="min-h-screen space-y-10 bg-background p-6">
      <div className="text-xs font-medium uppercase tracking-wide text-amber-600">Demo, fake data</div>
      <section>
        <h2 className="mb-3 text-sm font-semibold">Inbox</h2>
        <Inbox items={items} ready />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">Rules</h2>
        <Rules state={state} />
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold">Channels</h2>
        <Channels channels={state.channels} canManage />
      </section>
    </div>
  );
}
