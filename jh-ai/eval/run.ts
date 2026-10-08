// jh-ai/eval/run.ts
// The real-model test: runs the 50-odd questions of jh-ai/examples.ts through the actual provider and reports
// how often it produces the expected query, how much that costs, and how fast. This is how you decide whether a
// model (or a prompt change) is good enough, BEFORE people use it. It spends real money (about half a cent a
// question on the default model), so it only runs when asked.
//
//   npm run ai:eval                    all questions, the default model (AI_HOOK_MODEL or terra)
//   npm run ai:eval -- --model luna    another registry model
//   npm run ai:eval -- --only vague-with-dates,hanna-pages
//   npm run ai:eval -- --limit 10
//   npm run ai:eval -- --skip-fewshot  only questions the model was NOT shown the answer to (the honest score)
//
// The key is read from OPENAI_API_KEY (the environment, or .env.local). It is never printed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXAMPLES, EVAL_PAGES, EVAL_TODAY, type Example } from "../examples";
import { MODELS, resolveModel } from "../models";
import { normalizeSpec, stripForModel } from "../normalize";
import { providerFor } from "../providers";
import { translate } from "../translate";
import type { TranslateResult } from "../types";

function loadEnvLocal() {
  const p = path.resolve(__dirname, "../../.env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || line.trim().startsWith("#")) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/** Order-independent form of a query, for comparing what the model wrote with what is expected. */
function canon(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(canon).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (x && typeof x === "object") return Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canon(v)]));
  return x;
}
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  loadEnvLocal();
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set (environment or .env.local).");
    process.exit(2);
  }
  const { key, def } = resolveModel(arg("model") ?? process.env.AI_HOOK_MODEL);
  if (arg("model") && !MODELS[arg("model")!]) console.warn(`Unknown model "${arg("model")}", using ${key}.`);
  let list: Example[] = EXAMPLES;
  const only = arg("only")?.split(",");
  if (only) list = list.filter((e) => only.includes(e.id));
  if (process.argv.includes("--skip-fewshot")) list = list.filter((e) => !e.fewShot);
  const limit = Number(arg("limit") ?? 0);
  if (limit > 0) list = list.slice(0, limit);

  console.log(`Model: ${def.label} (${def.id})   questions: ${list.length}\n`);
  const provider = providerFor(def.provider);

  type Row = { ex: Example; got: TranslateResult | null; error?: string; match: boolean; verdict: string; attempts: number; usd: number; ms: number; input: number; cached: number; output: number };
  const rows: Row[] = [];
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const ex = list[next++];
      try {
        const { result, trace } = await translate(
          { question: ex.question, current: ex.current ? normalizeSpec(ex.current) : null, pages: EVAL_PAGES, today: EVAL_TODAY },
          { provider, model: def },
        );
        let match = false;
        let verdict = "";
        if (ex.expect.status === "ok") {
          if (result.status === "ok") {
            const got = stripForModel(result.spec);
            match = [ex.expect.spec, ...(ex.alt ?? [])].some((e) => same(got, stripForModel(normalizeSpec(e))));
            verdict = match ? "exact" : "valid but different (review)";
          } else verdict = `expected a query, got ${result.status}`;
        } else {
          match = result.status === ex.expect.status;
          verdict = match ? ex.expect.status : `expected ${ex.expect.status}, got ${result.status}`;
        }
        rows.push({ ex, got: result, match, verdict, attempts: trace.attempts, usd: trace.costUsd, ms: trace.latencyMs, input: trace.usage.inputTokens, cached: trace.usage.cachedTokens, output: trace.usage.outputTokens });
      } catch (e) {
        rows.push({ ex, got: null, error: e instanceof Error ? e.message : String(e), match: false, verdict: "error", attempts: 0, usd: 0, ms: 0, input: 0, cached: 0, output: 0 });
      }
      process.stdout.write(".");
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log("\n");

  rows.sort((a, b) => list.indexOf(a.ex) - list.indexOf(b.ex));
  for (const r of rows) {
    console.log(`${r.match ? "PASS" : "DIFF"}  ${r.ex.id.padEnd(24)} ${r.verdict}${r.attempts > 1 ? "  (repaired)" : ""}${r.ex.fewShot ? "  [shown in prompt]" : ""}`);
    if (!r.match) {
      console.log(`      question: ${r.ex.question}`);
      if (r.error) console.log(`      error: ${r.error}`);
      if (r.got?.status === "ok") console.log(`      got:      ${JSON.stringify(stripForModel(r.got.spec))}\n      expected: ${JSON.stringify(stripForModel(normalizeSpec((r.ex.expect as { spec: unknown }).spec as never)))}`);
      if (r.got && r.got.status !== "ok") console.log(`      got: ${JSON.stringify(r.got)}`);
    }
  }

  const n = rows.length;
  const pass = rows.filter((r) => r.match).length;
  const okExpected = rows.filter((r) => r.ex.expect.status === "ok");
  const valid = okExpected.filter((r) => r.got?.status === "ok").length;
  const usd = rows.reduce((s, r) => s + r.usd, 0);
  const input = rows.reduce((s, r) => s + r.input, 0);
  const cached = rows.reduce((s, r) => s + r.cached, 0);
  const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
  console.log("\n──────── summary ────────");
  console.log(`exact matches:           ${pass}/${n} (${Math.round((pass / n) * 100)}%)`);
  console.log(`valid query produced:    ${valid}/${okExpected.length} of the questions that have a query`);
  console.log(`needed a repair retry:   ${rows.filter((r) => r.attempts > 1).length}`);
  console.log(`cost:                    $${usd.toFixed(4)} total, $${(usd / Math.max(1, n)).toFixed(4)} per question`);
  console.log(`tokens in (cached):      ${input} (${Math.round((cached / Math.max(1, input)) * 100)}% served from cache)`);
  console.log(`latency:                 median ${lat[Math.floor(lat.length / 2)] ?? 0} ms, slowest ${lat[lat.length - 1] ?? 0} ms`);
  const out = path.resolve(__dirname, "last-run.json");
  writeFileSync(out, JSON.stringify({ model: def.id, at: new Date().toISOString(), exact: pass, total: n, valid, usd, rows: rows.map((r) => ({ id: r.ex.id, match: r.match, verdict: r.verdict, attempts: r.attempts, usd: r.usd, ms: r.ms })) }, null, 2));
  console.log(`\nreport written to jh-ai/eval/last-run.json (not committed)`);
  process.exit(pass === n ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
