// jh-marks/v2/tests/ai.test.ts - "Enter with AI" for v2 marks with a fake model. No network.
// Run: npx jiti jh-marks/v2/tests/ai.test.ts (part of npm run test:marks)
import { MODELS } from "../../../jh-ai/models";
import type { ModelProvider } from "../../../jh-ai/providers/types";
import { matchHeadings, sectionPhrases, translateMarkV2, type AiHeading } from "../ai";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) {
    passes++;
    console.log("ok:", m);
  } else {
    fails++;
    console.log("FAIL:", m);
  }
};
const fake = (replies: string[]): ModelProvider & { calls: number; first: string; last: string } => {
  const p = {
    calls: 0,
    first: "",
    last: "",
    async complete(req: { messages: { content: string }[] }) {
      if (!p.calls) p.first = req.messages[1].content;
      p.last = req.messages[req.messages.length - 1].content;
      return { text: replies[p.calls++] ?? "{}", usage: { inputTokens: 1000, cachedTokens: 800, outputTokens: 100 } };
    },
  };
  return p as ModelProvider & { calls: number; first: string; last: string };
};
const model = MODELS.terra;

const headings: AiHeading[] = [
  { key: "k1", text: "What we do", page: "/" },
  { key: "k2", text: "Our offers", page: "/pricing" },
  { key: "k3", text: "Hero", page: "/" },
  { key: "k4", text: "Frequently asked questions", page: "/pricing" },
  { key: "k5", text: "Case studies", page: "/work" },
];
const fields = [
  { key: "custom:field_4", name: "Monthly budget", kind: "number" },
  { key: "custom:service", name: "Service", kind: "choice", options: [{ v: "web", l: "Web design" }] },
];

async function main() {
  // ── finding the parts of the page a sentence names ──
  const ph = sectionPhrases('read our "What we do" section for 20s, then the offers section and the pricing plans part');
  console.log("phrases:", JSON.stringify(ph));
  ok(ph[0] === "What we do", "a quoted phrase comes first");
  ok(ph.includes("offers") && ph.includes("pricing plans"), "words before 'section' / 'part' are taken too");
  ok(!ph.includes("read"), "a verb before the quotes is not a section name");
  ok(sectionPhrases("stayed 2 minutes on pricing").length === 0, "no section named: nothing (the headings are not even read)");
  const m = matchHeadings(["offers", "faq", "what we do"], headings);
  ok(m[0].matches[0]?.key === "k2", "'offers' finds 'Our offers'");
  ok(m[2].matches[0]?.key === "k1", "'what we do' finds 'What we do'");
  ok(m[1].matches.length === 0, "'faq' does not match 'Frequently asked questions' by words (the model is told: no match, ask)");

  // ── the founder's example, answered well ──
  const good = JSON.stringify({
    status: "ok",
    mark: {
      blocks: [{ which: { kind: "converting" }, session: [], pages: { order: "sequence", steps: [{ path: "/", match: "exact", link: "later", conds: [{ kind: "heading", heading: { key: "k1", text: "What we do", page: "/" }, state: "seen", n: { op: ">", a: 20 } }] }, { path: "/pricing", match: "exact", link: "next", conds: [{ kind: "heading", heading: { key: "k2", text: "Our offers", page: "/pricing" }, state: "seen", n: { op: ">=", a: 20 } }] }] }, then: [] }],
      answers: [{ field: "custom:field_4", name: "Monthly budget", kind: "number", n: { op: ">", a: 30 } }],
      form: [],
    },
    name: "Offer reader",
    purpose: "Learned what you do, then went straight to your offers.",
    assumptions: [],
  });
  const p1 = fake([good]);
  const a = await translateMarkV2('saw my home page and "What we do" for more than 20 seconds, then straight to pricing and "Offers" for 20s, budget > $30', { pages: ["/", "/pricing"], fields, headings }, { provider: p1, model });
  ok(a.result.status === "ok" && a.result.rule.answers[0].field === "custom:field_4", "the budget maps to the field the site calls 'Monthly budget'");
  ok(p1.first.includes('custom:field_4 "Monthly budget" number') && p1.first.includes('"What we do" -> {"key":"k1"'), "the model was given the fields and only the matching headings");
  ok(!p1.first.includes("Case studies") && !p1.first.includes("Hero"), "headings the sentence does not name are never sent");
  ok(a.result.status === "ok" && a.result.reads[0].includes("then right after /pricing"), "plain English: " + (a.result.status === "ok" ? a.result.reads.join(" ") : ""));

  // ── an invented heading is sent back ──
  const invented = good.replace('"key":"k2"', '"key":"zz99"');
  const p2 = fake([invented, good]);
  const b = await translateMarkV2('"What we do" then "Offers"', { pages: [], fields, headings }, { provider: p2, model });
  ok(b.result.status === "ok" && p2.calls === 2 && p2.last.includes("is not in HEADING MATCHES"), "a heading key that was not offered is rejected and repaired");

  // ── a field the forms do not have ──
  const missing = JSON.stringify({ status: "missingField", field: "revenue" });
  const c = await translateMarkV2("revenue over 1m", { pages: [], fields, headings: [] }, { provider: fake([missing]), model });
  ok(c.result.status === "missingField" && c.result.field === "revenue" && c.result.reason.includes("Monthly budget"), "a field that does not exist: missingField, listing the fields there are");
  const wrongField = good.replace('"field":"custom:field_4"', '"field":"custom:revenue"');
  const p3 = fake([wrongField, good]);
  await translateMarkV2("budget over 30", { pages: [], fields, headings }, { provider: p3, model });
  ok(p3.calls === 2 && p3.last.includes('field "custom:revenue" is not in FORM FIELDS'), "an invented field key is rejected and repaired");

  // ── a sales word without a number ──
  const ask = JSON.stringify({ status: "clarify", question: "How many seconds before typing in Monthly budget counts as hesitation?" });
  const d = await translateMarkV2("no hesitation on the budget field", { pages: [], fields, headings: [] }, { provider: fake([ask]), model });
  ok(d.result.status === "clarify" && d.result.question.includes("hesitation"), "'no hesitation' with no number: one question about the measure");
  const sys = (await import("../ai")).markSystemPromptV2();
  ok(sys.includes("hesitation / hesitated / thought about it = fieldHesitation"), "the glossary maps hesitation to time before typing in a field");

  const e = await translateMarkV2("anything", { pages: [], fields, headings: [] }, { provider: fake(["not json", "still not"]), model });
  ok(e.result.status === "failed" && e.trace.attempts === 2, "garbage twice: a clear failure");

  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
}
main();
