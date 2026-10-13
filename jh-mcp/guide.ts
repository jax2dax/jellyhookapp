// jh-mcp/guide.ts
// The text behind the `get_schema` tool: everything an AI app needs to WRITE a Hook query itself. Nothing here is
// hand-copied: the grammar is the one Enter Hook with AI uses (jh-ai/prompt.ts JH_SPEC_GRAMMAR), the field list is
// generated from jh-hook/schema.ts, the glossary and the worked examples are the same ones the evaluation tests.
// So the guide cannot drift from the engine.
import { EXAMPLES } from "../jh-ai/examples";
import { renderGlossary } from "../jh-ai/glossary";
import { stripForModel } from "../jh-ai/normalize";
import { buildPromptCard } from "../jh-ai/promptCard";
import { JH_SPEC_GRAMMAR } from "../jh-ai/prompt";

let cached: string | null = null;

export function schemaGuide(): string {
  if (cached) return cached;
  const examples = EXAMPLES.filter((e) => e.fewShot && e.expect.status === "ok" && !e.current)
    .map((e) => `QUESTION: ${e.question}\nQUERY: ${JSON.stringify(stripForModel((e.expect as unknown as { spec: never }).spec))}`)
    .join("\n\n");
  cached = [
    "Jellyhook Hook: how to write a query for the run_hook tool.",
    "Pass the query as the `spec` argument (a JSON object). Check it first with validate_hook if unsure. Never write SQL.",
    "Reply to the person in plain words using the result; do not show the raw JSON unless asked.",
    "",
    JH_SPEC_GRAMMAR,
    "",
    buildPromptCard(),
    "",
    renderGlossary(),
    "",
    "WORKED EXAMPLES",
    examples,
  ].join("\n");
  return cached;
}
