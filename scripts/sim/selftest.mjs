// scripts/sim/selftest.mjs - checks the traffic simulator (scripts/sim/traffic.mjs) against a recording mock server: what it
// sends, from which origin, with which key, the rush mode, and that it refuses production. No database. Run: node scripts/sim/selftest.mjs
/* eslint-disable */
import http from "node:http";
import { spawn } from "node:child_process";
const got = { track: [], form: [], headers: [] };
const srv = http.createServer((req, res) => {
  let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => {
    const j = JSON.parse(b || "null");
    got.headers.push({ origin: req.headers.origin, key: req.headers["x-api-key"] });
    if (req.url === "/api/track") got.track.push(...j); else if (req.url === "/api/track-form") got.form.push(j);
    res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"success":true}');
  });
}).listen(4199, async () => {
  const run = (extra) => new Promise((r) => { const c = spawn(process.execPath, ["scripts/sim/traffic.mjs", "--base", "http://localhost:4199", "--key", "k-123456789", "--domain", "sim.jellyhook.test", "--visitors", "6", "--over", "1", "--dwell", "0.1-0.3", "--form-rate", "1", "--returning", "0.5", ...extra], { stdio: ["ignore", "pipe", "pipe"] }); let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d)); c.on("exit", (code) => r({ code, out })); });
  const a = await run(["--burst", "3"]);
  const types = got.track.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {});
  const ok = (c, m) => console.log((c ? "ok: " : "FAIL: ") + m);
  ok(a.code === 0, "the simulator finishes cleanly");
  ok(types.session_start >= 9 && types.page_view_start >= 9 && types.page_view_end >= 6, "visits, page views and their ends: " + JSON.stringify(types));
  ok(got.form.length === 9, "every visitor sent the form (6) plus the rush (3): " + got.form.length);
  const f = got.form[0];
  ok(f.form_key_hint && f.form_index === 0 && f.page_snapshot && f.page_snapshot.page_view_id && f.email.includes("@"), "a form carries its key, position, page snapshot and an email");
  ok(got.headers.every((h) => h.origin === "https://sim.jellyhook.test" && h.key === "k-123456789"), "every request comes from the site's own domain, with the key");
  const pvEnd = got.track.find((e) => e.type === "page_view_end");
  ok(pvEnd.duration > 0 && pvEnd.max_scroll_depth > 0 && pvEnd.page_view_id, "a page view ends with its time and scroll");
  const prod = await run(["--base", "https://jellyhook.com"]);
  ok(prod.code === 1 && /Refusing/.test(prod.out), "it refuses to send to jellyhook.com without --allow-production");
  srv.close();
});
