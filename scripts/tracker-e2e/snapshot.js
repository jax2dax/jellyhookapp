/* eslint-disable */
// The form page "so far", sent with a form, in real Chrome (mds/build/notifications/session-summary.md). Mock server.
// Scenario: about 2 s on "Hero" at the top, scroll to "Contact" (the form), about 3 s there, send the form, stay 2 s,
// then hide the tab. Checks that the form carries a snapshot of this page view (its heading times so far, scroll), that
// taking it did not stop the count (the page's own end still arrives with the full time), and that the two agree.
//   node scripts/tracker-e2e/snapshot.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const events = [];
const block = (h) => `<div style="height:1000px;border-top:1px solid #ccc">${h}</div>`;
const PAGE = `<!doctype html><html><head><title>s</title>
<script src="http://localhost:4104/tracker.js" data-key="${KEY}"></script></head>
<body style="margin:0"><div style="height:200px">intro</div>
${block("<h1>Hero</h1><p>text</p>")}
${block("<h1>Pricing</h1><p>text</p>")}
${block(`<h1>Contact</h1><form id="f"><label>Name <input name="name"></label><label>Email <input type="email" name="email"></label><button type="submit">Send</button></form>`)}
<script>document.addEventListener("submit", function (e) { e.preventDefault(); });</script></body></html>`;

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
      events.push({ path: req.url.split("?")[0], body: parsed });
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
const keyOf = (t) => { t = t.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120); let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const secOf = (ht, t) => { const e = ht && ht.h.find((x) => x[0] === keyOf(t)); return e ? e[3] / 10 : 0; };
const trackEvents = () => events.filter((e) => e.path === "/api/track" && Array.isArray(e.body)).flatMap((e) => e.body);

(async () => {
  await new Promise((r) => server.listen(4104, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const ctx = browser.defaultBrowserContext();
  const A = await ctx.newPage();
  await A.setViewport({ width: 1200, height: 800 });
  await A.goto("http://localhost:4104/page", { waitUntil: "load" });
  await sleep(2200);
  await A.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(3200);
  await A.type('input[name="name"]', "Ada Lovelace");
  await A.type('input[type="email"]', "ada@example.com");
  await A.click('button[type="submit"]');
  await sleep(2000);
  const B = await ctx.newPage(); // hide the tab: the page view ends
  await B.bringToFront();
  await sleep(1500);

  const form = events.find((e) => e.path === "/api/track-form");
  const snap = form && form.body && form.body.page_snapshot;
  const start = trackEvents().find((e) => e.type === "page_view_start");
  const end = trackEvents().find((e) => e.type === "page_view_end");
  console.log("\npage_snapshot:", JSON.stringify(snap));
  console.log("page_view_end heading_time:", JSON.stringify(end && end.heading_time));
  ok(!!snap, "the form carries a snapshot of the page");
  ok(snap && start && snap.page_view_id === start.page_view_id, "of this very page view");
  ok(snap && snap.max_scroll_depth > 0.9 && snap.viewport_height === 800, "with its scroll so far (" + (snap && snap.max_scroll_depth) + ")");
  const ht = snap && snap.heading_time;
  ok(!!ht && secOf(ht, "Hero") >= 1.5 && secOf(ht, "Hero") <= 3, "Hero about 2 s (" + secOf(ht, "Hero") + ")");
  ok(!!ht && secOf(ht, "Contact") >= 2.5, "Contact about 3 s or more, up to the form (" + secOf(ht, "Contact") + ")");
  const total = ht ? ht.h.reduce((n, x) => n + x[3], 0) / 10 : 0;
  ok(ht && Math.abs(total - snap.duration / 1000) <= 0.1 * ht.h.length + 0.3, "the snapshot adds up to the time so far (" + total + " s vs " + (snap.duration / 1000).toFixed(1) + " s)");
  ok(!!end && !!end.heading_time, "the page view still ends normally, with its heading times");
  ok(end && secOf(end.heading_time, "Contact") >= secOf(ht, "Contact") + 1.5, "taking the snapshot did not stop the count (Contact " + secOf(ht, "Contact") + " s at the form, " + (end && secOf(end.heading_time, "Contact")) + " s at the end)");
  ok(end && Math.abs(secOf(end.heading_time, "Hero") - secOf(ht, "Hero")) <= 0.2, "time before the form is the same in both (Hero)");

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
