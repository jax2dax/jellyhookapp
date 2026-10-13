// lib/mcp/server.ts
// Builds the MCP server for ONE authenticated request: the tools (jh-mcp/register.ts), wired to the real database,
// behind the per-token rate limit and the call record. A fresh server per request (stateless): no session to store,
// nothing shared between callers. Server only.
import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { runHook } from "@/jh-hook/engine/run";
import { scoped } from "@/jh-hook/engine/sql";
import type { HookSpec } from "@/jh-hook/types";
import { registerJellyhookTools, type Guard } from "@/jh-mcp/register";
import type { McpContext, McpDeps } from "@/jh-mcp/tools";
import { pgHookDb } from "@/lib/hook/pgDb";
import { renderCanvas } from "@/output/server/render";
import { checkRate, MAX_CREDITS, MAX_ROWS, recordCall, type Caller } from "./auth";

const deps: McpDeps = {
  async run(siteId: string, spec: HookSpec, maxCredits: number) {
    const result = await runHook(pgHookDb, siteId, spec, { maxCredits });
    const view = await renderCanvas(siteId, spec, result, { maxCredits });
    return { view, credits: result.cost.credits };
  },
  async pages(siteId: string) {
    const rows = await pgHookDb.query(`SELECT x.page_path AS path, count(*)::int AS views FROM ${scoped("page_views", "x")} WHERE x.page_path IS NOT NULL GROUP BY 1 ORDER BY views DESC LIMIT 50`, [siteId]);
    return rows as { path: string; views: number }[];
  },
};

export function buildServer(caller: Caller): McpServer {
  const ctx: McpContext = { siteId: caller.siteId, allowPii: caller.allowPii, maxCredits: MAX_CREDITS(), maxRows: MAX_ROWS() };
  const server = new McpServer({ name: "jellyhook", version: "1.0.0" });

  // Every tool goes through here: rate limit first, then the tool, then the record.
  const guard: Guard = async (kind, run) => {
    const t0 = Date.now();
    const rate = await checkRate(caller.tokenId);
    if (!rate.ok) {
      await recordCall(caller, { kind, status: "rate_limited", credits: 0, rows: null, ms: Date.now() - t0, error: rate.message });
      return { content: [{ type: "text", text: rate.message }], isError: true };
    }
    const out = await run();
    await recordCall(caller, { kind: out.kind, status: out.status, credits: out.credits, rows: out.rows, ms: Date.now() - t0, error: out.error });
    return { content: [{ type: "text", text: out.text }], isError: out.isError };
  };

  registerJellyhookTools(server, ctx, deps, guard);
  return server;
}
