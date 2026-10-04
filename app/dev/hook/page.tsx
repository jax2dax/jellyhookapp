// app/dev/hook/page.tsx
// Developer test bench for the Hook engine (jh-hook/). Builds a HookSpec
// with the recursive builder (components/hook/HookBuilder.tsx), runs it
// against the signed-in user's current site, and shows the answer beside
// what the engine did (order, estimates, tunnels, cost, SQL). The spec is
// the state and lives in the URL (?q=), so any query is shareable.
// See jh-hook/ui-ux.md.
"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SEL, SpecEditor } from "@/components/hook/HookBuilder";
import { describeCondition, describeSpec } from "@/jh-hook/describe";
import type { FieldType } from "@/jh-hook/schema";
import type { HookResult, HookSpec } from "@/jh-hook/types";
import { formatMs } from "@/jh-hook/units";
import { runHookAction } from "@/lib/actions/hook.action";

function encodeSpec(s: HookSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeSpec(q: string): HookSpec | null {
  try {
    const bin = atob(q.replace(/-/g, "+").replace(/_/g, "/"));
    const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return j?.v === 2 ? (j as HookSpec) : null;
  } catch {
    return null;
  }
}

const DEFAULT_SPEC: HookSpec = { v: 2, entity: "pageView", where: [], output: { kind: "count" } };

function formatValue(v: number | string | null, t: FieldType): string {
  if (v == null) return "empty";
  if (typeof v === "string") return t === "time" ? new Date(v).toLocaleString() : v;
  if (t === "duration") return formatMs(v);
  if (t === "percent") return `${+v.toFixed(2)}%`;
  if (t === "px") return `${Math.round(v)} px`;
  return Number.isInteger(v) ? v.toLocaleString() : (+v.toFixed(4)).toLocaleString();
}

export default function HookPage() {
  const [spec, setSpec] = useState<HookSpec>(DEFAULT_SPEC);
  const [result, setResult] = useState<HookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // spec <- URL once (the address bar is an external system), then URL <- spec
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    const s = q ? decodeSpec(q) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s) setSpec(s);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("q", encodeSpec(spec));
    window.history.replaceState(null, "", url);
  }, [spec]);

  const run = async () => {
    setRunning(true);
    setError(null);
    const res = await runHookAction(spec);
    if (res.ok) setResult(res.result);
    else {
      setResult(null);
      setError(res.error);
    }
    setRunning(false);
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

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Hook</h1>
        <p className="text-sm text-muted-foreground">Test bench. Runs against your current site only.</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <SpecEditor spec={spec} onChange={setSpec} />
          <p className="mt-3 text-xs text-muted-foreground">Reads as: {describeSpec(spec)}</p>
        </CardContent>
      </Card>

      {spec.where.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Order of the top-level conditions</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <select className={SEL} value={spec.order?.mode ?? "auto"} onChange={(e) => setSpec((s) => ({ ...s, order: { ...(s.order ?? {}), mode: e.target.value as "auto" | "manual", steps: orderIds } }))}>
                <option value="auto">Auto: the engine picks the cheapest order</option>
                <option value="manual">Manual: I pick the order</option>
              </select>
              {spec.order?.mode === "manual" && (
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={spec.order.guard !== false} onChange={(e) => setSpec((s) => ({ ...s, order: { ...s.order!, guard: e.target.checked } }))} />
                  guard (the engine may override an order that is 10x worse)
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
                      <span className="flex-1">{describeCondition(c, spec.entity)}</span>
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

      <Button onClick={run} disabled={running}>{running ? "Running..." : "Run hook"}</Button>
      {error && <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}
      {result && <ResultPanel r={result} spec={spec} />}
    </div>
  );
}

function ResultPanel({ r, spec }: { r: HookResult; spec: HookSpec }) {
  const a = r.answer;
  const maxRow = a.shape === "table" ? Math.max(1, ...a.rows.map((x) => (typeof x.value === "number" ? x.value : 0))) : 1;
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Result</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {a.shape === "one" && <div className="text-4xl font-semibold">{formatValue(a.value, a.type)}</div>}
        {a.shape === "list" && (
          <div>
            <div className="mb-1 text-2xl font-semibold">{a.values.length.toLocaleString()}{a.truncated ? "+" : ""} values</div>
            <div className="max-h-48 overflow-auto rounded border p-2 font-mono text-xs whitespace-pre">{a.values.map((v) => formatValue(v, a.type)).join("\n")}</div>
          </div>
        )}
        {a.shape === "table" && (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <tbody>
                {a.rows.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 pr-3 whitespace-nowrap">{row.key == null ? "(empty)" : formatValue(row.key, a.keyType)}</td>
                    <td className="w-full py-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded bg-primary/60" style={{ width: `${(100 * (typeof row.value === "number" ? row.value : 0)) / maxRow}%` }} />
                        <span className="whitespace-nowrap">{formatValue(row.value, a.valueType)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>{r.cost.credits} credit{r.cost.credits === 1 ? "" : "s"} (pg cost {r.cost.pgCost})</span>
          <span>plan {r.timing.planMs} ms</span>
          <span>run {r.timing.execMs} ms</span>
          <span>strategy: {r.plan.strategy}</span>
        </div>
        {r.plan.steps.length > 0 && (
          <div>
            <div className="mb-1 font-medium">What the engine did</div>
            <ol className="list-decimal space-y-0.5 pl-5">
              {r.plan.steps.map((s) => <li key={s.id}>{s.label} <span className="text-muted-foreground">(about {s.estRows} rows alone)</span></li>)}
            </ol>
          </div>
        )}
        {r.plan.notes.map((n, i) => <p key={i} className="text-xs text-muted-foreground">{n}</p>)}
        {r.tunnels.length > 0 && (
          <div className="text-xs">
            <div className="mb-1 font-medium">Sub-hooks (tunnels)</div>
            {r.tunnels.map((t) => (
              <p key={t.path} className="text-muted-foreground">
                {t.path}: {t.label} = {t.shape === "one" ? formatValue(t.sample[0] != null ? Number(t.sample[0]) : null, t.type) : `${t.count} values (${t.sample.slice(0, 5).join(", ")}${t.count > 5 ? ", ..." : ""})`}
              </p>
            ))}
          </div>
        )}
        <details><summary className="cursor-pointer text-xs">Compiled SQL</summary><pre className="mt-1 overflow-auto rounded border p-2 text-xs">{r.sql}</pre></details>
        <details><summary className="cursor-pointer text-xs">Spec (the Hook language)</summary><pre className="mt-1 overflow-auto rounded border p-2 text-xs">{JSON.stringify(spec, null, 2)}</pre></details>
      </CardContent>
    </Card>
  );
}
