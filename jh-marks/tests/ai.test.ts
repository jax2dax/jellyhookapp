// jh-marks/tests/ai.test.ts - "Enter with AI" with a fake model: a good answer, a repair after a bad one, clarify,
// unsupported, garbage. No network. Run: npm run test:marks
import { MODELS } from "../../jh-ai/models";
import type { ModelProvider } from "../../jh-ai/providers/types";
import { translateMark } from "../ai";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const fake = (replies: string[]): ModelProvider & { calls: number; last: string } => {
  const p = {
    calls: 0,
    last: "",
    async complete(req: { messages: { content: string }[] }) {
      p.last = req.messages[req.messages.length - 1].content;
      return { text: replies[p.calls++] ?? "{}", usage: { inputTokens: 1000, cachedTokens: 800, outputTokens: 100 } };
    },
  };
  return p as ModelProvider & { calls: number; last: string };
};
const model = MODELS.terra;

async function main() {
  const good = JSON.stringify({ status: "ok", mark: { scope: "any", rows: [{ order: "sequence", cards: [{ path: "/pricing", match: "exact", minSeconds: 30 }, { path: "/demo", match: "exact" }] }], lead: [] }, name: "Pricing then demo", assumptions: ["demo is /demo"] });
  const a = await translateMark("read pricing 30s then demo", ["/pricing", "/demo"], { provider: fake([good]), model });
  ok(a.result.status === "ok" && a.result.rule.rows[0].order === "sequence" && a.result.name === "Pricing then demo", "a good answer becomes a rule the builder can show");
  ok(a.result.status === "ok" && a.result.reads.startsWith("Before sending the form, they saw /pricing (stayed 30 s or more), then /demo"), "with its plain-English reading");
  ok(a.trace.attempts === 1 && a.trace.costUsd > 0, "one attempt, cost recorded");

  const bad = JSON.stringify({ status: "ok", mark: { rows: [{ cards: [{ path: "/pricing", minReadPct: 300 }] }] } });
  const p = fake([bad, good]);
  const b = await translateMark("read pricing a lot", [], { provider: p, model });
  ok(b.result.status === "ok" && p.calls === 2 && p.last.includes("between 1 and 100"), "a wrong number is sent back with the exact complaint, and the repair is used");

  const c = await translateMark("hot leads", [], { provider: fake([JSON.stringify({ status: "clarify", question: "Which pages make a lead hot for you?" })]), model });
  ok(c.result.status === "clarify", "a vague sentence asks one question back");
  const d = await translateMark("pricing or demo", [], { provider: fake([JSON.stringify({ status: "unsupported", reason: "Marks can't say OR yet." })]), model });
  ok(d.result.status === "unsupported", "what marks can't say is said plainly");
  const e = await translateMark("x", [], { provider: fake(["sorry", "still not json"]), model });
  ok(e.result.status === "failed" && e.trace.attempts === 2, "two bad replies: a clear failure, never a broken mark");
  const f = await translateMark("   ", [], { provider: fake([good]), model });
  ok(f.result.status === "failed" && f.trace.attempts === 0, "an empty sentence never calls the model");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
