/* eslint-disable */
// The tracker's outbox, in real Chrome (public/tracker.js "OUTBOX"; why: mds/crowd-test/v1/summary.md). A mock server
// answers 503 ("busy, try again") for a while, as the real one now does when the database does not answer.
// Checks:
//   1. a form sent while the server answers 503 is sent again until it is accepted, always with the same submission_id
//   2. page events sent during the 503s are sent again too
//   3. a form whose page is left (same tab, next page) before it was accepted is sent from the next page
//   4. a 4xx answer is final: not retried
//   node scripts/tracker-e2e/outbox.js   (needs puppeteer-core; CHROME_PATH if Chrome is not in the default place)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const PORT = 4107;
let busyUntil = 0; // answer 503 until this time
let formStatus = null; // when set, /api/track-form answers this status (for the 4xx check)
const seen = { form: [], formAccepted: [], track: 0, trackAccepted: 0 };

const PAGE = (next) => `<!doctype html><html><head><title>o</title><script src="http://localhost:${PORT}/tracker.js" data-key="${KEY}"></script></head><body>
<form id="contact" action="/sink" method="post"><input name="name" value="Ada"><input type="email" name="email" value="ada@acme.com"><input name="message" value="hi"><button type="submit">Send</button></form>
<a id="next" href="/${next}">next</a>
<script>document.addEventListener("submit", function (e) { e.preventDefault(); });</script></body></html>`;

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
  const u = req.url.split("?")[0];
  if (req.method === "OPTIONS") { res.writeHead(200, cors); return res.end(); }
  if (u === "/tracker.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(TRACKER); }
  if (u === "/api/site-config") { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end("{}"); }
  if (u === "/page" || u === "/page2") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE(u === "/page" ? "page2" : "page")); }
  if (req.method === "POST") {
    let b = "";
    req.on("data", (d) => (b += d));
    req.on("end", () => {
      const busy = Date.now() < busyUntil;
      let status = busy ? 503 : 200;
      if (u === "/api/track-form") {
        if (formStatus) status = formStatus;
        try {
          const j = JSON.parse(b);
          if (!j.skipped) {
            seen.form.push(j.submission_id);
            if (status === 200) seen.formAccepted.push(j.submission_id);
          }
        } catch (e) {}
      }
      if (u === "/api/track") {
        seen.track++;
        if (status === 200) seen.trackAccepted++;
      }
      res.writeHead(status, { ...cors, "Content-Type": "application/json" });
      res.end(status === 200 ? '{"success":true}' : '{"error":"busy"}');
    });
    return;
  }
  res.writeHead(200, cors); res.end();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) fails++; };
const reset = () => { seen.form = []; seen.formAccepted = []; seen.track = 0; seen.trackAccepted = 0; formStatus = null; };

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });

  // 1 and 2: busy for 4 s from the start, then fine
  reset();
  let ctx = await browser.createBrowserContext();
  let p = await ctx.newPage();
  busyUntil = Date.now() + 4000;
  await p.goto(`http://localhost:${PORT}/page`, { waitUntil: "load" });
  await sleep(1200);
  await p.click("#contact button");
  await sleep(12000); // the outbox pauses 2 s, then 5 s
  const ids = new Set(seen.form);
  console.log("form sends:", seen.form.length, "accepted:", seen.formAccepted.length, "page event sends:", seen.track, "accepted:", seen.trackAccepted);
  ok(seen.form.length >= 2 && seen.formAccepted.length === 1, "a form answered 503 is sent again until accepted, and accepted once");
  ok(ids.size === 1 && [...ids][0], "every send of that form carries the same submission_id");
  ok(seen.trackAccepted >= 1 && seen.track > seen.trackAccepted, "page events answered 503 are sent again and then accepted");
  await ctx.close();

  // 3: the page is left while the server is busy; the next page of the same tab sends the form
  reset();
  ctx = await browser.createBrowserContext();
  p = await ctx.newPage();
  busyUntil = Date.now() + 60_000;
  await p.goto(`http://localhost:${PORT}/page`, { waitUntil: "load" });
  await sleep(1200);
  await p.click("#contact button");
  await sleep(500);
  busyUntil = Date.now() + 1500; // the server recovers shortly after the visitor moved on
  await p.click("#next");
  await p.waitForNavigation({ waitUntil: "load" }).catch(() => {});
  await sleep(6000);
  console.log("after leaving the page: form sends:", seen.form.length, "accepted:", seen.formAccepted.length);
  ok(seen.formAccepted.length === 1, "a form not accepted before the page was left is sent from the next page and accepted once");
  ok(new Set(seen.form).size === 1, "with the same submission_id");
  await ctx.close();

  // 4: a 4xx is final
  reset();
  ctx = await browser.createBrowserContext();
  p = await ctx.newPage();
  busyUntil = 0;
  formStatus = 400;
  await p.goto(`http://localhost:${PORT}/page`, { waitUntil: "load" });
  await sleep(1200);
  await p.click("#contact button");
  await sleep(4000);
  ok(seen.form.length === 1, "a 4xx answer is not retried (" + seen.form.length + " send)");
  await ctx.close();

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : "\nall passed");
  process.exit(fails ? 1 : 0);
})();
