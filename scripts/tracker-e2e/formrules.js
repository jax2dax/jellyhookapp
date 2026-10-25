/* eslint-disable */
// Which forms are leads, in real Chrome (mds/build/forms/lead-forms.md). Mock server; /api/site-config returns the
// site's default (specify_form) and per-form switches (form_rules) as the real one does. A page with three forms:
//   #contact     (no attribute)                      #newsletter (no attribute)
//   #careers     data-conversion="false"             #demo        data-conversion="true"
// Checks: the switch decides an unmarked form, a mark beats the switch, the site default applies to unswitched forms,
// a form that is not a lead sends only a "skipped" count (no answers), and every lead names its form (form_key_hint).
//   node scripts/tracker-e2e/formrules.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
let CONFIG = {};
const posts = [];

const form = (id, attr) =>
  `<form id="${id}" ${attr || ""} action="/sink" method="post"><input name="name" value="Ada ${id}"><input type="email" name="email" value="${id}@acme.com"><input name="message" value="hello from ${id}"><button type="submit">Send</button></form>`;
const PAGE = `<!doctype html><html><head><title>f</title><script src="http://localhost:4106/tracker.js" data-key="${KEY}"></script></head><body>
${form("contact")}${form("newsletter")}${form("careers", 'data-conversion="false"')}${form("demo", 'data-conversion="true"')}
<script>document.addEventListener("submit", function (e) { e.preventDefault(); });</script></body></html>`;

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
  const u = req.url.split("?")[0];
  if (req.method === "OPTIONS") { res.writeHead(200, cors); return res.end(); }
  if (u === "/tracker.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(TRACKER); }
  if (u === "/api/site-config") { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify(CONFIG)); }
  if (u === "/page") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE); }
  if (req.method === "POST") {
    let b = "";
    req.on("data", (d) => (b += d));
    req.on("end", () => {
      try { if (u === "/api/track-form") posts.push(JSON.parse(b)); } catch (e) {}
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end('{"success":true}');
    });
    return;
  }
  res.writeHead(200, cors); res.end();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log(c ? "ok:" : "FAIL:", m); if (!c) fails++; };

/** Submits each form once on a fresh page with this config; returns { leads: Set of form ids, skipped: Set, raw } */
async function run(browser, config) {
  CONFIG = config;
  posts.length = 0;
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.goto("http://localhost:4106/page", { waitUntil: "load" });
  await sleep(1200);
  for (const id of ["contact", "newsletter", "careers", "demo"]) {
    await p.click("#" + id + " button");
    await sleep(500);
  }
  await sleep(800);
  await ctx.close();
  const idOf = (x) => x && x.form_key_hint && x.form_key_hint.id;
  return {
    leads: new Set(posts.filter((x) => !x.skipped).map(idOf)),
    skipped: new Set(posts.filter((x) => x.skipped).map(idOf)),
    raw: posts.slice(),
  };
}

(async () => {
  await new Promise((r) => server.listen(4106, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });

  // 1. a new site (every form counts), the newsletter switched off in Settings
  const a = await run(browser, { specify_form: false, form_rules: { "id:newsletter": false } });
  console.log("new site, newsletter off:", [...a.leads], "skipped:", [...a.skipped]);
  ok(a.leads.has("contact") && a.leads.has("demo"), "unswitched and marked-true forms are leads");
  ok(!a.leads.has("newsletter") && a.skipped.has("newsletter"), "a form switched off is not a lead; it is counted as skipped");
  ok(!a.leads.has("careers") && a.skipped.has("careers"), 'data-conversion="false" is never a lead');
  const lead = a.raw.find((x) => !x.skipped && x.form_key_hint && x.form_key_hint.id === "contact");
  ok(lead && lead.email === "contact@acme.com" && lead.form_index === 0 && lead.conversion_mark === null, "a lead carries its form (id, position, no mark)");
  ok(a.raw.filter((x) => x.skipped).every((x) => !("email" in x) && !("name" in x) && !("raw_data" in x) && !("phone" in x)), "skipped counts carry no name, email or answers");

  // 2. a mark beats the switch
  const b = await run(browser, { specify_form: false, form_rules: { "id:demo": false, "id:careers": true } });
  ok(b.leads.has("demo"), 'data-conversion="true" is a lead even when its switch is off');
  ok(!b.leads.has("careers"), 'data-conversion="false" is not a lead even when its switch is on');

  // 3. an "Only forms I mark" site: unswitched forms wait, a switch turns one on
  const c = await run(browser, { specify_form: true, form_rules: { "id:contact": true } });
  console.log("marked-only site, contact on:", [...c.leads], "skipped:", [...c.skipped]);
  ok(c.leads.has("contact") && c.leads.has("demo"), "the switched-on form and the marked form are leads");
  ok(!c.leads.has("newsletter") && c.skipped.has("newsletter"), "an unswitched form is not (as before on such sites)");

  // 4. no config (the endpoint failed): every unmarked form counts, as the safe default
  const d = await run(browser, {});
  ok(d.leads.has("contact") && d.leads.has("newsletter") && !d.leads.has("careers"), "no config: every form but the one marked false");

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
