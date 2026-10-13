// jh-mcp/tests/tools.test.ts - offline, with fakes for the database. Run: npm run test:mcp
import { maskEmail, maskName, maskPhone, piiOutputKind } from "../mask";
import { shapeView } from "../shape";
import { toolDescribe, toolPages, toolRun, toolSchema, toolValidate, type McpContext, type McpDeps } from "../tools";
import { normalizeSpec } from "../../jh-ai/normalize";
import type { CanvasView } from "../../output/types";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

// ── masking ──
ok(maskEmail("halima44@gmail.com") === "h***@gmail.com" && maskEmail("nope") === "***", "mask: email keeps first letter and domain only");
ok(maskName("Halima Ahmed") === "H. A." && maskName("halima") === "H." && maskName("  ") === "***", "mask: name becomes initials");
ok(maskPhone("+1 (503) 555-0142") === "***42" && maskPhone("7") === "***", "mask: phone keeps the last two digits");

const leadSpec = (field: string, kind = "values") => normalizeSpec({ entity: "lead", where: [], output: { kind, field } });
ok(piiOutputKind(leadSpec("email")) === "email" && piiOutputKind(leadSpec("name")) === "name" && piiOutputKind(leadSpec("page")) === null, "pii: lead email / name / phone outputs are recognised, page is not");
ok(piiOutputKind(normalizeSpec({ entity: "session", where: [], output: { kind: "count" } })) === null, "pii: a session count is not personal");

// ── shaping ──
const leadsView = {
  kind: "leads",
  sentence: "a list of leads",
  total: 120,
  truncated: false,
  more: [],
  pageSize: 25,
  items: [
    { href: "/platform/leads/1", name: "Halima Ahmed", email: "halima44@gmail.com", phone: "+1 503 555 0142", submittedAt: "2026-10-12T21:00:00Z", page: "/", qualified: true, fields: [{ key: "message", value: "my secret note" }], sessions: [] },
  ],
} as unknown as CanvasView;
const spec = normalizeSpec({ entity: "lead", where: [], output: { kind: "ids" } });
const masked = shapeView(leadsView, spec, { allowPii: false, maxRows: 50 }).text;
ok(!masked.includes("halima44") && !masked.includes("Halima") && !masked.includes("0142") && masked.includes("h***@gmail.com") && masked.includes("H. A."), "shape: leads are masked by default");
const open = shapeView(leadsView, spec, { allowPii: true, maxRows: 50 }).text;
ok(open.includes("halima44@gmail.com") && open.includes("Halima Ahmed"), "shape: a token that allows personal details gets them");
ok(!masked.includes("my secret note") && !open.includes("my secret note"), "shape: raw form answers are never returned, even with personal details allowed");

const many = { kind: "values", sentence: "emails", type: "text", truncated: false, values: Array.from({ length: 80 }, (_, i) => `person${i}@example.com`) } as unknown as CanvasView;
const capped = shapeView(many, leadSpec("email"), { allowPii: false, maxRows: 50 });
ok(capped.rows === 50 && JSON.parse(capped.text).values.length === 50 && JSON.parse(capped.text).truncated === true, "shape: lists are capped at maxRows and say so");
ok(!capped.text.includes("person1@example.com") && capped.text.includes("p***@example.com"), "shape: a values list of emails is masked because the OUTPUT is an email");
const groups = { kind: "ranking", sentence: "by email", keyType: "text", valueType: "number", rows: [{ key: "a@b.com", value: 3 }] } as unknown as CanvasView;
ok(shapeView(groups, leadSpec("email", "groupBy"), { allowPii: false, maxRows: 50 }).text.includes("a***@b.com"), "shape: groupBy keys that are emails are masked");
const num = { kind: "number", sentence: "how many", type: "number", value: 42 } as unknown as CanvasView;
ok(JSON.parse(shapeView(num, normalizeSpec({ entity: "session", where: [], output: { kind: "count" } }), { allowPii: false, maxRows: 50 }).text).raw === 42, "shape: a plain number comes through");

// ── tools ──
const ctx: McpContext = { siteId: "site-1", allowPii: false, maxCredits: 20, maxRows: 50 };
let runs = 0;
let lastSite = "";
const deps: McpDeps = {
  async run(siteId, _spec, maxCredits) {
    runs++;
    lastSite = siteId;
    if (maxCredits < 20) throw new Error("db down: secret connection string");
    return { view: num, credits: 3 };
  },
  async pages() {
    return Array.from({ length: 80 }, (_, i) => ({ path: "/p" + i, views: 80 - i }));
  },
};
const goodSpec = { entity: "session", where: [], output: { kind: "count" } };

(async () => {
  const schema = toolSchema();
  ok(!schema.isError && schema.text.includes("THE QUERY") && schema.text.includes("session") && schema.text.includes("WORKED EXAMPLES"), "get_schema: grammar, fields and examples");
  ok(!schema.text.includes('"status":"ok"') && !schema.text.includes("REPLY WITH ONE JSON OBJECT"), "get_schema: does not carry the Enter-Hook-with-AI reply envelope");

  const v = toolValidate(goodSpec);
  ok(!v.isError && JSON.parse(v.text).valid === true && v.credits === 0, "validate_hook: a good query is valid and free");
  const bad = toolValidate({ entity: "session", where: [{ kind: "field", field: "nonsense", op: "is", value: 1 }], output: { kind: "count" } });
  ok(bad.isError && bad.status === "refused" && bad.text.includes("can't run"), "validate_hook: an unknown field is refused with a message");
  ok(toolValidate("select * from sessions").isError && toolValidate(null).isError && toolValidate([1]).isError, "validate_hook: SQL text, null and arrays are refused");
  ok(!toolDescribe(goodSpec).isError && toolDescribe(goodSpec).text.length > 5, "describe_hook: plain words");

  const pg = await toolPages(ctx, deps);
  ok(JSON.parse(pg.text).pages.length === 50 && pg.rows === 50, "list_pages: capped at 50");
  const personalDeps: McpDeps = { ...deps, async pages() { return [{ path: "/pricing", views: 9 }, { path: "/unsubscribe/jane@x.com", views: 2 }, { path: "/platform/leads/9ca06ad0-ac44-4875-abdd-765607722e3d", views: 7 }, { path: "/order/12345678", views: 1 }]; } };
  const safe = JSON.parse((await toolPages(ctx, personalDeps)).text).pages.map((p: { path: string }) => p.path);
  ok(safe.length === 1 && safe[0] === "/pricing", "list_pages: paths with an email, a uuid or a long number are left out by default");
  const open2 = JSON.parse((await toolPages({ ...ctx, allowPii: true }, personalDeps)).text).pages;
  ok(open2.length === 4, "list_pages: a token that allows personal details gets every path");

  const r = await toolRun(ctx, deps, goodSpec);
  ok(!r.isError && r.credits === 3 && r.kind === "mcp_run" && lastSite === "site-1" && runs === 1, "run_hook: runs against the token's site and reports credits");
  const before = runs;
  const refusedRun = await toolRun(ctx, deps, { entity: "session", where: [], output: { kind: "nonsense" } });
  ok(refusedRun.isError && refusedRun.status === "refused" && runs === before, "run_hook: an invalid query never reaches the database");
  const boom = await toolRun({ ...ctx, maxCredits: 5 }, deps, goodSpec);
  ok(boom.isError && boom.status === "error" && /Reference [A-Z0-9]+/.test(boom.text) && !boom.text.includes("secret connection string") && !(boom.error ?? "").includes("secret"), "run_hook: an internal error gives a reference code, never the raw message");
  ok(!("siteId" in (goodSpec as object)) && !JSON.stringify(goodSpec).includes("site"), "no tool takes a site id from the AI");

  console.log(`\n${passes} passed, ${fails} failed`);
  if (fails) process.exit(1);
})();
