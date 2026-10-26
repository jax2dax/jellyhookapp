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
console.log(`Test database: ${host}\n`);

const next = path.join("node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "-p", "3100"], {
  stdio: "inherit",
  env: { ...process.env, ...bench, NEXT_DIST_DIR: ".next-bench", JELLYHOOK_BENCH: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
