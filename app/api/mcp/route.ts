// app/api/mcp/route.ts
// The MCP endpoint: https://<site>/api/mcp. An AI app (Claude, Cursor...) sends JSON-RPC over HTTP POST with
// "Authorization: Bearer <token>". Stateless: every request is authenticated and answered on its own, no sessions.
// Off unless MCP_ENABLED=1. Plan and rules: mds/build/mcp/plan.md.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticate } from "@/lib/mcp/auth";
import { buildServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

const json = (status: number, message: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }), { status, headers: { "Content-Type": "application/json", ...headers } });

export async function POST(req: Request) {
  const a = await authenticate(req);
  if (!a.ok) return json(a.status, a.message, a.status === 401 ? { "WWW-Authenticate": 'Bearer realm="jellyhook"' } : {});

  const server = buildServer(a.caller);
  // Stateless + plain JSON answers (no streaming): the simplest thing every client understands.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // The answer is already built; release the per-request server.
    void server.close();
  }
}

// No server-initiated streams and no sessions to end.
const notAllowed = () => json(405, "This server is stateless: use POST.", { Allow: "POST" });
export const GET = notAllowed;
export const DELETE = notAllowed;
