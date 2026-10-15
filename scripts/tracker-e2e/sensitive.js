/* eslint-disable */
// Real Chrome, mock server: sensitive fields never leave the page (2026-10-14).
// A form with a card number, a CVC (by autocomplete only), a card number typed into a free-text field, an SSN in a
// notes field, an IBAN by label, and a field the site owner marked data-jh-ignore. Checks the lead that is sent
// (/api/track-form) and every other request.
//   node scripts/tracker-e2e/sensitive.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const CARD = "4242 4242 4242 4242";
const events = [];
const PAGE = `<!doctype html><html><head><title>f</title>
<script src="http://localhost:4104/tracker.js" data-key="${KEY}"></script></head>
<body><form data-conversion="true" onsubmit="return false">
  <input id="email" name="email" type="email">
  <input id="name" name="name">
  <input id="company" name="company">
  <input id="cardnumber" name="cardnumber">
  <input id="x1" name="x1" autocomplete="cc-csc">
  <label for="acct">IBAN</label><input id="acct" name="field_7">
  <input id="notes" name="notes">
  <input id="msg" name="message">
  <div data-jh-ignore><input id="internal" name="internal_ref"></div>
  <button id="send" type="submit">Send</button>
</form></body></html>`;

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
  await new Promise((r) => server.listen(4104, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const A = await browser.newPage();
  await A.goto("http://localhost:4104/page", { waitUntil: "load" });
  await sleep(1000);
  const fill = async (sel, text) => { await A.click(sel); await A.keyboard.type(text, { delay: 5 }); };
  await fill("#email", "ann@example.com");
  await fill("#name", "Ann Lee");
  await fill("#company", "Acme");
  await fill("#cardnumber", CARD);
  await fill("#x1", "123");
  await fill("#acct", "DE89370400440532013000");
  await fill("#notes", "123-45-6789");
  await fill("#msg", "Please call me");
  await fill("#internal", "do-not-store-this");
  await A.click("#send");
  await sleep(1500);

  const lead = events.find((e) => e.path === "/api/track-form");
  ok(!!lead, "the lead was sent");
  const raw = (lead && lead.body && lead.body.raw_data) || {};
  console.log("raw_data sent:", JSON.stringify(raw));
  ok(raw.company === "Acme" && raw.message === "Please call me", "ordinary fields are kept (company, message)");
  ok(lead.body.email === "ann@example.com" && lead.body.name === "Ann Lee", "name and email still detected");
  ok(!("cardnumber" in raw), "card number field (by name) left out");
  ok(!("x1" in raw), "CVC field (by autocomplete=cc-csc only) left out");
  ok(!("field_7" in raw), "IBAN field (by its label only) left out");
  ok(!("notes" in raw), "an SSN typed into a notes field left out (by value)");
  ok(!("internal_ref" in raw), "data-jh-ignore field left out of the lead");
  const all = events.map((e) => e.raw).join("\n");
  ok(!all.includes("4242 4242") && !all.includes("123-45-6789") && !all.includes("DE8937") && !all.includes("do-not-store-this"), "none of those values appears in ANY request");
  const eng = events.filter((e) => e.path === "/api/track-form-engagement").map((e) => e.body);
  const keys = eng.flatMap((e) => Object.keys(e.field_timings_delta || {}).concat((e.form_fields || []).map((f) => f.key)));
  ok(!keys.some((k) => k.includes("internal_ref")), "data-jh-ignore field has no timings and is not in the field list");
  ok(keys.some((k) => k.includes("cardnumber")), "a sensitive field still has its timing (time only, never its value)");

  await browser.close();
  server.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
