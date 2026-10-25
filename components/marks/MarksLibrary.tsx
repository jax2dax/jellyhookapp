"use client";
// components/marks/MarksLibrary.tsx
// /platform/marks: the marks library, one screen.
//   left   Browse: published marks by category (jh-marks/catalog.ts), small cards. "Add to marks" copies one (yours,
//          editable, no updates); "Use mark" connects it (plug icon: its updates apply, only its pages are yours).
//          Both arrive off.
//   right  a sidebar: My marks (on/off, edit, pages of a connected mark, delete), then Shared with me (marks team
//          members shared). Editing opens the builder in the sidebar. Apply marks on the leads page.
// A locked mark (publisher setting) hides its formula: lock icon, Edit dimmed. Limits: 5 built by you, 15 in all.
// Design: mds/build/marks/marks.md, "Library".
import { ArrowLeft, Check, ChevronDown, Info, Loader2, Lock, MoreHorizontal, Plug, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { describeSpec } from "@/jh-hook/describe";
import { CATALOG, CATEGORIES, type CatalogMark } from "@/jh-marks/catalog";
import { describeRule } from "@/jh-marks/rule";
import { addFromLibrary, deleteMark, setMarkActive, type MarksState, type MarkView } from "@/lib/actions/marks.action";
import { MarkBuilder, type BuilderInitial } from "./MarkBuilder";
import { MarkVarsEditor } from "./MarkVarsEditor";

type Ready = Extract<MarksState, { ok: true }>;

/** What a published mark does, in words (with its default pages); hidden when locked. */
function previewOf(c: CatalogMark): string | null {
  if (c.locked) return null;
  const made = c.make({ vars: {}, stats: { sessionHighMs: null } });
  return "rule" in made ? describeRule(made.rule) : c.reads ?? describeSpec(made.spec);
}

function Toggle({ on, disabled, onChange }: { on: boolean; disabled?: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      title={disabled ? "Only its owner can turn it on or off" : on ? "On: its badges show on your leads" : "Off"}
      className={"relative h-4 w-7 shrink-0 rounded-full transition disabled:opacity-50 " + (on ? "bg-primary" : "bg-muted-foreground/30")}
    >
      <span className={"absolute top-0.5 size-3 rounded-full bg-background shadow transition-all " + (on ? "left-3.5" : "left-0.5")} />
    </button>
  );
}

export function MarksLibrary({ state: initial }: { state: MarksState }) {
  const [marks, setMarks] = useState<MarkView[]>(initial.ok ? initial.marks : []);
  const [builder, setBuilder] = useState<BuilderInitial | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  // the "..." menu closes on a click anywhere outside it, and on Escape
  useEffect(() => {
    if (!menu) return;
    const outside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest("[data-mark-menu]")) setMenu(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);
  const [varsOpen, setVarsOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [vars, setVars] = useState<Record<string, Record<string, string>>>({});

  const mine = useMemo(() => marks.filter((m) => m.mine), [marks]);
  const shared = useMemo(() => marks.filter((m) => !m.mine), [marks]);
  if (!initial.ok) return <p className="rounded-lg border p-4 text-sm text-red-600">{initial.error}</p>;
  const s = initial as Ready;
  if (!s.ready) return <p className="rounded-lg border p-4 text-sm text-muted-foreground">Marks are not set up on this database yet (migrations 18 and 19).</p>;
  const full = mine.length >= s.totalLimit;
  const upsert = (m: MarkView) => setMarks((list) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, m]));

  const take = async (c: CatalogMark, mode: "copy" | "use") => {
    setBusy(c.key + mode);
    setNote(null);
    const r = await addFromLibrary(c.key, mode, vars[c.key] ?? {});
    setBusy(null);
    if (!r.ok) return setNote({ tone: "error", text: r.error });
    upsert(r.mark);
    setNote({ tone: r.warning ? "error" : "ok", text: r.warning ?? `${c.name} ${mode === "use" ? "connected" : "added"}, off. ${r.mark.matchCount ?? 0} of your leads match.` });
  };

  const toggle = async (m: MarkView) => {
    setBusy(m.id);
    const r = await setMarkActive(m.id, !m.active);
    setBusy(null);
    if (!r.ok) return setNote({ tone: "error", text: r.error });
    upsert({ ...m, active: !m.active, matchCount: r.matchCount, evaluatedAt: r.evaluatedAt });
  };

  /** One mark in the sidebar: a compact row, its menu, and its inline editors. */
  const row = (m: MarkView) => (
    <li key={m.id} className="relative">
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
        <span className="size-2.5 shrink-0 rounded-full" style={m.active ? { backgroundColor: m.color } : { boxShadow: `inset 0 0 0 2px ${m.color}` }} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className="truncate text-sm">{m.name}</span>
            {m.source === "connected" && <Plug className="size-3 shrink-0 text-sky-600 dark:text-sky-400" aria-label="connected to a published mark" />}
            {m.locked && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="formula hidden" />}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {m.active ? (m.matchCount ?? 0) + (m.matchCount === 1 ? " lead" : " leads") : "off"}
            {!m.mine && m.createdByEmail ? " · " + m.createdByEmail : ""}
          </span>
        </span>
        {busy === m.id ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Toggle on={m.active} disabled={!m.mine} onChange={() => toggle(m)} />}
        {m.mine && (
          <button type="button" onClick={() => setMenu(menu === m.id ? null : m.id)} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="More" data-mark-menu>
            <MoreHorizontal className="size-4" />
          </button>
        )}
      </div>
      {menu === m.id && (
        <div data-mark-menu className="absolute right-1 top-9 z-20 w-44 rounded-md border bg-popover p-1 text-xs shadow-md">
          {m.locked || m.source === "connected" ? (
            <span className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground/60" title={m.locked ? "The publisher hid this formula" : "Connected: its formula is the publisher's; edit its values"}>
              {m.locked ? <Lock className="size-3" /> : <Plug className="size-3" />} Edit
            </span>
          ) : (
            <button
              type="button"
              disabled={!m.rule}
              onClick={() => {
                setMenu(null);
                if (m.rule) setBuilder({ id: m.id, name: m.name, description: m.description ?? "", color: m.color, active: m.active, visibility: m.visibility, sharedWith: m.sharedWith, rule: structuredClone(m.rule), templateKey: m.templateKey });
              }}
              className="w-full rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40"
              title={m.rule ? undefined : "Made as a Hook question: edit it in Hook"}
            >
              Edit
            </button>
          )}
          {m.vars.length > 0 && (
            <button type="button" onClick={() => { setMenu(null); setVarsOpen(m.id); }} className="w-full rounded px-2 py-1.5 text-left hover:bg-muted">
              Edit its values
            </button>
          )}
          <button type="button" onClick={() => { setMenu(null); setConfirm(m.id); }} className="w-full rounded px-2 py-1.5 text-left text-red-600 hover:bg-muted dark:text-red-400">
            {m.source === "connected" ? "Disconnect" : "Delete"}
          </button>
        </div>
      )}
      {varsOpen === m.id && (
        <div className="px-1 pb-1">
          <MarkVarsEditor
            mark={m}
            pages={s.pages}
            onCancel={() => setVarsOpen(null)}
            onSaved={(x) => {
              setVarsOpen(null);
              upsert(x);
              setNote({ tone: "ok", text: `${x.name}: values saved, ${x.matchCount ?? 0} leads match.` });
            }}
          />
        </div>
      )}
      {confirm === m.id && (
        <div className="mx-1 mb-1 rounded-md border border-red-500/40 bg-red-500/5 p-2 text-xs">
          {m.source === "connected" ? "Disconnect" : "Delete"} <strong>{m.name}</strong>? Its badges go too.
          <div className="mt-1.5 flex justify-end gap-1.5">
            <button type="button" onClick={() => setConfirm(null)} className="h-6 rounded-md px-2 text-muted-foreground hover:bg-muted">
              Keep it
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirm(null);
                setBusy(m.id);
                const r = await deleteMark(m.id);
                setBusy(null);
                if (!r.ok) return setNote({ tone: "error", text: r.error });
                setMarks((list) => list.filter((x) => x.id !== m.id));
              }}
              className="h-6 rounded-md bg-red-600 px-2 font-medium text-white hover:bg-red-700"
            >
              {m.source === "connected" ? "Disconnect" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </li>
  );

  return (
    <div className="flex items-start gap-5">
      {/* ── left: Browse ── */}
      <div className="min-w-0 flex-1 space-y-5">
        {note && <p className={"rounded-md px-3 py-2 text-xs " + (note.tone === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-red-500/10 text-red-700 dark:text-red-300")}>{note.text}</p>}
        {CATEGORIES.map((cat) => {
          const items = CATALOG.filter((c) => c.category === cat.key);
          if (!items.length) return null;
          return (
            <section key={cat.key} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold">{cat.name}</h2>
                <span className="text-xs text-muted-foreground">{cat.blurb}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((c) => {
                  const have = mine.find((m) => m.sourceKey === c.key);
                  const preview = previewOf(c);
                  const open = expanded === c.key;
                  return (
                    <div key={c.key} className="flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        {c.locked && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="formula hidden" />}
                        {c.note && (
                          <span title={c.note} className="flex shrink-0">
                            <Info className="size-3 text-muted-foreground" aria-label={c.note} />
                          </span>
                        )}
                        <button type="button" onClick={() => setExpanded(open ? null : c.key)} className="ml-auto flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={open ? "Less" : "More about this mark"} aria-expanded={open}>
                          <ChevronDown className={"size-3.5 transition-transform " + (open ? "rotate-180" : "")} />
                        </button>
                      </div>
                      <p className={"text-xs text-muted-foreground " + (open ? "" : "line-clamp-1")}>{c.purpose}</p>
                      {open && (
                        <div className="space-y-1.5">
                          <p className="rounded-md border bg-muted px-2 py-1.5 text-[11px] leading-relaxed text-foreground/80">{preview ?? "Formula hidden by the publisher."}</p>
                          {c.note && <p className="text-[11px] text-muted-foreground/90">{c.note}</p>}
                        </div>
                      )}
                      {(c.vars ?? []).length > 0 && (
                        <div className="space-y-1">
                          {(c.vars ?? []).map((v) => (
                            <label key={v.key} className="flex items-center gap-1.5 text-[11px]">
                              <span className="w-24 shrink-0 truncate text-muted-foreground" title={v.label}>
                                {v.label}
                              </span>
                              <input
                                list={v.type === "page" ? "jh-library-pages" : undefined}
                                type={v.type === "page" ? "text" : "number"}
                                min={v.type === "page" ? undefined : 1}
                                value={vars[c.key]?.[v.key] ?? v.default}
                                placeholder={v.type === "page" ? v.default : v.default || "site's normal"}
                                onChange={(e) => setVars((x) => ({ ...x, [c.key]: { ...(x[c.key] ?? {}), [v.key]: e.target.value } }))}
                                className="h-5 min-w-0 flex-1 rounded border border-input bg-background px-1.5 font-mono text-[11px]"
                              />
                              {v.type !== "page" && <span className="text-muted-foreground">{v.type === "seconds" ? "s" : v.type === "percent" ? "%" : "x"}</span>}
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex min-w-0 flex-nowrap items-center gap-1.5 overflow-hidden pt-0.5">
                        {have ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                            <Check className="size-3" /> {have.source === "connected" ? "Connected" : "In your marks"}
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={full || !!busy || !!c.locked}
                              onClick={() => take(c, "copy")}
                              title={c.locked ? "The publisher does not allow copies" : "A copy that is yours to edit; later changes to this mark don't reach it"}
                              className="flex h-6 min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
                            >
                              {busy === c.key + "copy" ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Add to marks
                            </button>
                            {/* "Use mark" (connecting to the publisher's mark) is switched off (founder, 2026-10-22): a connected
                                mark is controlled by whoever made it. Only copies, which are yours to control. */}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <datalist id="jh-library-pages">
          {s.pages.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      {/* ── right: My marks, then Shared with me ── */}
      <aside className="sticky top-6 flex max-h-[calc(100vh-3rem)] w-80 shrink-0 flex-col overflow-hidden rounded-lg border bg-card">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          {builder ? (
            <>
              <button type="button" onClick={() => setBuilder(null)} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Back">
                <ArrowLeft className="size-4" />
              </button>
              <h2 className="text-sm font-semibold">Edit mark</h2>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold">My marks</h2>
              <span className="ml-auto text-[11px] text-muted-foreground" title={`${mine.filter((m) => m.source === "own").length} of ${s.limit} built by you`}>
                {mine.length} of {s.totalLimit}
              </span>
            </>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {builder ? (
            <div className="p-1">
              <MarkBuilder
                key={builder.id ?? "new"}
                initial={builder}
                pages={s.pages}
                team={s.team}
                me={s.me}
                onCancel={() => setBuilder(null)}
                onSaved={(m, warning) => {
                  setBuilder(null);
                  upsert(m);
                  setNote({ tone: warning ? "error" : "ok", text: warning ?? `${m.name} saved.` });
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {mine.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No marks yet. Add one from the left.</p> : <ul className="space-y-0.5">{mine.map(row)}</ul>}
              <div className="border-t pt-2">
                <h3 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Shared with me</h3>
                {shared.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">Nothing shared yet. Marks team members share with you appear here.</p> : <ul className="space-y-0.5">{shared.map(row)}</ul>}
              </div>
              <Link href="/platform/leads" className="block px-2 pt-1 text-[11px] text-primary hover:underline">
                Turn marks on and apply them on Leads →
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
