// components/hook/AskHook.tsx
// "Ask Hook": type a question in your own words and the builder fills itself in. It never runs the query:
// the person reads "Reads as", checks it, edits it if they like, and presses Run, exactly as for a query they
// built by hand. Undo puts the previous query back. See mds/build/ai-hook-translate/.
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Announce } from "@/components/hook/HookBuilder";
import { hookLog } from "@/jh-hook/debug";
import type { HookSpec } from "@/jh-hook/types";
import { askHookAction, askHookStatus } from "@/lib/actions/hookAi.action";

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
  const before = useRef<HookSpec | null>(null);
  const asked = useRef("");

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
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Ask Hook</span>
          <span className="text-xs text-muted-foreground">Describe what you want in your own words. It fills in the builder; you check it and press Run.</span>
          {left !== null && <span className="ml-auto text-xs text-muted-foreground">{left} of {status!.limitToday} questions left today</span>}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <textarea
            className="min-h-[2.5rem] w-full flex-1 resize-y rounded-md border bg-background p-2 text-sm"
            rows={2}
            maxLength={600}
            placeholder={EXAMPLES[0]}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(text);
              }
            }}
            aria-label="Ask Hook"
          />
          <Button type="submit" disabled={busy || !text.trim() || left === 0}>
            {busy ? "Thinking..." : "Ask"}
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {!builderIsEmpty && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={adjust} onChange={(e) => setAdjust(e.target.checked)} />
              Adjust the query below (untick to start from scratch)
            </label>
          )}
          {text === "" &&
            EXAMPLES.map((ex) => (
              <button key={ex} type="button" className="rounded-full border px-2 py-0.5 hover:bg-muted" onClick={() => setText(ex)}>
                {ex}
              </button>
            ))}
        </div>

        {shown?.kind === "ok" && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <div className="text-xs text-muted-foreground">Reads as</div>
            <div>{shown.reads}</div>
            {shown.assumptions.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                {shown.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{shown.credits} credit{shown.credits === 1 ? "" : "s"}</span>
              <button type="button" className="underline-offset-2 hover:underline" onClick={undo}>
                Undo
              </button>
            </div>
          </div>
        )}

        {shown?.kind === "clarify" && (
          <form
            className="space-y-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              ask(`${asked.current}\nYou asked me: ${shown.question}\nMy answer: ${answer}`);
            }}
          >
            <div>{shown.question}</div>
            <div className="flex gap-2">
              <input className="flex-1 rounded-md border bg-background p-2 text-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" aria-label="Your answer" />
              <Button type="submit" size="sm" disabled={busy || !answer.trim()}>
                Answer
              </Button>
            </div>
          </form>
        )}

        {shown?.kind === "unsupported" && <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{shown.reason}</div>}
        {shown?.kind === "error" && <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">{shown.text}</div>}
      </CardContent>
    </Card>
  );
}
