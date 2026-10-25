"use client";
// components/marks/v2/RuleEditor.tsx
// The new mark builder's "Enter manually" face (marks v2, mds/build/marks/marks-v2-plan.md section 5). Made for sales
// people: it starts with three buttons (Visit condition, Page condition, Form condition); a visit is a card (like one
// visit chart) with its own conditions and pages; "Then, a later visit" chains visits; a second card on its own is
// another visit that must also have happened. Advanced choices sit at the bottom of each menu.
// The rule: jh-marks/v2/rule.ts. Checked by jh-marks/v2/check.ts.
import * as React from "react";
import { ArrowDown, ChevronDown, CornerDownRight, Info, Plus, Search, X } from "lucide-react";
import { newId, type AnswerCond, type Block, type FormCond, type HeadingRef, type MarkRuleV2, type NumCond, type NumOp, type PageCond, type PageGroup, type PageStep, type RootWhich, type SessionCond, type ThenWhich } from "@/jh-marks/v2/rule";
import type { CatalogField } from "@/lib/forms/catalog";
import { loadPageHeadings, type PageHeading } from "@/lib/actions/pageHeadings.action";
import { FieldNamingHelp } from "@/components/forms/FieldNamingHelp";

const MAX_DEPTH = 3;
const PLATFORMS = ["Any platform", "Google", "Meta", "LinkedIn", "Microsoft", "TikTok", "X", "YouTube", "Reddit", "Email", "AI assistants", "Referral", "Direct"];

// ── small pieces ─────────────────────────────────────────────────────────────

const OPS: { v: NumOp; l: string }[] = [
  { v: ">=", l: "at least" },
  { v: ">", l: "more than" },
  { v: "<=", l: "at most" },
  { v: "<", l: "less than" },
  { v: "=", l: "exactly" },
  { v: "between", l: "between" },
];

function NumInput({ value, onChange, unit, min = 0 }: { value: NumCond; onChange: (n: NumCond) => void; unit?: string; min?: number }) {
  const box = "h-7 w-16 rounded-md border bg-background px-1.5 text-xs tabular-nums";
  const n = (v: string) => (v === "" ? min : Math.max(min, Number(v)));
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <select value={value.op} onChange={(e) => onChange({ ...value, op: e.target.value as NumOp, b: e.target.value === "between" ? value.b ?? value.a : undefined })} className="h-7 rounded-md border bg-background px-1 text-xs" aria-label="Comparison">
        {OPS.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <input type="number" value={value.a} min={min} onChange={(e) => onChange({ ...value, a: n(e.target.value) })} className={box} aria-label="Value" />
      {value.op === "between" && (
        <>
          <span className="text-xs text-muted-foreground">and</span>
          <input type="number" value={value.b ?? value.a} min={min} onChange={(e) => onChange({ ...value, b: n(e.target.value) })} className={box} aria-label="Second value" />
        </>
      )}
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </span>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <span title={text} className="inline-flex cursor-help text-muted-foreground">
      <Info className="size-3" />
    </span>
  );
}

function Remove({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label={label} title={label}>
      <X className="size-3.5" />
    </button>
  );
}

type MenuItem = { label: string; hint?: string; onClick: () => void; advanced?: boolean; disabled?: boolean };

/** A "+ something" button that opens a short list; advanced items sit below a line. */
function AddMenu({ label, items, small }: { label: string; items: MenuItem[]; small?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const basic = items.filter((i) => !i.advanced);
  const adv = items.filter((i) => i.advanced);
  const item = (i: MenuItem) => (
    <button
      key={i.label}
      type="button"
      disabled={i.disabled}
      onClick={() => {
        setOpen(false);
        i.onClick();
      }}
      className="flex w-full flex-col items-start rounded px-2 py-1.5 text-left hover:bg-muted disabled:opacity-40"
    >
      <span className="text-xs text-foreground">{i.label}</span>
      {i.hint && <span className="text-[11px] text-muted-foreground">{i.hint}</span>}
    </button>
  );
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className={"inline-flex items-center gap-1 rounded-md border border-dashed text-muted-foreground hover:border-foreground/40 hover:text-foreground " + (small ? "h-6 px-1.5 text-[11px]" : "h-7 px-2 text-xs")}>
        <Plus className="size-3" /> {label} <ChevronDown className="size-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border bg-popover p-1 shadow-lg">
          {basic.map(item)}
          {adv.length > 0 && <div className="mx-2 my-1 border-t pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">More</div>}
          {adv.map(item)}
        </div>
      )}
    </span>
  );
}

/** Pick a heading of a page: type part of its name, the closest ones are listed. */
function HeadingPicker({ page, value, onChange }: { page: string; value: HeadingRef | null; onChange: (h: HeadingRef) => void }) {
  const [list, setList] = React.useState<PageHeading[] | null>(null);
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(!value);
  React.useEffect(() => {
    let live = true;
    if (!page.startsWith("/") || page.length < 1) return;
    loadPageHeadings(page).then((r) => live && setList(r.ok ? r.headings : []));
    return () => {
      live = false;
    };
  }, [page]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = (list ?? [])
    .map((h) => ({ h, score: words.length ? words.filter((w) => h.text.toLowerCase().includes(w)).length / words.length : 1 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  if (!open && value)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-7 max-w-56 items-center gap-1 truncate rounded-md border bg-blue-500/10 px-2 text-xs font-medium text-blue-700 dark:text-blue-300" title={"Heading on " + (value.page ?? page)}>
        &quot;{value.text}&quot;
      </button>
    );
  return (
    <span className="relative inline-block">
      <span className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2">
        <Search className="size-3 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={page.startsWith("/") ? "Find a heading on " + page : "Pick the page first"} className="w-44 bg-transparent text-xs outline-none" aria-label="Find a heading" />
      </span>
      <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-72 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
        {list === null && page.startsWith("/") && <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading the page&apos;s headings...</p>}
        {list !== null && !list.length && <p className="px-2 py-1.5 text-xs text-muted-foreground">No headings recorded for {page} yet. They appear after a visitor opens the page.</p>}
        {shown.map(({ h }) => (
          <button
            key={h.key}
            type="button"
            onClick={() => {
              onChange({ key: h.key, text: h.text, page });
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"
          >
            <span className="w-5 shrink-0 text-[10px] uppercase text-muted-foreground">{h.tag}</span>
            <span className="min-w-0 flex-1 truncate">{h.text}</span>
          </button>
        ))}
        {value && (
          <button type="button" onClick={() => setOpen(false)} className="w-full rounded px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted">
            Keep &quot;{value.text}&quot;
          </button>
        )}
      </div>
    </span>
  );
}

// ── conditions ───────────────────────────────────────────────────────────────

const WHICH_ROOT: { kind: RootWhich["kind"]; label: string; hint: string; advanced?: boolean }[] = [
  { kind: "converting", label: "The visit they sent the form in", hint: "The visit in which the lead filled in your form (the default)" },
  { kind: "last", label: "Their last visit", hint: "The last visit up to sending the form: the same visit as the one they sent it in" },
  { kind: "any", label: "Any visit", hint: "Any of their visits, up to sending the form" },
  { kind: "first", label: "Their first visit", hint: "The first time they ever came" },
  { kind: "nth", label: "Visit number...", hint: "Their 4th visit, after their 4th, between the 4th and the 5th... (counted from their first visit ever)" },
  { kind: "every", label: "Every visit", hint: "Each of their visits up to sending must meet this", advanced: true },
];

function WhichSelect({ which, root, onChange }: { which: RootWhich | ThenWhich; root: boolean; onChange: (w: RootWhich | ThenWhich) => void }) {
  const opts = root ? WHICH_ROOT : [{ kind: "later" as const, label: "Any later visit", hint: "Any visit after the one above" }, { kind: "nth" as const, label: "Visit number...", hint: "Counted from their first visit ever" }];
  const current = opts.find((o) => o.kind === which.kind);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select
        value={which.kind}
        onChange={(e) => {
          const k = e.target.value;
          onChange(k === "nth" ? { kind: "nth", n: { op: "=", a: root ? 2 : 3 } } : ({ kind: k } as RootWhich | ThenWhich));
        }}
        className="h-7 rounded-md border bg-background px-1.5 text-xs font-medium"
        aria-label="Which visit"
      >
        {opts.map((o) => (
          <option key={o.kind} value={o.kind}>
            {o.label}
          </option>
        ))}
      </select>
      {which.kind === "nth" && <NumInput value={which.n} min={1} onChange={(n) => onChange({ kind: "nth", n })} />}
      {current && <Hint text={current.hint} />}
    </span>
  );
}

function SessionCondRow({ c, onChange, pages }: { c: SessionCond; onChange: (c: SessionCond | null) => void; pages: string[] }) {
  const [headingPage, setHeadingPage] = React.useState(("heading" in c && c.heading.page) || pages[0] || "/");
  let body: React.ReactNode;
  switch (c.kind) {
    case "duration":
      body = (
        <>
          <span>Visit length</span>
          <NumInput value={c.n} unit="seconds" onChange={(n) => onChange({ ...c, n })} />
        </>
      );
      break;
    case "pages":
      body = (
        <>
          <span>Pages seen</span>
          <NumInput value={c.n} onChange={(n) => onChange({ ...c, n })} />
        </>
      );
      break;
    case "heading":
    case "headingShare":
      body = (
        <>
          <span>{c.kind === "heading" ? "Heading" : "Share of reading on"}</span>
          <input list="jh-mark-pages" value={headingPage} onChange={(e) => setHeadingPage(e.target.value)} className="h-7 w-28 rounded-md border bg-background px-1.5 text-xs" aria-label="Page of the heading" title="The page to pick the heading from" />
          <HeadingPicker page={headingPage} value={c.heading.key ? c.heading : null} onChange={(heading) => onChange({ ...c, heading } as SessionCond)} />
          {c.kind === "heading" ? (
            <>
              <select value={c.state} onChange={(e) => onChange({ ...c, state: e.target.value as "seen" | "notSeen", n: e.target.value === "seen" ? c.n : undefined })} className="h-7 rounded-md border bg-background px-1 text-xs" aria-label="Seen or not">
                <option value="seen">was read</option>
                <option value="notSeen">was not read</option>
              </select>
              {c.state === "seen" &&
                (c.n ? (
                  <>
                    <span>for</span>
                    <NumInput value={c.n} unit="seconds" onChange={(n) => onChange({ ...c, n })} />
                  </>
                ) : (
                  <button type="button" onClick={() => onChange({ ...c, n: { op: ">=", a: 10 } })} className="text-[11px] text-primary hover:underline">
                    + for how long
                  </button>
                ))}
            </>
          ) : (
            <NumInput value={c.n} unit="% of the visit's reading" onChange={(n) => onChange({ ...c, n })} />
          )}
        </>
      );
      break;
    case "source":
      body = (
        <>
          <span>Came from</span>
          <input value={c.value} onChange={(e) => onChange({ ...c, value: e.target.value.toLowerCase() })} placeholder="google" className="h-7 w-32 rounded-md border bg-background px-1.5 text-xs" aria-label="Came from" />
          <Hint text="Matched in the referrer or the utm source (google, linkedin, a campaign name)" />
        </>
      );
      break;
    case "channel":
      body = (
        <>
          <span>Came from</span>
          <select value={c.platform} onChange={(e) => onChange({ ...c, platform: e.target.value })} className="h-7 rounded-md border bg-background px-1 text-xs" aria-label="Platform">
            {PLATFORMS.map((p) => (
              <option key={p} value={p === "Any platform" ? "" : p}>
                {p}
              </option>
            ))}
          </select>
          <select value={c.paid} onChange={(e) => onChange({ ...c, paid: e.target.value as "any" | "paid" | "free" })} className="h-7 rounded-md border bg-background px-1 text-xs" aria-label="Paid or free">
            <option value="paid">an ad (paid)</option>
            <option value="free">free (search, social, link)</option>
            <option value="any">paid or free</option>
          </select>
          <input value={c.campaign ?? ""} onChange={(e) => onChange({ ...c, campaign: e.target.value })} placeholder="campaign contains" className="h-7 w-32 rounded-md border bg-background px-1.5 text-xs" aria-label="Campaign contains" />
          <input value={c.ad ?? ""} onChange={(e) => onChange({ ...c, ad: e.target.value })} placeholder="ad contains" className="h-7 w-28 rounded-md border bg-background px-1.5 text-xs" aria-label="Ad contains" />
          <Hint text="Read from the link that brought them: the ad network's click id, utm_source / utm_medium, utm_campaign and utm_content (the ad). Pick the visit above: their first visit, any visit, or the one they sent the form in." />
        </>
      );
      break;
    case "device":
      body = (
        <>
          <span>Device</span>
          <select value={c.value} onChange={(e) => onChange({ ...c, value: e.target.value as "desktop" | "mobile" })} className="h-7 rounded-md border bg-background px-1 text-xs">
            <option value="desktop">computer</option>
            <option value="mobile">phone</option>
          </select>
        </>
      );
      break;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {body}
      <span className="ml-auto">
        <Remove onClick={() => onChange(null)} label="Remove this condition" />
      </span>
    </div>
  );
}

function PageCondRow({ c, page, inSequence, onChange }: { c: PageCond; page: string; inSequence: boolean; onChange: (c: PageCond | null) => void }) {
  let body: React.ReactNode;
  switch (c.kind) {
    case "time":
      body = (
        <>
          <span>Time on it</span>
          <NumInput value={c.n} unit="seconds" onChange={(n) => onChange({ ...c, n })} />
        </>
      );
      break;
    case "seen":
      body = (
        <>
          <span>Share of the page seen</span>
          <NumInput value={c.n} unit="%" onChange={(n) => onChange({ ...c, n })} />
        </>
      );
      break;
    case "views":
      body = (
        <>
          <span>Times viewed in the visit</span>
          <NumInput value={c.n} min={1} onChange={(n) => onChange({ ...c, n })} />
          {inSequence && <span className="text-[11px] text-red-600">not in a sequence</span>}
        </>
      );
      break;
    case "heading":
      body = (
        <>
          <HeadingPicker page={page} value={c.heading.key ? c.heading : null} onChange={(heading) => onChange({ ...c, heading })} />
          <select value={c.state} onChange={(e) => onChange({ ...c, state: e.target.value as "seen" | "notSeen", n: e.target.value === "seen" ? c.n : undefined })} className="h-7 rounded-md border bg-background px-1 text-xs" aria-label="Seen or not">
            <option value="seen">was read</option>
            <option value="notSeen">was not read (or only passed)</option>
          </select>
          {c.state === "seen" &&
            (c.n ? (
              <>
                <span>for</span>
                <NumInput value={c.n} unit="seconds" onChange={(n) => onChange({ ...c, n })} />
              </>
            ) : (
              <button type="button" onClick={() => onChange({ ...c, n: { op: ">=", a: 10 } })} className="text-[11px] text-primary hover:underline">
                + for how long
              </button>
            ))}
        </>
      );
      break;
    case "headingShare":
      body = (
        <>
          <HeadingPicker page={page} value={c.heading.key ? c.heading : null} onChange={(heading) => onChange({ ...c, heading })} />
          <span>got</span>
          <NumInput value={c.n} unit="% of the page's reading" onChange={(n) => onChange({ ...c, n })} />
        </>
      );
      break;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {body}
      <span className="ml-auto">
        <Remove onClick={() => onChange(null)} label="Remove this condition" />
      </span>
    </div>
  );
}

const noHeading = (): HeadingRef => ({ key: "", text: "" });

function StepCard({ step, index, group, onChange }: { step: PageStep; index: number; group: PageGroup; onChange: (s: PageStep | null) => void }) {
  const seq = group.order === "sequence";
  const set = (patch: Partial<PageStep>) => onChange({ ...step, ...patch });
  const add = (c: PageCond) => set({ conds: [...step.conds, c] });
  return (
    <div className="space-y-1.5 rounded-md border bg-card p-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">{seq ? `${index + 1}.` : "Saw"}</span>
        <input list="jh-mark-pages" value={step.path} onChange={(e) => set({ path: e.target.value })} placeholder="/pricing" className="h-7 w-36 rounded-md border bg-background px-1.5 text-xs font-medium" aria-label="Page" />
        <select value={step.match} onChange={(e) => set({ match: e.target.value as "exact" | "startsWith" })} className="h-7 rounded-md border bg-background px-1 text-[11px]" aria-label="Exact page or every page under it" title="Exactly this page, or every page whose address starts with it">
          <option value="exact">this page</option>
          <option value="startsWith">or any page under it</option>
        </select>
        <span className="ml-auto">
          <Remove onClick={() => onChange(null)} label="Remove this page" />
        </span>
      </div>
      {step.conds.map((c, i) => (
        <div key={c.id} className="pl-4">
          <PageCondRow
            c={c}
            page={step.path}
            inSequence={seq}
            onChange={(next) => set({ conds: next ? step.conds.map((x, j) => (j === i ? next : x)) : step.conds.filter((_, j) => j !== i) })}
          />
        </div>
      ))}
      <div className="pl-4">
        <AddMenu
          small
          label="Condition on this page"
          items={[
            { label: "Time on the page", onClick: () => add({ id: newId("p"), kind: "time", n: { op: ">=", a: 30 } }) },
            { label: "Share of the page seen", onClick: () => add({ id: newId("p"), kind: "seen", n: { op: ">=", a: 50 } }) },
            { label: "A heading on this page", hint: "Read it (and for how long), or not", onClick: () => add({ id: newId("p"), kind: "heading", heading: noHeading(), state: "seen" }) },
            { label: "Times viewed in the visit", disabled: seq, hint: seq ? "Not inside a sequence" : undefined, onClick: () => add({ id: newId("p"), kind: "views", n: { op: ">=", a: 2 } }) },
            { label: "Share of the page's reading on a heading", hint: "e.g. 40% of their reading went to Offers", advanced: true, onClick: () => add({ id: newId("p"), kind: "headingShare", heading: noHeading(), n: { op: ">=", a: 30 } }) },
          ]}
        />
      </div>
    </div>
  );
}

function PagesBox({ group, onChange }: { group: PageGroup; onChange: (g: PageGroup | null) => void }) {
  const seq = group.order === "sequence";
  const setStep = (i: number, s: PageStep | null) => {
    const steps = s ? group.steps.map((x, j) => (j === i ? s : x)) : group.steps.filter((_, j) => j !== i);
    onChange(steps.length ? { order: steps.length > 1 ? group.order : "any", steps } : null);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">Pages</span>
        {group.steps.length > 1 && (
          <select value={group.order} onChange={(e) => onChange({ ...group, order: e.target.value as "any" | "sequence", steps: group.steps.map((s) => ({ ...s, conds: e.target.value === "sequence" ? s.conds.filter((c) => c.kind !== "views") : s.conds })) })} className="h-6 rounded-md border bg-background px-1 text-[11px]" aria-label="Order of the pages">
            <option value="any">in any order</option>
            <option value="sequence">in this order</option>
          </select>
        )}
      </div>
      {group.steps.map((s, i) => (
        <React.Fragment key={s.id}>
          {seq && i > 0 && (
            <div className="flex items-center gap-1.5 pl-3 text-[11px] text-muted-foreground">
              <ArrowDown className="size-3" />
              <select value={s.link} onChange={(e) => setStep(i, { ...s, link: e.target.value as "next" | "later" })} className="h-6 rounded-md border bg-background px-1 text-[11px]" aria-label="How this page follows the one above">
                <option value="next">right after (the very next page)</option>
                <option value="later">later in the same visit</option>
              </select>
            </div>
          )}
          <StepCard step={s} index={i} group={group} onChange={(x) => setStep(i, x)} />
        </React.Fragment>
      ))}
      {group.steps.length < 6 && (
        <button type="button" onClick={() => onChange({ ...group, steps: [...group.steps, { id: newId("st"), path: "", match: "exact", conds: [], link: "next" }] })} className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
          <Plus className="size-3" /> {seq ? "Then another page" : "Another page"}
        </button>
      )}
    </div>
  );
}

function BlockCard({ block, depth, pages, onChange }: { block: Block; depth: number; pages: string[]; onChange: (b: Block | null) => void }) {
  const set = (patch: Partial<Block>) => onChange({ ...block, ...patch });
  const addSession = (c: SessionCond) => set({ session: [...block.session, c] });
  const addPage = () => set({ pages: block.pages ? { ...block.pages, steps: [...block.pages.steps, { id: newId("st"), path: "", match: "exact", conds: [], link: "next" }] } : { order: "any", steps: [{ id: newId("st"), path: "", match: "exact", conds: [], link: "later" }] } });
  return (
    <div className={"space-y-2 rounded-lg border p-2.5 " + (depth === 1 ? "bg-background" : "bg-muted/30")}>
      <div className="flex flex-wrap items-center gap-1.5">
        {depth > 1 && <CornerDownRight className="size-3.5 text-muted-foreground" />}
        <span className="text-xs font-semibold text-foreground">{depth > 1 ? "Then, in" : "In"}</span>
        <WhichSelect which={block.which} root={depth === 1} onChange={(which) => set({ which })} />
        <span className="ml-auto">
          <Remove onClick={() => onChange(null)} label="Remove this visit" />
        </span>
      </div>
      {block.session.map((c, i) => (
        <SessionCondRow key={c.id} c={c} pages={pages} onChange={(next) => set({ session: next ? block.session.map((x, j) => (j === i ? next : x)) : block.session.filter((_, j) => j !== i) })} />
      ))}
      {block.pages && <PagesBox group={block.pages} onChange={(g) => set({ pages: g })} />}
      <div className="flex flex-wrap items-center gap-1.5">
        <AddMenu
          small
          label="Visit condition"
          items={[
            { label: "Visit length", onClick: () => addSession({ id: newId("s"), kind: "duration", n: { op: ">=", a: 60 } }) },
            { label: "Pages seen", onClick: () => addSession({ id: newId("s"), kind: "pages", n: { op: ">=", a: 3 } }) },
            { label: "A heading, across the visit", hint: "Read on any page of the visit, or not", onClick: () => addSession({ id: newId("s"), kind: "heading", heading: noHeading(), state: "seen" }) },
            { label: "Came from an ad or platform", hint: "Meta ad, Google search, a campaign, a specific ad", onClick: () => addSession({ id: newId("s"), kind: "channel", platform: "Meta", paid: "paid" }) },
            { label: "Came from (any text)", hint: "matched in the referrer or utm source", advanced: true, onClick: () => addSession({ id: newId("s"), kind: "source", value: "" }) },
            { label: "Device", onClick: () => addSession({ id: newId("s"), kind: "device", value: "mobile" }) },
            { label: "Share of the visit's reading on a heading", advanced: true, onClick: () => addSession({ id: newId("s"), kind: "headingShare", heading: noHeading(), n: { op: ">=", a: 30 } }) },
          ]}
        />
        {!block.pages && (
          <button type="button" onClick={addPage} className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
            <Plus className="size-3" /> Page
          </button>
        )}
        {depth < MAX_DEPTH && (block.session.length > 0 || block.pages) && (
          <button type="button" onClick={() => set({ then: [...block.then, { id: newId("b"), which: { kind: "later" }, session: [], pages: null, then: [] }] })} className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-primary/40 px-1.5 text-[11px] text-primary hover:bg-primary/10" title="A visit that must come after this one">
            <CornerDownRight className="size-3" /> Then, a later visit
          </button>
        )}
      </div>
      {block.then.length > 0 && (
        <div className="space-y-2 border-l-2 border-primary/30 pl-3">
          {block.then.map((t, i) => (
            <BlockCard key={t.id} block={t} depth={depth + 1} pages={pages} onChange={(next) => set({ then: next ? block.then.map((x, j) => (j === i ? next : x)) : block.then.filter((_, j) => j !== i) })} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── form: answers and how it was filled ──────────────────────────────────────

const CONTACT_FIELDS = [
  { key: "email", name: "Email" },
  { key: "name", name: "Name" },
  { key: "phone", name: "Phone" },
];

function FieldSelect({ value, name, fields, withContact, onChange, onMissing }: { value: string; name?: string; fields: { key: string; name: string }[]; withContact?: boolean; onChange: (key: string, name: string) => void; onMissing: () => void }) {
  const listed = withContact ? [...CONTACT_FIELDS, ...fields] : fields;
  // the field already in the mark stays shown by its name, even when the site's field list has not loaded or no longer has it
  const all = value && !listed.some((f) => f.key === value) ? [{ key: value, name: name || value }, ...listed] : listed;
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === "__missing") return onMissing();
          const f = all.find((x) => x.key === e.target.value);
          if (f) onChange(f.key, f.name);
        }}
        className="h-7 max-w-48 rounded-md border bg-background px-1 text-xs font-medium"
        aria-label="Form field"
      >
        {!value && <option value="">Pick a field</option>}
        {all.map((f) => (
          <option key={f.key} value={f.key}>
            {f.name}
          </option>
        ))}
        <option value="__missing">My field is not here...</option>
      </select>
    </span>
  );
}

function AnswerRow({ c, fields, onChange, onMissing }: { c: AnswerCond; fields: CatalogField[]; onChange: (c: AnswerCond | null) => void; onMissing: () => void }) {
  const f = fields.find((x) => x.key === c.field);
  const pick = (key: string, name: string) => {
    const g = fields.find((x) => x.key === key);
    if (!g) return;
    onChange(answerFor(g, c.id, name));
  };
  let control: React.ReactNode = null;
  switch (c.kind) {
    case "number":
      control = <NumInput value={c.n} min={-1e12} onChange={(n) => onChange({ ...c, n })} />;
      break;
    case "choice":
    case "multi": {
      const opts = f?.options ?? c.options ?? [];
      control = (
        <>
          {c.kind === "choice" && (
            <select value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as "is" | "isNot" })} className="h-7 rounded-md border bg-background px-1 text-xs">
              <option value="is">is</option>
              <option value="isNot">is not</option>
            </select>
          )}
          {c.kind === "multi" && <span>includes</span>}
          <span className="inline-flex flex-wrap gap-1">
            {opts.map((o) => {
              const on = c.values.includes(o.l || o.v);
              return (
                <button key={o.v} type="button" onClick={() => onChange({ ...c, values: on ? c.values.filter((v) => v !== (o.l || o.v)) : [...c.values, o.l || o.v] })} className={"rounded-full border px-2 py-0.5 text-[11px] " + (on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {o.l || o.v}
                </button>
              );
            })}
          </span>
        </>
      );
      break;
    }
    case "yesno":
      control = (
        <select value={c.checked ? "yes" : "no"} onChange={(e) => onChange({ ...c, checked: e.target.value === "yes" })} className="h-7 rounded-md border bg-background px-1 text-xs">
          <option value="yes">is checked</option>
          <option value="no">is not checked</option>
        </select>
      );
      break;
    case "text":
      control = (
        <>
          <select value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as "contains" | "empty" | "notEmpty" })} className="h-7 rounded-md border bg-background px-1 text-xs">
            <option value="contains">contains</option>
            <option value="notEmpty">is filled in</option>
            <option value="empty">is left empty</option>
          </select>
          {c.op === "contains" && <input value={c.value ?? ""} onChange={(e) => onChange({ ...c, value: e.target.value })} className="h-7 w-32 rounded-md border bg-background px-1.5 text-xs" aria-label="Text" />}
        </>
      );
      break;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <FieldSelect value={c.field} name={c.name} fields={fields} onChange={pick} onMissing={onMissing} />
      {control}
      <span className="ml-auto">
        <Remove onClick={() => onChange(null)} label="Remove this answer condition" />
      </span>
    </div>
  );
}

/** A starting answer condition that fits the field's kind. */
function answerFor(f: CatalogField, id = newId("a"), name = f.name): AnswerCond {
  const base = { id, field: f.key, name };
  switch (f.kind) {
    case "number":
      return { ...base, kind: "number", n: { op: ">=", a: f.min ?? 0 }, options: f.options.length ? f.options : undefined };
    case "choice":
      return { ...base, kind: "choice", op: "is", values: [], options: f.options };
    case "multi":
      return { ...base, kind: "multi", values: [], options: f.options };
    case "yesno":
      return { ...base, kind: "yesno", checked: true };
    default:
      return { ...base, kind: "text", op: "notEmpty" };
  }
}

function FormRow({ c, fields, onChange, onMissing }: { c: FormCond; fields: CatalogField[]; onChange: (c: FormCond | null) => void; onMissing: () => void }) {
  const LABEL: Record<FormCond["kind"], string> = {
    fillTime: "Time filling the form",
    timeToStart: "Time from seeing the form to typing",
    emptyFields: "Fields left empty",
    errors: "Form errors",
    leftWhileFilling: "",
    fieldHesitation: "Time before typing in",
    fieldTime: "Time spent in",
    fieldEdits: "Times changed:",
    fieldEmpty: "",
  };
  let body: React.ReactNode;
  if (c.kind === "leftWhileFilling")
    body = (
      <select value={c.value ? "yes" : "no"} onChange={(e) => onChange({ ...c, value: e.target.value === "yes" })} className="h-7 rounded-md border bg-background px-1 text-xs">
        <option value="yes">Left the form while filling it</option>
        <option value="no">Filled the form in one go</option>
      </select>
    );
  else if (c.kind === "fieldEmpty")
    body = (
      <>
        <FieldSelect value={c.field} name={c.name} fields={fields} withContact onChange={(field, name) => onChange({ ...c, field, name })} onMissing={onMissing} />
        <select value={c.value ? "yes" : "no"} onChange={(e) => onChange({ ...c, value: e.target.value === "yes" })} className="h-7 rounded-md border bg-background px-1 text-xs">
          <option value="yes">was left empty</option>
          <option value="no">was filled in</option>
        </select>
      </>
    );
  else if (c.kind === "fieldHesitation" || c.kind === "fieldTime" || c.kind === "fieldEdits")
    body = (
      <>
        <span>{LABEL[c.kind]}</span>
        <FieldSelect value={c.field} name={c.name} fields={fields} withContact onChange={(field, name) => onChange({ ...c, field, name })} onMissing={onMissing} />
        <NumInput value={c.n} unit={c.kind === "fieldEdits" ? "times" : "seconds"} onChange={(n) => onChange({ ...c, n })} />
        {c.kind === "fieldHesitation" && <Hint text="Hesitation: from clicking into the field to the first key typed" />}
      </>
    );
  else
    body = (
      <>
        <span>{LABEL[c.kind]}</span>
        <NumInput value={c.n} unit={c.kind === "fillTime" || c.kind === "timeToStart" ? "seconds" : undefined} onChange={(n) => onChange({ ...c, n } as FormCond)} />
      </>
    );
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {body}
      <span className="ml-auto">
        <Remove onClick={() => onChange(null)} label="Remove this form condition" />
      </span>
    </div>
  );
}

// ── the editor ───────────────────────────────────────────────────────────────

export function RuleEditor({ rule, onChange, pages, fields }: { rule: MarkRuleV2; onChange: (r: MarkRuleV2) => void; pages: string[]; fields: CatalogField[] | null }) {
  const [missing, setMissing] = React.useState<string | null>(null);
  const set = (patch: Partial<MarkRuleV2>) => onChange({ ...rule, ...patch });
  const newBlock = (which: RootWhich, withPage = false): Block => ({ id: newId("b"), which, session: [], pages: withPage ? { order: "any", steps: [{ id: newId("st"), path: "", match: "exact", conds: [], link: "later" }] } : null, then: [] });
  const empty = !rule.blocks.length && !rule.answers.length && !rule.form.length;
  const catalog = fields ?? [];

  const addVisit = () => set({ blocks: [...rule.blocks, newBlock({ kind: "converting" })] });
  // "Page condition" first = a page in the visit they sent the form in (the visit sales people mean)
  const addPage = () => {
    const conv = rule.blocks.find((b) => b.which.kind === "converting");
    if (conv) return set({ blocks: rule.blocks.map((b) => (b.id !== conv.id ? b : { ...b, pages: b.pages ? { ...b.pages, steps: [...b.pages.steps, { id: newId("st"), path: "", match: "exact", conds: [], link: "next" }] } : { order: "any", steps: [{ id: newId("st"), path: "", match: "exact", conds: [], link: "later" }] } })) });
    set({ blocks: [...rule.blocks, newBlock({ kind: "converting" }, true)] });
  };
  const formItems: MenuItem[] = [
    {
      label: "An answer",
      hint: "What they answered: budget, service, company size...",
      onClick: () => {
        if (!catalog.length) return setMissing("");
        set({ answers: [...rule.answers, answerFor(catalog[0])] });
      },
    },
    { label: "Time filling the form", hint: "From the first key to sending", onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "fillTime", n: { op: "<=", a: 60 } }] }) },
    { label: "Hesitation on a field", hint: "Time from clicking into a field to typing", onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "fieldHesitation", field: catalog[0]?.key ?? "email", name: catalog[0]?.name ?? "Email", n: { op: "<=", a: 3 } }] }) },
    { label: "A field left empty or filled", onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "fieldEmpty", field: catalog[0]?.key ?? "phone", name: catalog[0]?.name ?? "Phone", value: true }] }) },
    { label: "Left the form while filling", onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "leftWhileFilling", value: true }] }) },
    { label: "Time from seeing the form to typing", advanced: true, onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "timeToStart", n: { op: "<=", a: 10 } }] }) },
    { label: "Time spent in a field", advanced: true, onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "fieldTime", field: catalog[0]?.key ?? "email", name: catalog[0]?.name ?? "Email", n: { op: ">=", a: 10 } }] }) },
    { label: "Times a field was changed", advanced: true, onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "fieldEdits", field: catalog[0]?.key ?? "email", name: catalog[0]?.name ?? "Email", n: { op: ">=", a: 2 } }] }) },
    { label: "Fields left empty", advanced: true, onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "emptyFields", n: { op: "<=", a: 0 } }] }) },
    { label: "Form errors", advanced: true, onClick: () => set({ form: [...rule.form, { id: newId("f"), kind: "errors", n: { op: ">=", a: 1 } }] }) },
  ];

  return (
    <div className="space-y-3">
      <datalist id="jh-mark-pages">
        {pages.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      {empty ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { label: "Visit condition", hint: "Length, pages, headings, where they came from. Chain visits with 'then'.", onClick: addVisit },
            { label: "Page condition", hint: "Pages in the visit they sent the form in: time, headings, order.", onClick: addPage },
          ].map((b) => (
            <button key={b.label} type="button" onClick={b.onClick} className="flex flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left hover:border-primary/50 hover:bg-primary/5">
              <span className="text-sm font-medium text-foreground">{b.label}</span>
              <span className="text-[11px] text-muted-foreground">{b.hint}</span>
            </button>
          ))}
          <div className="flex flex-col items-start gap-1 rounded-lg border bg-background p-3">
            <span className="text-sm font-medium text-foreground">Form condition</span>
            <span className="mb-1 text-[11px] text-muted-foreground">Their answers (budget...) and how they filled the form.</span>
            <AddMenu small label="Form" items={formItems} />
          </div>
        </div>
      ) : (
        <>
          {rule.blocks.map((b, i) => (
            <React.Fragment key={b.id}>
              {i > 0 && <div className="text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">and also</div>}
              <BlockCard block={b} depth={1} pages={pages} onChange={(next) => set({ blocks: next ? rule.blocks.map((x, j) => (j === i ? next : x)) : rule.blocks.filter((_, j) => j !== i) })} />
            </React.Fragment>
          ))}

          {(rule.answers.length > 0 || rule.form.length > 0) && (
            <div className="space-y-2 rounded-lg border bg-background p-2.5">
              <div className="text-xs font-semibold text-foreground">The form they sent</div>
              {rule.answers.map((c, i) => (
                <AnswerRow key={c.id} c={c} fields={catalog} onMissing={() => setMissing(c.name)} onChange={(next) => set({ answers: next ? rule.answers.map((x, j) => (j === i ? next : x)) : rule.answers.filter((_, j) => j !== i) })} />
              ))}
              {rule.form.map((c, i) => (
                <FormRow key={c.id} c={c} fields={catalog} onMissing={() => setMissing("")} onChange={(next) => set({ form: next ? rule.form.map((x, j) => (j === i ? next : x)) : rule.form.filter((_, j) => j !== i) })} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            {rule.blocks.length > 0 && (
              <AddMenu
                label="Another visit"
                items={[
                  { label: "Another visit (also required)", hint: "A separate visit that must also have happened, in any order", onClick: () => set({ blocks: [...rule.blocks, newBlock({ kind: "any" })] }) },
                  { label: "A page in the visit they sent the form in", onClick: addPage },
                ]}
              />
            )}
            {!rule.blocks.length && (
              <>
                <button type="button" onClick={addVisit} className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="size-3" /> Visit condition
                </button>
                <button type="button" onClick={addPage} className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="size-3" /> Page condition
                </button>
              </>
            )}
            <AddMenu label="Form condition" items={formItems} />
          </div>
        </>
      )}

      {missing !== null && <FieldNamingHelp asked={missing || "that field"} known={catalog} onClose={() => setMissing(null)} />}
    </div>
  );
}
