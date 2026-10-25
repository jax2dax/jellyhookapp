"use client";
// components/notifications/Rules.tsx
// Notification rules (mds/build/notifications/notifications.md): "notify when a new lead has all of [marks]", with a
// a subject and message, who gets it (All members by default, or Custom: a way to hand a kind of lead to someone),
// integrations (Slack, webhooks; in-app always) and an optional group to add the lead to. Rules belong to the site:
// they keep running when their creator leaves; their creator or an owner/admin changes them.
import * as React from "react";
import { AppLink as Link, useAction, useSandbox } from "@/components/sandbox/sandbox";
import { Bell, Check, ChevronDown, Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { IntegrationTile, JellyhookTile, KindLogo, SlackLogo } from "./Brand";
import { deleteRule, saveRule, setRuleActive, testHookMessage, type RuleView, type RulesState } from "@/lib/actions/notifications.action";
import { DEFAULT_MESSAGE_OPTIONS, MAX_SUMMARY_PAGES, slackMessage, type MessageOptions, type MessageToggle } from "@/lib/notifications/message";
import { samplePages, sampleSummary } from "@/lib/notifications/sampleVisit";
import { listSitePages } from "@/lib/actions/hook.action";
import { fillTemplate } from "@/lib/notifications/decide";
import { SlackPreview } from "./SlackPreview";
import { copySharedMark } from "@/lib/actions/marks.action";

type Draft = { id?: string; name: string; title: string; body: string; markIds: string[]; recipients: string[]; channelIds: string[]; addToGroupId: string | null; messageOptions: MessageOptions };
const empty = (): Draft => ({ name: "", title: "", body: "", markIds: [], recipients: [], channelIds: [], addToGroupId: null, messageOptions: { ...DEFAULT_MESSAGE_OPTIONS } });

/**
 * `startMark`: a mark id from a mark's "Create a hook" (?newHook=<id>): the editor opens with that mark in it and the
 * mark's name as the hook's name. The address is cleaned so a refresh does not open it again.
 */
export function Rules({
  state: initial,
  startMark = null,
  newHookOptions,
}: {
  state: RulesState;
  startMark?: string | null;
  /** what a new hook's Slack message starts with, over the defaults (the home page demo leaves out the ad parts) */
  newHookOptions?: Partial<MessageOptions>;
}) {
  const fresh = (): Draft => ({ ...empty(), messageOptions: { ...DEFAULT_MESSAGE_OPTIONS, ...newHookOptions } });
  const [state, setState] = React.useState(initial);
  const [draft, setDraft] = React.useState<Draft | null>(() => {
    const m = startMark ? initial.marks.find((x) => x.id === startMark) : null;
    return m ? { ...fresh(), name: m.name, markIds: [m.id] } : null;
  });
  const sandbox = !!useSandbox();
  React.useEffect(() => {
    if (!startMark || sandbox) return;
    const u = new URL(window.location.href);
    u.searchParams.delete("newHook");
    window.history.replaceState(null, "", u.pathname + u.search);
  }, [startMark, sandbox]);
  const [note, setNote] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const actActive = useAction("setRuleActive", setRuleActive);
  const actDelete = useAction("deleteRule", deleteRule);
  const mine = state.rules.filter((r) => r.mine).length;

  if (!state.ready) return <p className="text-sm text-muted-foreground">Notifications are not set up on this database yet (migration 20).</p>;

  const toggle = async (r: RuleView) => {
    setBusy(r.id);
    const res = await actActive(r.id, !r.active);
    setBusy(null);
    if (!res.ok) return setNote({ tone: "error", text: res.error });
    setState((s) => ({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)) }));
  };
  const remove = async (r: RuleView) => {
    if (!window.confirm(`Delete the hook "${r.name}"? Leads it already caught and notifications already sent stay.`)) return;
    setBusy(r.id);
    const res = await actDelete(r.id);
    setBusy(null);
    if (!res.ok) return setNote({ tone: "error", text: res.error });
    setState((s) => ({ ...s, rules: s.rules.filter((x) => x.id !== r.id) }));
  };

  const markOf = (id: string) => state.marks.find((m) => m.id === id);
  const who = (r: { recipients: string[] }) => (r.recipients.length ? r.recipients.map((u) => state.members.find((m) => m.userId === u)?.email ?? "a member").join(", ") : "All members");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">A hook watches every new lead. When one has all of its marks, the lead is hooked and your team is told.</p>
        <button
          type="button"
          disabled={mine >= state.limit || !!draft}
          onClick={() => setDraft(fresh())}
          data-tour="hooks-add"
          title={mine >= state.limit ? `Limit of ${state.limit} hooks reached` : "Add hook"}
          className="flex h-8 shrink-0 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          <Plus className="size-3.5" /> Add hook
        </button>
      </div>
      {note && <p className={"text-xs " + (note.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{note.text}</p>}

      {draft && (
        <RuleEditor
          key={draft.id ?? "new"}
          draft={draft}
          state={state}
          onCancel={() => setDraft(null)}
          onCopied={(m) => setState((s) => ({ ...s, marks: [...s.marks, m] }))}
          onSaved={(id, d) => {
            setState((s) => {
              const view: RuleView = { id, name: d.name, title: d.title || d.name, body: d.body, markIds: d.markIds, recipients: d.recipients, channelIds: d.channelIds, addToGroupId: d.addToGroupId, active: true, mine: true, canEdit: true, createdByEmail: null, firedThisWeek: 0, messageOptions: d.messageOptions };
              const known = s.rules.find((r) => r.id === id);
              return { ...s, rules: known ? s.rules.map((r) => (r.id === id ? { ...known, ...view, active: known.active, mine: known.mine, createdByEmail: known.createdByEmail, firedThisWeek: known.firedThisWeek } : r)) : [...s.rules, view] };
            });
            setNote({ tone: "ok", text: `${d.name} saved.` });
            setDraft(null);
          }}
        />
      )}

      {state.rules.length === 0 && !draft ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Bell className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-foreground">No hooks yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">Add a hook to catch the leads that match the marks you choose, and tell your team.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {state.rules.map((r) => (
            <li key={r.id} data-tour="hook-row" className={"rounded-lg border bg-card p-3 " + (r.active ? "" : "opacity-60")}>
              <div className="flex items-start gap-3">
                {/* a hook's own on/off: a "Live / Paused" pill, so it never looks like a mark's switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.active}
                  disabled={!r.canEdit || busy === r.id}
                  onClick={() => toggle(r)}
                  title={r.active ? "Live: catches every new lead. Click to pause." : "Paused: catches nothing. Click to go live."}
                  className={
                    "mt-0.5 inline-flex h-6 w-[4.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 " +
                    (r.active ? "border-amber-500/60 bg-amber-400/15 text-amber-700 dark:text-amber-300" : "border-border bg-muted text-muted-foreground")
                  }
                >
                  <span className={"size-1.5 rounded-full " + (r.active ? "animate-pulse bg-amber-500" : "bg-muted-foreground/50")} />
                  {r.active ? "Live" : "Paused"}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-foreground">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.firedThisWeek} this week{r.mine ? "" : r.createdByEmail ? " · by " + r.createdByEmail : ""}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Lead marks</span>
                    {r.markIds.map((id) => {
                      const m = markOf(id);
                      return (
                        <span key={id} className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 " + (m && m.active ? "text-foreground" : "border-red-500/50 text-red-600 dark:text-red-400")} title={m ? (m.active ? undefined : "This mark is off. The hook is paused until it is on.") : "This mark was deleted. The hook is paused."}>
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: m?.color ?? "#999" }} />
                          {m?.name ?? "Deleted mark"}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Notify: {who(r)}</span>
                    {r.channelIds.map((c) => {
                      const ch = state.channels.find((x) => x.id === c);
                      return ch ? (
                        <span key={c} className="inline-flex items-center gap-1">
                          <KindLogo kind={ch.kind} className="size-3" /> {ch.name}
                        </span>
                      ) : null;
                    })}
                    {r.addToGroupId && <span>Group: {state.groups.find((g) => g.id === r.addToGroupId)?.name ?? "Deleted group"}</span>}
                  </div>
                </div>
                {r.canEdit && (
                  <span className="flex shrink-0 items-center gap-1">
                    <button type="button" disabled={!!draft} onClick={() => setDraft({ id: r.id, name: r.name, title: r.title, body: r.body, markIds: r.markIds, recipients: r.recipients, channelIds: r.channelIds, addToGroupId: r.addToGroupId, messageOptions: r.messageOptions })} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label={"Edit " + r.name}>
                      <Pencil className="size-3.5" />
                    </button>
                    <button type="button" disabled={busy === r.id} onClick={() => remove(r)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label={"Delete " + r.name}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RuleEditor({
  draft: initial,
  state,
  onCancel,
  onSaved,
  onCopied,
}: {
  draft: Draft;
  state: RulesState;
  onCancel: () => void;
  onSaved: (id: string, d: Draft) => void;
  onCopied: (m: RulesState["marks"][number]) => void;
}) {
  const [d, setD] = React.useState<Draft>(initial);
  const [picking, setPicking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copying, setCopying] = React.useState<string | null>(null);
  const actSave = useAction("saveRule", saveRule);
  const actCopy = useAction("copySharedMark", copySharedMark);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const markOf = (id: string) => state.marks.find((m) => m.id === id);
    const usable = state.marks.filter((m) => m.mine && m.source !== "connected");
  const shared = state.marks.filter((m) => !m.mine);

  const save = async () => {
    setBusy(true);
    setError(null);
    const name = d.name.trim() || "New hook";
    const r = await actSave({ ...d, name, title: d.title.trim() || name });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onSaved(r.id, { ...d, name, title: d.title.trim() || name });
  };
  const copy = async (id: string) => {
    setCopying(id);
    const r = await actCopy(id);
    setCopying(null);
    if (!r.ok) return setError(r.error);
    onCopied({ id: r.mark.id, name: r.mark.name, color: r.mark.color, active: r.mark.active, mine: true, source: "copy" });
    set({ markIds: [...d.markIds, r.mark.id] });
  };

  const label = "w-24 shrink-0 pt-1.5 text-xs font-medium text-muted-foreground";
  const custom = d.recipients.length > 0;
  const seg = (on: boolean) => "h-7 px-3 text-xs transition-colors " + (on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");
  return (
    <div className="rounded-xl border bg-card shadow-sm" data-tour="hook-editor" style={{ animation: "jh-card-in 220ms ease-out both" }}>
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <input
          value={d.name}
          maxLength={60}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="New hook"
          aria-label="Hook name"
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-sm font-semibold hover:border-border focus:border-border focus:outline-none"
        />
        <button type="button" onClick={onCancel} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-4 p-4">
        <div className="flex gap-3">
          <span className={label}>Lead marks</span>
          <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {d.markIds.map((id) => {
              const m = markOf(id);
              return (
                <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs">
                  <span className="size-2 rounded-full" style={{ backgroundColor: m?.color ?? "#999" }} />
                  {m?.name ?? "Deleted mark"}
                  <button type="button" onClick={() => set({ markIds: d.markIds.filter((x) => x !== id) })} className="text-muted-foreground hover:text-foreground" aria-label="Remove">
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            <button type="button" onClick={() => setPicking((p) => !p)} className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              <Plus className="size-3" /> Add mark
            </button>
            {d.markIds.length > 1 && <span className="text-[11px] text-muted-foreground">Lead must match all</span>}
            {picking && (
              <div className="absolute left-0 top-full z-30 mt-1 max-h-80 w-80 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your marks</div>
                {usable.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No marks yet. Create one on the Leads page.</p>}
                {usable.map((m) => {
                  const on = d.markIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!m.active || on}
                      onClick={() => {
                        set({ markIds: [...d.markIds, m.id] });
                        setPicking(false);
                      }}
                      title={m.active ? undefined : "This mark is off. Turn it on in the Marks panel to use it."}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      {on ? <Check className="size-3.5 text-primary" /> : !m.active && <span className="text-[11px] text-muted-foreground">Off</span>}
                    </button>
                  );
                })}
                {shared.length > 0 && <div className="mt-1 border-t px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Shared by teammates</div>}
                {shared.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    <button type="button" disabled={!!copying} onClick={() => copy(m.id)} className="flex h-6 items-center gap-1 rounded border px-1.5 text-[11px] text-foreground hover:bg-muted disabled:opacity-40" title="Adds an independent copy to your marks">
                      {copying === m.id ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Copy to my marks
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <span className={label}>Notify</span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="inline-flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Notify">
              <button type="button" role="radio" aria-checked={!custom} onClick={() => set({ recipients: [] })} className={seg(!custom) + " rounded"}>
                All
              </button>
              <button type="button" role="radio" aria-checked={custom} onClick={() => !custom && set({ recipients: state.members.filter((m) => m.userId === state.me).map((m) => m.userId) })} className={seg(custom) + " rounded"}>
                Custom
              </button>
            </div>
            {custom && (
              <div className="flex flex-wrap gap-1.5">
                {state.members.map((m) => {
                  const on = d.recipients.includes(m.userId);
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => {
                        const next = on ? d.recipients.filter((u) => u !== m.userId) : [...d.recipients, m.userId];
                        if (next.length) set({ recipients: next });
                      }}
                      className={"inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs " + (on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted")}
                    >
                      {on && <Check className="size-3" />}
                      {m.email ?? "Member"}
                      {m.userId === state.me ? " (you)" : ""}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <span className={label}>Message</span>
          <div className="min-w-0 flex-1 overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
            <input
              value={d.title}
              maxLength={80}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Subject"
              aria-label="Subject"
              data-tour="hook-subject"
              className="h-9 w-full border-b bg-transparent px-3 text-sm font-medium focus:outline-none"
            />
            <textarea
              value={d.body}
              maxLength={300}
              rows={2}
              onChange={(e) => set({ body: e.target.value })}
              placeholder="High intent lead with 3 marks"
              aria-label="Message"
              className="block w-full resize-none bg-transparent px-3 py-2 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <span className={label}>Notification method</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <JellyhookTile />
            {state.channels.map((c) => {
              const on = d.channelIds.includes(c.id);
              return (
                <IntegrationTile
                  key={c.id}
                  tour={"channel-" + c.kind}
                  kind={c.kind}
                  label={c.name}
                  selected={on}
                  muted={c.status !== "ok"}
                  title={c.status === "ok" ? c.name : c.name + ": delivery failing"}
                  onClick={() => set({ channelIds: on ? d.channelIds.filter((x) => x !== c.id) : [...d.channelIds, c.id] })}
                />
              );
            })}
            {!state.channels.some((c) => c.kind === "slack") && (
              <Link href="/platform/integrations" className="relative flex h-[72px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-background hover:border-foreground/30" title="Connect Slack">
                <SlackLogo className="size-6 opacity-60" />
                <span className="text-[11px] text-muted-foreground">Connect</span>
              </Link>
            )}
          </div>
        </div>

        {d.channelIds.some((id) => state.channels.find((c) => c.id === id)?.kind === "slack") && <SlackMessageOptions d={d} state={state} set={set} />}

        <div className="flex gap-3">
          <span className={label}>Same visitor again</span>
          <div className="min-w-0 flex-1 space-y-1">
            <select
              value={d.messageOptions.repeat}
              onChange={(e) => set({ messageOptions: { ...d.messageOptions, repeat: e.target.value as MessageOptions["repeat"] } })}
              className="h-8 min-w-0 rounded-md border bg-background px-2 text-sm"
              aria-label="When the same visitor matches this hook again"
            >
              <option value="daily">Notify once a day</option>
              <option value="every">Notify every time</option>
            </select>
            <p className="text-[11px] text-muted-foreground">When one visitor sends several forms that match. Once a day avoids repeat messages; every time is useful for testing.</p>
          </div>
        </div>

        <div className="flex gap-3">
          <span className={label}>
            Add lead to group <span className="block font-normal text-muted-foreground/70">(optional)</span>
          </span>
          <select
            value={d.addToGroupId ?? ""}
            disabled={!state.groups.length}
            onChange={(e) => set({ addToGroupId: e.target.value || null })}
            className="h-8 min-w-0 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
          >
            <option value="">{state.groups.length ? "None" : "No groups"}</option>
            {state.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t px-4 py-3">
        <button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted">
          Cancel
        </button>
        <button type="button" data-tour="hook-save" disabled={busy || !d.markIds.length} onClick={save} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
          {busy && <Loader2 className="size-3.5 animate-spin" />} {d.id ? "Save changes" : "Create hook"}
        </button>
      </div>
    </div>
  );
}

const OPTION_ROWS: { key: MessageToggle; label: string; hint: string }[] = [
  { key: "source", label: "Where they came from", hint: "Came from: Meta · Ads · Spring sale · 2026 Core Demo Video" },
  { key: "adImage", label: "The ad's thumbnail", hint: "When the ad has one in Acquisition → Ads" },
  { key: "watchButton", label: "Watch the ad button", hint: "When the ad has a video link" },
  { key: "openButton", label: "Open the lead button", hint: "A link to the lead, in Jellyhook or HubSpot" },
  { key: "details", label: "Hook, site and time", hint: "The small line under the message" },
];

/**
 * "Customize the Slack message" (shown once a Slack channel is picked): which parts the hook's Slack message carries
 * besides its subject and message, a preview drawn from the exact blocks sent, and a test sent to the picked channels.
 * Webhooks always receive every field.
 */
function SlackMessageOptions({ d, state, set }: { d: Draft; state: RulesState; set: (patch: Partial<Draft>) => void }) {
  const [open, setOpen] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const actTest = useAction("testHookMessage", testHookMessage);
  const o = d.messageOptions;
  const markNames = d.markIds.map((id) => state.marks.find((m) => m.id === id)?.name ?? "a mark");
  const ad = state.sampleAd;
  const preview = slackMessage({
    deliveryId: "preview",
    eventId: "preview",
    createdAt: new Date().toISOString(),
    site: { id: "", domain: null },
    rule: { id: "", name: d.name.trim() || "New hook" },
    title: d.title.trim() || d.name.trim() || "New hook",
    body: fillTemplate(d.body, "a new lead", markNames.length ? markNames : ["your marks"]),
    marks: [],
    lead: { id: "", url: "https://jellyhook.com", submittedAt: new Date().toISOString(), hubspotUrl: state.hubspotConnected ? "https://app.hubspot.com" : null },
    source: ad ? { line: ad.line, ad: { platform: "", adId: "", title: ad.title, thumbnailUrl: ad.thumbnailUrl, videoUrl: ad.videoUrl ?? "https://example.com/video" } } : { line: "Meta · Ads · Spring sale · Example ad", ad: { platform: "", adId: "", title: "Example ad", thumbnailUrl: (typeof window === "undefined" ? "https://jellyhook.com" : window.location.origin) + "/jellyhook-nobg.png", videoUrl: "https://example.com/video" } },
    options: o,
    summary: o.summary === "off" ? null : sampleSummary(o.summary),
    pages: o.pages.length ? samplePages(o.pages, o.pageScope) : null,
  }) as unknown as { blocks: Parameters<typeof SlackPreview>[0]["blocks"] };
  const test = async () => {
    setTesting(true);
    setNote(null);
    const r = await actTest({ name: d.name, title: d.title, body: d.body, markIds: d.markIds, channelIds: d.channelIds, messageOptions: o });
    setTesting(false);
    if (!r.ok) return setNote({ tone: "error", text: r.error });
    setNote(r.failed.length ? { tone: "error", text: "Not delivered: " + r.failed.join("; ") } : { tone: "ok", text: `Sent to ${r.sent} Slack channel${r.sent === 1 ? "" : "s"}. Check Slack.` });
  };
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 pt-1.5 text-xs font-medium text-muted-foreground">Slack message</span>
      <div className="min-w-0 flex-1 space-y-2">
        <button type="button" data-tour="slack-customize" onClick={() => setOpen((x) => !x)} className="inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted" aria-expanded={open}>
          Customize <ChevronDown className={"size-3 transition-transform " + (open ? "rotate-180" : "")} />
        </button>
        {open && (
          <div className="grid gap-3 rounded-md border bg-background p-3 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">The subject and message are always sent. Choose what else the Slack message shows:</p>
              {OPTION_ROWS.map((row) => (
                <label key={row.key} className="flex cursor-pointer items-start gap-2 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={o[row.key]} onChange={(e) => set({ messageOptions: { ...o, [row.key]: e.target.checked } })} />
                  <span>
                    <span className="block text-foreground">{row.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{row.hint}</span>
                  </span>
                </label>
              ))}
              {state.hubspotConnected && o.openButton && (
                <label className="block space-y-1 border-t pt-2 text-xs">
                  <span className="block text-foreground">Open the lead in</span>
                  <select className="h-7 w-full rounded-md border bg-background px-2 text-xs" value={o.leadLink} onChange={(e) => set({ messageOptions: { ...o, leadLink: e.target.value as MessageOptions["leadLink"] } })}>
                    <option value="hubspot">HubSpot (its contact record)</option>
                    <option value="jellyhook">Jellyhook</option>
                    <option value="both">Both: a button for each</option>
                  </select>
                  <span className="block text-[11px] text-muted-foreground">With no HubSpot contact for the lead&apos;s email yet, it opens in Jellyhook.</span>
                </label>
              )}
              <SummaryOptions o={o} set={(patch) => set({ messageOptions: { ...o, ...patch } })} />
              <button type="button" disabled={testing} onClick={test} className="mt-1 inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40">
                {testing ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />} Send a test to Slack
              </button>
              {note && <p className={"text-[11px] " + (note.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{note.text}</p>}
              {!ad && <p className="text-[11px] text-muted-foreground">The preview uses an example ad. Add your ads in Acquisition → Ads to see yours.</p>}
              {(o.summary !== "off" || o.pages.length > 0) && <p className="text-[11px] text-muted-foreground">The preview summarizes an example visit. The test uses your newest lead.</p>}
            </div>
            <div className="min-w-0" data-tour="slack-preview">
              <SlackPreview blocks={preview.blocks} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const SUMMARY_CHOICES: { value: MessageOptions["summary"]; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "short", label: "Short: the visit and its pages" },
  { value: "moderate", label: "Moderate: the key points" },
  { value: "long", label: "Long: everything" },
];

/**
 * The visit summary's version and up to MAX_SUMMARY_PAGES page summaries, with which visits those read. The site's
 * pages are listed (lib/actions/hook.action.ts listSitePages) only when the page box is first used.
 */
function SummaryOptions({ o, set }: { o: MessageOptions; set: (patch: Partial<MessageOptions>) => void }) {
  const [pages, setPages] = React.useState<string[] | null>(null);
  const [path, setPath] = React.useState("");
  const listId = React.useId();
  const actPages = useAction("listSitePages", listSitePages);
  const loadPages = () => {
    if (pages !== null) return;
    setPages([]);
    actPages()
      .then((r) => setPages(r.map((x) => x.path)))
      .catch(() => setPages([]));
  };
  const clean = path.trim();
  const canAdd = clean.startsWith("/") && o.pages.length < MAX_SUMMARY_PAGES && !o.pages.includes(clean);
  const add = () => {
    if (!canAdd) return;
    set({ pages: [...o.pages, clean.slice(0, 200)] });
    setPath("");
  };
  const field = "h-7 w-full rounded-md border bg-background px-2 text-xs";
  return (
    <div className="space-y-2 border-t pt-2">
      <label className="block space-y-1 text-xs">
        <span className="block text-foreground">Visit summary</span>
        <select className={field} value={o.summary} onChange={(e) => set({ summary: e.target.value as MessageOptions["summary"] })}>
          {SUMMARY_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="block text-[11px] text-muted-foreground">What they did in the visit with the form, before sending it.</span>
      </label>
      <div className="space-y-1 text-xs">
        <span className="block text-foreground">
          Page summaries <span className="text-muted-foreground">(up to {MAX_SUMMARY_PAGES})</span>
        </span>
        {o.pages.map((p) => (
          <div key={p} className="flex items-center gap-1 rounded-md border px-2 py-1">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px]">{p}</code>
            <button type="button" aria-label={"Remove " + p} onClick={() => set({ pages: o.pages.filter((x) => x !== p) })} className="text-muted-foreground hover:text-foreground">
              <X className="size-3" />
            </button>
          </div>
        ))}
        {o.pages.length < MAX_SUMMARY_PAGES && (
          <div className="flex gap-1">
            <input
              className={field}
              list={listId}
              placeholder="/pricing"
              value={path}
              onFocus={loadPages}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button type="button" disabled={!canAdd} onClick={add} className="h-7 shrink-0 rounded-md border px-2 text-xs hover:bg-muted disabled:opacity-40">
              Add
            </button>
            <datalist id={listId}>
              {(pages ?? []).map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        )}
        {o.pages.length > 0 && (
          <select className={field} value={o.pageScope} onChange={(e) => set({ pageScope: e.target.value as MessageOptions["pageScope"] })} aria-label="Which visits the page summaries read">
            <option value="all">Read every visit of the lead</option>
            <option value="converting">Read only the visit with the form</option>
          </select>
        )}
        <span className="block text-[11px] text-muted-foreground">A page they did not open reads &quot;Page not visited&quot;.</span>
      </div>
    </div>
  );
}
