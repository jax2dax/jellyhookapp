#!/usr/bin/env node
/* eslint-disable */
// scripts/sim/dev-bench.mjs - runs Jellyhook on http://localhost:3100 against the TEST database (npm run dev:bench).
//
// Reads .env.bench (the separate Supabase project's keys; never committed, never read by anyone but this process) before
// Next.js starts, so its values win over .env.local: Next.js never overrides a variable that is already set. Builds into
// .next-bench, so it can run next to the normal dev server (port 3000, .next) without the two clashing.
// What .env.bench must contain: mds/build/control-room.md ("The test environment").
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

if (!existsSync(".env.bench")) {
  console.error("No .env.bench. Create it with the test Supabase project's keys (see mds/build/control-room.md, 'The test environment').");
  process.exit(1);
}
const next = path.join("node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, ["--env-file=.env.bench", next, "dev", "-p", "3100"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_DIST_DIR: ".next-bench", JELLYHOOK_BENCH: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
