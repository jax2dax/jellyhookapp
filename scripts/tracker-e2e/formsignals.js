/* eslint-disable */
// Real Chrome, mock server: the form-study signals (2026-10-14). Proves, on a real form:
//  - "viewed" carries the field list (keys, types, required) and NO values;
//  - "started" carries the on-screen time before starting (the form was on screen ~2 s before the first click);
//  - every field visit is reported on its own (a field left and returned to arrives as two visits);
//  - each visit says filled yes/no and edited yes/no, never the value;
//  - a submit blocked by the browser's own validation reports which field failed;
//  - nothing typed ever appears in any request.
//   node scripts/tracker-e2e/formsignals.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const SECRET_TEXT = "zq-secret-typed-text";
const events = [];
const PAGE = `<!doctype html><html><head><title>f</title>
<script src="http://localhost:4103/tracker.js" data-key="${KEY}"></script></head>
<body style="margin:0"><h1>Top</h1><div style="height:1400px"></div>
<form data-conversion="true" onsubmit="return false">
  <input id="email" name="email" type="email" required>
  <input id="name" name="name" required>
  <select id="plan" name="plan"><option value="">-</option><option value="a">A</option></select>
  <input id="phone" name="phone" type="tel">
  <input type="hidden" name="token" value="x">
  <button id="send" type="submit">Send</button>
</form><div style="height:300px"></div></body></html>`;

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
      events.push({ path: req.url, raw: body, body: parsed });
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
  await new Promise((r) => server.listen(4103, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const A = await browser.newPage();
  await A.setViewport({ width: 1200, height: 700 });
  await A.goto("http://localhost:4103/page", { waitUntil: "load" });
  await sleep(800);
  await A.evaluate(() => window.scrollTo(0, 1200)); // the form comes on screen
  await sleep(2000); // ~2 s on screen before starting

  await A.click("#email");
  await A.keyboard.type("bad", { delay: 20 });
  await A.click("#send"); // browser validation: email invalid AND name empty -> "invalid" on both
  await sleep(600);
  await A.click("#name");
  await A.keyboard.type(SECRET_TEXT, { delay: 10 });
  await A.click("#email"); // back to email: a second visit
  await A.keyboard.down("Control"); await A.keyboard.press("A"); await A.keyboard.up("Control");
  await A.keyboard.type("ann@example.com", { delay: 10 });
  await A.click("#phone"); // focus and leave empty
  await A.click("#send");
  await sleep(1500);

  const eng = events.filter((e) => e.path === "/api/track-form-engagement").map((e) => e.body);
  const viewed = eng.find((e) => e.status === "viewed");
  const fields = viewed && viewed.form_fields;
  console.log("field list:", JSON.stringify(fields));
  ok(Array.isArray(fields) && fields.length === 4, "viewed carries the field list (4 fields, the hidden one left out)");
  ok(fields && fields.find((f) => f.key === "email" && f.type === "email" && f.required) && fields.find((f) => f.key === "name" && f.required) && fields.find((f) => f.key === "phone" && !f.required) && fields.find((f) => f.type === "select"), "keys, types and the required flag are right");

  const started = eng.find((e) => e.status === "started" && typeof e.onscreen_before_start_ms === "number");
  console.log("on screen before starting:", started && started.onscreen_before_start_ms, "ms");
  ok(started && started.onscreen_before_start_ms >= 1500 && started.onscreen_before_start_ms < 4500, "started carries the on-screen time before starting (about 2 s)");

  const deltas = eng.filter((e) => e.field_timings_delta).flatMap((e) => Object.entries(e.field_timings_delta).map(([k, v]) => ({ k, ...v })));
  console.log("visits:", deltas.map((d) => d.k + "(" + d.totalFocusedMsDelta + "ms filled=" + d.filled + " edited=" + d.edited + ")").join(" "));
  const emailVisits = deltas.filter((d) => d.k === "email");
  ok(emailVisits.length >= 2, "a field left and returned to arrives as separate visits (" + emailVisits.length + ")");
  // visit 2 is the browser moving focus into the invalid field after the blocked submit: nothing changed, edited=false
  ok(emailVisits.filter((d) => d.edited === true).length === 2 && emailVisits.some((d) => d.edited === false) && emailVisits.every((d) => d.filled === true), "email visits: two edited, one not (the browser focusing it after the blocked submit), all filled");
  const phone = deltas.find((d) => d.k === "phone");
  ok(phone && phone.filled === false && phone.edited === false, "phone focused and left empty: filled false, edited false");

  const errs = eng.filter((e) => e.field_errors_delta).map((e) => e.field_errors_delta);
  console.log("validation errors:", JSON.stringify(errs));
  ok(errs.some((m) => m.email >= 1) && errs.some((m) => m.name >= 1), "the blocked submit reported both invalid fields (email, name)");

  // the lead itself carries the submitted values (as it always has); every OTHER request must not
  const all = events.filter((e) => e.path !== "/api/track-form").map((e) => e.raw).join("\n");
  ok(!all.includes(SECRET_TEXT) && !all.includes("ann@example.com") && !all.includes('"bad"'), "nothing typed appears in any engagement or tracking request");
  const lead = events.filter((e) => e.path === "/api/track-form");
  ok(lead.length >= 1, "the final submit was captured as a lead (its values travel only in the lead, as before)");

  await browser.close();
  server.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
