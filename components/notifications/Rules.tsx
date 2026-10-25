"use client";
// components/notifications/Rules.tsx
// Notification rules (mds/build/notifications/notifications.md): "notify when a new lead has all of [marks]", with a
// a subject and message, who gets it (All members by default, or Custom: a way to hand a kind of lead to someone),
// integrations (Slack, webhooks; in-app always) and an optional group to add the lead to. Rules belong to the site:
// they keep running when their creator leaves; their creator or an owner/admin changes them.
import * as React from "react";
import Link from "next/link";
import { Bell, Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { IntegrationTile, JellyhookTile, KindLogo, SlackLogo } from "./Brand";
import { deleteRule, saveRule, setRuleActive, type RuleView, type RulesState } from "@/lib/actions/notifications.action";
import { copySharedMark } from "@/lib/actions/marks.action";

type Draft = { id?: string; name: string; title: string; body: string; markIds: string[]; recipients: string[]; channelIds: string[]; addToGroupId: string | null };
const empty = (): Draft => ({ name: "", title: "", body: "", markIds: [], recipients: [], channelIds: [], addToGroupId: null });

export function Rules({ state: initial }: { state: RulesState }) {
  const [state, setState] = React.useState(initial);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [note, setNote] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const mine = state.rules.filter((r) => r.mine).length;

  if (!state.ready) return <p className="text-sm text-muted-foreground">Notifications are not set up on this database yet (migration 20).</p>;

  const toggle = async (r: RuleView) => {
    setBusy(r.id);
    const res = await setRuleActive(r.id, !r.active);
    setBusy(null);
    if (!res.ok) return setNote({ tone: "error", text: res.error });
    setState((s) => ({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)) }));
  };
  const remove = async (r: RuleView) => {
    if (!window.confirm(`Delete the hook "${r.name}"? Leads it already caught and notifications already sent stay.`)) return;
    setBusy(r.id);
    const res = await deleteRule(r.id);
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
          onClick={() => setDraft(empty())}
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
              const view: RuleView = { id, name: d.name, title: d.title || d.name, body: d.body, markIds: d.markIds, recipients: d.recipients, channelIds: d.channelIds, addToGroupId: d.addToGroupId, active: true, mine: true, canEdit: true, createdByEmail: null, firedThisWeek: 0 };
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
            <li key={r.id} className={"rounded-lg border bg-card p-3 " + (r.active ? "" : "opacity-60")}>
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
                    <button type="button" disabled={!!draft} onClick={() => setDraft({ id: r.id, name: r.name, title: r.title, body: r.body, markIds: r.markIds, recipients: r.recipients, channelIds: r.channelIds, addToGroupId: r.addToGroupId })} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label={"Edit " + r.name}>
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
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const markOf = (id: string) => state.marks.find((m) => m.id === id);
    const usable = state.marks.filter((m) => m.mine && m.source !== "connected");
  const shared = state.marks.filter((m) => !m.mine);

  const save = async () => {
    setBusy(true);
    setError(null);
    const name = d.name.trim() || "New hook";
    const r = await saveRule({ ...d, name, title: d.title.trim() || name });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onSaved(r.id, { ...d, name, title: d.title.trim() || name });
  };
  const copy = async (id: string) => {
    setCopying(id);
    const r = await copySharedMark(id);
    setCopying(null);
    if (!r.ok) return setError(r.error);
    onCopied({ id: r.mark.id, name: r.mark.name, color: r.mark.color, active: r.mark.active, mine: true, source: "copy" });
    set({ markIds: [...d.markIds, r.mark.id] });
  };

  const label = "w-24 shrink-0 pt-1.5 text-xs font-medium text-muted-foreground";
  const custom = d.recipients.length > 0;
  const seg = (on: boolean) => "h-7 px-3 text-xs transition-colors " + (on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground");
  return (
    <div className="rounded-xl border bg-card shadow-sm" style={{ animation: "jh-card-in 220ms ease-out both" }}>
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
              <Link href="/platform/hooks?tab=integrations" className="relative flex h-[72px] w-[84px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed bg-background hover:border-foreground/30" title="Connect Slack">
                <SlackLogo className="size-6 opacity-60" />
                <span className="text-[11px] text-muted-foreground">Connect</span>
              </Link>
            )}
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
        <button type="button" disabled={busy || !d.markIds.length} onClick={save} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
          {busy && <Loader2 className="size-3.5 animate-spin" />} {d.id ? "Save changes" : "Create hook"}
        </button>
      </div>
    </div>
  );
}
