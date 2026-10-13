// jh-mcp/tests/config.test.ts - offline. Run: npm run test:mcp
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { TOOL_NAMES, cleanConfig, describeConfig, effectiveConfig } from "../config";
import { registerJellyhookTools, type Guard } from "../register";
import type { McpContext, McpDeps } from "../tools";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const ceilings = { maxRows: 50, maxCredits: 20, callsPerMinute: 30, callsPerDay: 500 };

// ── cleaning untrusted input ──
ok(JSON.stringify(cleanConfig(null)) === "{}" && JSON.stringify(cleanConfig("x")) === "{}" && JSON.stringify(cleanConfig([1])) === "{}", "clean: null, strings and arrays give no settings");
ok(cleanConfig({ tools: [...TOOL_NAMES] }).tools === undefined, "clean: all five tools is stored as 'no restriction'");
ok(JSON.stringify(cleanConfig({ tools: ["run_hook", "nonsense", "get_schema"] }).tools) === JSON.stringify(["get_schema", "run_hook"]), "clean: unknown tool names are dropped, order is canonical");
ok(cleanConfig({ tools: [] }).tools === undefined && cleanConfig({ tools: ["nonsense"] }).tools === undefined, "clean: an empty or all-unknown list is no restriction, never 'no tools'");
const lim = cleanConfig({ maxRows: "20", maxCredits: 5.9, callsPerMinute: 0, callsPerDay: -3 });
ok(lim.maxRows === 20 && lim.maxCredits === 5 && lim.callsPerMinute === undefined && lim.callsPerDay === undefined, "clean: numbers are floored, zero and negatives dropped");
ok(Object.keys(cleanConfig({ maxRows: "", maxCredits: null, evil: 1, __proto__: { x: 1 } })).length === 0, "clean: empty, null and unknown keys are ignored");

// ── effective settings: a token can only be LOWER than the server ──
const e1 = effectiveConfig({}, ceilings);
ok(e1.tools.size === 5 && e1.maxRows === 50 && e1.maxCredits === 20 && e1.callsPerMinute === 30 && e1.callsPerDay === 500, "effective: no settings = all tools and the server limits");
const e2 = effectiveConfig({ maxRows: 10, maxCredits: 3, callsPerMinute: 5, callsPerDay: 50 }, ceilings);
ok(e2.maxRows === 10 && e2.maxCredits === 3 && e2.callsPerMinute === 5 && e2.callsPerDay === 50, "effective: lower values apply");
const e3 = effectiveConfig({ maxRows: 9999, maxCredits: 9999, callsPerMinute: 9999, callsPerDay: 9999 }, ceilings);
ok(e3.maxRows === 50 && e3.maxCredits === 20 && e3.callsPerMinute === 30 && e3.callsPerDay === 500, "effective: a token can never exceed the server-wide ceilings");
ok(describeConfig({}) === "all tools" && describeConfig({ tools: ["run_hook"], maxRows: 5 }).includes("tools: run_hook") && describeConfig({ maxRows: 5 }).includes("5 rows"), "describe: one readable line");

// ── over the real protocol: a disabled tool is not listed and cannot be called ──
const ctx: McpContext = { siteId: "site-1", allowPii: false, maxCredits: 20, maxRows: 50 };
const deps: McpDeps = { async run() { throw new Error("must not run"); }, async pages() { return []; } };
const guard: Guard = async (_k, run) => { const o = await run(); return { content: [{ type: "text", text: o.text }], isError: o.isError }; };

const httpServer = http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
  const server = new McpServer({ name: "jellyhook", version: "1.0.0" });
  registerJellyhookTools(server, ctx, deps, guard, new Set(["get_schema", "validate_hook"]));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});

(async () => {
  await new Promise<void>((r) => httpServer.listen(0, r));
  const port = (httpServer.address() as { port: number }).port;
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost:" + port + "/api/mcp")));
  const names = (await client.listTools()).tools.map((t) => t.name).sort();
  ok(JSON.stringify(names) === JSON.stringify(["get_schema", "validate_hook"]), "protocol: a token limited to two tools lists only those two");
  const blocked = await client.callTool({ name: "run_hook", arguments: { spec: { entity: "session", where: [], output: { kind: "count" } } } }).then((r) => r, (e) => e);
  ok(blocked instanceof Error || (blocked as { isError?: boolean }).isError === true, "protocol: calling a tool the token does not have fails");
  await client.close();
  httpServer.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
