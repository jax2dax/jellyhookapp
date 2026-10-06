// lib/actions/canvas.action.ts
// Server entry points for the results canvas: run a hook AND render its
// result through the output engine (output/), load more items of a list
// view from sealed tokens, and compare two hooks. Same site rule and error
// policy as every Hook action (lib/hook/site.ts).
//
// What reaches the browser: views made of people, sessions, pages and
// numbers. Raw ids (the "a list of ..." output) and the SQL are stripped
// unless the caller is the developer bench (raw: true), which only ever
// shows the caller their own site's data anyway.
"use server";

import { migrateSpec } from "@/jh-hook/migrate";
import { runHook } from "@/jh-hook/engine/run";
import { hookLog } from "@/jh-hook/debug";
import type { HookResult, HookSpec } from "@/jh-hook/types";
import { pgHookDb } from "@/lib/hook/pgDb";
import { failure, siteOrThrow, type Failure } from "@/lib/hook/site";
import { compareHooks, loadMore, renderCanvas } from "@/output/server/render";
import type { CanvasView, Formula, ListKind } from "@/output/types";

const MAX_CREDITS = Number(process.env.HOOK_MAX_CREDITS ?? 200);

export type CanvasRunResponse =
  | { ok: true; result: HookResult; canvas: CanvasView | null; canvasError?: string; credits: number }
  | Failure;

export async function runHookCanvas(input: HookSpec, opts: { raw?: boolean } = {}): Promise<CanvasRunResponse> {
  const t0 = Date.now();
  let siteId = "";
  try {
    siteId = await siteOrThrow();
    const { spec } = migrateSpec(input);
    const result = await runHook(pgHookDb, siteId, spec, { maxCredits: MAX_CREDITS });
    let canvas: CanvasView | null = null;
    let canvasError: string | undefined;
    const ct = Date.now();
    try {
      canvas = await renderCanvas(siteId, spec, result, { maxCredits: MAX_CREDITS });
    } catch (e) {
      // the answer is still good; only the drawing failed
      const f = failure(e, { what: "canvas render", siteId, t0: ct });
      canvasError = f.error;
    }
    const baseCredits = canvas?.kind === "number" && canvas.base ? result.cost.credits : 0; // the base rate is the same measure over everything
    console.info(
      "[hook] canvas",
      JSON.stringify({
        site: siteId.slice(0, 8),
        entity: spec.entity,
        output: spec.output.kind,
        view: canvas?.kind ?? "failed",
        credits: result.cost.credits + baseCredits,
        runMs: result.timing.planMs + result.timing.execMs,
        canvasMs: Date.now() - ct,
      }),
    );
    const safe: HookResult = opts.raw
      ? result
      : {
          ...result,
          sql: "",
          // a list of the rows themselves: the canvas shows them; raw ids stay on the server
          answer: spec.output.kind === "ids" && result.answer.shape === "list" ? { ...result.answer, values: [] } : result.answer,
        };
    return { ok: true, result: safe, canvas, canvasError, credits: result.cost.credits + baseCredits };
  } catch (e) {
    return failure(e, { what: "run", siteId, t0 });
  }
}

export type LoadMoreResponse = { ok: true; items: unknown[] } | Failure;

export async function loadMoreCanvas(input: HookSpec, kind: ListKind, tokens: string[]): Promise<LoadMoreResponse> {
  const t0 = Date.now();
  let siteId = "";
  try {
    siteId = await siteOrThrow();
    const { spec } = migrateSpec(input);
    const items = await loadMore(siteId, spec, kind, tokens);
    hookLog.debug("canvas load more", { kind, n: items.length, ms: Date.now() - t0 });
    return { ok: true, items };
  } catch (e) {
    return failure(e, { what: "load more", siteId, t0 });
  }
}

export type CompareResponse = { ok: true; canvas: CanvasView; credits: number } | Failure;

export async function compareHooksAction(a: HookSpec, b: HookSpec, formula: Formula): Promise<CompareResponse> {
  const t0 = Date.now();
  let siteId = "";
  try {
    siteId = await siteOrThrow();
    const { view, credits } = await compareHooks(siteId, migrateSpec(a).spec, migrateSpec(b).spec, formula, { maxCredits: MAX_CREDITS });
    console.info("[hook] compare", JSON.stringify({ site: siteId.slice(0, 8), formula, credits, ms: Date.now() - t0 }));
    return { ok: true, canvas: view, credits };
  } catch (e) {
    return failure(e, { what: "compare", siteId, t0 });
  }
}
