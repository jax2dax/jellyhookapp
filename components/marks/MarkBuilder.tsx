"use client";
// components/marks/MarkBuilder.tsx
// The mark builder: a small device. The SCREEN shows the mark being built (with "Enter with AI" at its top); the KEYS
// below add to it. Made for a salesperson: press keys, type a page or a number, done.
//
// How the screen reads (jh-marks/rule.ts):
//   - a page card is one rounded block; what is JOINED onto it (time, read %, times) is about that same page;
//   - cards side by side with a gap are different pages, all needed; the row's ⋯ switches them to "in this order"
//     (one visit, arrows between them);
//   - the lower line holds conditions about the lead as a whole;
//   - every row and every lead condition must be true.
// Keys act on the selected page card (Read %, Time, Times), or on the lead when no card is selected (Read % of every
// page, time on the site). "+" at the end of a row adds another page to that row.
import { ArrowRight, Check, ExternalLink, Loader2, MoreHorizontal, Plus, Sparkles, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { compileRule, describeRule, fmtSeconds, MARK_COLORS, newId, RuleError, validateRule, type LeadChip, type MarkRule, type PageCard, type PageRow, type Scope } from "@/jh-marks/rule";
import { markFromAi, saveMark, type MarkView, type TeamMember, type Visibility } from "@/lib/actions/marks.action";
import { encodeSpecParam } from "@/lib/hook/specParam";

export interface BuilderInitial {
  id?: string;
  name: string;
  description: string;
  color: string;
  active: boolean;
  visibility: Visibility;
  sharedWith: string[];
  rule: MarkRule;
  templateKey?: string | null;
}

type Sel = { rowId: string; cardId: string } | null;
type Edit = { id: string; field: string } | null;

const SCOPES: { value: Scope; label: string; hint: string }[] = [
  { value: "any", label: "any visit", hint: "Anything they did before sending the form, in any visit" },
  { value: "converting", label: "the converting visit", hint: "Only the visit in which they sent the form" },
  { value: "all", label: "every visit", hint: "Each visit before sending must meet the page rows" },
];

/** A value typed in place: Enter or leaving the field keeps it, Escape drops it. */
function Inline({ value, onDone, type = "text", width = "w-16", list, placeholder }: { value: string; onDone: (v: string | null) => void; type?: "text" | "number"; width?: string; list?: string; placeholder?: string }) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      type={type}
      list={list}
      value={v}
      placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onDone(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") onDone(null);
      }}
      className={"h-5 rounded border-0 bg-muted px-1 text-xs text-foreground outline-none ring-1 ring-primary/60 " + width}
    />
  );
}

/** One part of a card or chip. Hover shows a small x. */
function Seg({ children, onClick, onRemove, first, title }: { children: ReactNode; onClick?: () => void; onRemove?: () => void; first?: boolean; title?: string }) {
  return (
    <span className={"group/seg relative flex h-7 items-center whitespace-nowrap px-2 text-xs " + (first ? "" : "border-l border-border/70")} title={title}>
      <span onClick={onClick} className={onClick ? "cursor-pointer" : ""}>
        {children}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -right-1.5 -top-1.5 z-10 hidden size-3.5 items-center justify-center rounded-full bg-foreground text-background shadow group-hover/seg:flex"
          aria-label="Remove"
        >
          <X className="size-2.5" />
        </button>
      )}
    </span>
  );
}

function Key({ children, onClick, disabled, hint, accent }: { children: ReactNode; onClick: () => void; disabled?: boolean; hint?: string; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={"h-9 rounded-lg border text-[11px] font-medium shadow-[0_1px_0_0] shadow-border transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35 " + (accent ? "border-primary/50 bg-primary/10 text-foreground" : "bg-card text-foreground hover:bg-muted")}
    >
      {children}
    </button>
  );
}

export function MarkBuilder({ initial, pages, team, me, onSaved, onCancel }: { initial: BuilderInitial; pages: string[]; team: TeamMember[]; me: string; onSaved: (m: MarkView, warning?: string) => void; onCancel: () => void }) {
  const [rule, setRule] = useState<MarkRule>(initial.rule);
  const [sel, setSel] = useState<Sel>(null);
  const [edit, setEdit] = useState<Edit>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [color, setColor] = useState(initial.color);
  const [active, setActive] = useState(initial.active);
  const [visibility, setVisibility] = useState<Visibility>(initial.visibility);
  const [sharedWith, setSharedWith] = useState<string[]>(initial.sharedWith);
  const [ai, setAi] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [undo, setUndo] = useState<MarkRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selRow = sel ? rule.rows.find((r) => r.id === sel.rowId) ?? null : null;
  const selCard = sel && selRow ? selRow.cards.find((c) => c.id === sel.cardId) ?? null : null;

  // what the mark says, live; and why it can't be saved yet
  const check = useMemo(() => {
    try {
      const r = validateRule(rule);
      if (rule.rows.some((row) => row.cards.some((c) => !c.path || c.path === "/"))) return { reads: "", problem: "Type the page address." };
      return { reads: describeRule(r), problem: null as string | null, valid: r };
    } catch (e) {
      return { reads: "", problem: e instanceof RuleError ? e.message : "Something is not right." };
    }
  }, [rule]);
  const empty = !rule.rows.length && !rule.lead.length;

  // ── rule edits ──
  const patchCard = (rowId: string, cardId: string, patch: Partial<PageCard>) =>
    setRule((r) => ({ ...r, rows: r.rows.map((row) => (row.id !== rowId ? row : { ...row, cards: row.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) })) }));
  const removeCard = (rowId: string, cardId: string) => {
    setRule((r) => ({
      ...r,
      rows: r.rows
        .map((row) => (row.id !== rowId ? row : { ...row, cards: row.cards.filter((c) => c.id !== cardId), order: row.cards.length - 1 < 2 ? ("any" as const) : row.order }))
        .filter((row) => row.cards.length),
    }));
    if (sel?.cardId === cardId) setSel(null);
  };
  const patchRow = (rowId: string, patch: Partial<PageRow>) => setRule((r) => ({ ...r, rows: r.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) }));
  const removeRow = (rowId: string) => {
    setRule((r) => ({ ...r, rows: r.rows.filter((row) => row.id !== rowId) }));
    if (sel?.rowId === rowId) setSel(null);
  };
  const patchChip = (id: string, patch: Partial<LeadChip>) => setRule((r) => ({ ...r, lead: r.lead.map((c) => (c.id === id ? ({ ...c, ...patch } as LeadChip) : c)) }));
  const removeChip = (id: string) => setRule((r) => ({ ...r, lead: r.lead.filter((c) => c.id !== id) }));

  const addPage = (rowId?: string) => {
    const card: PageCard = { id: newId("c"), path: "", match: "exact" };
    const target = rowId ?? sel?.rowId;
    const row = target ? rule.rows.find((r) => r.id === target) : null;
    if (row && row.cards.length < 4) {
      patchRow(row.id, { cards: [...row.cards, card] });
      setSel({ rowId: row.id, cardId: card.id });
    } else {
      if (rule.rows.length >= 6) return setError("At most 6 page rows.");
      const nr: PageRow = { id: newId("r"), order: "any", cards: [card] };
      setRule((r) => ({ ...r, rows: [...r.rows, nr] }));
      setSel({ rowId: nr.id, cardId: card.id });
    }
    setEdit({ id: card.id, field: "path" });
  };
  const onCard = (field: "minSeconds" | "minReadPct" | "minTimes", def: number) => {
    if (!sel || !selCard) return;
    if (selCard[field] == null) patchCard(sel.rowId, sel.cardId, { [field]: def } as Partial<PageCard>);
    setEdit({ id: selCard.id, field });
  };
  const addChip = (chip: LeadChip, field: string) => {
    const have = rule.lead.find((c) => c.kind === chip.kind);
    if (have) return setEdit({ id: have.id, field });
    setRule((r) => ({ ...r, lead: [...r.lead, chip] }));
    setEdit({ id: chip.id, field });
  };

  // ── AI ──
  const runAi = async () => {
    if (!ai.trim() || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    const res = await markFromAi(ai);
    setAiBusy(false);
    if (!res.ok) return setAiNote({ tone: "error", text: res.error });
    const r = res.result;
    if (r.status === "ok") {
      setUndo(rule);
      setRule(r.rule);
      setSel(null);
      if (!name.trim() && r.name) {
        setName(r.name);
      }
      setAiNote({ tone: "info", text: r.assumptions.length ? "Assumed: " + r.assumptions.join("; ") : "Done. Check it below, then save." });
    } else setAiNote({ tone: r.status === "clarify" ? "info" : "error", text: r.status === "clarify" ? r.question : r.reason });
  };

  // ── save ──
  const save = async () => {
    if (check.problem) return setError(check.problem);
    if (!name.trim()) return setError("Give the mark a name.");
    setSaving(true);
    setError(null);
    const res = await saveMark({ id: initial.id ?? null, name, description, color, active, visibility, sharedWith, rule, templateKey: initial.templateKey ?? null });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved(res.mark, res.warning);
  };
  const hookHref = check.valid ? "/platform/hook?q=" + encodeSpecParam(compileRule(check.valid)) : null;
  const others = team.filter((m) => m.userId !== me);

  // ── drawing ──
  const cardView = (row: PageRow, c: PageCard) => {
    const selected = sel?.cardId === c.id;
    const ed = (f: string) => edit?.id === c.id && edit.field === f;
    const num = (f: "minSeconds" | "minReadPct" | "minTimes", lo: number, hi: number) => (v: string | null) => {
      setEdit(null);
      if (v === null) return;
      const n = Math.round(Number(v));
      patchCard(row.id, c.id, { [f]: Number.isFinite(n) && n >= lo ? Math.min(n, hi) : null } as Partial<PageCard>);
    };
    return (
      <span
        key={c.id}
        onClick={() => setSel({ rowId: row.id, cardId: c.id })}
        className={"inline-flex cursor-pointer items-stretch rounded-md border bg-card shadow-sm transition " + (selected ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/30")}
      >
        <Seg first onRemove={() => removeCard(row.id, c.id)} onClick={() => setEdit({ id: c.id, field: "path" })} title="The page. Click to change it.">
          {ed("path") ? (
            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Inline
                value={c.path}
                width="w-28"
                list="jh-mark-pages"
                placeholder="/pricing"
                onDone={(v) => {
                  setEdit(null);
                  if (v === null) return c.path ? undefined : removeCard(row.id, c.id);
                  const p = v.trim();
                  if (!p) return removeCard(row.id, c.id);
                  patchCard(row.id, c.id, { path: p.startsWith("/") ? p : "/" + p });
                }}
              />
            </span>
          ) : (
            <span>
              <span className="text-muted-foreground">Saw </span>
              <span className="font-medium">{c.path || "…"}</span>
              {c.match === "startsWith" && <span className="text-muted-foreground">*</span>}
            </span>
          )}
        </Seg>
        {selected && !ed("path") && (
          <Seg title="Exactly this page, or every page whose address starts with it">
            <button type="button" className="text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground" onClick={(e) => { e.stopPropagation(); patchCard(row.id, c.id, { match: c.match === "exact" ? "startsWith" : "exact" }); }}>
              {c.match === "exact" ? "exact" : "starts with"}
            </button>
          </Seg>
        )}
        {c.minSeconds != null && (
          <Seg onRemove={() => patchCard(row.id, c.id, { minSeconds: null })} onClick={() => setEdit({ id: c.id, field: "minSeconds" })} title="Stayed at least this long on one view of the page (seconds)">
            {ed("minSeconds") ? <Inline type="number" value={String(c.minSeconds)} width="w-12" onDone={num("minSeconds", 1, 86400)} /> : <>{fmtSeconds(c.minSeconds)}+</>}
          </Seg>
        )}
        {c.minReadPct != null && (
          <Seg onRemove={() => patchCard(row.id, c.id, { minReadPct: null })} onClick={() => setEdit({ id: c.id, field: "minReadPct" })} title="Saw at least this share of the page on screen, in one view">
            {ed("minReadPct") ? <Inline type="number" value={String(c.minReadPct)} width="w-12" onDone={num("minReadPct", 1, 100)} /> : <>{c.minReadPct}% read</>}
          </Seg>
        )}
        {c.minTimes != null && row.order !== "sequence" && (
          <Seg onRemove={() => patchCard(row.id, c.id, { minTimes: null })} title="Viewed at least this many times">
            {ed("minTimes") ? (
              <Inline type="number" value={String(c.minTimes)} width="w-10" onDone={num("minTimes", 2, 100)} />
            ) : (
              <span>
                <span className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEdit({ id: c.id, field: "minTimes" }); }}>{c.minTimes}×</span>{" "}
                <button type="button" className="text-[10px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground" onClick={(e) => { e.stopPropagation(); patchCard(row.id, c.id, { timesIn: c.timesIn === "visit" ? "visits" : "visit" }); }}>
                  {c.timesIn === "visit" ? "in one visit" : "across visits"}
                </button>
              </span>
            )}
          </Seg>
        )}
      </span>
    );
  };

  const chipView = (c: LeadChip) => {
    const ed = edit?.id === c.id;
    const done = (field: string, lo: number, hi: number) => (v: string | null) => {
      setEdit(null);
      if (v === null) return;
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n < lo) return removeChip(c.id);
      patchChip(c.id, { [field]: Math.min(n, hi) } as Partial<LeadChip>);
    };
    let body: ReactNode;
    switch (c.kind) {
      case "visits":
        body = ed ? <Inline type="number" value={String(c.min)} width="w-10" onDone={done("min", 1, 100)} /> : <>{c.min}+ visits</>;
        break;
      case "pages":
        body = ed ? <Inline type="number" value={String(c.min)} width="w-10" onDone={done("min", 1, 500)} /> : <>{c.min}+ pages</>;
        break;
      case "readEvery":
        body = ed ? <Inline type="number" value={String(c.minPct)} width="w-10" onDone={done("minPct", 1, 100)} /> : <>{c.minPct}%+ of every page</>;
        break;
      case "totalTime":
        body = ed ? <Inline type="number" value={String(c.minSeconds)} width="w-14" onDone={done("minSeconds", 1, 86400)} /> : <>{fmtSeconds(c.minSeconds)}+ on the site</>;
        break;
      case "source":
        body = ed ? (
          <Inline
            value={c.value}
            width="w-24"
            placeholder="google"
            onDone={(v) => {
              setEdit(null);
              if (v === null) return c.value ? undefined : removeChip(c.id);
              const s = v.trim().toLowerCase();
              if (!s) return removeChip(c.id);
              patchChip(c.id, { value: s });
            }}
          />
        ) : (
          <>from {c.value || "…"}</>
        );
        break;
      case "device":
        body = (
          <button type="button" onClick={() => patchChip(c.id, { value: c.value === "mobile" ? "desktop" : "mobile" })} title="Click to switch">
            on a {c.value === "mobile" ? "phone" : "computer"}
          </button>
        );
        break;
      case "formTime":
        body = ed ? (
          <Inline type="number" value={String(c.seconds)} width="w-12" onDone={done("seconds", 1, 3600)} />
        ) : (
          <span>
            form{" "}
            <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => patchChip(c.id, { op: c.op === "under" ? "over" : "under" })} title="Click to switch under / over">
              {c.op}
            </button>{" "}
            <span className="cursor-pointer" onClick={() => setEdit({ id: c.id, field: "v" })} title="Click to change">
              {fmtSeconds(c.seconds)}
            </span>
          </span>
        );
        break;
    }
    // a tap on the chip edits its number or text; device and form time have their own tap targets inside
    const tapToEdit = !ed && c.kind !== "device" && c.kind !== "formTime";
    return (
      <span key={c.id} className="inline-flex rounded-md border border-dashed bg-card">
        <Seg first onRemove={() => removeChip(c.id)} onClick={tapToEdit ? () => setEdit({ id: c.id, field: "v" }) : undefined}>
          {body}
        </Seg>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <datalist id="jh-mark-pages">
        {pages.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {/* the device */}
      <div className="rounded-[1.4rem] border bg-muted/50 p-2.5 shadow-inner">
        <div className="space-y-2.5 rounded-2xl border bg-background p-3 shadow-sm">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Counts
            <select value={rule.scope} onChange={(e) => setRule((r) => ({ ...r, scope: e.target.value as Scope }))} className="field-sizing-content rounded border-0 bg-transparent py-0 pl-0.5 pr-6 text-[11px] font-medium text-foreground focus:ring-1 focus:ring-primary" title={SCOPES.find((s) => s.value === rule.scope)?.hint}>
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <span>before sending</span>
          </div>

          {/* the screen */}
          <div className="min-h-28 space-y-2" onClick={(e) => e.target === e.currentTarget && setSel(null)}>
            {empty && <p className="pt-6 text-center text-xs text-muted-foreground">Empty. Press a key below.</p>}
            {rule.rows.map((row) => (
              <div key={row.id} className="flex items-start gap-1">
                <div className="relative">
                  <button type="button" onClick={() => setMenu(menu === row.id ? null : row.id)} className="flex h-7 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Row options">
                    <MoreHorizontal className="size-3.5" />
                  </button>
                  {menu === row.id && (
                    <div className="absolute left-0 top-8 z-20 w-40 rounded-md border bg-popover p-1 text-xs shadow-md">
                      {(["any", "sequence"] as const).map((o) => (
                        <button key={o} type="button" disabled={o === "sequence" && row.cards.length < 2} onClick={() => { patchRow(row.id, { order: o }); setMenu(null); }} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40">
                          <Check className={"size-3 " + (row.order === o ? "opacity-100" : "opacity-0")} />
                          {o === "any" ? "Any order" : "In this order (one visit)"}
                        </button>
                      ))}
                      <button type="button" onClick={() => { removeRow(row.id); setMenu(null); }} className="w-full rounded px-2 py-1.5 pl-7 text-left text-red-600 hover:bg-muted dark:text-red-400">
                        Remove row
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {row.cards.map((c, i) => (
                    <span key={c.id} className="flex items-center gap-1.5">
                      {i > 0 && row.order === "sequence" && <ArrowRight className="size-3 text-muted-foreground" />}
                      {cardView(row, c)}
                    </span>
                  ))}
                  {row.cards.length < 4 && (
                    <button type="button" onClick={() => addPage(row.id)} className="flex size-6 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:border-foreground/40 hover:text-foreground" aria-label="Another page in this row" title="Another page in this row">
                      <Plus className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {rule.lead.length > 0 && (
              <div className={"flex flex-wrap items-center gap-1.5 " + (rule.rows.length ? "border-t border-dashed pt-2" : "")}>
                {rule.lead.map(chipView)}
              </div>
            )}
          </div>
        </div>

        {/* Enter with AI: between the screen and the keys */}
        <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2 focus-within:border-primary/60">
            <Sparkles className="size-3.5 shrink-0 text-primary" />
            <input
              value={ai}
              onChange={(e) => setAi(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAi()}
              placeholder="Describe the lead: read pricing 30 s, then the demo page"
              className="h-8 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/70"
              aria-label="Enter with AI"
              maxLength={400}
            />
            <button type="button" onClick={runAi} disabled={!ai.trim() || aiBusy} className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label="Build with AI">
              {aiBusy ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
            </button>
          </div>
          {aiNote && (
            <p className={"text-[11px] " + (aiNote.tone === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {aiNote.text}
              {undo && (
                <button type="button" className="ml-2 underline underline-offset-2" onClick={() => { setRule(undo); setUndo(null); setAiNote(null); }}>
                  Undo
                </button>
              )}
            </p>
          )}

        </div>
        {/* the keys */}
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <Key onClick={() => addPage()} hint="A page they saw">Saw page</Key>
          <Key onClick={() => (selCard ? onCard("minReadPct", 80) : addChip({ id: newId("l"), kind: "readEvery", minPct: 80 }, "v"))} accent={!!selCard} hint={selCard ? "How much of " + (selCard.path || "the page") + " they read" : "How much of every page they read"}>
            Read %
          </Key>
          <Key onClick={() => (selCard ? onCard("minSeconds", 30) : addChip({ id: newId("l"), kind: "totalTime", minSeconds: 120 }, "v"))} accent={!!selCard} hint={selCard ? "Time on " + (selCard.path || "the page") : "Time on the whole site"}>
            Time
          </Key>
          <Key onClick={() => onCard("minTimes", 2)} disabled={!selCard || selRow?.order === "sequence"} accent={!!selCard} hint={!selCard ? "Select a page first" : selRow?.order === "sequence" ? "Not in an ordered row" : "How many times they opened it"}>
            Times
          </Key>
          <Key onClick={() => addChip({ id: newId("l"), kind: "pages", min: 3 }, "v")} hint="How many pages they saw">Pages</Key>
          <Key onClick={() => addChip({ id: newId("l"), kind: "visits", min: 2 }, "v")} hint="How many times they came">Visits</Key>
          <Key onClick={() => addChip({ id: newId("l"), kind: "source", value: "" }, "v")} hint="Where they came from (google, facebook, a campaign)">Came from</Key>
          <Key onClick={() => addChip({ id: newId("l"), kind: "device", value: "mobile" }, "v")} hint="Phone or computer">Device</Key>
          <Key onClick={() => addChip({ id: newId("l"), kind: "formTime", op: "under", seconds: 60 }, "v")} hint="How long the form took">Form time</Key>
        </div>
      </div>

      {check.reads && <p className="text-xs leading-relaxed text-muted-foreground">{check.reads}</p>}

      {/* about the mark */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name, e.g. Pricing reader" className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" aria-label="Name" />
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} placeholder="Notes for the team (optional): what to do with these leads" className="w-full resize-none rounded-md border bg-background p-2 text-xs" />
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Colour">
          {MARK_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} role="radio" aria-checked={color === c} className={"size-5 rounded-full transition " + (color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "hover:scale-110")} style={{ backgroundColor: c }} aria-label={c} />
          ))}
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">Who sees it</span>
            {(["private", "team", "members"] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-1">
                <input type="radio" name="vis" checked={visibility === v} onChange={() => setVisibility(v)} className="size-3" />
                {v === "private" ? "Only me" : v === "team" ? "Team" : "Chosen"}
              </label>
            ))}
          </div>
          {visibility === "members" && (
            <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border p-2">
              {others.length === 0 && <p className="text-muted-foreground">Nobody else is on this site yet.</p>}
              {others.map((m) => (
                <label key={m.userId} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={sharedWith.includes(m.userId)} onChange={(e) => setSharedWith((s) => (e.target.checked ? [...s, m.userId] : s.filter((x) => x !== m.userId)))} className="size-3" />
                  {m.email ?? m.userId.slice(0, 10)}
                </label>
              ))}
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-3" />
            On: mark leads now and every new lead
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        {hookHref ? (
          <a href={hookHref} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="See and run this as a Hook query">
            Open in Hook <ExternalLink className="size-3" />
          </a>
        ) : (
          <span />
        )}
        <button type="button" onClick={onCancel} className="ml-auto h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving || empty} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {initial.id ? "Save" : "Save mark"}
        </button>
      </div>
    </div>
  );
}
