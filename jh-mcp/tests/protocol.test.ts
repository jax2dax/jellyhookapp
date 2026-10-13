// jh-mcp/tests/protocol.test.ts - the real MCP protocol, in this process, with fake data. Run: npm run test:mcp
// An actual MCP client (the official SDK) talks over HTTP to a small server that mounts the SAME tools the route
// serves (registerJellyhookTools) with the SAME transport settings (stateless, plain JSON). Only the database and
// the token check are faked. This proves: the tools list, the argument schemas, calling each tool, error results,
// and that a request without the right header is refused before any tool runs.
import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerJellyhookTools, type Guard } from "../register";
import type { McpContext, McpDeps } from "../tools";
import type { CanvasView } from "../../output/types";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const TOKEN = "jh_mcp_" + "a".repeat(43);
const ctx: McpContext = { siteId: "site-1", allowPii: false, maxCredits: 20, maxRows: 50 };
const calls: string[] = [];
const leads = {
  kind: "leads", sentence: "a list of leads", total: 1, truncated: false, more: [], pageSize: 25,
  items: [{ href: "/x", name: "Halima Ahmed", email: "halima44@gmail.com", phone: "+1 503 555 0142", submittedAt: "2026-10-12T21:00:00Z", page: "/", qualified: true, fields: [], sessions: [] }],
} as unknown as CanvasView;
const deps: McpDeps = {
  async run(siteId) { calls.push("run:" + siteId); return { view: leads, credits: 4 }; },
  async pages() { calls.push("pages"); return [{ path: "/", views: 10 }]; },
};
const guard: Guard = async (_kind, run) => {
  const out = await run();
  return { content: [{ type: "text", text: out.text }], isError: out.isError };
};

const httpServer = http.createServer(async (req, res) => {
  // The route's token check, faked: no valid bearer, no tools.
  if (req.headers.authorization !== "Bearer " + TOKEN) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "bad token" }, id: null }));
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request("http://localhost" + req.url, { method: req.method, headers: req.headers as Record<string, string>, body: req.method === "POST" ? Buffer.concat(chunks) : undefined });
  const server = new McpServer({ name: "jellyhook", version: "1.0.0" });
  registerJellyhookTools(server, ctx, deps, guard);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
});

const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0] ?? { text: "" }).text;

(async () => {
  await new Promise<void>((r) => httpServer.listen(0, r));
  const port = (httpServer.address() as { port: number }).port;
  const url = new URL("http://localhost:" + port + "/api/mcp");

  // 1. no / wrong token: refused before any tool
  const noAuth = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  ok(noAuth.status === 401 && calls.length === 0, "no token: 401, nothing ran");

  // 2. a real client with the token
  const client = new Client({ name: "test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: "Bearer " + TOKEN } } }));

  const tools = (await client.listTools()).tools;
  const names = tools.map((t) => t.name).sort();
  ok(JSON.stringify(names) === JSON.stringify(["describe_hook", "get_schema", "list_pages", "run_hook", "validate_hook"]), "tools/list: the five tools");
  ok(tools.every((t) => t.annotations?.readOnlyHint === true), "every tool is marked read-only");
  const run = tools.find((t) => t.name === "run_hook")!;
  ok(run.inputSchema.type === "object" && JSON.stringify(run.inputSchema).includes("spec") && (run.inputSchema.required ?? []).includes("spec"), "run_hook: requires a `spec` object");
  ok(!JSON.stringify(tools).toLowerCase().includes("siteid") && !JSON.stringify(tools).toLowerCase().includes("site_id"), "no tool accepts a site id");

  const schema = await client.callTool({ name: "get_schema", arguments: {} });
  ok(!schema.isError && text(schema).includes("THE QUERY") && text(schema).includes("WORKED EXAMPLES"), "get_schema over the wire");

  const pages = await client.callTool({ name: "list_pages", arguments: {} });
  ok(JSON.parse(text(pages)).pages[0].path === "/", "list_pages over the wire");

  const good = { entity: "lead", where: [], output: { kind: "ids" } };
  const valid = await client.callTool({ name: "validate_hook", arguments: { spec: good } });
  ok(!valid.isError && JSON.parse(text(valid)).valid === true, "validate_hook: a good query");
  const invalid = await client.callTool({ name: "validate_hook", arguments: { spec: { entity: "nope", where: [], output: { kind: "count" } } } });
  ok(invalid.isError === true && text(invalid).includes("can't run"), "validate_hook: a bad query comes back as an error result the AI can read");
  const noArg = await client.callTool({ name: "run_hook", arguments: {} }).then((r) => r, (e) => e);
  ok((noArg as { isError?: boolean }).isError === true || noArg instanceof Error, "run_hook without `spec`: refused by the argument schema");

  const ran = await client.callTool({ name: "run_hook", arguments: { spec: good } });
  const t = text(ran);
  ok(!ran.isError && calls.includes("run:site-1"), "run_hook: ran against the token's site");
  ok(t.includes("h***@gmail.com") && !t.includes("halima44@gmail.com") && !t.includes("Halima"), "run_hook: personal details masked over the wire");

  await client.close();
  httpServer.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
