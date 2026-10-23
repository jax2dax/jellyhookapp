"use client";
// components/leads/LeadsWithMarks.tsx
// The leads page body: the header and table on the left, the marks panel (always there) on the right, from the top.
//
// Speed (founder, 2026-10-16): nothing here makes the server rebuild the page.
//   - Badges: each mark's results (which leads have it, and why) are kept in this browser under the mark's stamp
//     (marks.evaluated_at, which moves only when that mark's results change: an edit, or new leads matched). On load,
//     only marks whose stamp moved are fetched (leadMarksFor), in one request. Turning a mark on/off or applying it
//     reads nothing.
//   - Applying lives in the address (?marks=) but is written with history.replaceState, so the server is not asked
//     to re-render.
//   - After an edit, delete or on/off, the panel tells this component what changed; the list is updated in place.
// The cache holds lead ids and short reasons (page paths, counts), never names or emails (lib/client/cache.ts rules).
import { useCallback, useEffect, useMemo, useState } from "react";
import { MarksPanel, type MarkChange } from "@/components/marks/MarksPanel";
import { Card, CardContent } from "@/components/ui/card";
import { leadMarksFor, type LeadMark, type MarksState, type MarkView } from "@/lib/actions/marks.action";
import { cacheKey, readCache, writeCache } from "@/lib/client/cache";
import { LeadsTable, type LeadRow, type TableMarks } from "./LeadsTable";
import { GroupDialog, GroupTabs, SelectionBar, useGroups } from "./LeadGroups";
import type { GroupsState, GroupView } from "@/lib/actions/groups.action";

type Cached = { stamp: string | null; rows: LeadMark[] };

export function LeadsWithMarks({
  leads,
  siteId,
  marks: initial,
  groups: groupsState,
  preloaded,
}: {
  leads: LeadRow[];
  siteId: string;
  marks: MarksState;
  /** lead groups (lib/actions/groups.action.ts); absent or not ready: no tabs, no checkboxes */
  groups?: GroupsState;
  /** results already known (the demo): never fetched */ preloaded?: Record<string, LeadMark[]>;
}) {
  const groupsReady = !!groupsState && groupsState.ok && groupsState.ready;
  const g = useGroups(groupsState && groupsState.ok ? groupsState.groups : []);
  // the open group lives in the address (?group=), written without asking the server to re-render (like ?marks=)
  const [openGroup, setOpenGroupState] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("group");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setOpenGroupState(id);
  }, []);
  const setOpenGroup = useCallback((id: string | null) => {
    setOpenGroupState(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("group", id);
    else url.searchParams.delete("group");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const [dialog, setDialog] = useState<{ group: GroupView | null; leadIds: string[] } | null>(null);
  const activeGroup = g.groups.find((x) => x.id === openGroup) ?? null;
  const shownLeads = useMemo(() => {
    if (!activeGroup) return leads;
    const inIt = new Set(activeGroup.leadIds);
    return leads.filter((l) => inIt.has(l.id));
  }, [leads, activeGroup]);
  const ready = initial.ok && initial.ready;
  const [marks, setMarks] = useState<MarkView[]>(initial.ok ? initial.marks : []);
  const [results, setResults] = useState<Record<string, LeadMark[]>>(preloaded ?? {});
  const [applied, setAppliedState] = useState<string[]>([]);
  useEffect(() => {
    // the address is read after the first render, so the server's HTML and the browser's first render agree
    const ids = (new URLSearchParams(window.location.search).get("marks") ?? "").split(",").filter(Boolean);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ids.length) setAppliedState(ids);
  }, []);

  const key = useCallback((id: string) => cacheKey(siteId, "markLeads", { mark: id }), [siteId]);

  // results: from this browser when the stamp still matches, else one request for every mark that moved
  const stamps = marks.map((m) => m.id + "@" + (m.evaluatedAt ?? "")).join("|");
  useEffect(() => {
    if (!ready) return;
    let live = true;
    const fromCache: Record<string, LeadMark[]> = {};
    const stale: string[] = [];
    for (const m of marks) {
      if (preloaded?.[m.id]) continue;
      const c = readCache<Cached>(key(m.id));
      if (c && c.value.stamp === m.evaluatedAt) fromCache[m.id] = c.value.rows;
      else stale.push(m.id);
    }
    // the browser's own storage, read once per change of stamps
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResults((r) => ({ ...r, ...fromCache }));
    if (stale.length) {
      leadMarksFor(stale).then((res) => {
        if (!live || !res.ok) return;
        const byMark: Record<string, LeadMark[]> = Object.fromEntries(stale.map((id) => [id, []]));
        for (const row of res.rows) byMark[row.markId]?.push(row);
        for (const id of stale) writeCache<Cached>(key(id), { stamp: marks.find((m) => m.id === id)?.evaluatedAt ?? null, rows: byMark[id] });
        setResults((r) => ({ ...r, ...byMark }));
      });
    }
    return () => {
      live = false;
    };
    // stamps is the real input: re-read only when a mark's results changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamps, ready, key]);

  const visibleApplied = useMemo(() => applied.filter((id) => marks.some((m) => m.id === id && m.active)), [applied, marks]);
  const setApplied = useCallback((ids: string[]) => {
    setAppliedState(ids);
    const url = new URL(window.location.href);
    if (ids.length) url.searchParams.set("marks", ids.join(","));
    else url.searchParams.delete("marks");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const onChange = useCallback(
    (c: MarkChange) => {
      setMarks((list) => {
        if (c.type === "saved") return list.some((m) => m.id === c.mark.id) ? list.map((m) => (m.id === c.mark.id ? c.mark : m)) : [...list, c.mark];
        if (c.type === "deleted") return list.filter((m) => m.id !== c.id);
        return list.map((m) => (m.id === c.id ? { ...m, ...c.patch } : m));
      });
      if (c.type === "deleted") {
        setResults((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== c.id)));
        setApplied(applied.filter((x) => x !== c.id));
      }
    },
    [applied, setApplied],
  );

  const table: TableMarks | undefined = useMemo(() => {
    if (!ready) return undefined;
    const byLead: TableMarks["byLead"] = {};
    for (const m of marks) {
      if (!m.active) continue;
      for (const r of results[m.id] ?? []) (byLead[r.leadId] ??= []).push({ mark: { id: m.id, name: m.name, color: m.color }, parts: r.parts });
    }
    return { byLead, applied: visibleApplied };
  }, [ready, marks, results, visibleApplied]);

  const state: MarksState = initial.ok ? { ...initial, marks } : initial;
  return (
    <div className="flex items-start gap-4">
      <div className="min-w-0 flex-1 space-y-4">
        <h1 className="text-lg font-semibold text-foreground">Leads</h1>
        {groupsReady && (
          <GroupTabs
            groups={g.groups}
            total={leads.length}
            active={activeGroup?.id ?? null}
            onPick={(id) => {
              setOpenGroup(id);
              g.setSelected(new Set());
            }}
            onNew={() => setDialog({ group: null, leadIds: [] })}
            onEdit={(grp) => setDialog({ group: grp, leadIds: [] })}
          />
        )}
        {groupsReady && g.selected.size > 0 && (
          <SelectionBar
            count={g.selected.size}
            groups={g.groups}
            inGroup={activeGroup}
            busy={g.busy}
            onAdd={g.add}
            onNewFromSelection={() => setDialog({ group: null, leadIds: [...g.selected] })}
            onRemove={() => activeGroup && g.remove(activeGroup.id)}
            onClear={() => g.setSelected(new Set())}
          />
        )}
        {g.note && <p className={"text-xs " + (g.note.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{g.note.text}</p>}
        <Card>
          <CardContent className="pt-4">
            {activeGroup && shownLeads.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                This group is empty. Select leads in <button type="button" className="text-primary hover:underline" onClick={() => setOpenGroup(null)}>All leads</button> and choose Add to group.
              </div>
            ) : (
              <LeadsTable leads={shownLeads} siteId={siteId} marks={table} selected={groupsReady ? g.selected : undefined} onToggle={groupsReady ? g.toggle : undefined} />
            )}
          </CardContent>
        </Card>
        {dialog && (
          <GroupDialog
            group={dialog.group}
            leadIds={dialog.leadIds}
            onClose={() => setDialog(null)}
            onCreated={(grp) => {
              g.setGroups((gs) => [...gs, grp]);
              g.setSelected(new Set());
              g.setNote({ tone: "ok", text: grp.leadIds.length ? `${grp.name} created with ${grp.leadIds.length} lead${grp.leadIds.length === 1 ? "" : "s"}.` : `${grp.name} created.` });
              setDialog(null);
            }}
            onUpdated={(id, patch) => {
              g.setGroups((gs) => gs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
              setDialog(null);
            }}
            onDeleted={(id) => {
              g.setGroups((gs) => gs.filter((x) => x.id !== id));
              if (openGroup === id) setOpenGroup(null);
              setDialog(null);
            }}
          />
        )}
      </div>
      <MarksPanel state={state} applied={visibleApplied} onApply={setApplied} onChange={onChange} />
    </div>
  );
}
