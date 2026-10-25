/* eslint-disable */
// Time per heading in real Chrome (mds/build/heading-time/plan.md). Mock server; prints what the tracker sent.
// Scenario on a page with h1 "Hero" (+ h2 "Why us"), h1 "Pricing" (+ h2 "Plans"), h1 "Contact", 1000 px apart:
// ~3 s at the top, ~4 s with "Pricing" across the middle, ~2 s at the bottom of the page, then the tab is hidden.
// Then the cost: the same scrolling with the meter on and off, compared by Chrome's own script time.
//   node scripts/tracker-e2e/headings.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const FULL = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const NO_METER = FULL.replace("    headingMeter.start();", "    /* meter off */");
if (NO_METER === FULL) throw new Error("could not switch the meter off");
let tracker = FULL;
const KEY = "11111111-2222-3333-4444-555555555555";
const events = [];
const block = (h) => `<div style="height:1000px;border-top:1px solid #ccc">${h}<p>text</p></div>`;
const PAGE = `<!doctype html><html><head><title>h</title>
<script src="http://localhost:4103/tracker.js" data-key="${KEY}"></script></head>
<body style="margin:0"><div style="height:300px">intro, above every heading</div>
${block('<h1>Hero</h1><div style="height:400px"></div><h2>Why us</h2>')}
<h2 style="display:none">Hidden heading</h2>
${block('<h1>Pricing</h1><div style="height:400px"></div><h2>Plans</h2>')}
${block("<h1>Contact</h1>")}</body></html>`;

const COLS = `<!doctype html><html><head><title>c</title>
<script src="http://localhost:4103/tracker.js" data-key="${KEY}"></script></head>
<body style="margin:0"><div style="display:flex;height:2000px"><div style="width:50%"><h1>Left column</h1><p>a</p></div><div style="width:50%"><h1>Right column</h1><p>b</p></div></div></body></html>`;
const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
  if (req.method === "OPTIONS") { res.writeHead(200, cors); return res.end(); }
  if (req.url.startsWith("/tracker.js")) { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(tracker); }
  if (req.url.startsWith("/api/site-config")) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end("{}"); }
  if (req.url.startsWith("/cols")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(COLS); }
  if (req.url.startsWith("/page")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE); }
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
let fails = 0;
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) fails++; };
// the server's key for a heading text (same as lib/tracking/headingTime.js keyOfText)
const keyOf = (t) => { t = t.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

(async () => {
  await new Promise((r) => server.listen(4103, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const ctx = browser.defaultBrowserContext();
  const A = await ctx.newPage();
  await A.setViewport({ width: 1200, height: 800 });
  await A.goto("http://localhost:4103/page", { waitUntil: "load" });
  await sleep(3000); // top: the line (400 px) is above every heading -> "^" ... until Hero's h1 at 301 px is above it: Hero
  await A.evaluate(() => window.scrollTo(0, 1300 - 400 + 50)); // Pricing's h1 (about 1301 px) just above the middle
  await sleep(4000);
  await A.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); // bottom: "Contact"
  await sleep(2000);
  const B = await ctx.newPage(); // hide the tab: the page view ends
  await B.bringToFront();
  await sleep(1500);

  const end = events.filter((e) => e.path === "/api/track" && Array.isArray(e.body)).flatMap((e) => e.body).find((e) => e.type === "page_view_end");
  const ht = end && end.heading_time;
  console.log("\nheading_time sent:", JSON.stringify(ht), "(" + JSON.stringify(ht || "").length + " bytes)");
  const sec = (t) => { const e = ht && ht.h.find((x) => x[0] === keyOf(t)); return e ? e[3] / 10 : 0; };
  ok(!!ht && ht.t === 1, "sent with page_view_end, top level h1");
  ok(sec("Hero") >= 2.5 && sec("Hero") <= 3.6, "Hero about 3 s (" + sec("Hero") + ")");
  ok(sec("Pricing") + sec("Plans") >= 3 && sec("Pricing") + sec("Plans") <= 5, "Pricing about 4 s (" + sec("Pricing") + " + Plans " + sec("Plans") + ")");
  ok(sec("Contact") >= 1 && sec("Contact") <= 3, "Contact about 2 s at the bottom of the page (" + sec("Contact") + ")");
  ok(!ht.h.some((x) => x[0] === keyOf("Hidden heading")), "the hidden heading gets nothing");
  ok(!ht.h.some((x) => x[0] === "^") || ht.h.find((x) => x[0] === "^")[3] <= 3, "almost nothing on the top of the page (Hero is in view from the start)");
  const total = ht.h.reduce((n, x) => n + x[3], 0) / 10;
  // every millisecond lands in one entry (headings, "^" above them, "~" passing through): only tenths rounding remains
  ok(Math.abs(total - end.duration / 1000) <= 0.1 * ht.h.length + 0.05, "the times add up to the page time exactly (" + total + " s vs " + (end.duration / 1000).toFixed(1) + " s)");
  ok(!ht.h.some((x) => x[0] === keyOf("Why us")) || sec("Why us") < 1.5, "a sub-heading only scrolled past gets little or nothing");

  // ── two headings side by side (same row): both are in front of the visitor, they SHARE the time (sum stays exact) ──
  const C = await ctx.newPage();
  await C.setViewport({ width: 1200, height: 800 });
  await C.goto("http://localhost:4103/cols", { waitUntil: "load" });
  await sleep(3500);
  const D = await ctx.newPage();
  await D.bringToFront();
  await sleep(1500);
  const colEnd = events.filter((e) => e.path === "/api/track" && Array.isArray(e.body)).flatMap((e) => e.body).filter((e) => e.type === "page_view_end" && e.heading_time && e.heading_time.h.some((x) => x[0] === keyOf("Left column"))).pop();
  const colSec = (t) => { const e = colEnd && colEnd.heading_time.h.find((x) => x[0] === keyOf(t)); return e ? e[3] / 10 : 0; };
  console.log("two columns:", JSON.stringify(colEnd && colEnd.heading_time));
  ok(colSec("Left column") >= 1.2 && Math.abs(colSec("Left column") - colSec("Right column")) <= 0.1, "side-by-side headings share the time equally (" + colSec("Left column") + " s and " + colSec("Right column") + " s)");
  const colTotal = colEnd ? colEnd.heading_time.h.reduce((n, x) => n + x[3], 0) / 10 : 0;
  ok(colEnd && Math.abs(colTotal - colEnd.duration / 1000) <= 0.25, "and together they add up to the page time (" + colTotal + " s vs " + (colEnd ? (colEnd.duration / 1000).toFixed(1) : "?") + " s)");

  // ── flicking: 12 quick scrolls of ~0.2 s between two headings go to "~" (passing through), not to the headings ──
  const F = await ctx.newPage();
  await F.setViewport({ width: 1200, height: 800 });
  await F.goto("http://localhost:4103/page", { waitUntil: "load" });
  await sleep(1500);
  for (let i = 0; i < 12; i++) {
    await F.evaluate((y) => window.scrollTo(0, y), i % 2 ? 1300 : 2300);
    await sleep(200);
  }
  await F.evaluate(() => window.scrollTo(0, 2300));
  await sleep(300);
  const G = await ctx.newPage();
  await G.bringToFront();
  await sleep(1500);
  const flickEnd = events.filter((e) => e.path === "/api/track" && Array.isArray(e.body)).flatMap((e) => e.body).filter((e) => e.type === "page_view_end" && e.heading_time).pop();
  console.log("flicking:", JSON.stringify(flickEnd && flickEnd.heading_time));
  const passing = flickEnd ? (flickEnd.heading_time.h.find((x) => x[0] === "~") || [0, 0, 0, 0])[3] / 10 : 0;
  ok(passing >= 1.5, "quick back-and-forth goes to passing through (" + passing + " s)");
  const flickTotal = flickEnd ? flickEnd.heading_time.h.reduce((n, x) => n + x[3], 0) / 10 : 0;
  ok(flickEnd && Math.abs(flickTotal - flickEnd.duration / 1000) <= 0.1 * flickEnd.heading_time.h.length + 0.05, "and the page still adds up (" + flickTotal + " s vs " + (flickEnd ? (flickEnd.duration / 1000).toFixed(1) : "?") + " s)");

  // ── cost: the same 60 scroll steps with the meter on and off ──
  const cost = async (src) => {
    tracker = src;
    const P = await ctx.newPage();
    await P.setViewport({ width: 1200, height: 800 });
    await P.goto("http://localhost:4103/page", { waitUntil: "load" });
    await P.bringToFront();
    await sleep(800);
    const before = await P.metrics();
    for (let i = 0; i < 60; i++) { await P.evaluate((y) => window.scrollTo(0, y), (i % 30) * 100); await sleep(50); }
    await sleep(1500);
    const after = await P.metrics();
    await P.close();
    return (after.ScriptDuration - before.ScriptDuration) * 1000;
  };
  const runs = { on: [], off: [] };
  for (let r = 0; r < 4; r++) { runs.off.push(await cost(NO_METER)); runs.on.push(await cost(FULL)); }
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log("script time over 60 scrolls + ~4.5 s: meter off " + med(runs.off).toFixed(1) + " ms, on " + med(runs.on).toFixed(1) + " ms (median of 4)");
  ok(med(runs.on) - med(runs.off) < 15, "the meter adds less than 15 ms of script time over 60 scrolls (" + (med(runs.on) - med(runs.off)).toFixed(1) + " ms)");

  await browser.close();
  server.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
