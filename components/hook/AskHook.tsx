// components/hook/AskHook.tsx
// "Ask Hook": type a question in your own words and the builder fills itself in. It never runs the query:
// the person reads "Reads as", checks it, edits it if they like, and presses Run, exactly as for a query they
// built by hand. Undo puts the previous query back. See mds/build/ai-hook-translate/.
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Announce } from "@/components/hook/HookBuilder";
import { hookLog } from "@/jh-hook/debug";
import type { HookSpec } from "@/jh-hook/types";
import { askHookAction, askHookStatus } from "@/lib/actions/hookAi.action";

const MAX_BOX = 160; // px: the card grows with the text up to this height, then the input scrolls

const EXAMPLES = ["How many sessions from google read the pricing page and didn't convert?", "Which form field do people give up on most?", "Leads per day over the last 30 days"];

type Shown =
  | { kind: "ok"; reads: string; assumptions: string[]; credits: number }
  | { kind: "clarify"; question: string }
  | { kind: "unsupported"; reason: string }
  | { kind: "error"; text: string };

export function AskHook({ spec, onApply, announce }: { spec: HookSpec; onApply: (s: HookSpec) => void; announce: Announce }) {
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [status, setStatus] = useState<{ available: boolean; usedToday: number; limitToday: number } | null>(null);
  const [adjust, setAdjust] = useState(true);
  const [info, setInfo] = useState(false);
  const before = useRef<HookSpec | null>(null);
  const asked = useRef("");
  const box = useRef<HTMLTextAreaElement>(null);

  // the box grows with what is typed, up to its max height, then scrolls
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    const full = el.scrollHeight + 2;
    el.style.height = Math.min(full, MAX_BOX) + "px";
    el.style.overflowY = full > MAX_BOX ? "auto" : "hidden"; // scrollbar only once the card stops growing
  }, [text]);

  useEffect(() => {
    let live = true;
    askHookStatus()
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ available: false, usedToday: 0, limitToday: 0 }));
    return () => {
      live = false;
    };
  }, []);

  const builderIsEmpty = spec.where.length === 0 && spec.entity === "session" && spec.output.kind === "count";

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setShown(null);
    try {
      const res = await askHookAction(q, adjust && !builderIsEmpty ? spec : null);
      if (!res.ok) {
        setShown({ kind: "error", text: res.error });
        hookLog.warn("ask refused", res);
        return;
      }
      setStatus((s) => (s ? { ...s, usedToday: res.usage.usedToday, limitToday: res.usage.limitToday } : s));
      const r = res.result;
      if (r.status === "ok") {
        before.current = spec;
        onApply(r.spec);
        setShown({ kind: "ok", reads: r.reads, assumptions: r.assumptions, credits: res.usage.credits });
        announce("success", "Filled in the builder. Check the query, then press Run.");
        setAnswer("");
      } else if (r.status === "clarify") {
        asked.current = q;
        setShown({ kind: "clarify", question: r.question });
      } else if (r.status === "unsupported") {
        setShown({ kind: "unsupported", reason: r.reason });
      } else {
        setShown({ kind: "error", text: r.reason });
      }
    } catch (e) {
      hookLog.error("ask unreachable", e);
      setShown({ kind: "error", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  const undo = () => {
    if (!before.current) return;
    onApply(before.current);
    before.current = null;
    setShown(null);
    announce("info", "Put the previous query back.");
  };

  if (status && !status.available) return null; // not configured: the builder works exactly as before

  const left = status ? Math.max(0, status.limitToday - status.usedToday) : null;

  return (
    <div className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 shadow-[0_0_18px_-4px_rgba(16,185,129,0.45)]">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.95)]" aria-hidden="true">
            <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
            <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
          </svg>
          Enter Hook with AI
        </span>
        <div className="relative">
          <button type="button" aria-label="About Enter Hook with AI" aria-expanded={info} onClick={() => setInfo((v) => !v)} className="flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500/50 text-[11px] italic text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
            i
          </button>
          {info && (
            <div className="absolute left-0 top-7 z-20 w-72 rounded-md border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-md">
              Describe what you want in your own words. It fills in the builder below; you check it and press Run. Nothing runs by itself.
              <div className="mt-2 text-muted-foreground">Try:</div>
              <ul className="mt-1 space-y-1">
                {EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => {
                        setText(ex);
                        setInfo(false);
                      }}
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
              {left !== null && <div className="mt-2 text-muted-foreground">{left} of {status!.limitToday} questions left today. Each costs a few Hook credits.</div>}
            </div>
          )}
        </div>
        <textarea
          ref={box}
          rows={1}
          className="order-4 min-h-8 min-w-0 flex-1 basis-40 resize-none overflow-y-hidden rounded-md border bg-background px-2 py-1.5 text-sm leading-snug"
          maxLength={600}
          placeholder={"e.g. " + EXAMPLES[0]}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(text);
            }
          }}
          aria-label="Enter Hook with AI"
        />
        {!builderIsEmpty && (
          <label className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title="Change the query already in the builder instead of starting a new one">
            <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
            Edit current
          </label>
        )}
        <Button type="submit" size="sm" className="order-5 bg-emerald-600 text-white hover:bg-emerald-500" disabled={busy || !text.trim() || left === 0}>
          {busy ? "Thinking..." : "Ask"}
        </Button>
      </form>

      {shown?.kind === "ok" && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="text-foreground">Filled in below. Check it, then press Run.</span>
          <span>{shown.credits} credit{shown.credits === 1 ? "" : "s"}</span>
          <button type="button" className="underline-offset-2 hover:underline" onClick={undo}>
            Undo
          </button>
          {shown.assumptions.length > 0 && <span>Assumed: {shown.assumptions.join(" ")}</span>}
        </div>
      )}

      {shown?.kind === "clarify" && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            ask([asked.current, "You asked me: " + shown.question, "My answer: " + answer].join("\n"));
          }}
        >
          <span>{shown.question}</span>
          <input className="h-8 min-w-[10rem] flex-1 rounded-md border bg-background px-2 text-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
          <Button type="submit" size="sm" disabled={busy || !answer.trim()}>
            Answer
          </Button>
        </form>
      )}

      {shown?.kind === "unsupported" && <p className="mt-2 text-xs text-muted-foreground">{shown.reason}</p>}
      {shown?.kind === "error" && <p className="mt-2 text-xs text-destructive">{shown.text}</p>}
    </div>
  );
}
