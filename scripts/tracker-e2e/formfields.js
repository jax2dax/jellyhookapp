/* eslint-disable */
// Real Chrome, mock server: what the tracker says about a form's fields, for marks on form answers (2026-10-24).
// Proves, on a real form:
//  - "viewed" carries each field's visible label (from <label for>, a wrapping <label>, aria-label, a radio group's
//    <legend>, a placeholder), a dropdown's / radio group's / checkbox group's choices, a number's and slider's limits;
//  - "viewed" still carries no value;
//  - the sent form's raw_data now has the picked radio and the checked boxes (they were never sent before);
//  - a card number field is still never sent.
//   node scripts/tracker-e2e/formfields.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const events = [];
const PAGE = `<!doctype html><html><head><title>f</title>
<script src="http://localhost:4105/tracker.js" data-key="${KEY}"></script></head>
<body><form id="f" onsubmit="return false">
  <label for="email">Work email *</label><input id="email" name="email" type="email">
  <label>Company size <input name="company_size" type="number" min="1" max="5000" step="1"></label>
  <input name="field_3" aria-label="Monthly budget" type="text">
  <input name="timeline" placeholder="When do you want to start?">
  <label for="svc">Service:</label><select id="svc" name="service"><option value="">Pick one</option><option value="brand">Branding</option><option value="web">Web design</option></select>
  <fieldset><legend>Budget range</legend>
    <label><input type="radio" name="budget" value="tier_1"> Under $1k</label>
    <label><input type="radio" name="budget" value="tier_2"> $1k-$5k</label>
    <label><input type="radio" name="budget" value="tier_3"> $5k+</label>
  </fieldset>
  <fieldset><legend>Interested in</legend>
    <label><input type="checkbox" name="interest" value="seo"> SEO</label>
    <label><input type="checkbox" name="interest" value="ads"> Ads</label>
    <label><input type="checkbox" name="interest" value="email"> Email</label>
  </fieldset>
  <label><input type="checkbox" name="consent"> I agree to be contacted</label>
  <label>Effort <input type="range" name="effort" min="0" max="10" step="2"></label>
  <label>Card <input name="cc-number" autocomplete="cc-number"></label>
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
  await new Promise((r) => server.listen(4105, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });
  const A = await browser.newPage();
  await A.setViewport({ width: 1200, height: 1400 });
  await A.goto("http://localhost:4105/page", { waitUntil: "load" });
  await sleep(1500);
  await A.click("#email");
  await A.keyboard.type("ann@example.com", { delay: 5 });
  await A.type("input[name=company_size]", "40");
  await A.type("input[name=field_3]", "$3,000");
  await A.select("#svc", "web");
  await A.click("input[name=budget][value=tier_2]");
  await A.click("input[name=interest][value=seo]");
  await A.click("input[name=interest][value=email]");
  await A.click("input[name=consent]");
  await A.type("input[name=cc-number]", "4111111111111111");
  await A.click("#send");
  await sleep(2000);

  const eng = events.filter((e) => e.path === "/api/track-form-engagement").map((e) => e.body);
  const viewed = eng.find((e) => e.form_fields);
  const fields = (viewed && viewed.form_fields) || [];
  console.log("field list:", JSON.stringify(fields));
  const f = (k) => fields.find((x) => x.key === k) || {};
  ok(f("email").label === "Work email", "label from <label for>, the * and : trimmed (" + f("email").label + ")");
  ok(f("custom:company_size").label === "Company size", "label from a wrapping <label> (" + f("custom:company_size").label + ")");
  ok(f("custom:company_size").min === 1 && f("custom:company_size").max === 5000 && f("custom:company_size").step === 1, "a number's limits");
  ok(f("custom:field_3").label === "Monthly budget", "label from aria-label for a field named field_3 (" + f("custom:field_3").label + ")");
  ok(f("custom:timeline").label === "When do you want to start?", "label from the placeholder");
  ok(f("custom:service").label === "Service" && (f("custom:service").options || []).length === 2 && f("custom:service").options[1].v === "web" && f("custom:service").options[1].l === "Web design", "a dropdown's label and choices, without the empty 'Pick one'");
  ok(f("custom:budget").type === "radio" && f("custom:budget").label === "Budget range" && (f("custom:budget").options || []).length === 3 && f("custom:budget").options[1].l === "$1k-$5k", "a radio group: legend as label, its 3 choices with their text");
  ok(f("custom:interest").label === "Interested in" && (f("custom:interest").options || []).length === 3, "a checkbox group: legend, 3 choices");
  ok(f("custom:consent").label === "I agree to be contacted", "a single checkbox's label");
  ok(f("custom:effort").type === "range" && f("custom:effort").max === 10 && f("custom:effort").step === 2, "a slider's limits");
  ok(!JSON.stringify(eng).includes("ann@example.com") && !JSON.stringify(eng).includes("$3,000"), "the field list and the engagement events carry no value");

  const sent = events.find((e) => e.path === "/api/track-form");
  const raw = (sent && sent.body && sent.body.raw_data) || {};
  console.log("raw_data:", JSON.stringify(raw));
  ok(raw.budget === "tier_2", "the picked radio is sent (" + raw.budget + ")");
  ok(raw.interest === "seo, email", "the checked boxes are sent (" + raw.interest + ")");
  ok(raw.consent === "yes", "a checked box without a value is sent as yes");
  ok(raw.field_3 === "$3,000" && raw.service === "web" && raw.company_size === "40", "the other answers as before");
  ok(!JSON.stringify(sent ? sent.body : {}).includes("4111111111111111"), "a card number is never sent");

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
