# Jellyhook Traffic & Backend Capacity Report

Written for: the founder (Joshua), to decide infrastructure spend and rate-limiting policy before onboarding real businesses.

This is not a guess dressed as a number. Everything below is traced from the actual code paths (`public/tracker.js`, `app/api/track/route.js`, `app/api/track-form/route.js`, `app/api/track-structure/route.js`, `components/dashboard/LiveTicker.tsx`) plus current, sourced Vercel/Supabase plan limits. Where a number can't be pinned exactly without a live load test, that's said explicitly instead of invented.

---

## 1. Answering the direct question first: is this "nonsense," or is it just the ticker?

**It's not nonsense. The architecture (event batching, session/page_view/lead separation, throttled client-side sends) is sound.** The scalability risk that came up earlier was specifically the *dashboard-owner-facing* Live Ticker polling every 500ms-4s per open tab — that's a cost *you* generate by leaving your own dashboard open, unrelated to how many visitors a client's site gets.

**The tracker-facing path (what actually scales with a business's traffic) is a separate, more serious concern**, for a different reason: it is **serial, chatty, and has an uncached external network call in the hot path.** That's the real bottleneck, and it's fixable without a rewrite. Details below.

---

## 2. What actually generates a network request (ground truth from tracker.js)

Scroll tracking does **not** generate network traffic. It's tracked in memory, throttled to a check every 250ms, and only ever leaves the browser as part of a `page_view_end` payload. This matters a lot for your capacity math — 500 people scrolling simultaneously is zero extra backend load by itself.

Requests to your backend happen only at these points, per visitor, per browser tab:

| Event | Fires | Endpoint |
|---|---|---|
| `session_start` | once per tab session | `/api/track` |
| `page_view_start` | once per page load / SPA route change / tab refocus | `/api/track` |
| `page_view_end` | once per page leave / route change / tab close | `/api/track` |
| `session_end` | once per tab close | `/api/track` |
| page structure capture | once per page load (headers only) | `/api/track-structure` |
| form submit | once per actual submit (not per keystroke — this doesn't exist yet) | `/api/track-form` |

**Rough floor for one visitor viewing 3 pages in one visit:** ~1 session_start + 3 page_view_start + 3 page_view_end + 1 session_end + 3 structure captures = **~11 requests total**, spread across however long they stay (not a burst). A single-page visitor who bounces immediately is closer to 4-5 requests.

---

## 3. The real bottleneck: what happens *inside* one `/api/track` call

This is the part that matters more than any platform limit. Reading `app/api/track/route.js` top to bottom:

- Every single POST — regardless of event type — makes a **synchronous, uncached call to `ip-api.com`** for country lookup, with a 2-second timeout, *before* touching your own database. This is a free third-party service, shared across everyone who uses it worldwide, rate-limited at 1000 req/min **for the whole internet**, not exclusively for you. There is no per-visitor caching, so the same visitor triggers this lookup on every `session_start` (once per tab, so not every page — but still, on a busy site with lots of tabs/sessions, this is a real external dependency with no fallback beyond "return null on failure").
- Each event in the batch is processed with `await` **sequentially, one at a time**, not in parallel. A `session_start` event alone can trigger up to 4 sequential Supabase round-trips (dedup check → open-session check → stale-session check → insert). A `page_view_start`/`page_view_end` adds 1-2 more (visitor upsert + page_view select-then-insert/update).
- None of this is batched into a single SQL statement — it's application-level read-then-write (`select` → `insert`/`update`), which is the correct pattern for correctness here, but it's 2x the round-trips of a single upsert.

**Concretely: a single `session_start` request, in the worst case, is 1 external HTTP call (up to 2s) + roughly 5-6 sequential Postgres round-trips.** On Supabase's free shared pooler this is commonly 30-100ms per round-trip, so a single request's server-side processing time realistically lands somewhere in the **150ms-500ms range under light load, and 1-3+ seconds under contention or if the IP lookup is slow** (it's the single biggest unbounded variable in the whole path).

This is the actual thing to fix before scaling, not a platform tier. **Two changes that cost nothing to make and would multiply your real capacity: (1) cache country-by-IP for the life of a session instead of calling ip-api.com every time, and (2) run the visitor-upsert and session-logic queries concurrently with `Promise.all` where they don't depend on each other.**

---

## 4. Platform numbers, sourced and current (September 2026)

**Vercel:**
- Hobby (free): 1,000,000 serverless function invocations/month included. Each function execution capped at 10 seconds. **Hobby's terms of service prohibit commercial use** — a business paying you to track their site makes this itself a violation, independent of any traffic number.
- Pro ($20/seat/month): no included invocation allowance — billed from the first invocation, offset by a $20/month usage credit, then $0.60 per million invocations beyond that.

**Supabase:**
- Free: Nano compute, **60 direct database connections, 200 pooler (Supavisor) connections** — hard-capped, not adjustable without upgrading compute size. Project auto-pauses after 1 week of inactivity.
- Pro ($25/month base): 8GB database included, $10/month compute credit (covers one Micro compute instance), 500 realtime connections, 100GB storage, 50,000 MAU, 2M edge function invocations included. Compute, egress, and connection overages are billed beyond that.

Sources: [Vercel Functions Limits](https://vercel.com/docs/functions/limitations), [Vercel Pricing](https://vercel.com/pricing), [Vercel Functions Usage & Pricing](https://vercel.com/docs/functions/usage-and-pricing), [Supabase connection pooling docs](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits), [Supabase Pricing 2026 breakdown](https://flexprice.io/blog/supabase-pricing-breakdown).

---

## 5. Where each backend actually cracks

**Vercel (Hobby, current setup) cracks on: monthly invocation count, not concurrency.** Vercel serverless functions scale out automatically per-request; there's no fixed "concurrent users" ceiling on Hobby the way there is a hard connection cap on the database. The wall you hit is **1,000,000 invocations/month total**, and separately, the commercial-use ToS violation the moment a business is paying you — that's a policy wall, not a technical one, and it exists starting at zero real customers.

**Supabase (Free, current setup) cracks on: concurrent open connections, specifically.** Every `/api/track` invocation opens a database connection through the pooler for its duration (the 150ms-3s window above). With 200 pooler connections as the hard ceiling, **the number of *simultaneous* in-flight tracking requests is what matters, not total daily traffic.** If 200+ visitors across all your businesses' sites happen to trigger a tracked event (page load/leave) within the same ~1-second window, requests start queueing or failing, regardless of how much traffic you've handled that day.

---

## 6. Concrete scenario math

Assumptions stated plainly: average tracked request holds a DB connection for ~300ms (mid-range from Section 3, assuming the IP-lookup cache fix is NOT yet made — this is your current, unoptimized number); a visitor's requests are spread over their visit, not a single burst, so "500 visitors on site" doesn't mean 500 simultaneous requests — it means up to ~500 people who could each trigger a request in the same second during a traffic spike (e.g., everyone landing from the same ad campaign at once).

| Scenario | What actually stresses your stack | Outcome on current setup (Vercel Hobby + Supabase Free) |
|---|---|---|
| 1 site, 500 visitors spread over a day | Total invocation count (~500 × 11 ≈ 5,500 requests) | Trivially fine — nowhere near 1M/month. Connection count fine (~1-2 concurrent at a time). |
| 1 site, 500 visitors arriving in the same minute (e.g. a viral post, an email blast) | Concurrent pooler connections | **This is your actual crack point.** ~500 people each firing page_view_start within seconds, each holding a connection ~300ms, means peak concurrent connections can spike well past a handful and start contending for the 200-connection pooler ceiling if page views cluster tightly (multiple pages, multiple tabs). Not guaranteed to fail at exactly 500, but this is the regime where it starts happening. |
| 100 total concurrent visitors across all your tracked sites, sustained | Pooler connections, sustained | Comfortably inside Supabase Free's 200-connection ceiling, assuming the ~300ms hold time — real headroom here. |
| 1,000 total concurrent visitors, sustained | Pooler connections | **Exceeds Supabase Free's 200-connection ceiling outright**, independent of Vercel. This is a hard database-side failure, not a slowdown. |
| 10,000 total concurrent visitors, sustained | Both — but Supabase fails first, Vercel invocation budget also burns fast at this volume | Not survivable on Free tier of either service. Needs Supabase Pro at minimum (still bounded, see below) and likely a paid Vercel plan given monthly invocation math (10k concurrent for any sustained period generates invocation counts that eat into the 1M free budget within days, not months). |

**The one-line answer to "how much traffic can one business's site generate before my database cracks":** you're not going to hit a wall from *daily total* traffic on Free tier (1M Vercel invocations is generous), you'll hit a wall from **traffic *clustering*** — many visitors' events landing in the same few seconds — because that's what exhausts Supabase's fixed connection ceiling. A steady trickle of 5,000 visitors/day is fine. A traffic spike of a few hundred visitors within the same minute is where Free tier Supabase is the actual risk, today, with zero optimization done.

---

## 7. The scenarios you asked for (a–g)

**a) Current setup (Vercel Hobby + Supabase Free, $0/month):**
- Safe for: low, steady traffic across a handful of sites — realistically comfortable up to roughly **50-100 truly concurrent tracked visitors** before connection pressure becomes a live risk during clustering, and effectively unlimited *total* daily/monthly traffic as long as it doesn't cluster.
- Not safe for: any commercial use per Vercel Hobby's ToS (this applies regardless of traffic volume — worth fixing first, it's a policy risk not a technical one), and any traffic-spike scenario (viral moment, ad launch) for even one client site.

**b) Vercel Pro only ($20/mo), Supabase still Free:**
- Removes the ToS violation and the 1M/month invocation ceiling. **Does nothing for the actual crack point** — Supabase Free's 200-connection ceiling is unchanged. This is the wrong first upgrade if the goal is surviving traffic spikes; it's the right first upgrade if the goal is legal commercial use.

**c) Supabase Pro only ($25/mo), Vercel still Hobby:**
- Larger compute (Micro instance via the $10 credit) generally raises the practical connection ceiling and shortens per-query time (dedicated compute vs. shared Nano), which directly attacks your actual bottleneck. Still leaves the Vercel Hobby commercial-use ToS problem unresolved.

**d) Both upgraded ($45/mo total):**
- This is the realistic minimum for "actually running a business on this." Solves the ToS problem, gives real compute headroom on the database side. Ballpark comfortable capacity: **several hundred concurrent tracked visitors** sustained across all your client sites combined, assuming the IP-lookup caching fix from Section 3 is also made (without that fix, the compute upgrade helps less than it should, because you're still burning time on an external network call you don't control).

**e) Alternative SaaS stack (swap either piece):** not something I can respond to at this effort level without a load test — if you want this explored (e.g. Railway/Neon/PlanetScale for Postgres, Cloudflare Workers for the ingestion endpoint), say so and I'll scope it as its own investigation rather than guess numbers.

**f) What to subscribe to for 100 / 1,000 / 10,000 total concurrent visitors, across your currently-tracked sites (1 today):**
- **100 concurrent:** current free stack, *with* the IP-lookup caching fix from Section 3. $0/month.
- **1,000 concurrent:** Supabase Pro minimum ($25/mo) for a real compute tier and headroom on connections; Vercel Pro ($20/mo) to remove the ToS/invocation ceiling. **~$45/month**, contingent on also fixing the serial-query pattern in Section 3 — without that fix this tier is genuinely at risk even on Pro.
- **10,000 concurrent, sustained:** this is past what either platform's base paid tier is built for without real engineering work — you'd need a dedicated, larger Supabase compute tier (priced by usage, easily $100-300+/month depending on sustained load) and likely a queue/batching layer in front of `/api/track` so bursts don't hold thousands of simultaneous DB connections at once. This is an architecture change (a write-ahead queue, e.g. via a lightweight service or Supabase Edge Functions batching writes), not just a bigger plan.

**g) Enterprise (AWS) for "just surviving visitors":** genuinely not worth pricing out at this stage — AWS has no free tier equivalent to what you're already getting from Vercel+Supabase, and you'd be trading a $0-45/month bill for a $200+/month bill plus the engineering time to replace two managed platforms with raw infrastructure you'd have to operate yourself. Revisit this only once you're past the 10,000-concurrent tier above and actually need multi-region/dedicated capacity.

---

## 8. What to actually do, in order

1. **Fix the IP-lookup call** — cache it per session or drop it to fire-and-forget after the response is sent, so it stops blocking every `/api/track` request. This is the single highest-leverage, zero-cost fix available and directly increases how many requests/second you can serve on the exact same infrastructure.
2. **Parallelize the independent queries inside one event's handling** (`Promise.all` on the visitor upsert and country lookup, at minimum) — cuts per-request DB hold time further, which is what actually determines how many concurrent visitors your Supabase connection ceiling can support.
3. **Resolve the Vercel Hobby commercial-use restriction** before onboarding an actual paying business client — this is a compliance risk today, independent of any traffic number.
4. Only after 1-3 are done, re-measure with a real load test before deciding whether Supabase Pro is needed — the numbers in Section 6 assume the *current*, unoptimized request cost, and are almost certainly pessimistic once the fixes above land.

Field-abandonment tracking (the next feature you want to build) adds more form-related network traffic (view + per-field blur events), but it's small relative to page-view traffic and doesn't change any conclusion above — worth revisiting the invocation math once it's built, not before.
