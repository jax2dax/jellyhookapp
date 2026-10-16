"use client";
// components/marks/SaveAsMark.tsx
// "Save as mark" in Hook: a query on leads becomes a mark, shown as a badge on the leads page. Only a query that
// returns leads can be one (the button says so otherwise). The mark keeps the query; it is edited in Hook, not in the
// chip builder. Server side: lib/actions/marks.action.ts saveMark.
import { Bookmark, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { HookSpec } from "@/jh-hook/types";
import { colorFor, MARK_COLORS } from "@/jh-marks/rule";
import { saveMark } from "@/lib/actions/marks.action";

export function SaveAsMark({ spec }: { spec: HookSpec }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(MARK_COLORS[0]);
  const [notes, setNotes] = useState("");
  const [team, setTeam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const onLeads = spec.entity === "lead";

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await saveMark({ name, color, description: notes, active: true, visibility: team ? "team" : "private", spec });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: `Saved. ${r.mark.matchCount ?? 0} lead${r.mark.matchCount === 1 ? "" : "s"} have it.` + (r.warning ? " " + r.warning : "") });
  };

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!onLeads}
        onClick={() => setOpen((o) => !o)}
        title={onLeads ? "Keep this question as a mark: matching leads get a badge" : "Only a question about leads (form submissions) can be a mark"}
        className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Bookmark className="size-3.5" /> Save as mark
      </button>
      {open && onLeads && (
        <div className="absolute right-0 top-10 z-30 w-72 space-y-2.5 rounded-lg border bg-popover p-3 shadow-lg">
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!msg) setColor(colorFor(e.target.value || "x"));
            }}
            maxLength={40}
            placeholder="Name, e.g. Pricing reader"
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          />
          <div className="flex gap-1.5">
            {MARK_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={"size-5 rounded-full " + (color === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover" : "")} style={{ backgroundColor: c }} aria-label={c} />
            ))}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Notes (optional)" className="w-full resize-none rounded-md border bg-background p-2 text-xs" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={team} onChange={(e) => setTeam(e.target.checked)} className="size-3" />
            Share with the team
          </label>
          {msg && (
            <p className={"text-xs " + (msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
              {msg.text} {msg.ok && <Link href="/platform/leads" className="underline underline-offset-2">See the leads</Link>}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted">
              Close
            </button>
            <button type="button" onClick={save} disabled={busy || !name.trim()} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy && <Loader2 className="size-3.5 animate-spin" />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
