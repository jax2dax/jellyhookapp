/* eslint-disable */
// What happens to a focused form field when the visitor leaves the tab and comes back? Real Chrome, mock server.
// Scenario: click into the email field, type, switch to another tab for ~4 s, come back, type more, submit.
// Prints the form-engagement events the tracker sent, and checks that the 4 s away are NOT counted as time in the field.
//   node scripts/tracker-e2e/formaway.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const events = [];
const PAGE = `<!doctype html><html><head><title>f</title>
<script src="http://localhost:4102/tracker.js" data-key="${KEY}"></script></head>
<body style="margin:0"><h1>Contact</h1>
<form data-conversion="true" onsubmit="return false"><input id="email" name="email" type="email"><input id="name" name="name"><button type="submit">Send</button></form></body></html>`;

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
  if (req.method === "OPTIONS") { res.writeHead(200, cors); return res.end(); }
  if (req.url.startsWith("/tracker.js")) { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(TRACKER); }
  if (req.url.startsWith("/api/site-config")) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end('{"specify_form":false}'); }
  if (req.url.startsWith("/page")) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE); }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch (e) {}
      events.push({ t: Date.now(), path: req.url, body: parsed });
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

(async () => {
  await new Promise((r) => server.listen(4102, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const ctx = browser.defaultBrowserContext();
  const A = await ctx.newPage();
  await A.goto("http://localhost:4102/page", { waitUntil: "load" });
  await sleep(1200);

  const tClick = Date.now();
  await A.click("#email");
  await A.keyboard.type("ann@example.com", { delay: 30 });
  await sleep(1500); // ~1.5 s focused and typing
  const tLeave = Date.now();
  const B = await ctx.newPage(); // leave the tab (the field stays the page's active element)
  await B.bringToFront();
  await sleep(4000); // ~4 s away
  await A.bringToFront();
  const tReturn = Date.now();
  await sleep(1200);
  const tBack = Date.now();
  await A.keyboard.type("x", { delay: 30 });
  await sleep(1500); // ~1.5 s focused again
  await A.click("button[type=submit]"); // blurs the field and submits
  const tSubmit = Date.now();
  await sleep(1500);

  const eng = events.filter((e) => e.path === "/api/track-form-engagement").map((e) => e.body);
  console.log("\nform-engagement events (status, field deltas in ms):");
  for (const e of eng) {
    const d = e.field_timings_delta ? Object.entries(e.field_timings_delta).map(([k, v]) => k + "=" + v.totalFocusedMsDelta) .join(",") : "-";
    console.log("  " + e.status.padEnd(9) + " page_view " + String(e.page_view_id).slice(0, 4) + "  delta: " + d);
  }
  const total = eng.reduce((n, e) => n + (e.field_timings_delta && e.field_timings_delta.email ? e.field_timings_delta.email.totalFocusedMsDelta : 0), 0);
  const inField = (tLeave - tClick) + (tSubmit - tReturn); // time the field really was focused: before leaving + after coming back
  const away = tReturn - tLeave;
  console.log("field really focused for about " + inField + " ms, tab hidden for about " + away + " ms. The tracker counted " + total + " ms.");
  ok(eng.some((e) => e.status === "started"), "started was sent when the field was first focused");
  ok(Math.abs(total - inField) < 900, "time in the field counted correctly (" + total + " vs about " + inField + " ms), the " + away + " ms away are NOT counted");
  ok(eng.filter((e) => e.field_timings_delta && e.field_timings_delta.email).length >= 2, "the field's time arrives in at least two pieces (before leaving, after coming back)");
  const sub = events.filter((e) => e.path === "/api/track-form");
  ok(sub.length === 1, "one submission recorded");
  await browser.close();
  server.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
