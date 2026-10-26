// scripts/sim/guardtest.mjs - checks the safety guard of `npm run dev:bench` (scripts/sim/dev-bench.mjs): it must start only
// against a database that carries the test mark (mds/bench/01-mark-test-database.sql), and refuse every other one, and it
// must never print a key. Runs against a mock database server in a temporary folder; touches no real .env or database.
// Run: node scripts/sim/guardtest.mjs
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let fails = 0;
const ok = (c, m) => {
  console.log((c ? "ok: " : "FAIL: ") + m);
  if (!c) fails++;
};
let mode = "marked";
const srv = http.createServer((req, res) => {
  const authed = req.headers.apikey === "secret-key-value" && req.headers.authorization === "Bearer secret-key-value";
  if (!authed || !req.url.startsWith("/rest/v1/jh_environment")) {
    res.writeHead(401);
    return res.end("{}");
  }
  const json = (code, body) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(body);
  };
  if (mode === "marked") return json(200, '[{"name":"bench"}]');
  if (mode === "empty") return json(200, "[]");
  if (mode === "other") return json(200, '[{"name":"production"}]');
  return json(404, '{"code":"PGRST205"}'); // the table is missing: a production database
});
srv.listen(4188, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bench-"));
  fs.writeFileSync(
    path.join(dir, ".env.bench"),
    "SUPABASE_URL=http://localhost:4188\nNEXT_PUBLIC_SUPABASE_URL=http://localhost:4188\nSUPABASE_SERVICE_ROLE_KEY=secret-key-value\nNEXT_PUBLIC_SUPABASE_ANON_KEY=anon-value\nHOOK_DATABASE_URL=postgres-value\n",
  );
  const run = () =>
    new Promise((resolve) => {
      const c = spawn(process.execPath, [path.resolve("scripts/sim/dev-bench.mjs")], { cwd: dir, env: { ...process.env, JELLYHOOK_BENCH_CHECK_ONLY: "1" } });
      let out = "";
      c.stdout.on("data", (d) => (out += d));
      c.stderr.on("data", (d) => (out += d));
      c.on("exit", (code) => resolve({ code, out }));
    });
  const a = await run();
  ok(a.code === 0 && /Marked as the test database: ok/.test(a.out), "a database with the test mark starts");
  ok(!/secret-key-value|anon-value|postgres-value/.test(a.out), "no value of .env.bench is ever printed (only names and the host)");
  for (const m of ["empty", "other", "missing"]) {
    mode = m;
    const b = await run();
    ok(b.code === 1 && /NOT STARTING/.test(b.out) && !/secret-key-value/.test(b.out), `a database without the mark is refused (${m})`);
  }
  srv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
});
