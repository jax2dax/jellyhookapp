/* eslint-disable */
// Form compatibility check for public/tracker.js in a REAL Chrome.
//
// Each case is the markup a platform really produces (Salesforce Web-to-Lead, Pardot form handler,
// Marketo Forms 2.0, HubSpot, Mailchimp, Contact Form 7, Gravity Forms, WPForms, plus iframe
// providers). A visitor types into it and submits; the harness reports what the tracker captured.
//
// Honest limits: the markup is reproduced from each vendor's documentation and public embed code,
// not fetched from live vendor accounts, and the iframe providers are SIMULATED (a page served at the
// provider's real origin posts the message the vendor documents). It proves how the tracker behaves on
// that markup; it does not prove a vendor never changes its markup.
//
//   npm i --no-save puppeteer-core
//   node scripts/tracker-e2e/forms.js          (set CHROME_PATH if needed)
const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const TRACKER = fs.readFileSync(path.resolve(__dirname, "../../public/tracker.js"), "utf8");
const KEY = "11111111-2222-3333-4444-555555555555";
let SPECIFY = false;
const captured = [];
const health = [];

// The starter form offered on the create-site screen: the harness uses the very same text the screen shows.
const STARTER_FORM = fs.readFileSync(path.resolve(__dirname, "../../app/platform/create-site/starterForm.mjs"), "utf8").match(/STARTER_FORM = `([^`]*)`;/)[1];

const FORM_SUBMIT = "document.addEventListener('submit', e => { e.preventDefault(); }, false);"; // vendors submit through their own JS

const CASES = [
  {
    id: "jellyhook-starter-form",
    label: "Jellyhook starter form (the one offered on the create-site screen)",
    selfMarked: true,
    html: STARTER_FORM,
    fill: { name: "Ada Lovelace", email: "ada@example.com", phone: "555-0101", message: "Hello" },
    submit: "button[type=submit]",
    expect: { email: "ada@example.com", name: "Ada Lovelace", phone: "555-0101" },
  },
  {
    id: "salesforce-web-to-lead",
    label: "Salesforce Web-to-Lead (plain HTML form, posts to webto.salesforce.com)",
    html: `<form action="/sink" method="POST"><input type=hidden name="oid" value="00D5g000000ABCD"><input type=hidden name="retURL" value="http://localhost/thanks">
      <label for="first_name">First Name</label><input id="first_name" maxlength="40" name="first_name" size="20" type="text" />
      <label for="last_name">Last Name</label><input id="last_name" maxlength="80" name="last_name" size="20" type="text" />
      <label for="email">Email</label><input id="email" maxlength="80" name="email" size="20" type="text" />
      <label for="company">Company</label><input id="company" maxlength="40" name="company" size="20" type="text" />
      <label for="phone">Phone</label><input id="phone" maxlength="40" name="phone" size="20" type="text" />
      <input type="submit" name="submit"></form>`,
    fill: { first_name: "Dana", last_name: "Scully", email: "dana@fbi.gov", company: "FBI", phone: "+1 555 0100" },
    submit: "input[type=submit]",
    expect: { email: "dana@fbi.gov", name: "Dana Scully", phone: "+1 555 0100" },
  },
  {
    id: "pardot-form-handler",
    label: "Pardot / Account Engagement form handler (your own HTML form posting to go.pardot.com)",
    html: `<form action="/sink" method="post" accept-charset="UTF-8"><p><label for="email">Email</label><input type="email" id="email" name="email"></p>
      <p><label>First name <input type="text" name="first_name"></label></p><p><label>Last name <input type="text" name="last_name"></label></p>
      <p><label>Company <input type="text" name="company"></label></p><button type="submit">Send</button></form>`,
    fill: { email: "mulder@fbi.gov", first_name: "Fox", last_name: "Mulder", company: "FBI" },
    submit: "button[type=submit]",
    expect: { email: "mulder@fbi.gov", name: "Fox Mulder" },
  },
  {
    id: "marketo-forms2",
    label: "Marketo Forms 2.0 (JavaScript-rendered form, submits via JSONP)",
    html: `<script>${FORM_SUBMIT}</script><form id="mktoForm_1001" class="mktoForm" style="width:400px"><div class="mktoFormRow"><div class="mktoFieldDescriptor mktoFormCol"><label for="FirstName" class="mktoLabel mktoHasWidth">First Name:</label><div class="mktoGutter mktoHasWidth"></div><input id="FirstName" name="FirstName" maxlength="255" type="text" class="mktoField mktoTextField"></div></div>
      <div class="mktoFormRow"><div class="mktoFieldDescriptor mktoFormCol"><label for="LastName" class="mktoLabel">Last Name:</label><input id="LastName" name="LastName" type="text" class="mktoField"></div></div>
      <div class="mktoFormRow"><div class="mktoFieldDescriptor mktoFormCol"><label for="Email" class="mktoLabel">Email Address:</label><input id="Email" name="Email" maxlength="255" type="email" class="mktoField mktoEmailField"></div></div>
      <div class="mktoFormRow"><div class="mktoFieldDescriptor mktoFormCol"><label for="Phone" class="mktoLabel">Phone Number:</label><input id="Phone" name="Phone" type="tel" class="mktoField"></div></div>
      <input type="hidden" name="formid" value="1001"><input type="hidden" name="munchkinId" value="123-ABC-456"><div class="mktoButtonRow"><button type="submit" class="mktoButton">Submit</button></div></form>`,
    fill: { FirstName: "Walter", LastName: "Skinner", Email: "skinner@fbi.gov", Phone: "555-0199" },
    submit: "button[type=submit]",
    expect: { email: "skinner@fbi.gov", name: "Walter Skinner", phone: "555-0199" },
  },
  {
    id: "hubspot-embed",
    label: "HubSpot JavaScript embed (form rendered in the page, wrapped in data-conversion)",
    html: `<script>${FORM_SUBMIT}</script><div data-conversion="true"><form class="hs-form-private hsForm_abc123 hs-form stacked" id="hsForm_abc123" action="https://forms.hsforms.com/submissions/v3/public/submit/formsnext/multipart/1/abc" method="post">
      <div class="hs_firstname hs-firstname hs-fieldtype-text field hs-form-field"><label for="firstname-abc"><span>First name</span></label><input id="firstname-abc" name="firstname" required type="text" class="hs-input"></div>
      <div class="hs_lastname hs-lastname field hs-form-field"><label for="lastname-abc"><span>Last name</span></label><input id="lastname-abc" name="lastname" type="text" class="hs-input"></div>
      <div class="hs_email hs-email field hs-form-field"><label for="email-abc"><span>Email</span></label><input id="email-abc" name="email" required type="email" class="hs-input"></div>
      <div class="hs_phone hs-phone field hs-form-field"><label for="phone-abc"><span>Phone number</span></label><input id="phone-abc" name="phone" type="tel" class="hs-input"></div>
      <div class="hs_submit hs-submit"><input type="submit" class="hs-button primary large" value="Submit"></div></form></div>`,
    fill: { firstname: "Monica", lastname: "Reyes", email: "reyes@fbi.gov", phone: "555-0123" },
    submit: "input[type=submit]",
    expect: { email: "reyes@fbi.gov", name: "Monica Reyes", phone: "555-0123" },
  },
  {
    id: "mailchimp-embedded",
    label: "Mailchimp embedded signup form (email, optional first name, honeypot field)",
    html: `<form action="/sink" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" class="validate"><div id="mc_embed_signup_scroll">
      <div class="mc-field-group"><label for="mce-EMAIL">Email Address <span class="asterisk">*</span></label><input type="email" value="" name="EMAIL" class="required email" id="mce-EMAIL" required></div>
      <div class="mc-field-group"><label for="mce-FNAME">First Name</label><input type="text" value="" name="FNAME" class="" id="mce-FNAME"></div>
      <div style="position: absolute; left: -5000px;" aria-hidden="true"><input type="text" name="b_abc123_def456" tabindex="-1" value=""></div>
      <div class="clear"><input type="submit" name="subscribe" id="mc-embedded-subscribe" class="button" value="Subscribe"></div></div></form>`,
    fill: { EMAIL: "news@fbi.gov", FNAME: "Alex" },
    submit: "input[type=submit]",
    expect: { email: "news@fbi.gov", name: "Alex" },
  },
  {
    id: "contact-form-7",
    label: "WordPress Contact Form 7 (submits with fetch)",
    html: `<script>document.addEventListener('submit', e => { e.preventDefault(); fetch('/sink', { method: 'POST', body: new FormData(e.target) }); }, false);</script>
      <div class="wpcf7 js" id="wpcf7-f12-p3-o1"><form action="/contact/#wpcf7-f12-p3-o1" method="post" class="wpcf7-form init" novalidate="novalidate" data-status="init"><input type="hidden" name="_wpcf7" value="12">
      <p><label> Your name<br><span class="wpcf7-form-control-wrap" data-name="your-name"><input size="40" class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" aria-required="true" aria-invalid="false" value="" type="text" name="your-name"></span></label></p>
      <p><label> Your email<br><span class="wpcf7-form-control-wrap" data-name="your-email"><input size="40" class="wpcf7-form-control wpcf7-email wpcf7-validates-as-required wpcf7-text wpcf7-validates-as-email" aria-required="true" aria-invalid="false" value="" type="email" name="your-email"></span></label></p>
      <p><label> Your message<br><span class="wpcf7-form-control-wrap" data-name="your-message"><textarea cols="40" rows="10" class="wpcf7-form-control wpcf7-textarea" aria-invalid="false" name="your-message"></textarea></span></label></p>
      <p><input class="wpcf7-form-control wpcf7-submit has-spinner" type="submit" value="Submit"></p></form></div>`,
    fill: { "your-name": "Frohike", "your-email": "frohike@gunmen.org", "your-message": "Hello" },
    submit: "input[type=submit]",
    expect: { email: "frohike@gunmen.org", name: "Frohike" },
  },
  {
    id: "gravity-forms",
    label: "WordPress Gravity Forms (split name fields named input_1_3 / input_1_6)",
    html: `<script>${FORM_SUBMIT}</script><div class="gform_wrapper" id="gform_wrapper_1"><form method="post" enctype="multipart/form-data" id="gform_1" action="/contact/"><div class="gform_body"><ul class="gform_fields">
      <li id="field_1_1" class="gfield"><label class="gfield_label" for="input_1_1">Name</label><div class="ginput_container ginput_container_name" id="input_1_1"><span id="input_1_1_3_container" class="name_first"><input type="text" name="input_1.3" id="input_1_1_3" value="" autocomplete="given-name"><label for="input_1_1_3" class="gform-field-label--type-sub">First</label></span><span id="input_1_1_6_container" class="name_last"><input type="text" name="input_1.6" id="input_1_1_6" value="" autocomplete="family-name"><label for="input_1_1_6">Last</label></span></div></li>
      <li id="field_1_2" class="gfield"><label class="gfield_label" for="input_1_2">Email</label><div class="ginput_container ginput_container_email"><input name="input_2" id="input_1_2" type="email" value="" class="medium" autocomplete="email"></div></li>
      <li id="field_1_3" class="gfield"><label class="gfield_label" for="input_1_3">Phone</label><div class="ginput_container ginput_container_phone"><input name="input_3" id="input_1_3" type="tel" value="" class="medium"></div></li></ul></div>
      <div class="gform_footer"><input type="submit" id="gform_submit_button_1" class="gform_button button" value="Submit"></div></form></div>`,
    fill: { "input_1.3": "Jeffrey", "input_1.6": "Spender", input_2: "spender@fbi.gov", input_3: "555-0177" },
    submit: "#gform_submit_button_1",
    expect: { email: "spender@fbi.gov", name: "Jeffrey Spender", phone: "555-0177" },
  },
  {
    id: "wpforms",
    label: "WordPress WPForms (name field named wpforms[fields][0][first])",
    html: `<script>${FORM_SUBMIT}</script><div class="wpforms-container"><form id="wpforms-form-123" class="wpforms-validate wpforms-form" data-formid="123" method="post" enctype="multipart/form-data" action="/contact/"><div class="wpforms-field-container">
      <div class="wpforms-field wpforms-field-name"><label class="wpforms-field-label" for="wpforms-123-field_0">Name <span class="wpforms-required-label">*</span></label><div class="wpforms-field-row wpforms-field-medium"><div class="wpforms-field-row-block wpforms-first wpforms-one-half"><input type="text" id="wpforms-123-field_0" class="wpforms-field-name-first" name="wpforms[fields][0][first]" required><label for="wpforms-123-field_0" class="wpforms-field-sublabel after">First</label></div><div class="wpforms-field-row-block wpforms-one-half"><input type="text" id="wpforms-123-field_0-last" class="wpforms-field-name-last" name="wpforms[fields][0][last]" required><label for="wpforms-123-field_0-last" class="wpforms-field-sublabel after">Last</label></div></div></div>
      <div class="wpforms-field wpforms-field-email"><label class="wpforms-field-label" for="wpforms-123-field_1">Email</label><input type="email" id="wpforms-123-field_1" class="wpforms-field-medium" name="wpforms[fields][1]" required></div></div>
      <input type="hidden" name="wpforms[id]" value="123"><div class="wpforms-submit-container"><button type="submit" name="wpforms[submit]" class="wpforms-submit">Submit</button></div></form></div>`,
    fill: { "wpforms[fields][0][first]": "Diana", "wpforms[fields][0][last]": "Fowley", "wpforms[fields][1]": "fowley@fbi.gov" },
    submit: "button[type=submit]",
    expect: { email: "fowley@fbi.gov", name: "Diana Fowley" },
  },
  {
    id: "plain-contact-form",
    label: "A plain hand-written contact form (name, email, message)",
    html: `<script>${FORM_SUBMIT}</script><form><input name="name" placeholder="Your name"><input name="email" type="email" placeholder="Email"><textarea name="message"></textarea><button type="submit">Send</button></form>`,
    fill: { name: "Marita Covarrubias", email: "marita@example.com", message: "hi" },
    submit: "button[type=submit]",
    expect: { email: "marita@example.com", name: "Marita Covarrubias" },
  },
  {
    id: "react-fetch-form",
    label: "A React-style form that submits with fetch and never fires a real submit",
    html: `<form id="f"><input name="email" type="email"><input name="fullName"><button type="button" id="go">Send</button></form><script>document.getElementById('go').addEventListener('click', () => fetch('/sink', { method: 'POST', body: JSON.stringify({ ok: 1 }) }));</script>`,
    fill: { email: "react@example.com", fullName: "Pat React" },
    submit: "#go",
    expect: { email: "react@example.com", name: "Pat React" },
  },
];

// ── iframe providers: a page served at the provider's real origin posts the documented message
const IFRAMES = [
  { id: "typeform-iframe", label: "Typeform embed (iframe, postMessage form-submit)", src: "https://form.typeform.com/to/abc123", message: `{ type: "form-submit", responseId: "resp-1" }`, tracked: "anonymous" },
  { id: "calendly-iframe", label: "Calendly inline embed (iframe, calendly.event_scheduled)", src: "https://calendly.com/acme/intro", message: `{ event: "calendly.event_scheduled", payload: { event: { uri: "x" } } }`, tracked: "anonymous" },
  { id: "jotform-iframe", label: "Jotform iframe embed (submission-completed)", src: "https://form.jotform.com/2412345", message: `"submission-completed"`, tracked: "anonymous" },
  { id: "pardot-iframe", label: "Pardot form in an iframe (no message sent)", src: "https://go.pardot.com/l/123/2024/abc.html", message: null, tracked: "none" },
  { id: "zoho-iframe", label: "Zoho Forms iframe embed (no message sent)", src: "https://forms.zohopublic.com/acme/form/Contact/formperma/xyz", message: null, tracked: "none" },
  { id: "pipedrive-iframe", label: "Pipedrive web form (iframe, no message sent)", src: "https://webforms.pipedrive.com/f/abc", message: null, tracked: "none" },
  { id: "google-forms-iframe", label: "Google Forms embed (iframe, no message sent)", src: "https://docs.google.com/forms/d/e/1FAIpQLSabc/viewform?embedded=true", message: null, tracked: "none" },
];

const pageFor = (c, wrapperMode) =>
  `<!doctype html><html><head><title>${c.id}</title><script src="http://localhost:4200/tracker.js" data-key="${KEY}" data-debug></script></head><body style="margin:20px">
  <h1>${c.label}</h1>${wrapperMode ? `<div data-conversion="true">${c.html}</div>` : c.html}</body></html>`;
const iframePage = (c, wrapperMode) =>
  `<!doctype html><html><head><title>${c.id}</title><script src="http://localhost:4200/tracker.js" data-key="${KEY}" data-debug></script></head><body style="margin:20px"><h1>${c.label}</h1>${wrapperMode ? '<div data-conversion="true">' : ""}<iframe id="emb" src="${c.src}" width="400" height="300"></iframe>${wrapperMode ? "</div>" : ""}</body></html>`;

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
  const u = req.url.split("?")[0];
  if (u === "/tracker.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(TRACKER); }
  if (u === "/api/site-config") { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify({ specify_form: SPECIFY })); }
  if (u === "/sink") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<p>ok</p>"); }
  if (req.method === "POST") {
    let b = "";
    req.on("data", (d) => (b += d));
    req.on("end", () => {
      let j = null;
      try { j = JSON.parse(b); } catch (e) {}
      if (u === "/api/track-form") captured.push(j);
      if (u === "/api/track") for (const ev of Array.isArray(j) ? j : []) if (ev.type === "health") health.push(ev);
      res.writeHead(200, { ...cors, "Content-Type": "application/json" });
      res.end('{"success":true}');
    });
    return;
  }
  const id = u.slice(1).replace(/-wrapped$/, "");
  const wrapped = u.endsWith("-wrapped");
  const c = CASES.find((x) => x.id === id);
  if (c) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(pageFor(c, wrapped)); }
  const f = IFRAMES.find((x) => x.id === id);
  if (f) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(iframePage(f, wrapped)); }
  res.writeHead(404); res.end();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
const verdict = (name, ok, extra = "") => rows.push({ name, ok, extra });

(async () => {
  await new Promise((r) => server.listen(4200, r));
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--no-sandbox"] });

  for (const mode of ["global", "labelled"]) {
    SPECIFY = mode === "labelled";
    console.log(`\n=========== site mode: ${mode === "global" ? "track every form" : 'only forms marked data-conversion="true" (recommended)'} ===========`);

    for (const c of CASES) {
      // In labelled mode every case is tested twice: unmarked (must NOT be captured) and marked on a wrapper (must be)
      for (const wrapped of mode === "labelled" ? [false, true] : [false]) {
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        captured.length = 0;
        await page.goto(`http://localhost:4200/${c.id}${wrapped ? "-wrapped" : ""}`, { waitUntil: "load" });
        await sleep(600);
        for (const [name, value] of Object.entries(c.fill)) {
          const sel = `[name="${name}"]`;
          await page.focus(sel);
          await page.type(sel, value);
        }
        await page.click(c.submit);
        await sleep(900);
        const got = captured.filter((x) => x && x.page_path);
        const cap = got[0];
        const expectCapture = mode === "global" || wrapped || c.id === "hubspot-embed" || c.selfMarked;
        const label = `${c.id}${mode === "labelled" ? (wrapped ? " [wrapper marked]" : " [not marked]") : ""}`;
        if (!expectCapture) {
          verdict(label, got.length === 0, got.length === 0 ? "correctly ignored" : `captured ${got.length} but should be ignored`);
        } else if (!cap) {
          verdict(label, false, "NOT CAPTURED");
        } else {
          const probs = [];
          if (cap.email !== c.expect.email) probs.push(`email=${cap.email}`);
          if (c.expect.name && cap.name !== c.expect.name) probs.push(`name="${cap.name}" (wanted "${c.expect.name}")`);
          if (c.expect.phone && cap.phone !== c.expect.phone) probs.push(`phone=${cap.phone}`);
          if (got.length > 1) probs.push(`${got.length} duplicate captures`);
          verdict(label, probs.length === 0, probs.length ? probs.join("; ") : `captured: ${cap.email} | ${cap.name} | ${cap.phone || "-"}`);
        }
        await ctx.close();
      }
    }

    // ── iframes
    for (const f of IFRAMES) {
      for (const wrapped of mode === "labelled" ? [false, true] : [false]) {
        const ctx = await browser.createBrowserContext();
        const page = await ctx.newPage();
        captured.length = 0;
        health.length = 0;
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          const url = req.url();
          if (url === f.src || url.startsWith(f.src.split("?")[0])) {
            const body = `<!doctype html><body><button id="go">Submit</button><script>document.getElementById('go').onclick=()=>parent.postMessage(${f.message || "null"}, '*');</script></body>`;
            return req.respond({ status: 200, contentType: "text/html", body });
          }
          req.continue();
        });
        await page.goto(`http://localhost:4200/${f.id}${wrapped ? "-wrapped" : ""}`, { waitUntil: "load" });
        await sleep(500);
        const frame = page.frames().find((fr) => fr.url().startsWith(f.src.split("?")[0]));
        if (frame && f.message) { await frame.click("#go"); } else if (frame) { await frame.click("#go").catch(() => {}); }
        await sleep(3800); // health report settles after 3 s
        const got = captured.filter((x) => x && x.page_path);
        const label = `${f.id}${mode === "labelled" ? (wrapped ? " [wrapper marked]" : " [not marked]") : ""}`;
        const expectCapture = f.tracked === "anonymous" && (mode === "global" || wrapped);
        const rep = health.map((h) => h.report && h.report.iframe_forms).find(Boolean);
        const flagged = !!rep;
        if (f.tracked === "anonymous") {
          verdict(label, expectCapture ? got.length === 1 : got.length === 0, expectCapture ? (got.length === 1 ? `anonymous conversion captured (source ${got[0].raw_data && got[0].raw_data._source}), iframe flagged in health: ${flagged}` : `captured ${got.length}`) : got.length === 0 ? "correctly ignored" : "captured but should be ignored");
        } else {
          verdict(label, got.length === 0 && flagged, `cannot be tracked (separate website inside an iframe); flagged in Settings health report: ${flagged}`);
        }
        await ctx.close();
      }
    }
  }

  await browser.close();
  server.close();
  console.log("");
  let bad = 0;
  for (const r of rows) { console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}\n        ${r.extra}`); if (!r.ok) bad++; }
  console.log(`\n${rows.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
