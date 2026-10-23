"use client";
// components/leads/LeadGroups.tsx
// Lead groups on the Leads page (mds/build/notifications/groups.md): the tabs above the table (All leads, then each
// group), the bar that appears when leads are selected (Add to group, New group from selection, Remove, Clear), and the
// small window to create or change a group. A group is only a box of leads: it has a name and who can see it.
import * as React from "react";
import { Check, ChevronDown, Lock, MoreHorizontal, Plus, Users, X } from "lucide-react";
import { addToGroup, createGroup, deleteGroup, removeFromGroup, updateGroup, type GroupView } from "@/lib/actions/groups.action";

type Note = { tone: "ok" | "error"; text: string } | null;

export function GroupTabs({
  groups,
  total,
  active,
  onPick,
  onNew,
  onEdit,
}: {
  groups: GroupView[];
  total: number;
  active: string | null;
  onPick: (id: string | null) => void;
  onNew: () => void;
  onEdit: (g: GroupView) => void;
}) {
  const tab = (on: boolean) => "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors " + (on ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-muted hover:text-foreground");
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Lead groups">
      <button type="button" role="tab" aria-selected={!active} onClick={() => onPick(null)} className={tab(!active)}>
        All leads <span className="tabular-nums text-xs text-muted-foreground">{total}</span>
      </button>
      {groups.map((g) => (
        <span key={g.id} className="flex shrink-0 items-center">
          <button type="button" role="tab" aria-selected={active === g.id} onClick={() => onPick(g.id)} className={tab(active === g.id)} title={g.visibility === "private" ? "Only you see this group" : "Your teammates see this group"}>
            <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
            {g.name}
            {g.visibility === "private" && <Lock className="size-3 text-muted-foreground" />}
            <span className="tabular-nums text-xs text-muted-foreground">{g.leadIds.length}</span>
          </button>
          {active === g.id && g.canEdit && (
            <button type="button" onClick={() => onEdit(g)} className="ml-0.5 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={"Change " + g.name}>
              <MoreHorizontal className="size-4" />
            </button>
          )}
        </span>
      ))}
      <button type="button" onClick={onNew} className="flex h-8 shrink-0 items-center gap-1 rounded-md border border-dashed px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
        <Plus className="size-3.5" /> New group
      </button>
    </div>
  );
}

/** The bar over the table while leads are selected. */
export function SelectionBar({
  count,
  groups,
  inGroup,
  busy,
  onAdd,
  onNewFromSelection,
  onRemove,
  onClear,
}: {
  count: number;
  groups: GroupView[];
  inGroup: GroupView | null;
  busy: boolean;
  onAdd: (groupId: string) => void;
  onNewFromSelection: () => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const others = groups.filter((g) => g.id !== inGroup?.id);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm" style={{ animation: "jh-card-in 220ms ease-out both" }}>
      <span className="font-medium text-foreground">{count} selected</span>
      <div className="relative" ref={ref}>
        <button type="button" disabled={busy || !others.length} onClick={() => setOpen((o) => !o)} className="flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground disabled:opacity-40" title={others.length ? "Copy them into a group" : "No other group yet: make one"}>
          Add to group <ChevronDown className="size-3.5" />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
            {others.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAdd(g.id);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                <span className="text-xs text-muted-foreground">{g.leadIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" disabled={busy} onClick={onNewFromSelection} className="flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs hover:bg-muted disabled:opacity-40">
        <Plus className="size-3.5" /> New group from selection
      </button>
      {inGroup && (
        <button type="button" disabled={busy} onClick={onRemove} className="flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs text-red-600 hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400">
          Remove from {inGroup.name}
        </button>
      )}
      <button type="button" onClick={onClear} className="ml-auto flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        <X className="size-3.5" /> Clear
      </button>
    </div>
  );
}

/** Create a group (optionally with the selected leads), or rename, change who sees it, or delete one. */
export function GroupDialog({
  group,
  leadIds,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  /** null: a new group */
  group: GroupView | null;
  /** the leads to put in a new group */
  leadIds: string[];
  onClose: () => void;
  onCreated: (g: GroupView) => void;
  onUpdated: (id: string, patch: Partial<GroupView>) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = React.useState(group?.name ?? "");
  const [visibility, setVisibility] = React.useState<"team" | "private">(group?.visibility ?? "team");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    if (!group) {
      const r = await createGroup(name, visibility, leadIds);
      setBusy(false);
      if (!r.ok) return setError(r.error);
      onCreated(r.group);
    } else {
      const r = await updateGroup(group.id, { name, visibility });
      setBusy(false);
      if (!r.ok) return setError(r.error);
      onUpdated(group.id, { name: name.trim(), visibility });
    }
  };
  const remove = async () => {
    if (!group) return;
    setBusy(true);
    const r = await deleteGroup(group.id);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onDeleted(group.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-xl border bg-card p-4 shadow-xl" style={{ animation: "jh-card-in 220ms ease-out both" }} role="dialog" aria-label={group ? "Change group" : "New group"}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{group ? "Change group" : leadIds.length ? `New group with ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}` : "New group"}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <label className="block text-xs text-muted-foreground">Name</label>
        <input autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && save()} placeholder="Deal done" className="mt-1 h-9 w-full rounded-md border bg-background px-2.5 text-sm" />
        <div className="mt-3 text-xs text-muted-foreground">Who sees it</div>
        <div className="mt-1 grid grid-cols-2 gap-2" role="radiogroup">
          {(
            [
              ["team", "Teammates", Users],
              ["private", "Only me", Lock],
            ] as const
          ).map(([v, label, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={visibility === v} onClick={() => setVisibility(v)} className={"flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm " + (visibility === v ? "border-primary bg-primary/10" : "hover:bg-muted")}>
              <Icon className="size-3.5" /> {label}
              {visibility === v && <Check className="ml-auto size-3.5 text-primary" />}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="mt-4 flex items-center gap-2">
          {group &&
            (confirm ? (
              <span className="flex items-center gap-2 text-xs">
                Delete the group? The leads stay.
                <button type="button" disabled={busy} onClick={remove} className="rounded-md bg-red-600 px-2 py-1 text-white">Delete</button>
                <button type="button" onClick={() => setConfirm(false)} className="rounded-md px-2 py-1 hover:bg-muted">Keep</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="text-xs text-red-600 hover:underline dark:text-red-400">Delete group</button>
            ))}
          <button type="button" onClick={onClose} className="ml-auto h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted">Cancel</button>
          <button type="button" disabled={busy || !name.trim()} onClick={save} className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
            {group ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Keeps the groups list and the selection, and runs the actions; returns what the page needs. */
export function useGroups(initial: GroupView[]) {
  const [groups, setGroups] = React.useState<GroupView[]>(initial);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<Note>(null);

  React.useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  const toggle = React.useCallback((ids: string[], on: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  }, []);

  const add = async (groupId: string) => {
    const ids = [...selected];
    setBusy(true);
    const r = await addToGroup(groupId, ids);
    setBusy(false);
    if (!r.ok) return setNote({ tone: "error", text: r.error });
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, leadIds: [...new Set([...ids, ...g.leadIds])] } : g)));
    const name = groups.find((g) => g.id === groupId)?.name ?? "the group";
    setNote({ tone: "ok", text: `${r.added} added to ${name}${r.added < ids.length ? ` (${ids.length - r.added} already there)` : ""}.` });
    setSelected(new Set());
  };

  const remove = async (groupId: string) => {
    const ids = [...selected];
    setBusy(true);
    const r = await removeFromGroup(groupId, ids);
    setBusy(false);
    if (!r.ok) return setNote({ tone: "error", text: r.error });
    setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, leadIds: g.leadIds.filter((id) => !selected.has(id)) } : g)));
    setNote({ tone: "ok", text: `${ids.length} removed from the group.` });
    setSelected(new Set());
  };

  return { groups, setGroups, selected, setSelected, toggle, busy, note, setNote, add, remove };
}
