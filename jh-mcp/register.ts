// jh-mcp/register.ts
// Registers the Jellyhook tools on an MCP server. Pure of database and web framework: the data comes in through
// `deps`, and `guard` is the wrapper every call goes through (in production: rate limit first, then the tool, then the
// call record; in tests: a pass-through). The production wiring is lib/mcp/server.ts; the protocol test
// (tests/protocol.test.ts) registers the same tools with fakes, so what is tested is what is served.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ToolName } from "./config";
import { toolDescribe, toolPages, toolRun, toolSchema, toolValidate, type McpContext, type McpDeps, type ToolKind, type ToolOutcome } from "./tools";

export type Guard = (kind: ToolKind, run: () => Promise<ToolOutcome> | ToolOutcome) => Promise<{ content: { type: "text"; text: string }[]; isError: boolean }>;

const specArg = z.record(z.string(), z.unknown()).describe("The Hook query as a JSON object (entity, where, output). Call get_schema for the format.");
const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function registerJellyhookTools(server: McpServer, ctx: McpContext, deps: McpDeps, guard: Guard, enabled?: ReadonlySet<ToolName>): void {
  // Tools the token is not allowed to use are not registered at all: they do not appear in the list and cannot be called.
  const on = (name: ToolName) => !enabled || enabled.has(name);
  if (on("get_schema"))
    server.registerTool(
    "get_schema",
    { title: "How to write a Hook query", description: "Call this first. Returns the query format, every entity and field Jellyhook can ask about, a glossary of business words, and worked examples. Use it to write the `spec` for run_hook.", annotations: readOnly },
    () => guard("mcp_schema", () => toolSchema()),
  );
  if (on("list_pages"))
    server.registerTool(
    "list_pages",
    { title: "The site's pages", description: "The site's most viewed page paths with view counts (top 50). Use the real paths in queries.", annotations: readOnly },
    () => guard("mcp_pages", () => toolPages(ctx, deps)),
  );
  if (on("validate_hook"))
    server.registerTool(
    "validate_hook",
    { title: "Check a Hook query", description: "Checks a query without running it and returns how it reads in words, or exactly what to fix. Free.", inputSchema: { spec: specArg }, annotations: readOnly },
    ({ spec }) => guard("mcp_validate", () => toolValidate(spec)),
  );
  if (on("describe_hook"))
    server.registerTool(
    "describe_hook",
    { title: "Describe a Hook query", description: "Says in plain words what a Hook query asks. Free.", inputSchema: { spec: specArg }, annotations: readOnly },
    ({ spec }) => guard("mcp_describe", () => toolDescribe(spec)),
  );
  if (on("run_hook"))
    server.registerTool(
    "run_hook",
    {
      title: "Run a Hook query",
      description: `Runs a Hook query against this site's data and returns the answer: a number, a ranking, a time series, or a short list (at most ${ctx.maxRows} rows) of sessions, leads, visitors, pages or forms. Uses Jellyhook credits (refused above ${ctx.maxCredits}). Personal details (email, name, phone) come back masked unless the token allows them. Read-only.`,
      inputSchema: { spec: specArg },
      annotations: readOnly,
    },
    ({ spec }) => guard("mcp_run", () => toolRun(ctx, deps, spec)),
  );
}
