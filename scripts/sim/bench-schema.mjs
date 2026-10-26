#!/usr/bin/env node
// scripts/sim/bench-schema.mjs - makes bench-schema.sql: the STRUCTURE of the production database (tables, columns,
// indexes, functions, policies; no rows), to run once in the TEST project's SQL editor (mds/bench/WHICH-SQL-WHERE.md).
//
//   node scripts/sim/bench-schema.mjs "<production connection string>"
//
// The connection string is in the Supabase dashboard of the PRODUCTION project: Connect > "Session pooler" (replace
// [YOUR-PASSWORD] with the database password). It is used only to READ the structure: pg_dump --schema-only never
// writes to the database and never includes data. pg_dump comes from the PostgreSQL command-line tools if they are
// installed (no Docker needed), else from Docker (the postgres:17 image; Docker Desktop must be running). The result is
// cleaned (scripts/sim/dumpclean.mjs) and written to bench-schema.sql in this folder (ignored by git). Only the public
// schema is dumped.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** Where PostgreSQL's command-line tools usually are: Windows installs them off the PATH, in a folder per version. */
export function pgDumpCandidates(env = process.env, listDir = (d) => readdirSync(d)) {
  const out = [];
  const versioned = (base, file) => {
    try {
      for (const v of listDir(base).sort((x, y) => Number(y) - Number(x))) out.push(path.join(base, v, "bin", file));
    } catch {
      /* the folder is not there */
    }
  };
  for (const pf of [env["ProgramFiles"], env["ProgramFiles(x86)"], "C:\\Program Files"]) if (pf) versioned(path.join(pf, "PostgreSQL"), "pg_dump.exe");
  versioned("/usr/lib/postgresql", "pg_dump"); // Linux
  versioned("/Library/PostgreSQL", "pg_dump"); // macOS installer
  out.push("/opt/homebrew/bin/pg_dump", "/usr/local/bin/pg_dump");
  return out;
}

/** pg_dump on this computer: on the PATH, or at one of the usual places. */
function findPgDump() {
  const works = (cmd) => spawnSync(cmd, ["--version"], { encoding: "utf8" }).status === 0;
  if (works("pg_dump")) return "pg_dump";
  return pgDumpCandidates().find((c) => existsSync(c) && works(c)) ?? null;
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "jh-schema-"));
const local = findPgDump();
const dumpArgs = ["--schema-only", "--schema=public", "--no-owner", "--no-privileges"];
let run;
if (local) {
  console.log(`Using the PostgreSQL tools on this computer (${local}).`);
  run = spawnSync(local, [...dumpArgs, "-f", path.join(tmp, "schema.sql"), url], { stdio: ["ignore", "inherit", "inherit"] });
} else {
  console.log("PostgreSQL tools not found on this computer; trying Docker (Docker Desktop must be running).");
  run = spawnSync("docker", ["run", "--rm", "-v", `${tmp}:/out`, "postgres:17", "pg_dump", ...dumpArgs, "-f", "/out/schema.sql", url], { stdio: ["ignore", "inherit", "inherit"] });
}
if (run.error || run.status !== 0) {
  console.error(
    `\nThe dump failed (${run.error ? run.error.message : "exit " + run.status}).\n` +
      (local
        ? "Check: the connection string is the Session pooler one with the real password in place of [YOUR-PASSWORD]. If the message says the server version is newer than pg_dump's, install the latest PostgreSQL command-line tools."
        : "Neither the PostgreSQL command-line tools nor a running Docker were found. Install the PostgreSQL command-line tools (mds/bench/WHICH-SQL-WHERE.md), then run this again."),
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
