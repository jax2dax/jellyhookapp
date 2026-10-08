// components/hook/HookWorkspace.tsx
// The whole Hook workspace:
//   header (Copy link, </> code panel)
//   builder (+ optional Hook B and a formula, for comparisons)
//   run order, Run
//   the CANVAS: the result drawn by the output engine (output/), then how
//   it ran
//   the silhouette preview in a sticky right-hand column.
// Used by both pages:
//   /platform/hook  mode="product"  the product. No SQL, no raw ids.
//   /dev/hook       mode="dev"      the test bench. Also the SQL, the
//                                   Postgres cost and raw ids.
// The query is the only state that matters; it lives in the URL (?q=), and
// older queries are upgraded on the way in (jh-hook/migrate.ts). Everything
// a person should know about (a run, an upgrade, a failure) is announced on
// screen, not only in the console. See jh-hook/ui-ux.md and output/.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEL, SpecEditor, type Announce } from "@/components/hook/HookBuilder";
import { AskHook } from "@/components/hook/AskHook";
import { describeCondition, describeSpec } from "@/jh-hook/describe";
import { hookLog } from "@/jh-hook/debug";
import { migrateSpec } from "@/jh-hook/migrate";
import { SPEC_VERSION, type HookResult, type HookSpec } from "@/jh-hook/types";
import { compareHooksAction, runHookCanvas } from "@/lib/actions/canvas.action";
import { Canvas } from "@/output/components/Canvas";
import { formatValue } from "@/output/format";
import { FORMULA_LABEL, type CanvasView, type Formula } from "@/output/types";
import { SilhouettePanel } from "@/silhouette";

export type WorkspaceMode = "product" | "dev";

function encodeSpec(s: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeSpec(q: string): unknown {
  const bin = atob(q.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

const V = SPEC_VERSION as HookSpec["v"];
const DEFAULT_SPEC: HookSpec = { v: V, entity: "session", where: [], output: { kind: "count" } };
const DEFAULT_B: HookSpec = { v: V, entity: "session", where: [], output: { kind: "count" } };

// ── On-screen announcements ─────────────────────────────────────────────
type Notice = { id: number; tone: "info" | "success" | "error"; text: string };
function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    setNotices((n) => n.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);
  const announce: Announce = useCallback(
    (tone, text) => {
      const id = next.current++;
      setNotices((n) => [...n.slice(-3), { id, tone, text }]); // at most 4 on screen
      timers.current.set(id, setTimeout(() => dismiss(id), tone === "error" ? 9000 : 5000));
    },
    [dismiss],
  );
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  return { notices, announce, dismiss };
}

function Notices({ notices, dismiss }: { notices: Notice[]; dismiss: (id: number) => void }) {
  const tone = { info: "border-sky-500/40 bg-sky-500/10", success: "border-emerald-500/40 bg-emerald-500/10", error: "border-red-500/50 bg-red-500/10" };
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite" role="status">
      {notices.map((n) => (
        <div key={n.id} className={`pointer-events-auto flex items-start gap-2 rounded-md border bg-background/90 p-3 text-sm shadow-md backdrop-blur ${tone[n.tone]}`}>
          <span className="flex-1">{n.text}</span>
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => dismiss(n.id)} aria-label="Dismiss">
            x
          </button>
        </div>
      ))}
    </div>
  );
}

/** What the last run produced: a single-hook result with its canvas, or a comparison. */
type Outcome =
  | { kind: "run"; spec: HookSpec; r: HookResult; canvas: CanvasView | null; canvasError?: string; credits: number }
  | { kind: "compare"; spec: HookSpec; b: HookSpec; canvas: CanvasView; credits: number };

export function HookWorkspace({ mode }: { mode: WorkspaceMode }) {
  const dev = mode === "dev";
  const [spec, setSpec] = useState<HookSpec>(DEFAULT_SPEC);
  const [compare, setCompare] = useState<{ b: HookSpec; formula: Formula } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const { notices, announce, dismiss } = useNotices();

  /** Upgrades and loads a query from anywhere (URL, paste). Returns false if it can't be read. */
  const load = useCallback(
    (raw: unknown, source: string): boolean => {
      try {
        const m = migrateSpec(raw);
        setSpec(m.spec);
        setOutcome(null);
        setError(null);
        if (m.upgradedFrom) announce("info", `This query was saved in an older format (v${m.upgradedFrom}) and was upgraded. ${m.notes.join(" ")}`.trim());
        hookLog.info("query loaded", { source, upgradedFrom: m.upgradedFrom });
        return true;
      } catch (e) {
        announce("error", `Couldn't load the query from the ${source}: ${e instanceof Error ? e.message : "unreadable"}`);
        hookLog.warn("query load failed", { source, error: e });
        return false;
      }
    },
    [announce],
  );

  // query <- URL once (the address bar is an external system), then URL <- query
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (!q) return;
    let raw: unknown;
    try {
      raw = decodeSpec(q);
    } catch {
      announce("error", "The link's query is damaged and couldn't be read. Starting with an empty hook.");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL, an external system
    load(raw, "link");
  }, [announce, load]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("q", encodeSpec(spec));
    window.history.replaceState(null, "", url);
  }, [spec]);

  const run = async () => {
    setRunning(true);
    setError(null);
    const t0 = performance.now();
    const ranA = spec;
    const cmp = compare;
    try {
      if (cmp) {
        const res = await compareHooksAction(ranA, cmp.b, cmp.formula);
        const ms = Math.round(performance.now() - t0);
        if (res.ok) {
          setOutcome({ kind: "compare", spec: ranA, b: cmp.b, canvas: res.canvas, credits: res.credits });
          announce("success", `Compared in ${ms} ms, ${res.credits} credit${res.credits === 1 ? "" : "s"}.`);
        } else {
          setOutcome(null);
          setError(res.error);
          announce("error", res.ref ? `The comparison failed (reference ${res.ref}).` : "The comparison can't run as written. See the message under Run.");
        }
        return;
      }
      hookLog.debug("run start", ranA);
      const res = await runHookCanvas(ranA, { raw: dev });
      const ms = Math.round(performance.now() - t0);
      if (res.ok) {
        setOutcome({ kind: "run", spec: ranA, r: res.result, canvas: res.canvas, canvasError: res.canvasError, credits: res.credits });
        hookLog.info("run done", { ms, credits: res.credits, view: res.canvas?.kind });
        announce("success", `Done in ${ms} ms, ${res.credits} credit${res.credits === 1 ? "" : "s"}.`);
        if (res.canvasError) announce("error", "The answer is ready, but the results couldn't be drawn. Details under Run.");
      } else {
        setOutcome(null);
        setError(res.error);
        hookLog.warn("run refused", res);
        announce("error", res.ref ? `The run failed (reference ${res.ref}).` : "The hook can't run as written. See the message under Run.");
      }
    } catch (e) {
      setOutcome(null);
      setError("Couldn't reach the server. Check your connection and try again.");
      hookLog.error("run unreachable", e);
      announce("error", "Couldn't reach the server.");
    } finally {
      setRunning(false);
    }
  };

  const loadPasted = () => {
    let raw: unknown;
    try {
      raw = JSON.parse(pasted);
    } catch {
      announce("error", "That isn't valid JSON. Paste the query exactly as copied.");
      return;
    }
    if (load(raw, "pasted text")) {
      announce("success", "Query loaded into the builder.");
      setCodeOpen(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      announce("success", "Link copied. Anyone with access to a site can open it against their own site.");
    } catch {
      announce("error", "Couldn't copy. Copy the address bar instead.");
    }
  };

  const orderIds = useMemo(() => {
    const have = spec.where.map((c) => c.id);
    const mine = (spec.order?.steps ?? []).filter((id) => have.includes(id));
    return [...mine, ...have.filter((id) => !mine.includes(id))];
  }, [spec.where, spec.order]);
  const move = (id: string, d: -1 | 1) => {
    const a = [...orderIds];
    const i = a.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setSpec((s) => ({ ...s, order: { ...(s.order ?? { mode: "manual" }), mode: "manual", steps: a } }));
  };

  const stale = outcome && (outcome.spec !== spec || (outcome.kind === "compare" ? !compare || outcome.b !== compare.b : !!compare));

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 p-4 md:p-6">
      <Notices notices={notices} dismiss={dismiss} />
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold">Hook{dev ? " (test bench)" : ""}</h1>
          <p className="text-sm text-muted-foreground">
            {dev ? "Runs against your current site only. Shows the SQL and raw ids." : "Ask precise questions about your visitors, sessions, leads and forms."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copyLink} title="Copy a link to this query">Copy link</Button>
        <Button variant={codeOpen ? "secondary" : "outline"} size="sm" className="font-mono" onClick={() => setCodeOpen((o) => !o)} aria-expanded={codeOpen} title="Paste or copy the query as code">
          &lt;/&gt;
        </Button>
      </div>

      {codeOpen && (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <textarea
              className="h-40 w-full rounded-md border bg-background p-2 font-mono text-xs"
              placeholder='Paste a query (the JSON from "The query" under a result), then Load. The builder rebuilds itself from it.'
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={loadPasted} disabled={!pasted.trim()}>Load into builder</Button>
              <Button variant="outline" size="sm" onClick={() => setPasted(JSON.stringify(spec, null, 2))}>Show the current query here</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Card>
            {compare && <CardHeader className="pb-0"><CardTitle className="text-sm">Hook A</CardTitle></CardHeader>}
            <CardContent className="pt-4">
              <SpecEditor spec={spec} onChange={setSpec} root announce={announce} />
              <p className="mt-3 text-xs text-muted-foreground">Reads as: {describeSpec(spec)}</p>
            </CardContent>
          </Card>

          {compare ? (
            <Card>
              <CardHeader className="pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-sm">Hook B</CardTitle>
                  <span className="text-xs text-muted-foreground">Both hooks must return one number.</span>
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCompare(null)}>Stop comparing</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <SpecEditor spec={compare.b} onChange={(b) => setCompare((c) => (c ? { ...c, b } : c))} />
                <p className="text-xs text-muted-foreground">Reads as: {describeSpec(compare.b)}</p>
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Result</span>
                  <select className={SEL} value={compare.formula} onChange={(e) => setCompare((c) => (c ? { ...c, formula: e.target.value as Formula } : c))}>
                    {(Object.keys(FORMULA_LABEL) as Formula[]).map((f) => <option key={f} value={f}>{FORMULA_LABEL[f]}</option>)}
                  </select>
                </label>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCompare({ b: DEFAULT_B, formula: "percent" })} title="Run two hooks side by side and combine their numbers">
              Compare with another hook
            </Button>
          )}

          {!compare && spec.where.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Run order</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <select className={SEL} value={spec.order?.mode ?? "auto"} onChange={(e) => setSpec((s) => ({ ...s, order: { ...(s.order ?? {}), mode: e.target.value as "auto" | "manual", steps: orderIds } }))}>
                    <option value="auto">Auto: the engine picks the fastest order</option>
                    <option value="manual">Manual: I pick the order</option>
                  </select>
                  {spec.order?.mode === "manual" && (
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={spec.order.guard !== false} onChange={(e) => setSpec((s) => ({ ...s, order: { ...s.order!, guard: e.target.checked } }))} />
                      Let the engine step in if my order is much slower (10x or more)
                    </label>
                  )}
                </div>
                {spec.order?.mode === "manual" && (
                  <ol className="space-y-1">
                    {orderIds.map((id, i) => {
                      const c = spec.where.find((x) => x.id === id)!;
                      return (
                        <li key={id} className="flex items-center gap-2">
                          <span className="w-5 text-muted-foreground">{i + 1}.</span>
                          <span className="flex-1">{c.meta?.name ?? describeCondition(c, spec.entity)}</span>
                          <Button variant="ghost" size="sm" onClick={() => move(id, -1)}>Up</Button>
                          <Button variant="ghost" size="sm" onClick={() => move(id, 1)}>Down</Button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={running}>{running ? "Running..." : compare ? "Run comparison" : "Run hook"}</Button>
            {stale && <span className="text-xs text-muted-foreground">The hook changed since the last run.</span>}
          </div>
          {error && <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
          {outcome && <ResultPanel outcome={outcome} dev={dev} announce={announce} />}
        </div>

        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="space-y-3">
    <AskHook
            spec={spec}
            announce={announce}
            onApply={(s) => {
              setSpec(s);
              setOutcome(null);
              setError(null);
            }}
          />
            <SilhouettePanel spec={spec} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ outcome, dev, announce }: { outcome: Outcome; dev: boolean; announce: Announce }) {
  if (outcome.kind === "compare") {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Comparison</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Canvas view={outcome.canvas} spec={outcome.spec} announce={announce} />
          <p className="text-xs text-muted-foreground">{outcome.credits} credits (both hooks)</p>
        </CardContent>
      </Card>
    );
  }
  const { r, spec, canvas, canvasError } = outcome;
  const a = r.answer;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Result</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {canvas ? (
          <Canvas view={canvas} spec={spec} announce={announce} />
        ) : (
          <div className="space-y-1">
            {a.shape === "one" && <div className="text-4xl font-semibold">{formatValue(a.value, a.type)}</div>}
            {canvasError && <p className="text-xs text-red-500">The results couldn&apos;t be drawn: {canvasError}</p>}
          </div>
        )}
        <div className="flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span>{outcome.credits} credit{outcome.credits === 1 ? "" : "s"}</span>
          <span>plan {r.timing.planMs} ms</span>
          <span>run {r.timing.execMs} ms</span>
          <span>{r.plan.strategy === "staged" ? "ran step by step" : "ran in one pass"}</span>
        </div>
        <details>
          <summary className="cursor-pointer text-xs">How it ran</summary>
          <div className="mt-1 space-y-1 text-xs">
            {r.plan.steps.length > 0 && (
              <ol className="list-decimal space-y-0.5 pl-5">
                {r.plan.steps.map((s) => <li key={s.id}>{s.label} <span className="text-muted-foreground">(about {s.estRows} rows alone)</span></li>)}
              </ol>
            )}
            {r.plan.notes.map((n, i) => <p key={i} className="text-muted-foreground">{n}</p>)}
            {r.tunnels.length > 0 && (
              <div>
                <div className="font-medium">Tunnels: what flowed in from sub-hooks</div>
                {r.tunnels.map((t) => (
                  <p key={t.path} className="text-muted-foreground">
                    {t.path}: {t.label} = {t.shape === "one" ? formatValue(t.sample[0] != null ? Number(t.sample[0]) : null, t.type) : `${t.count} values`}
                  </p>
                ))}
              </div>
            )}
          </div>
        </details>
        {dev && a.shape === "list" && a.values.length > 0 && (
          <details>
            <summary className="cursor-pointer text-xs">For developers: the raw values ({a.values.length})</summary>
            <div className="mt-1 max-h-48 overflow-auto whitespace-pre rounded border p-2 font-mono text-xs">{a.values.join("\n")}</div>
          </details>
        )}
        {dev && r.sql && (
          <details>
            <summary className="cursor-pointer text-xs">For developers: the SQL it ran</summary>
            <pre className="mt-1 overflow-auto rounded border p-2 text-xs">{r.sql}</pre>
            <p className="mt-1 text-xs text-muted-foreground">Postgres cost {r.cost.pgCost}</p>
          </details>
        )}
        <details>
          <summary className="cursor-pointer text-xs">The query (the saved definition, paste it back to reload)</summary>
          <pre className="mt-1 overflow-auto rounded border p-2 text-xs">{JSON.stringify(spec, null, 2)}</pre>
        </details>
      </CardContent>
    </Card>
  );
}
