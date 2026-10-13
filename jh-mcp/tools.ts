// jh-mcp/tools.ts
// What each MCP tool does, with no web framework and no database in sight: the database parts come in through
// `McpDeps`, so everything here is testable offline with fakes. The route (app/api/mcp/route.ts) only turns an
// HTTP request into a call of these functions and records the outcome.
//
// Rules (mds/build/mcp/plan.md):
//  - the model's query is UNTRUSTED: normalized, validated and dry-compiled before it can run;
//  - the site comes from the token (ctx.siteId); no tool takes a site id;
//  - results are capped and personal details masked unless the token allows them (shape.ts);
//  - a refusal explains what to fix, an unexpected error gives only a reference code.
import { AiParseError, normalizeSpec } from "../jh-ai/normalize";
import { checkSpec } from "../jh-ai/check";
import { describeSpec } from "../jh-hook/describe";
import { refCode, hookLog } from "../jh-hook/debug";
import { isHookError } from "../jh-hook/errors";
import type { HookSpec } from "../jh-hook/types";
import type { CanvasView } from "../output/types";
import { schemaGuide } from "./guide";
import { shapeView } from "./shape";

export type ToolKind = "mcp_run" | "mcp_validate" | "mcp_schema" | "mcp_pages" | "mcp_describe";

export interface ToolOutcome {
  text: string;
  isError: boolean;
  kind: ToolKind;
  status: "ok" | "refused" | "error";
  credits: number;
  rows: number | null;
  /** Short, never contains the query or any data: goes to the call record. */
  error?: string;
}

export interface McpContext {
  siteId: string;
  allowPii: boolean;
  maxCredits: number;
  maxRows: number;
}

export interface McpDeps {
  run(siteId: string, spec: HookSpec, maxCredits: number): Promise<{ view: CanvasView; credits: number }>;
  pages(siteId: string): Promise<{ path: string; views: number }[]>;
}

const ok = (kind: ToolKind, text: string, extra: Partial<ToolOutcome> = {}): ToolOutcome => ({ text, isError: false, kind, status: "ok", credits: 0, rows: null, ...extra });
const refused = (kind: ToolKind, message: string): ToolOutcome => ({ text: message, isError: true, kind, status: "refused", credits: 0, rows: null, error: message.slice(0, 200) });

/** The AI app's query -> a clean, valid HookSpec, or a message saying what to fix. */
function prepare(raw: unknown): { spec: HookSpec } | { error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "`spec` must be a JSON object like {\"entity\":\"session\",\"where\":[],\"output\":{\"kind\":\"count\"}}. Call get_schema for the format." };
  try {
    const spec = normalizeSpec(raw);
    checkSpec(spec);
    return { spec };
  } catch (e) {
    if (e instanceof AiParseError || isHookError(e)) return { error: "This query can't run: " + (e as Error).message };
    hookLog.error("mcp prepare failed", e);
    return { error: "This query could not be checked. Reference " + refCode() + "." };
  }
}

export function toolSchema(): ToolOutcome {
  return ok("mcp_schema", schemaGuide());
}

/**
 * A page path that carries something personal or an id: an email, a long hex string (uuid), a long number. Such
 * paths (for example /unsubscribe/jane@x.com or /platform/leads/<uuid>) are left out for a token that may not see
 * personal details. Same rule as the Enter Hook with AI page list.
 */
export function pathLooksPersonal(path: string): boolean {
  return /@|[0-9a-f]{8,}|d{6,}/i.test(path);
}

export async function toolPages(ctx: McpContext, deps: McpDeps): Promise<ToolOutcome> {
  const all = await deps.pages(ctx.siteId);
  const rows = (ctx.allowPii ? all : all.filter((p) => !pathLooksPersonal(p.path))).slice(0, 50);
  return ok("mcp_pages", JSON.stringify({ pages: rows }), { rows: rows.length });
}

export function toolValidate(raw: unknown): ToolOutcome {
  const p = prepare(raw);
  if ("error" in p) return refused("mcp_validate", p.error);
  return ok("mcp_validate", JSON.stringify({ valid: true, readsAs: describeSpec(p.spec) }));
}

export function toolDescribe(raw: unknown): ToolOutcome {
  const p = prepare(raw);
  if ("error" in p) return refused("mcp_describe", p.error);
  return ok("mcp_describe", describeSpec(p.spec));
}

export async function toolRun(ctx: McpContext, deps: McpDeps, raw: unknown): Promise<ToolOutcome> {
  const p = prepare(raw);
  if ("error" in p) return refused("mcp_run", p.error);
  try {
    const { view, credits } = await deps.run(ctx.siteId, p.spec, ctx.maxCredits);
    const shaped = shapeView(view, p.spec, { allowPii: ctx.allowPii, maxRows: ctx.maxRows });
    return ok("mcp_run", shaped.text, { credits, rows: shaped.rows });
  } catch (e) {
    // A HookError says what to fix (too expensive, a value that doesn't fit): pass it on. Anything else is ours.
    if (isHookError(e)) return refused("mcp_run", "This query can't run: " + e.message);
    const ref = refCode();
    hookLog.error("mcp run failed", { ref, site: ctx.siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
    return { text: "Something went wrong on the Jellyhook side. Reference " + ref + ".", isError: true, kind: "mcp_run", status: "error", credits: 0, rows: null, error: "internal " + ref };
  }
}
