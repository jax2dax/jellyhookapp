"use client";
// components/marks/MarksPanel.tsx
// The marks panel: always on the right of the leads page, from the top. It lists the marks you can see, the
// templates, and opens the builder in place.
//   - clicking a mark APPLIES it to the table (its leads go first, the rest are dimmed): a view, nothing is saved;
//   - the switch turns a mark ON or OFF (only its creator): one small update, nothing is re-checked;
//   - the menu: edit, re-check, delete (yours), or "edit in Hook" for a mark made there.
// Every change is reported to the page (onChange) so it updates in place, without reloading. Design:
// mds/build/marks/marks.md.
import { ArrowLeft, Bookmark, ExternalLink, Loader2, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { colorFor, emptyRule, TEMPLATES } from "@/jh-marks/rule";
import { deleteMark, recheckMark, setMarkActive, type MarkView, type MarksState } from "@/lib/actions/marks.action";
import { encodeSpecParam } from "@/lib/hook/specParam";
import { MarkBuilder, type BuilderInitial } from "./MarkBuilder";

type Ready = Extract<MarksState, { ok: true }>;

/** What changed, so the page can update in place. */
export type MarkChange = { type: "saved"; mark: MarkView } | { type: "deleted"; id: string } | { type: "patched"; id: string; patch: Partial<MarkView> };

function Toggle({ on, disabled, onChange, label }: { on: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={disabled ? "Only its creator can turn it on or off" : on ? "On: leads that meet it get the badge" : "Off: no badges"}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={"relative h-4 w-7 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 " + (on ? "bg-primary" : "bg-muted-foreground/30")}
    >
      <span className={"absolute top-0.5 size-3 rounded-full bg-background shadow transition-all " + (on ? "left-3.5" : "left-0.5")} />
    </button>
  );
}

export function MarksPanel({ state, applied, onApply, onChange }: { state: MarksState; applied: string[]; onApply: (ids: string[]) => void; onChange: (c: MarkChange) => void }) {
  const [builder, setBuilder] = useState<BuilderInitial | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!state.ok) return <aside className="sticky top-6 w-[24rem] shrink-0 rounded-lg border bg-card p-3 text-xs text-muted-foreground">{state.error}</aside>;
  const s = state as Ready;
  const mine = s.marks.filter((m) => m.mine);
  const full = mine.length >= s.limit;
  const usedTemplates = new Set(mine.map((m) => m.templateKey).filter(Boolean));
  const toggleApply = (id: string) => onApply(applied.includes(id) ? applied.filter((x) => x !== id) : [...applied, id]);

  const startNew = (t?: (typeof TEMPLATES)[number]) => {
    setNote(null);
    setBuilder({
      name: t?.name ?? "",
      description: t?.description ?? "",
      color: t ? colorFor(t.name) : "#3b82f6",
      active: true,
      visibility: "private",
      sharedWith: [],
      rule: t ? structuredClone(t.rule) : emptyRule(),
      templateKey: t?.key ?? null,
    });
  };
  const edit = (m: MarkView) => {
    setMenu(null);
    if (!m.rule) {
      window.open("/platform/hook?q=" + encodeSpecParam(m.spec), "_blank");
      return;
    }
    setBuilder({ id: m.id, name: m.name, description: m.description ?? "", color: m.color, active: m.active, visibility: m.visibility, sharedWith: m.sharedWith, rule: structuredClone(m.rule), templateKey: m.templateKey });
  };
  const run = async <R extends { ok: boolean }>(id: string, fn: () => Promise<R>, done: (r: R) => { text: string; change: MarkChange }) => {
    setBusy(id);
    setMenu(null);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return setNote({ tone: "error", text: (r as unknown as { error: string }).error });
    const d = done(r);
    setNote({ tone: "ok", text: d.text });
    onChange(d.change);
  };

  // ── open ──
  return (
    <aside className="sticky top-6 flex max-h-[calc(100vh-3rem)] min-h-[calc(100vh-3rem)] w-[24rem] shrink-0 flex-col overflow-hidden rounded-lg border bg-card" aria-label="Marks">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        {builder ? (
          <button type="button" onClick={() => setBuilder(null)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back to the marks">
            <ArrowLeft className="size-4" />
          </button>
        ) : (
          <Bookmark className="size-4 text-muted-foreground" />
        )}
        <h2 className="text-sm font-semibold">{builder ? (builder.id ? "Edit mark" : "New mark") : "Marks"}</h2>
        {!builder && (
          <>
            <span className="ml-auto text-[11px] text-muted-foreground">{mine.length} of {s.limit}</span>
            <button
              type="button"
              disabled={full || !s.ready}
              onClick={() => startNew()}
              title={full ? `You have ${s.limit} marks: delete one to add another` : "New mark"}
              className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="size-3.5" /> New
            </button>
          </>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!s.ready ? (
          <p className="text-xs text-muted-foreground">Marks are not set up on this database yet (migration 18).</p>
        ) : builder ? (
          <MarkBuilder
            key={builder.id ?? builder.templateKey ?? "new"}
            initial={builder}
            pages={s.pages}
            team={s.team}
            me={s.me}
            onCancel={() => setBuilder(null)}
            onSaved={(m, warning) => {
              setBuilder(null);
              setNote({ tone: warning ? "error" : "ok", text: warning ?? `${m.name}: ${m.matchCount ?? 0} ${m.matchCount === 1 ? "lead has it" : "leads have it"}${m.active ? "." : " (off)."}` });
              onChange({ type: "saved", mark: m });
            }}
          />
        ) : (
          <div className="space-y-4">
            {note && <p className={"rounded-md px-2 py-1.5 text-xs " + (note.tone === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300")}>{note.text}</p>}

            {s.marks.length === 0 && <p className="text-xs text-muted-foreground">No marks yet. A mark puts a coloured badge on every lead that did what you choose, like reading your pricing page. Start from a template or make your own.</p>}

            <ul className="space-y-1">
              {s.marks.map((m) => {
                const on = applied.includes(m.id);
                return (
                  <li key={m.id} className="relative">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleApply(m.id)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleApply(m.id))}
                      title={on ? "Applied to the table. Click to remove." : "Apply to the table: its leads go first"}
                      className={"group flex cursor-pointer items-start gap-2.5 rounded-md border px-2.5 py-2 transition " + (on ? "" : "border-transparent hover:bg-muted/60")}
                      style={on ? { borderColor: m.color + "80", backgroundColor: m.color + "14" } : undefined}
                    >
                      <span className="mt-1 size-3 shrink-0 rounded-full" style={m.active ? { backgroundColor: m.color } : { boxShadow: `inset 0 0 0 2px ${m.color}` }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{m.name}</span>
                          {on && <span className="rounded px-1 text-[10px] font-medium" style={{ backgroundColor: m.color + "33" }}>applied</span>}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {m.active ? (m.matchCount ?? 0) + (m.matchCount === 1 ? " lead" : " leads") : "off"}
                          {!m.mine && m.createdByEmail ? " · by " + m.createdByEmail : ""}
                          {m.mine && m.visibility !== "private" ? (m.visibility === "team" ? " · shared with the team" : " · shared with " + m.sharedWith.length) : ""}
                          {!m.rule ? " · made in Hook" : ""}
                        </span>
                        {m.description && <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground/80">{m.description}</span>}
                      </span>
                      {busy === m.id ? (
                        <Loader2 className="mt-0.5 size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Toggle
                          on={m.active}
                          disabled={!m.mine}
                          label={"Turn " + m.name + (m.active ? " off" : " on")}
                          onChange={(v) =>
                            run(m.id, () => setMarkActive(m.id, v), (r) => ({
                              text: v ? `${m.name} is on: ${r.ok ? (r.matchCount ?? 0) : 0} leads.` : `${m.name} is off.`,
                              change: { type: "patched", id: m.id, patch: r.ok ? { active: v, matchCount: r.matchCount, evaluatedAt: r.evaluatedAt } : { active: v } },
                            }))
                          }
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenu(menu === m.id ? null : m.id);
                        }}
                        className="-mr-1 flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="More"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </div>
                    {confirmDelete === m.id && (
                      <div className="mx-1 mb-1 mt-1 rounded-md border border-red-500/40 bg-red-500/5 p-2.5" role="alertdialog" aria-label={"Delete " + m.name}>
                        <p className="text-xs text-foreground">
                          Delete <strong>{m.name}</strong>? Its badges go too{m.visibility !== "private" ? ", for everyone it is shared with" : ""}. This can&apos;t be undone.
                        </p>
                        <div className="mt-2 flex justify-end gap-2">
                          <button type="button" autoFocus onClick={() => setConfirmDelete(null)} className="h-7 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-muted">
                            Keep it
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDelete(null);
                              run(m.id, () => deleteMark(m.id), () => ({ text: `${m.name} deleted.`, change: { type: "deleted", id: m.id } }));
                            }}
                            className="h-7 rounded-md bg-red-600 px-2.5 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                    {menu === m.id && (
                      <div className="absolute right-1 top-10 z-20 w-44 rounded-md border bg-popover p-1 text-xs shadow-md">
                        {m.mine && (
                          <button type="button" onClick={() => edit(m)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                            {m.rule ? "Edit" : <>Edit in Hook <ExternalLink className="size-3" /></>}
                          </button>
                        )}
                        {!m.mine && !m.rule && (
                          <button type="button" onClick={() => edit(m)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                            Open in Hook <ExternalLink className="size-3" />
                          </button>
                        )}
                        <button type="button" onClick={() => run(m.id, () => recheckMark(m.id), (r) => ({ text: `${m.name}: ${r.ok ? r.matchCount : 0} leads.`, change: { type: "patched", id: m.id, patch: r.ok ? { matchCount: r.matchCount, evaluatedAt: r.evaluatedAt } : {} } }))} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted">
                          <RefreshCw className="size-3" /> Re-check all leads
                        </button>
                        {m.mine && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenu(null);
                              setConfirmDelete(m.id);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-red-600 hover:bg-muted dark:text-red-400"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {TEMPLATES.some((t) => !usedTemplates.has(t.key)) && (
              <div className="space-y-1">
                <h3 className="px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Templates</h3>
                <ul className="space-y-1">
                  {TEMPLATES.filter((t) => !usedTemplates.has(t.key)).map((t) => (
                    <li key={t.key} className="flex items-start gap-2.5 rounded-md px-2.5 py-2 hover:bg-muted/60">
                      <span className="mt-1 size-3 shrink-0 rounded-full" style={{ boxShadow: `inset 0 0 0 2px ${colorFor(t.name)}` }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{t.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{t.description}</span>
                      </span>
                      <button type="button" disabled={full} onClick={() => startNew(t)} className="rounded-md border px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-40" title={full ? `You have ${s.limit} marks` : t.needsPath ? "Check the page address, then save" : "Use it"}>
                        Use
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {full && <p className="px-1 text-[11px] text-muted-foreground">You have {s.limit} marks, the most there can be. Delete one to add another.</p>}
          </div>
        )}
      </div>
    </aside>
  );
}
