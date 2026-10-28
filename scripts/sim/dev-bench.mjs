#!/usr/bin/env node
// scripts/sim/dev-bench.mjs - runs Jellyhook on http://localhost:3100 against the TEST database (npm run dev:bench).
//
// Reads .env.bench (the separate Supabase project's keys; never committed) before Next.js starts and passes its values to
// it as environment variables, so they win over .env.local: Next.js never overrides a variable that is already set.
// (Not with node's --env-file flag: Next.js forwards node's flags to its workers through NODE_OPTIONS, which refuses it.)
// Prints the variable NAMES and the test database's host, never a value. Refuses to start when a database variable is
// missing, because a missing one would silently fall back to the one in .env.local, which is production.
// Builds into .next-bench, so it can run next to the normal dev server (port 3000, .next).
// What .env.bench must contain: mds/build/control-room.md ("The test environment").
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "./envfile.mjs";

if (!existsSync(".env.bench")) {
  console.error("No .env.bench. Create it with the test Supabase project's keys (see mds/build/control-room.md, 'The test environment').");
  process.exit(1);
}

const bench = parseEnv(readFileSync(".env.bench", "utf8"));
console.log(`.env.bench: ${Object.keys(bench).length} variables (${Object.keys(bench).join(", ")})`);

const must = ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "HOOK_DATABASE_URL"];
const missing = must.filter((k) => !bench[k]);
if (missing.length) {
  console.error(`\nMissing in .env.bench: ${missing.join(", ")}.\nA database variable left out would fall back to the one in .env.local, which is PRODUCTION. Add them all, then run again.`);
  process.exit(1);
}
let host = "";
try {
  host = new URL(bench.SUPABASE_URL).host;
} catch {
  console.error("\nSUPABASE_URL in .env.bench is not a web address (it should look like https://abcdefgh.supabase.co).");
  process.exit(1);
}
if (bench.NEXT_PUBLIC_SUPABASE_URL !== bench.SUPABASE_URL) {
  console.error("\nSUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL in .env.bench are different. They must be the same test project.");
  process.exit(1);
}
console.log(`Test database: ${host}`);

// The database must carry the test mark (mds/bench/01-mark-test-database.sql, run in the TEST project only). Production
// never has it, so a .env.bench that points at production is refused here, before anything is started.
const refuse = (why) => {
  console.error(`\nNOT STARTING: ${why}\nThis check exists so load tests never run against production.`);
  process.exit(1);
};
try {
  const res = await fetch(`${bench.SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/jh_environment?select=name`, {
    headers: { apikey: bench.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${bench.SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  const rows = res.ok ? await res.json().catch(() => null) : null;
  if (!Array.isArray(rows) || !rows.some((r) => r && r.name === "bench")) {
    refuse(
      `${host} is not marked as the test database.\nIf it IS your test project, run mds/bench/01-mark-test-database.sql in ITS SQL editor (the project whose address is ${host}), then try again.\nIf it is your production project, .env.bench is wrong: fix it.`,
    );
  }
} catch (e) {
  refuse(`could not check ${host} (${e instanceof Error ? e.message : String(e)}).`);
}
console.log("Marked as the test database: ok\n");
if (process.env.JELLYHOOK_BENCH_CHECK_ONLY === "1") process.exit(0);

const next = path.join("node_modules", "next", "dist", "bin", "next");
// --prod (npm run start:bench): a production build, then `next start`, like the live site. The development server
// compiles pages when first asked and again later ("Compiling..." in the browser) and is much slower under load, so load
// tests that should measure the DATABASE use this. Its own folder (.next-bench-prod), built with the test project's keys.
const prod = process.argv.includes("--prod");
const env = { ...process.env, ...bench, NEXT_DIST_DIR: prod ? ".next-bench-prod" : ".next-bench", JELLYHOOK_BENCH: "1" };
const run = (args) => new Promise((done) => spawn(process.execPath, [next, ...args], { stdio: "inherit", env }).on("exit", (code) => done(code ?? 0)));
if (prod) {
  console.log("Building (production build, a few minutes) ...");
  const built = await run(["build"]);
  if (built !== 0) process.exit(built);
}
process.exit(await run(prod ? ["start", "-p", "3100"] : ["dev", "-p", "3100"]));
