// components/showcase/demoStore.ts
// The home page demo's "database": the sample site's leads, marks, groups and hooks, kept in memory for one visit to
// the page. It answers the same actions the real components call (components/sandbox/sandbox.tsx), so the demo runs the
// real Leads and Hooks screens. Marks are checked with the real checker (jh-marks/v2/check.ts) against the sample
// journeys, so a mark built in the demo badges exactly the leads it would match. Nothing is sent anywhere.
import { checkLead } from "@/jh-marks/v2/check";
import { describeRuleV2, isRuleV2, RuleV2Error, validateRuleV2, type MarkRuleV2 } from "@/jh-marks/v2/rule";
import { DEFAULT_MESSAGE_OPTIONS, messageOptions } from "@/lib/notifications/message";
import type { LeadMark, MarksState, MarkView, SaveMarkInput } from "@/lib/actions/marks.action";
import type { GroupsState, GroupView } from "@/lib/actions/groups.action";
import type { RuleView, RulesState, SaveRuleInput } from "@/lib/actions/notifications.action";
import type { HookedLead } from "@/lib/actions/hooks.action";
import type { SandboxActions } from "@/components/sandbox/sandbox";
import type { LeadRow } from "@/components/leads/LeadsTable";
import { buildSample, headingsOf, SAMPLE_FIELDS, SAMPLE_PAGES } from "./sampleSite";
import type { Journey } from "@/jh-marks/v2/check";

const ME = "demo-you";
const YOU = "you@studio.example.com";
const TEAM = [
  { userId: ME, email: YOU },
  { userId: "demo-sara", email: "sara@studio.example.com" },
  { userId: "demo-ben", email: "ben@studio.example.com" },
];
const SLACK = { id: "demo-slack", kind: "slack" as const, name: "#sales-leads", hint: "Slack", status: "ok" as const, lastError: null };
const AI_OFF = "Describing a mark in your own words is not part of this demo. Choose Enter manually.";

let seq = 0;
const stamp = () => new Date(Date.now() + ++seq).toISOString();

export class DemoStore {
  readonly leads: LeadRow[];
  readonly journeys: Map<string, Journey>;
  marks: MarkView[] = [];
  results = new Map<string, LeadMark[]>();
  groups: GroupView[];
  rules: RuleView[] = [];
  hooked: HookedLead[] = [];
  /** the mark saved last (the tour points at it) */
  lastMarkId: string | null = null;
  private listeners = new Set<() => void>();

  constructor(now = Date.now()) {
    const s = buildSample(now);
    this.leads = s.leads;
    this.journeys = s.journeys;
    const big = this.addMark("demo-big-budget", "Big budget", "#f59e0b", "Picked the top budget on the form. Reply the same day.", {
      v: 2,
      blocks: [],
      answers: [{ id: "a1", field: "custom:budget", name: "Budget", kind: "choice", op: "is", values: ["$20k+"], options: SAMPLE_FIELDS[0].options }],
      form: [],
    });
    this.addMark("demo-came-back", "Came back", "#14b8a6", "Visited more than once before sending the form.", {
      v: 2,
      blocks: [{ id: "b1", which: { kind: "nth", n: { op: ">=", a: 2 } }, session: [{ id: "s1", kind: "pages", n: { op: ">=", a: 1 } }], pages: null, then: [] }],
      answers: [],
      form: [],
    });
    const recent = this.leads.slice(0, 6).map((l) => l.id);
    this.groups = [
      { id: "demo-g1", name: "Call this week", color: "#22c55e", visibility: "team", mine: true, canEdit: true, createdByEmail: YOU, leadIds: recent.slice(0, 2) },
      { id: "demo-g2", name: "Proposals sent", color: "#a855f7", visibility: "team", mine: false, canEdit: false, createdByEmail: TEAM[1].email, leadIds: [recent[3]] },
    ];
    this.rules = [
      { id: "demo-r1", name: "Big budget", title: "Big budget lead", body: "{lead} matched {marks}", markIds: [big.id], recipients: [], channelIds: [SLACK.id], addToGroupId: null, active: true, mine: true, canEdit: true, createdByEmail: YOU, firedThisWeek: 2, messageOptions: { ...DEFAULT_MESSAGE_OPTIONS } },
    ];
    this.hooked = this.leads
      .filter((l) => (this.results.get(big.id) ?? []).some((r) => r.leadId === l.id))
      .slice(0, 2)
      .map((l) => ({ leadId: l.id, name: l.name, email: l.email, page: l.page_path, submittedAt: l.submitted_at, hookedAt: l.submitted_at!, hooks: [{ id: "demo-r1", name: "Big budget" }], source: null, ad: null }));
  }

  // ── change notices (the demo's sidebar badge) ──
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }
  private changed() {
    for (const fn of this.listeners) fn();
  }

  // ── marks ──
  private check(mark: MarkView) {
    const rule = mark.rule && isRuleV2(mark.rule) ? mark.rule : null;
    const rows: LeadMark[] = [];
    if (rule) for (const [leadId, j] of this.journeys) {
      const r = checkLead(rule, j);
      if (r.match) rows.push({ leadId, markId: mark.id, parts: r.parts });
    }
    this.results.set(mark.id, rows);
    mark.matchCount = rows.length;
    mark.evaluatedAt = stamp();
  }

  private addMark(id: string, name: string, color: string, description: string, rule: MarkRuleV2): MarkView {
    const r = validateRuleV2(rule);
    const at = new Date(Date.now() - 6 * 86_400_000).toISOString();
    const m: MarkView = { id, name, description, color, active: true, visibility: "team", sharedWith: [], rule: r, spec: null, reads: describeRuleV2(r).join(" "), templateKey: null, source: "own", sourceKey: null, vars: [], varValues: {}, locked: false, mine: true, createdByEmail: YOU, createdAt: at, updatedAt: at, matchCount: 0, evaluatedAt: null };
    this.check(m);
    this.marks.push(m);
    return m;
  }

  marksState(): MarksState {
    return { ok: true, ready: true, me: ME, marks: this.marks.map((m) => ({ ...m })), leadMarks: [], team: TEAM, pages: SAMPLE_PAGES, limit: 5, totalLimit: 15 };
  }

  groupsState(): GroupsState {
    return { ok: true, ready: true, groups: this.groups.map((g) => ({ ...g, leadIds: [...g.leadIds] })), limit: 30 };
  }

  rulesState(): RulesState {
    return {
      ready: true,
      me: ME,
      canManageChannels: true,
      rules: this.rules.map((r) => ({ ...r })),
      marks: this.marks.map((m) => ({ id: m.id, name: m.name, color: m.color, active: m.active, mine: m.mine, source: m.source })),
      members: TEAM,
      groups: this.groups.map((g) => ({ id: g.id, name: g.name, color: g.color })),
      channels: [SLACK],
      limit: 10,
      sampleAd: null,
      hubspotConnected: false,
    };
  }

  // ── the actions the real components call ──
  actions(): Partial<SandboxActions> {
    const later = <T>(v: T, ms = 280) => new Promise<T>((res) => setTimeout(() => res(v), ms));
    const markById = (id: string) => this.marks.find((m) => m.id === id);
    return {
      saveMark: async (input: SaveMarkInput) => {
        const name = String(input.name ?? "").trim().slice(0, 40);
        if (!name) return later({ ok: false as const, error: "Give the mark a name." });
        if (!isRuleV2(input.rule)) return later({ ok: false as const, error: "Add at least one condition." });
        let rule: MarkRuleV2;
        try {
          rule = validateRuleV2(input.rule);
        } catch (e) {
          return later({ ok: false as const, error: e instanceof RuleV2Error ? e.message : "Something is not right." });
        }
        const now = new Date().toISOString();
        const old = input.id ? markById(input.id) : undefined;
        if (!old && this.marks.filter((m) => m.mine && m.source === "own").length >= 5) return later({ ok: false as const, error: "You have 5 marks of your own, the most there can be. Delete one to make another." });
        const m: MarkView = {
          ...(old ?? { id: "demo-mark-" + ++seq, createdAt: now, templateKey: null, source: "own" as const, sourceKey: null, vars: [], varValues: {}, locked: false, mine: true, createdByEmail: YOU, matchCount: 0, evaluatedAt: null }),
          name,
          description: input.description?.trim() || null,
          color: input.color,
          active: !!input.active,
          visibility: input.visibility,
          sharedWith: input.sharedWith ?? [],
          rule,
          spec: null,
          reads: describeRuleV2(rule).join(" "),
          updatedAt: now,
        };
        this.check(m);
        this.marks = old ? this.marks.map((x) => (x.id === m.id ? m : x)) : [...this.marks, m];
        this.lastMarkId = m.id;
        this.changed();
        return later({ ok: true as const, mark: { ...m } }, 650);
      },
      leadMarksFor: async (ids: string[]) => later({ ok: true as const, rows: ids.flatMap((id) => this.results.get(id) ?? []) }, 120),
      setMarkActive: async (id: string, active: boolean) => {
        const m = markById(id);
        if (!m) return later({ ok: false as const, error: "This mark was deleted." });
        m.active = active;
        if (active) this.check(m);
        this.changed();
        return later({ ok: true as const, matchCount: m.matchCount, evaluatedAt: m.evaluatedAt });
      },
      recheckMark: async (id: string) => {
        const m = markById(id);
        if (!m) return later({ ok: false as const, error: "This mark was deleted." });
        this.check(m);
        return later({ ok: true as const, matchCount: m.matchCount ?? 0, evaluatedAt: m.evaluatedAt! }, 500);
      },
      deleteMark: async (id: string) => {
        this.marks = this.marks.filter((m) => m.id !== id);
        this.results.delete(id);
        this.changed();
        return later({ ok: true as const });
      },
      markFromAi: async () => later({ ok: false as const, error: AI_OFF }),
      markFromAiV2: async () => later({ ok: false as const, error: AI_OFF }),
      loadFormFields: async () => later({ ok: true as const, fields: SAMPLE_FIELDS, namesReady: true }, 150),
      loadPageHeadings: async (path: string) => later({ ok: true as const, headings: headingsOf(String(path).split("?")[0]) }, 150),
      setLeadQualified: async (_site: string, leadId: string, qualified: boolean | null) => {
        const l = this.leads.find((x) => x.id === leadId);
        if (l) l.qualified = qualified;
        return later({ ok: true });
      },

      // groups
      createGroup: async (name: string, visibility: "team" | "private", leadIds: string[] = []) => {
        const clean = name.trim().slice(0, 40);
        if (!clean) return later({ ok: false as const, error: "Give the group a name." });
        const g: GroupView = { id: "demo-g" + ++seq, name: clean, color: "#0ea5e9", visibility, mine: true, canEdit: true, createdByEmail: YOU, leadIds: [...leadIds] };
        this.groups = [...this.groups, g];
        return later({ ok: true as const, group: { ...g } });
      },
      addToGroup: async (groupId: string, leadIds: string[]) => {
        const g = this.groups.find((x) => x.id === groupId);
        if (!g) return later({ ok: false as const, error: "This group was deleted." });
        const before = g.leadIds.length;
        g.leadIds = [...new Set([...g.leadIds, ...leadIds])];
        return later({ ok: true as const, added: g.leadIds.length - before });
      },
      removeFromGroup: async (groupId: string, leadIds: string[]) => {
        const g = this.groups.find((x) => x.id === groupId);
        if (g) g.leadIds = g.leadIds.filter((id) => !leadIds.includes(id));
        return later({ ok: true as const });
      },
      updateGroup: async (groupId: string, patch: { name?: string; visibility?: "team" | "private" }) => {
        this.groups = this.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
        return later({ ok: true as const });
      },
      deleteGroup: async (groupId: string) => {
        this.groups = this.groups.filter((g) => g.id !== groupId);
        return later({ ok: true as const });
      },

      // hooks
      saveRule: async (input: SaveRuleInput) => {
        if (!input.markIds.length) return later({ ok: false as const, error: "Add at least one mark." });
        const id = input.id ?? "demo-r" + ++seq;
        const view: RuleView = {
          id,
          name: input.name.trim() || "New hook",
          title: input.title.trim() || input.name.trim() || "New hook",
          body: input.body,
          markIds: [...input.markIds],
          recipients: [...input.recipients],
          channelIds: [...input.channelIds],
          addToGroupId: input.addToGroupId,
          active: true,
          mine: true,
          canEdit: true,
          createdByEmail: YOU,
          firedThisWeek: 0,
          messageOptions: messageOptions(input.messageOptions ?? {}),
        };
        this.rules = this.rules.some((r) => r.id === id) ? this.rules.map((r) => (r.id === id ? view : r)) : [...this.rules, view];
        this.changed();
        return later({ ok: true as const, id }, 600);
      },
      setRuleActive: async (id: string, active: boolean) => {
        this.rules = this.rules.map((r) => (r.id === id ? { ...r, active } : r));
        return later({ ok: true as const });
      },
      deleteRule: async (id: string) => {
        this.rules = this.rules.filter((r) => r.id !== id);
        return later({ ok: true as const });
      },
      testHookMessage: async () => later({ ok: false as const, error: "Slack is not connected in this demo. Sign up free and connect your own workspace." }),
      markRead: async () => later({ ok: true as const }, 50),
      listSitePages: async () => later(SAMPLE_PAGES.map((path) => ({ path, views: 0 }))),
    };
  }
}
