// scripts/bench/load-leads.mjs
// Sends many form submissions (leads) at once to a LOCAL Jellyhook, to see how the check (marks + notification rules)
// copes. Every lead reuses one real visitor, so the leads get that visitor's marks. Prints how long each request took;
// the server prints the check timings as "[notifications] batch leads=.. waited=..ms marks=..ms rules=..ms".
//
//   node scripts/bench/load-leads.mjs --key <site api key> --visitor <visitor_id> --page https://yoursite.com/contact
//        [--count 100] [--concurrency 20] [--base http://localhost:3000]
//
// --visitor: copy visitor_id from a lead that already has the marks (form_submissions.visitor_id).
// --page: a page on the site's own domain (the server only accepts the site's host).
// Test leads are named "Load test N" with emails loadtest+<run>-<n>@example.com. Delete them after:
//   delete from form_submissions where email like 'loadtest+%@example.com';
const arg = (k, d) => {
  const i = process.argv.indexOf("--" + k);
  return i > -1 ? process.argv[i + 1] : d;
};
const key = arg("key");
const visitor = arg("visitor");
const page = arg("page");
const count = Number(arg("count", 100));
const concurrency = Number(arg("concurrency", 20));
const base = arg("base", "http://localhost:3000").replace(/\/+$/, "");
if (!key || !visitor || !page) {
  console.error("Need --key, --visitor and --page. See the top of this file.");
  process.exit(1);
}
const run = Date.now().toString(36);
const url = new URL(page);

async function one(n) {
  const t = Date.now();
  const res = await fetch(base + "/api/track-form", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, Origin: url.origin, Referer: page },
    body: JSON.stringify({
      api_key: key,
      visitor_id: visitor,
      session_id: visitor + "-s",
      page_url: page,
      page_path: url.pathname,
      name: "Load test " + n,
      email: `loadtest+${run}-${n}@example.com`,
      raw_data: { message: "load test" },
    }),
  });
  return { ms: Date.now() - t, status: res.status };
}

const results = [];
let next = 0;
const started = Date.now();
await Promise.all(
  Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (next < count) results.push(await one(next++));
  }),
);
const ms = results.map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => ms[Math.min(ms.length - 1, Math.floor((p / 100) * ms.length))];
const bad = results.filter((r) => r.status !== 200).length;
console.log(`sent ${count} leads in ${Date.now() - started}ms (concurrency ${concurrency})`);
console.log(`request time: p50 ${pct(50)}ms  p95 ${pct(95)}ms  max ${ms[ms.length - 1]}ms  non-200: ${bad}`);
console.log("Now watch the dev server terminal for [notifications] batch lines, and the bell.");
