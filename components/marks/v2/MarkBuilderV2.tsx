"use client";
// components/marks/v2/MarkBuilderV2.tsx
// The builder for new marks (marks v2): two faces like the old one. "Enter with AI" first for a new mark, "Enter
// manually" shows the editor (./RuleEditor.tsx). Then the mark's name, purpose, colour, who sees it, on/off, Save.
// Old marks (made with the chip keys) keep opening in components/marks/MarkBuilder.tsx's old builder.
import * as React from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { describeRuleV2, isRuleV2, RuleV2Error, validateRuleV2, type MarkRuleV2 } from "@/jh-marks/v2/rule";
import { MARK_COLORS } from "@/jh-marks/rule";
import { saveMark, type MarkView, type TeamMember, type Visibility } from "@/lib/actions/marks.action";
import { markFromAiV2 } from "@/lib/actions/marksAi.action";
import { loadFormFields } from "@/lib/actions/formFields.action";
import type { CatalogField } from "@/lib/forms/catalog";
import { FieldNamingHelp } from "@/components/forms/FieldNamingHelp";
import { RuleEditor } from "./RuleEditor";
import type { BuilderInitial } from "../MarkBuilder";

const AI_EXAMPLES = [
  'Read "Pricing plans" for 20 seconds, then went straight to the contact page',
  "Came back 3 or more times and their budget is over $5,000",
  "Filled the form in under a minute, with no hesitation on the budget field",
  "First found us on Google, later read the case studies",
];

export function MarkBuilderV2({ initial, pages, team, me, onSaved, onCancel }: { initial: BuilderInitial; pages: string[]; team: TeamMember[]; me: string; onSaved: (m: MarkView, warning?: string) => void; onCancel: () => void }) {
  const [rule, setRule] = React.useState<MarkRuleV2>(() => (isRuleV2(initial.rule) ? initial.rule : { v: 2, blocks: [], answers: [], form: [] }));
  const empty = !rule.blocks.length && !rule.answers.length && !rule.form.length;
  const [face, setFace] = React.useState<"ai" | "manual">(empty ? "ai" : "manual");
  const [fields, setFields] = React.useState<CatalogField[] | null>(null);
  const [name, setName] = React.useState(initial.name);
  const [description, setDescription] = React.useState(initial.description);
  const [color, setColor] = React.useState(initial.color);
  const [active, setActive] = React.useState(initial.active);
  const [visibility, setVisibility] = React.useState<Visibility>(initial.visibility);
  const [sharedWith, setSharedWith] = React.useState<string[]>(initial.sharedWith);
  const [ai, setAi] = React.useState("");
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiNote, setAiNote] = React.useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [missingField, setMissingField] = React.useState<string | null>(null);
  const [undo, setUndo] = React.useState<MarkRuleV2 | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadFormFields().then((r) => setFields(r.ok ? r.fields : []));
  }, []);

  const check = React.useMemo(() => {
    if (empty) return { reads: [] as string[], problem: "Add at least one condition." };
    try {
      const v = validateRuleV2(rule);
      const blank = (b: MarkRuleV2["blocks"][number]): boolean => !!b.pages?.steps.some((s) => !s.path || s.path === "/") || b.then.some(blank);
      if (rule.blocks.some(blank)) return { reads: describeRuleV2(v), problem: "Type the address of every page." };
      return { reads: describeRuleV2(v), problem: null as string | null };
    } catch (e) {
      return { reads: [] as string[], problem: e instanceof RuleV2Error ? e.message : "Something is not right." };
    }
  }, [rule, empty]);

  const runAi = async () => {
    if (!ai.trim() || aiBusy) return;
    setAiBusy(true);
    setAiNote(null);
    const res = await markFromAiV2(ai);
    setAiBusy(false);
    if (!res.ok) return setAiNote({ tone: "error", text: res.error });
    const r = res.result;
    if (r.status === "ok") {
      setUndo(rule);
      setRule(r.rule);
      setFace("manual");
      if (!name.trim() && r.name) setName(r.name);
      if (!description.trim() && r.purpose) setDescription(r.purpose);
      setAiNote({ tone: "info", text: r.assumptions.length ? "Assumed: " + r.assumptions.join("; ") : "Done. Check it below, then save." });
    } else if (r.status === "missingField") {
      // a field they named is not on their forms: the popup offers naming it, or the docs
      setMissingField(r.field);
      setAiNote({ tone: "error", text: r.reason });
    } else setAiNote({ tone: r.status === "clarify" ? "info" : "error", text: r.status === "clarify" ? r.question : r.reason });
  };

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
  const others = team.filter((m) => m.userId !== me);

  const aiBox = (
    <>
      <div className="jh-ai-glow rounded-xl p-[1.5px]">
        <textarea
          value={ai}
          onChange={(e) => setAi(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              runAi();
            }
          }}
          rows={4}
          maxLength={400}
          placeholder='e.g. Read "Pricing plans" for 20 seconds, then went to the contact page, and their budget is over $3,000'
          aria-label="Describe the leads to mark"
          className="relative block w-full resize-none rounded-[10px] bg-background p-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">Put section names in quotes, for example &quot;Hero&quot; or &quot;Pricing plans&quot;, so they are not mixed up with the rest of the sentence.</p>
    </>
  );

  return (
    <div className="space-y-3">
      <div className="[perspective:1600px]">
        <div className={"grid transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none " + (face === "manual" ? "[transform:rotateY(180deg)]" : "")}>
          {/* face 1: Enter with AI */}
          <div className="flex flex-col rounded-[1.4rem] border bg-muted/50 p-2.5 shadow-inner [backface-visibility:hidden] [grid-area:1/1]" inert={face !== "ai"} aria-hidden={face !== "ai"}>
            <div className="flex flex-1 flex-col gap-3 rounded-2xl border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Enter with AI</h3>
              </div>
              <p className="text-xs text-muted-foreground">Describe the leads you want marked, in your own words.</p>
              {aiBox}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Try one</div>
                <div className="flex flex-wrap gap-1.5">
                  {AI_EXAMPLES.map((x) => (
                    <button key={x} type="button" onClick={() => setAi(x)} className="rounded-full border bg-muted/40 px-2.5 py-1 text-left text-[11px] text-foreground hover:border-primary/50 hover:bg-primary/10">
                      {x}
                    </button>
                  ))}
                </div>
              </div>
              {aiNote && <p className={"text-xs " + (aiNote.tone === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{aiNote.text}</p>}
              <button type="button" onClick={runAi} disabled={!ai.trim() || aiBusy} className="mt-auto flex h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-40">
                {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {aiBusy ? "Building..." : "Build the mark"}
              </button>
            </div>
            <button type="button" onClick={() => setFace("manual")} className="mx-auto mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
              Enter manually <ArrowRight className="size-3" />
            </button>
          </div>

          {/* face 2: Enter manually */}
          <div className="rounded-[1.4rem] border bg-muted/50 p-2.5 shadow-inner [backface-visibility:hidden] [grid-area:1/1] [transform:rotateY(180deg)]" inert={face !== "manual"} aria-hidden={face !== "manual"}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Enter manually</span>
              <button type="button" onClick={() => setFace("ai")} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10">
                <Sparkles className="size-3" /> Enter with AI
              </button>
            </div>
            <div className="rounded-2xl border bg-background p-3 shadow-sm">
              <RuleEditor rule={rule} onChange={setRule} pages={pages} fields={fields} />
            </div>
            {aiNote && face === "manual" && (
              <p className={"mt-2 px-1 text-[11px] " + (aiNote.tone === "error" ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                {aiNote.text}
                {undo && (
                  <button
                    type="button"
                    className="ml-2 underline underline-offset-2"
                    onClick={() => {
                      setRule(undo);
                      setUndo(null);
                      setAiNote(null);
                    }}
                  >
                    Undo
                  </button>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {check.reads.length > 0 && (
        <div className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
          {check.reads.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name, e.g. Pricing reader" className="h-8 w-full rounded-md border bg-background px-2 text-sm" aria-label="Name" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} placeholder="Purpose, in plain words: who these leads are and what to do with them (the AI fills this in)" className="w-full resize-none rounded-md border bg-background p-2 text-xs" />
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
                <input type="radio" name="vis2" checked={visibility === v} onChange={() => setVisibility(v)} className="size-3" />
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
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted">
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving || empty} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {initial.id ? "Save" : "Save mark"}
        </button>
      </div>

      {missingField !== null && <FieldNamingHelp asked={missingField} known={fields ?? []} onClose={() => setMissingField(null)} />}
    </div>
  );
}
