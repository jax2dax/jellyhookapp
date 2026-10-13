/* eslint-disable */
// End-to-end check of FORM VIEW detection in a real Chrome, against a mock server (nothing touches the database).
// The founder's case: scroll down to the form, leave the tab, come back WITHOUT scrolling, leave, come back...
// Every page view that has the form on screen must send its own "viewed" with the form's position, and a form
// taller than two screens (which can never be 50% visible) must still count as seen.
//
// Run: node scripts/tracker-e2e/formview.js   (needs puppeteer-core: npm i --no-save puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const events = [];

const PAGE = (formHeight) => `<!doctype html><html><head><title>f</title>
<script src="http://localhost:4101/tracker.js" data-key="${KEY}" data-debug></script></head>
<body style="margin:0"><h1>Top</h1><div style="height:3000px"></div>
<form data-conversion="true" style="height:${formHeight}px;background:#eee"><input name="email" type="email"><input name="name"><button type="submit">Send</button></form>
<div style="height:300px"></div></body></html>`;

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
  if (req.method === "OPTIONS") { res.writeHead(200, cors); return res.end(); }
  if (req.url.startsWith("/tracker.js")) { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(TRACKER); }
  if (req.url.startsWith("/api/site-config")) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end('{"specify_form":false}'); }
  if (req.url.startsWith("/short")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE(400)); }
  if (req.url.startsWith("/tall")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE(2400)); }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch (e) {}
      events.push({ path: req.url, body: parsed });
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end('{"success":true}');
    });
    return;
  }
  res.writeHead(404); res.end();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const track = () => events.filter((e) => e.path === "/api/track").flatMap((e) => (Array.isArray(e.body) ? e.body : []));
const viewed = () => events.filter((e) => e.path === "/api/track-form-engagement" && e.body && e.body.status === "viewed").map((e) => e.body);
let fails = 0;
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) fails++; };

(async () => {
  await new Promise((r) => server.listen(4101, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const ctx = browser.defaultBrowserContext();

  // ── short form: scroll to it, then leave and return 3 times without scrolling ──
  const A = await ctx.newPage();
  await A.setViewport({ width: 1200, height: 665 });
  await A.goto("http://localhost:4101/short", { waitUntil: "load" });
  await sleep(1200);
  ok(viewed().length === 0, "short: form not seen at the top of the page");
  await A.evaluate(() => window.scrollTo(0, 2900));
  await sleep(1200);
  ok(viewed().length === 1 && viewed()[0].form_top_y > 2900, "short: scrolled to the form, one 'viewed' with its position (" + (viewed()[0] || {}).form_top_y + ")");

  const other = await ctx.newPage();
  for (let i = 1; i <= 3; i++) {
    await other.bringToFront();
    await sleep(800);
    await A.bringToFront();
    await A.mouse.move(300, 300);
    await sleep(1500);
  }
  const starts = track().filter((e) => e.type === "page_view_start");
  const v = viewed();
  console.log("page views:", starts.map((s) => s.page_view_id.slice(0, 4) + "@" + s.entry_scroll).join(" "), "| viewed for:", v.map((x) => x.page_view_id.slice(0, 4)).join(" "));
  ok(starts.length === 4, "short: 4 page views (load + 3 returns)");
  const withForm = starts.filter((s) => v.some((x) => x.page_view_id === s.page_view_id));
  ok(withForm.length === 4, "short: EVERY page view with the form on screen sent its own 'viewed' (" + withForm.length + "/4)");
  const ends = track().filter((e) => e.type === "page_view_end");
  ok(ends.every((e) => e.revisit_start_scroll === null), "short: no scroll back up, so revisit_start_scroll is null on every page view end");
  await A.close();
  await other.close();

  // ── tall form (2400px on a 665px screen: can never be 50% visible) ──
  const before = viewed().length;
  const T = await ctx.newPage();
  await T.setViewport({ width: 1200, height: 665 });
  await T.goto("http://localhost:4101/tall", { waitUntil: "load" });
  await sleep(1000);
  await T.evaluate(() => window.scrollTo(0, 3300));
  await sleep(1200);
  ok(viewed().length === before + 1, "tall: a form taller than two screens still counts as seen when it fills the screen");

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
