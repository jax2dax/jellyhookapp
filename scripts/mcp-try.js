/* eslint-disable */
// One-command check of the MCP endpoint with a real token. Prints a short pass/fail list.
//   PowerShell:  $env:MCP_TOKEN = "jh_mcp_..."; node scripts/mcp-try.js
//   Another server:  $env:MCP_URL = "https://your-domain/api/mcp"
const URL_ = process.env.MCP_URL || "http://localhost:3000/api/mcp";
const TOKEN = process.env.MCP_TOKEN;
if (!TOKEN) {
  console.error('Set the token first:  $env:MCP_TOKEN = "jh_mcp_..."');
  process.exit(2);
}
let id = 0;
async function rpc(method, params, token = TOKEN) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: "Bearer " + token },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch (e) {}
  return { status: res.status, body, text };
}
const call = (name, args) => rpc("tools/call", { name, arguments: args });
const textOf = (r) => r.body?.result?.content?.[0]?.text ?? "";
let fails = 0;
const ok = (c, m, extra) => { console.log((c ? "ok:   " : "FAIL: ") + m + (extra ? "  -> " + extra : "")); if (!c) fails++; };

(async () => {
  const bad = await rpc("tools/list", {}, "jh_mcp_" + "x".repeat(43));
  ok(bad.status === 401, "a wrong token is refused", "status " + bad.status);

  const list = await rpc("tools/list", {});
  const names = (list.body?.result?.tools || []).map((t) => t.name).sort();
  ok(names.length === 5, "five tools listed", names.join(", "));

  const schema = await call("get_schema", {});
  ok(textOf(schema).includes("WORKED EXAMPLES"), "get_schema returns the guide", textOf(schema).length + " characters");

  const pages = await call("list_pages", {});
  let top = "";
  try { top = JSON.parse(textOf(pages)).pages.slice(0, 3).map((p) => p.path + " (" + p.views + ")").join(", "); } catch (e) {}
  ok(!pages.body?.result?.isError, "list_pages", top || textOf(pages).slice(0, 150));

  const bad2 = await call("validate_hook", { spec: { entity: "nope", where: [], output: { kind: "count" } } });
  ok(bad2.body?.result?.isError === true, "an invalid query is refused with a reason", textOf(bad2).slice(0, 120));

  const count = await call("run_hook", { spec: { entity: "session", where: [], output: { kind: "count" } } });
  ok(!count.body?.result?.isError, "run_hook: count of sessions", textOf(count).slice(0, 200));

  const leads = await call("run_hook", { spec: { entity: "lead", where: [], output: { kind: "ids" } } });
  const lt = textOf(leads);
  const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/.test(lt.replace(/[A-Za-z0-9._%+-]\*{3}@/g, ""));
  ok(!leads.body?.result?.isError, "run_hook: list of leads", lt.slice(0, 200));
  try {
    const j = JSON.parse(lt);
    ok(!(j.total > 0 && j.returned === 0), "leads: when there are leads, some are returned (total " + j.total + ", returned " + j.returned + ")");
  } catch (e) {}
  const sess = await call("run_hook", { spec: { entity: "session", where: [], output: { kind: "ids" } } });
  try {
    const j = JSON.parse(textOf(sess));
    ok(!(j.total > 0 && j.returned === 0), "sessions: when there are sessions, some are returned (total " + j.total + ", returned " + j.returned + ")");
    const pagesSeen = (j.sessions?.[0]?.pages || []).map((p) => p.path).join(" > ");
    ok(true, "first session's pages", pagesSeen || "(none)");
  } catch (e) { ok(false, "sessions list could not be read", textOf(sess).slice(0, 150)); }
  ok(!hasEmail, "no unmasked email address in the leads answer (token without personal details)");

  console.log(fails ? "\n" + fails + " FAILED" : "\nALL OK");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("Could not reach " + URL_ + ": " + e.message); process.exit(2); });
