// End-to-end check of public/tracker.js in a REAL Chrome, against a mock server
// (nothing touches your database or Supabase).
//
// What it proves: one shared session across windows, one active window at a time (no
// overlapping page views), idle close and a new session after idle, heartbeats, click
// events, health reports, structure reports, text/plain sends (no preflight requests),
// and the tightened fetch interceptor plus data-track-field.
//
// Run (one-off install, not saved to package.json):
//   npm i --no-save puppeteer-core
//   node scripts/tracker-e2e/run.js
// Set CHROME_PATH if Chrome is not in the default Windows location.
// Takes about 40 seconds. Exit code 0 = all checks passed.
const http = require("http");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const path = require("path");
const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const events = []; // [{path, body}]
const t0 = Date.now();

const PAGE = (title) => `<!doctype html><html><head><title>${title}</title>
<script src="http://localhost:4100/tracker.js" data-key="${KEY}" data-debug></script></head>
<body style="margin:0">
<h1>Welcome</h1><p>hello</p>
<button id="b" data-track-click="hero-cta" style="width:200px;height:50px">Go</button>
<div style="height:1500px"></div><h2>Pricing</h2>
<form data-conversion="true"><input name="email" type="email" data-track-field><input name="name"><button type="submit">Send</button></form>
<div data-conversion="true">wrong element</div>
<div style="height:1500px"></div>
</body></html>`;

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
  if (req.method === "OPTIONS") { events.push({ path: "OPTIONS " + req.url }); res.writeHead(200, cors); return res.end(); }
  if (req.url.startsWith("/tracker-fast.js")) { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(FAST); }
  if (req.url.startsWith("/tracker.js")) { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(TRACKER); }
  if (req.url.startsWith("/api/site-config")) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end('{"specify_form":false}'); }
  if (req.url.startsWith("/fast")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE("fast").replace("tracker.js", "tracker-fast.js")); }
  if (req.url.startsWith("/page")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE(req.url)); }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch (e) {}
      events.push({ t: Date.now() - t0, path: req.url, ct: req.headers["content-type"], body: parsed });
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end('{"success":true}');
    });
    return;
  }
  res.writeHead(404); res.end();
});

const FAST = TRACKER.replace("const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;", "const SESSION_IDLE_TIMEOUT_MS = 3000;").replace("}, 30 * 1000);", "}, 250);").replace("const HEARTBEAT_MS = 5 * 60 * 1000;", "const HEARTBEAT_MS = 1200;");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const track = () => events.filter((e) => e.path === "/api/track").flatMap((e) => (Array.isArray(e.body) ? e.body : []));
const summary = () => track().map((e) => `${e.type}${e.session_id ? " s=" + e.session_id.slice(0, 4) : ""}${e.page_view_id ? " pv=" + e.page_view_id.slice(0, 4) : ""}${e.name ? " name=" + e.name : ""}`);
let fails = 0;
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) fails++; };

(async () => {
  await new Promise((r) => server.listen(4100, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const ctx = browser.defaultBrowserContext();
  const logs = [];

  const A = await ctx.newPage();
  A.on("console", (m) => logs.push("A:" + m.text()));
  await A.goto("http://localhost:4100/page-a", { waitUntil: "load" });
  await sleep(4000);
  let ev = track();
  console.log("after A load:", summary().join(" | "));
  ok(ev.filter((e) => e.type === "session_start").length === 1, "A: exactly one session_start");
  ok(ev.filter((e) => e.type === "page_view_start").length === 1, "A: exactly one page_view_start");
  ok(ev.find((e) => e.type === "session_start")?.is_first_visit === true, "A: first visit flagged");
  ok(ev.find((e) => e.type === "page_view_start")?.viewport_width > 0, "A: viewport_width sent");
  ok(ev.every((e) => e.host === "localhost"), "A: every event carries host");
  ok(events.filter((e) => e.path === "/api/track").every((e) => (e.ct || "").startsWith("text/plain")), "sends are text/plain (no preflight)");
  ok(!events.some((e) => e.path && e.path.startsWith("OPTIONS")), "no preflight OPTIONS requests at all");
  const health = ev.find((e) => e.type === "health");
  ok(health && health.report.conversion_form.marked === 1 && health.report.conversion_form.wrong_element === 1, "health: 1 marked form, 1 wrong element found");
  ok(health && health.report.field_attr.marked === 1 && health.report.click_attr.marked === 1, "health: field + click attributes found");
  const struct = events.filter((e) => e.path === "/api/track-structure");
  ok(struct.length === 1 && struct[0].body.structures.length === 2 && struct[0].body.page_view_id, "structure: sent once with 2 headers and page_view_id");

  // click on marked element
  await A.click('#b');
  await sleep(500);
  ok(track().some((e) => e.type === "click" && e.name === "hero-cta"), "click event sent with name");
  const pvA = track().find((e) => e.type === "page_view_start").page_view_id;

  // second window, same browser: shares the session, A pauses
  const B = await ctx.newPage();
  B.on("console", (m) => logs.push("B:" + m.text()));
  await B.goto("http://localhost:4100/page-b", { waitUntil: "load" });
  await B.bringToFront();
  await sleep(1500);
  ev = track();
  console.log("after B load:", summary().join(" | "));
  ok(ev.filter((e) => e.type === "session_start").length === 1, "B joins the SAME session (still one session_start)");
  const sids = new Set(ev.filter((e) => e.session_id).map((e) => e.session_id));
  ok(sids.size === 1, "all events share one session_id");
  ok(ev.some((e) => e.type === "page_view_end" && e.page_view_id === pvA), "A's page view ended when B became active");
  const starts = ev.filter((e) => e.type === "page_view_start");
  ok(starts.length === 2, "two page views total, not overlapping");
  const aEnd = ev.findIndex((e) => e.type === "page_view_end" && e.page_view_id === pvA);
  const bStart = ev.findIndex((e) => e.type === "page_view_start" && e.page_view_id !== pvA);
  console.log("order: A end index", aEnd, "B start index", bStart);

  // use A again: B pauses, A reopens
  await A.bringToFront();
  await A.mouse.click(300, 300);
  await sleep(1500);
  ev = track();
  console.log("after A reuse:", summary().join(" | "));
  const open = new Set();
  let maxOpen = 0;
  for (const e of ev) {
    if (e.type === "page_view_start") open.add(e.page_view_id);
    if (e.type === "page_view_end") open.delete(e.page_view_id);
    maxOpen = Math.max(maxOpen, open.size);
  }
  // rebuild real intervals: start = arrival time, end = arrival time minus "ended N ms ago"
  const tl = events.filter((e) => e.path === "/api/track").flatMap((e) => (e.body || []).map((b) => ({ ...b, t: e.t })));
  const iv = {};
  for (const e of tl) {
    if (e.type === "page_view_start") iv[e.page_view_id] = { s: e.t };
    if (e.type === "page_view_end" && iv[e.page_view_id]) iv[e.page_view_id].e = e.t - (e.ended_ago_ms || 0);
  }
  const list = Object.values(iv).filter((x) => x.e !== undefined).sort((a, b) => a.s - b.s);
  let worstOverlap = 0;
  for (let i = 1; i < list.length; i++) worstOverlap = Math.max(worstOverlap, list[i - 1].e - list[i].s);
  console.log("intervals:", list.map((x) => [x.s, x.e]));
  ok(worstOverlap <= 250, "page views do not overlap beyond network jitter (worst overlap " + worstOverlap + " ms)");
  ok(ev.filter((e) => e.type === "page_view_start").length === 3, "A reopened with a fresh page view (3 starts)");
  ok(ev.filter((e) => e.type === "session_start").length === 1, "still one session_start");

  // closing windows does not end the session
  const before = track().filter((e) => e.type === "session_end").length;
  await B.close();
  await A.close();
  await sleep(800);
  ok(track().filter((e) => e.type === "session_end").length === before && before === 0, "closing windows sends NO session_end");

  // noise check
  const noisy = logs.filter((l) => /Tracker/.test(l));
  console.log("debug lines (data-debug is on in the test page):", noisy.length);

  // silent without data-debug
  const C = await ctx.newPage();
  const clogs = [];
  C.on("console", (m) => clogs.push(m.text()));
  await C.setRequestInterception(true);
  C.on("request", (r) => r.continue());
  await C.goto("http://localhost:4100/page-c", { waitUntil: "load" });
  await sleep(300);
  await C.evaluate(() => { localStorage.removeItem("jh_debug"); });
  await C.close();

  // ── idle scenario (idle shortened to 3 s, heartbeat to 1.2 s) ──
  events.length = 0;
  const ctx2 = await browser.createBrowserContext();
  const F = await ctx2.newPage();
  await F.goto("http://localhost:4100/fast", { waitUntil: "load" });
  await sleep(2500);
  let fe = track();
  ok(fe.filter((e) => e.type === "heartbeat").length >= 1, "heartbeat sent while the visit is alive");
  await sleep(2500); // now ~5 s with no interaction: idle > 3 s
  fe = track();
  const fsid = fe.find((e) => e.type === "session_start").session_id; const idleEnd = fe.find((e) => e.type === "page_view_end" && e.session_id === fsid);
  ok(!!idleEnd && idleEnd.ended_ago_ms >= 1500, "idle: page view closed as of the last use (ended_ago_ms=" + (idleEnd && idleEnd.ended_ago_ms) + ")");
  const hbBefore = fe.filter((e) => e.type === "heartbeat").length;
  await sleep(1500);
  ok(track().filter((e) => e.type === "heartbeat").length === hbBefore, "no heartbeats while idle-paused");
  await F.mouse.click(10, 300); // the visitor comes back
  await sleep(1200);
  fe = track();
  console.log("after idle return:", fe.map((e) => e.type + (e.session_id ? " s=" + e.session_id.slice(0, 4) : "")).join(" | "));
  const starts2 = fe.filter((e) => e.type === "session_start");
  ok(starts2.length === 2, "coming back after idle starts a NEW session (2 session_starts)");
  ok(fe.some((e) => e.type === "session_end" && e.ended_ago_ms > 0), "the old session is closed with how long ago it really ended");
  ok(starts2[0].session_id !== starts2[1].session_id && starts2[1].is_first_visit !== true, "new session id; not flagged as a first visit");
  await ctx2.close();

  // ── form paths ──
  events.length = 0;
  const ctx3 = await browser.createBrowserContext();
  const G = await ctx3.newPage();
  await G.goto("http://localhost:4100/page-g", { waitUntil: "load" });
  await sleep(1200);
  const forms = () => events.filter((e) => e.path === "/api/track-form").map((e) => e.body);
  // 1. values set by script, no visitor interaction, then a POST: NOT a conversion
  await G.evaluate(() => { document.querySelector("[name=email]").value = "bot@example.com"; return fetch("http://localhost:4100/other", { method: "POST", body: "x" }).catch(() => {}); });
  await sleep(500);
  ok(forms().length === 0, "interceptor: no capture without the visitor using the form");
  // 2. visitor types, then a GET (e.g. an image or analytics call): NOT a conversion
  await G.click("[name=email]");
  await G.type("[name=email]", "real@example.com");
  await G.evaluate(() => fetch("http://localhost:4100/pixel").catch(() => {}));
  await sleep(500);
  ok(forms().length === 0, "interceptor: a GET never counts as a submission");
  // 3. visitor types, then a POST: captured, once
  await G.type("[name=name]", "Pat");
  await G.evaluate(() => fetch("http://localhost:4100/other", { method: "POST", body: "x" }).catch(() => {}));
  await sleep(700);
  const captured = forms();
  ok(captured.length === 1, "interceptor: POST right after using the form is captured once (" + captured.length + ")");
  ok(captured[0] && captured[0].is_labelled_conversion === true && String(captured[0].email).includes("real@example.com"), "capture: labelled conversion with the email");
  ok(captured[0] && captured[0].name === "Pat", "capture: lead name still detected from an unmarked field");
  ok(captured[0] && Object.keys(captured[0].raw_data).join() === "email", "data-track-field: raw_data holds only the marked field (" + (captured[0] && Object.keys(captured[0].raw_data).join()) + ")");
  const eng = events.filter((e) => e.path === "/api/track-form-engagement").map((e) => e.body);
  const timed = eng.flatMap((b) => Object.keys(b.field_timings_delta || {}));
  ok(timed.length > 0 && timed.every((k) => k === "email"), "data-track-field: only the marked field has timings (" + [...new Set(timed)].join() + ")");
  ok(eng.every((b) => b.has_marked_fields === true), "engagement tells the server the form has marked fields");
  await ctx3.close();

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL OK");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
