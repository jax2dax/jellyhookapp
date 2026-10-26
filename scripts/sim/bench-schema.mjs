#!/usr/bin/env node
// scripts/sim/bench-schema.mjs - makes bench-schema.sql: the STRUCTURE of the production database (tables, columns,
// indexes, functions, policies; no rows), to run once in the TEST project's SQL editor (mds/bench/WHICH-SQL-WHERE.md).
//
//   node scripts/sim/bench-schema.mjs "<production connection string>"
//
// The connection string is in the Supabase dashboard of the PRODUCTION project: Connect > "Session pooler" (replace
// [YOUR-PASSWORD] with the database password). It is used only to READ the structure: pg_dump --schema-only never
// writes to the database and never includes data. pg_dump runs inside Docker (the postgres:17 image), so nothing has to
// be installed; Docker Desktop must be running. The result is cleaned (scripts/sim/dumpclean.mjs) and written to
// bench-schema.sql in this folder (ignored by git). Only the public schema is dumped.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { cleanDump } from "./dumpclean.mjs";

const url = process.argv[2];
if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error('Usage: node scripts/sim/bench-schema.mjs "<production connection string>"\nThe string starts with postgresql:// (Supabase dashboard > Connect > Session pooler).');
  process.exit(1);
}
const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "(unreadable)";
  }
})();
console.log(`Reading the structure (no data) of ${host} ... this only reads production.`);

const tmp = mkdtempSync(path.join(os.tmpdir(), "jh-schema-"));
const run = spawnSync(
  "docker",
  ["run", "--rm", "-v", `${tmp}:/out`, "postgres:17", "pg_dump", "--schema-only", "--schema=public", "--no-owner", "--no-privileges", "-f", "/out/schema.sql", url],
  { stdio: ["ignore", "inherit", "inherit"] },
);
if (run.error || run.status !== 0) {
  console.error(
    `\nThe dump failed (${run.error ? run.error.message : "exit " + run.status}).\n` +
      "Check: Docker Desktop is running; the connection string is the Session pooler one with the real password in place of [YOUR-PASSWORD].",
  );
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}
const raw = readFileSync(path.join(tmp, "schema.sql"), "utf8");
rmSync(tmp, { recursive: true, force: true });
const cleaned = cleanDump(raw);
writeFileSync("bench-schema.sql", cleaned);
const tables = (cleaned.match(/^CREATE TABLE /gm) || []).length;
const functions = (cleaned.match(/^CREATE (OR REPLACE )?FUNCTION /gm) || []).length;
console.log(`\nWrote bench-schema.sql: ${tables} tables, ${functions} functions, ${Math.round(cleaned.length / 1024)} KB.`);
console.log("Next: open the TEST project's SQL editor (check its name says BENCH), paste the file's contents and run it.");
