/* eslint-disable */
// New HubSpot forms (v4, the "hs-form-frame" embed) in real Chrome. Mock server.
// The form itself lives in HubSpot's iframe; what the page sees is HubSpot's documented API ("Global form events"):
// window event "hs-form-event:on-submission:success" (detail { formId, instanceId }) and
// HubSpotFormsV4.getFormFromEvent(event).getFormFieldValues() -> [{ name: "0-1/email", value }]. The page below stands
// in for HubSpot's embed script with exactly that API. Honest limit: it proves the tracker's side against HubSpot's
// documentation, not HubSpot's live script; a real submission on a real page is the final check.
//   node scripts/tracker-e2e/hubspotv4.js   (needs puppeteer-core)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
const FORM_ID = "29478cf5-7fa5-4065-b80d-c8347ee65073";
let SPECIFY = false;
const forms = [];

// stands in for js-na2.hsforms.net/forms/embed/<portal>.js: values come back after a short wait, like the real one
const fakeEmbed = (mode) => `<script>
window.HubSpotFormsV4 = {
  getFormFromEvent: function () {
    return { getFormFieldValues: function () {
      ${mode === "hang" ? "return new Promise(function () {});" : `return new Promise(function (r) { setTimeout(function () { r([
        { name: "0-1/email", value: "ada@acme.com" }, { name: "0-1/firstname", value: "Ada" }, { name: "0-1/lastname", value: "Lovelace" },
        { name: "0-1/phone", value: "555-0101" }, { name: "0-2/name", value: "Acme" }, { name: "0-1/interests", value: ["Pricing", "Demo"] }
      ]); }, 150); });`}
    } };
  }
};
window.fakeSubmit = function () {
  window.dispatchEvent(new CustomEvent("hs-form-event:on-submission:success", { detail: { formId: "${FORM_ID}", instanceId: "inst-" + Math.random().toString(36).slice(2) } }));
};
</script>`;
const page = (wrapped, mode) => `<!doctype html><html><head><title>v4</title>
<script src="http://localhost:4105/tracker.js" data-key="${KEY}"></script></head><body>
<h1>Contact</h1>
${wrapped ? '<div data-conversion="true">' : ""}<div class="hs-form-frame" data-region="na2" data-form-id="${FORM_ID}" data-portal-id="247791723"><iframe src="about:blank" title="HubSpot form"></iframe></div>${wrapped ? "</div>" : ""}
${fakeEmbed(mode)}</body></html>`;

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*" };
  const u = req.url.split("?")[0];
  if (req.method === "OPTIONS") { res.writeHead(200, cors); return res.end(); }
  if (u === "/tracker.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(TRACKER); }
  if (u === "/api/site-config") { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify({ specify_form: SPECIFY })); }
  if (u.startsWith("/p/")) {
    const [, , wrapped, mode] = u.split("/");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(page(wrapped === "wrapped", mode));
  }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => {
      try { if (u === "/api/track-form") forms.push(JSON.parse(body)); } catch (e) {}
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

async function submit(browser, wrapped, mode, specify, waitMs = 1500) {
  SPECIFY = specify;
  forms.length = 0;
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.goto(`http://localhost:4105/p/${wrapped ? "wrapped" : "bare"}/${mode}`, { waitUntil: "load" });
  await sleep(1200);
  await p.evaluate(() => window.fakeSubmit());
  await sleep(waitMs);
  await ctx.close();
  return forms.slice();
}

(async () => {
  await new Promise((r) => server.listen(4105, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });

  const a = await submit(browser, false, "ok", false);
  const f = a[0];
  console.log("captured:", JSON.stringify(f && { email: f.email, name: f.name, phone: f.phone, raw: f.raw_data, snapshot: !!f.page_snapshot }));
  ok(a.length === 1, "a new HubSpot form submission is captured, once");
  ok(f && f.email === "ada@acme.com", "email from the field 0-1/email");
  ok(f && f.name === "Ada Lovelace", "name from 0-1/firstname + 0-1/lastname");
  ok(f && f.phone === "555-0101", "phone");
  ok(f && f.raw_data && f.raw_data._source === "hubspot" && f.raw_data.interests === "Pricing, Demo", "a multi-checkbox answer is kept as text");
  ok(f && f.raw_data && f.raw_data["0-2/name"] === "Acme" && f.name === "Ada Lovelace", "the company's name field does not replace the person's name");
  ok(f && f.page_snapshot && f.page_snapshot.page_view_id, "with the page snapshot (summary and marks see the form page)");

  ok((await submit(browser, true, "ok", true)).length === 1, "specify-form mode: captured inside a data-conversion wrapper");
  ok((await submit(browser, false, "ok", true)).length === 0, "specify-form mode: ignored without the wrapper");

  const hang = await submit(browser, false, "hang", false, 3000);
  ok(hang.length === 1 && hang[0].email === null, "values never arrive: the submission is still sent after 2 s (without email)");

  await browser.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
  process.exit(fails ? 1 : 0);
})();
