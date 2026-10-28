#!/usr/bin/env node
/* eslint-disable */
// scripts/sim/traffic.mjs - simulated visitors for load tests and the control room (mds/build/control-room.md).
//
// Sends what the real tracker sends (public/tracker.js), to a Jellyhook server: visits (session_start), page views
// with the time spent and how far they scrolled (page_view_start / page_view_end), and forms (/api/track-form, with
// the form's key and the page snapshot). Each visitor waits real time on each page, so durations, the lead queue and
// form-to-Slack times are real. Some visitors come back, some come from an ad, some send the form.
//
//   npm run sim -- --key <site api key> --domain sim.jellyhook.test        (--base defaults to http://localhost:3100)
//        [--visitors 100] [--over 60] [--pages /,/pricing,/blogs,/contact] [--form-page /contact]
//        [--form-rate 0.3] [--returning 0.2] [--ads 0.3] [--dwell 2-12] [--burst 30] [--end-visits 1] [--allow-production]
//
//   --visitors   how many visitors arrive              --over    spread over this many seconds
//   --dwell      seconds on each page, min-max         --burst   ALSO send this many forms, one per second (a rush)
//   --form-rate  share of visitors who send the form   --returning share who come back for a second visit
//   --ads        share who arrive from an ad (utm)     --allow-production   needed to send to jellyhook.com
//
// The domain must be the test site's domain in Jellyhook (its events are matched to it); the key is its API key.
// Prints progress, then totals: events sent, refused, forms, and the server's answers.

import { createHash, randomUUID } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "true"]);
    return acc;
  }, []),
);
const need = (k, fallback) => {
  if (args[k]) return args[k];
  if (fallback) return fallback;
  console.error(`
Missing --${k}.

What to run (after "npm run dev:bench" is running and you created a test site there):

  npm run sim -- --key <the test site's API key> --domain <the test site's domain>

  --key     Settings > Installation on http://localhost:3100 (the API key)
  --domain  the domain you gave the test site, for example sim.jellyhook.test
  --base    defaults to http://localhost:3100 (the test server)

Add  --visitors 100 --over 60  for 100 visitors over a minute, and  --burst 30  for a rush of 30 forms, one per second.
Note the "--" after "npm run sim": it passes the rest to the script.`);
  process.exit(1);
};
const BASE = need("base", "http://localhost:3100").replace(/\/+$/, "");
const KEY = need("key");
const DOMAIN = need("domain").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
if (/(^|\.)jellyhook\.com$/i.test(new URL(BASE).hostname) && args["allow-production"] !== "true") {
  console.error("Refusing to send simulated traffic to jellyhook.com (production). Point --base at the test server, or add --allow-production if you really mean it.");
  process.exit(1);
}
const VISITORS = Number(args.visitors ?? 100);
const OVER_S = Number(args.over ?? 60);
const PAGES = String(args.pages ?? "/,/pricing,/blogs,/contact").split(",").map((p) => p.trim()).filter(Boolean);
const FORM_PAGE = args["form-page"] ?? PAGES[PAGES.length - 1];
const FORM_RATE = Number(args["form-rate"] ?? 0.3);
const RETURNING = Number(args.returning ?? 0.2);
const ADS = Number(args.ads ?? 0.3);
const [DWELL_MIN, DWELL_MAX] = String(args.dwell ?? "2-12").split("-").map(Number);
const BURST = Number(args.burst ?? 0);
// --end-visits 1: each visit ends with a session_end, as a real tracker sends when the visit is over. The server then checks the
// leads of that visit a SECOND time (marks and hooks), so this doubles the checking work. Real visits end minutes later (idle),
// not right after the form, so it makes the test harder than the real day: use it for the heaviest variants.
const END_VISITS = String(args["end-visits"] ?? "0") === "1";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 JellyhookSim/1";
const ORIGIN = "https://" + DOMAIN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

const stats = { visits: 0, pageViews: 0, events: 0, requests: 0, refused: 0, errors: 0, forms: 0, formsRefused: 0, statuses: {}, retried: 0, recovered: 0, lost: 0, formsLost: 0 };

// --retry 1 (the default since v2): like the real tracker's outbox (public/tracker.js), a send answered 5xx or 429, or
// with no answer, is sent again in the background with growing pauses, while the visitor goes on. A send that still fails
// after the last pause is LOST: the number that matters most (a lost visit or form cannot be rebuilt). --retry 0 sends
// once, as the tracker did before v2. Sends carrying form field timings are never repeated (the server adds them up).
const RETRY = String(args.retry ?? "1") === "1";
const PAUSES = [2000, 5000, 15000, 30000, 60000, 120000, 300000, 600000];
const retrying = new Set();
const failed = (s) => s === 0 || s >= 500 || s === 429;

/** A stable fake person from a visitor id: its own network address and browser build. Without this every simulated visitor
 *  shares one IP and one browser, and the app (correctly) merges them into a handful of people (jh_resolve_visitor). */
function identity(visitorId) {
  const h = createHash("sha256").update(String(visitorId)).digest();
  return { ip: `203.0.${h[0]}.${h[1] || 1}`, ua: UA.replace("Chrome/131.0", `Chrome/131.0.${h[2] * 256 + h[3]}`) };
}

async function send(path, body, who) {
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8", "x-api-key": KEY, Origin: ORIGIN, Referer: ORIGIN + "/", "User-Agent": who.ua, "x-forwarded-for": who.ip },
      body: JSON.stringify(body),
    });
    stats.statuses[res.status] = (stats.statuses[res.status] ?? 0) + 1;
    return res.status;
  } catch (e) {
    stats.errors++;
    return 0;
  }
}

async function post(path, body) {
  stats.requests++;
  const who = identity((Array.isArray(body) ? body[0] : body)?.visitor_id);
  const status = await send(path, body, who);
  if (status >= 400) stats.refused++;
  if (RETRY && failed(status) && !body?.field_timings_delta) {
    stats.retried++;
    const isForm = path === "/api/track-form";
    const job = (async () => {
      for (const pause of PAUSES) {
        await sleep(pause);
        if (!failed(await send(path, body, who))) {
          stats.recovered++;
          return;
        }
      }
      stats.lost++;
      if (isForm) stats.formsLost++;
    })();
    retrying.add(job);
    job.finally(() => retrying.delete(job));
  }
  return status;
}

const track = (events) => {
  stats.events += events.length;
  return post("/api/track", events);
};

const AD_TAGS = [
  { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "Spring sale", utm_content: "1201", ad_name: "Core demo video", click_id: "meta" },
  { utm_source: "google", utm_medium: "cpc", utm_campaign: "Brand", utm_content: "8841", click_id: "google" },
  { utm_source: "tiktok", utm_medium: "paid_social", utm_campaign: "Test", utm_content: "5512", ad_name: "UGC 3" },
];

/** One visit: pages in order with real time on each, then maybe the form. */
async function visit(visitorId, first, sendsForm) {
  const sessionId = randomUUID();
  const ad = Math.random() < ADS ? pick(AD_TAGS) : null;
  const pages = [PAGES[0], ...Array.from({ length: Math.floor(rand(0, PAGES.length)) }, () => pick(PAGES))];
  if (sendsForm && pages[pages.length - 1] !== FORM_PAGE) pages.push(FORM_PAGE);
  const base = { visitor_id: visitorId, session_id: sessionId, user_agent: UA, device_type: "desktop" };
  await track([{ type: "session_start", ...base, is_first_visit: first, page_path: pages[0], page_url: ORIGIN + pages[0], referrer: ad ? "" : "https://www.google.com/", ...(ad ?? {}) }]);
  stats.visits++;
  for (let i = 0; i < pages.length; i++) {
    const path = pages[i];
    const pageViewId = randomUUID();
    const pv = { ...base, page_view_id: pageViewId, page_path: path, page_url: ORIGIN + path };
    await track([{ type: "page_view_start", ...pv, page_title: "Sim " + path, referrer: i === 0 ? "" : ORIGIN + pages[i - 1], entry_scroll: 0, viewport_height: 900, viewport_width: 1440, page_height: 3200 }]);
    stats.pageViews++;
    const stayMs = rand(DWELL_MIN, DWELL_MAX) * 1000;
    const scroll = Math.min(1, rand(0.1, 1.1));
    const last = i === pages.length - 1;
    if (last && sendsForm) {
      await sleep(stayMs * 0.7);
      await form(visitorId, sessionId, pageViewId, path, stayMs * 0.7, scroll);
      await sleep(stayMs * 0.3);
    } else {
      await sleep(stayMs);
    }
    await track([{ type: "page_view_end", ...pv, duration: Math.round(stayMs), scroll_depth: scroll * 0.8, max_scroll_depth: scroll, viewport_height: 900, page_height: 3200 }]);
  }
  if (END_VISITS) await track([{ type: "session_end", ...base, ended_ago_ms: 0 }]);
}

// The form's field list, as the tracker reports it when the form is seen (keys, types, labels, choices; never values).
// The mark builder's "answers" list is built from this, so without it a site has no fields to pick.
const FORM_FIELDS = [
  { key: "custom:firstname", type: "text", required: true, label: "First name" },
  { key: "custom:lastname", type: "text", required: true, label: "Last name" },
  { key: "email", type: "email", required: true, label: "Email" },
  { key: "custom:budget", type: "select", required: false, label: "Budget", options: [{ v: "Under $1k", l: "Under $1k" }, { v: "$1k-$5k", l: "$1k-$5k" }, { v: "$5k+", l: "$5k+" }] },
  { key: "custom:message", type: "textarea", required: false, label: "Message" },
];

/** What the tracker sends about a form besides the lead itself: seen, started (with field timing), submitted. */
async function engagement(status, visitorId, sessionId, pageViewId, path, extra = {}) {
  stats.events++;
  return post("/api/track-form-engagement", {
    api_key: KEY,
    visitor_id: visitorId,
    session_id: sessionId,
    page_view_id: pageViewId,
    page_path: path,
    form_index: 0,
    form_key_hint: { id: "contact", name: null },
    status,
    last_activity_at: new Date().toISOString(),
    ...extra,
  });
}

async function form(visitorId, sessionId, pageViewId, path, soFarMs, scroll) {
  const n = ++stats.forms;
  const t = Date.now();
  const iso = (ms) => new Date(t + ms).toISOString();
  await engagement("viewed", visitorId, sessionId, pageViewId, path, { form_fields: FORM_FIELDS, form_top_y: 600, form_bottom_y: 1300 });
  await engagement("started", visitorId, sessionId, pageViewId, path, {
    onscreen_before_start_ms: Math.round(rand(1000, 4000)),
    field_timings_delta: Object.fromEntries(
      FORM_FIELDS.map((f, i) => [f.key, { firstFocusAt: iso(i * 1500), firstKeydownAt: iso(i * 1500 + rand(300, 2500)), lastUnfocusAt: iso(i * 1500 + 3000), totalFocusedMsDelta: Math.round(rand(1500, 6000)), filled: true, edited: Math.random() < 0.2 }]),
    ),
  });
  const status = await post("/api/track-form", {
    api_key: KEY,
    visitor_id: visitorId,
    session_id: sessionId,
    page_url: ORIGIN + path,
    page_path: path,
    name: "Sim Visitor " + n,
    email: `sim+${Date.now()}-${n}@jellyhook-sim.test`,
    phone: null,
    confidence: "high",
    raw_data: { firstname: "Sim", lastname: "Visitor " + n, budget: pick(["$1k-$5k", "$5k+", "Under $1k"]), message: "Simulated lead" },
    is_labelled_conversion: false,
    conversion_mark: null,
    form_key_hint: { id: "contact", name: null },
    form_index: 0,
    page_snapshot: { page_view_id: pageViewId, duration: Math.round(soFarMs), scroll_depth: scroll * 0.8, max_scroll_depth: scroll, max_scroll_reached_at: new Date().toISOString(), revisit_start_scroll: null, viewport_height: 900 },
    submission_id: randomUUID(), // like the real tracker: a repeat of this form is never a second lead
  });
  if (status >= 400 || status === 0) stats.formsRefused++; // the FIRST try failed (with --retry 1 it is sent again)
  await engagement("submitted", visitorId, sessionId, pageViewId, path);
}

async function visitor(i) {
  const visitorId = randomUUID();
  const sendsForm = Math.random() < FORM_RATE;
  const comesBack = Math.random() < RETURNING;
  // a returning visitor reads first and sends the form on the second visit
  await visit(visitorId, true, sendsForm && !comesBack);
  if (comesBack) {
    await sleep(rand(1, 4) * 1000);
    await visit(visitorId, false, sendsForm);
  }
}

/** A rush of forms: one per second, each from its own short visit on the form page. */
async function burst(n) {
  const all = [];
  for (let i = 0; i < n; i++) {
    const visitorId = randomUUID();
    const sessionId = randomUUID();
    const pageViewId = randomUUID();
    all.push(
      (async () => {
        await track([{ type: "session_start", visitor_id: visitorId, session_id: sessionId, user_agent: UA, device_type: "desktop", is_first_visit: true, page_path: FORM_PAGE, page_url: ORIGIN + FORM_PAGE, referrer: "" }]);
        await track([{ type: "page_view_start", visitor_id: visitorId, session_id: sessionId, page_view_id: pageViewId, page_path: FORM_PAGE, page_url: ORIGIN + FORM_PAGE, user_agent: UA, entry_scroll: 0, viewport_height: 900, page_height: 3200 }]);
        await form(visitorId, sessionId, pageViewId, FORM_PAGE, 8000, 0.9);
      })(),
    );
    await sleep(1000);
  }
  await Promise.all(all);
}

const t0 = Date.now();
console.log(`Simulating ${VISITORS} visitors over ${OVER_S}s on ${DOMAIN} -> ${BASE}${BURST ? `, plus a rush of ${BURST} forms (1/s)` : ""}`);
// "refused" = answered 400 or more on the first try; with --retry 1 such a send is tried again in the background, so the
// numbers that matter are on the right: still being retried, recovered, LOST
const progress = setInterval(() => {
  const retry = RETRY ? ` | retrying ${retrying.size}, recovered ${stats.recovered}, LOST ${stats.lost}` : "";
  console.log(`  ${Math.round((Date.now() - t0) / 1000)}s: ${stats.visits} visits, ${stats.pageViews} page views, ${stats.forms} forms, ${stats.events} events, ${stats.refused} refused, ${stats.errors} no answer${retry}`);
}, 5000);

function summary(stopped) {
  console.log(`\n${stopped ? "STOPPED by hand" : "Done"} in ${Math.round((Date.now() - t0) / 1000)}s${!stopped && Date.now() - sent > 2000 ? ` (${Math.round((Date.now() - sent) / 1000)}s of it waiting for retries)` : ""}.`);
  console.log(`  visits ${stats.visits}, page views ${stats.pageViews}, events ${stats.events}, requests ${stats.requests}`);
  console.log(`  forms sent ${stats.forms} (${stats.formsRefused} failed on the first try)`);
  console.log(`  server answers: ${JSON.stringify(stats.statuses)}${stats.errors ? `, ${stats.errors} network errors` : ""}`);
  if (RETRY) console.log(`  failed on the first try ${stats.retried}: recovered by retrying ${stats.recovered}, LOST ${stats.lost} (forms lost: ${stats.formsLost})${stopped ? `, still being retried when stopped ${retrying.size} (unknown: a real browser would go on trying)` : ""}`);
  console.log(`Open ${BASE}/admin to see it in the control room.`);
}
let sent = Date.now();
// Ctrl+C: the totals so far, so a run stopped by hand still says what was recovered and lost
process.on("SIGINT", () => {
  clearInterval(progress);
  summary(true);
  process.exit(130);
});
const jobs = [];
for (let i = 0; i < VISITORS; i++) {
  jobs.push(visitor(i));
  await sleep((OVER_S * 1000) / Math.max(VISITORS, 1));
}
if (BURST) jobs.push(burst(BURST));
await Promise.all(jobs);
sent = Date.now();
if (retrying.size) console.log(`\nAll visitors done; ${retrying.size} send(s) still being retried (pauses up to 10 minutes) ...`);
while (retrying.size) await Promise.race([...retrying]);
clearInterval(progress);
summary(false);
process.exit(stats.lost || (!RETRY && (stats.refused || stats.errors)) ? 1 : 0);
