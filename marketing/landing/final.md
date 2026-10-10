# Final deliverable: the Jellyhook landing page

Date: 2026-10-09. Winner of 3 simulated rounds: **R3B + post-test fixes** (see `variants.md`, "Decision").
Preview: `app/landing-preview/page.tsx` + `app/landing-preview/HeroLead.tsx` -> http://localhost:3000/landing-preview (noindex,
unlinked). `app/page.tsx` is unchanged until the founder approves.

Process files: `synthesis.md` (Phase 0) · `agent-a-marketing.md`, `agent-b-design.md` (Phase 1) · `draft-v1.md` (Phase 2) ·
`personas.md`, `persona-results/`, `phase3-results.md`, `pain-points.md` (Phase 3) · `variants/`, `variants.md` (Phase 4) ·
`alternatives.md` (backup heroes).

---

## 1. Final copy (as built in the preview)

**Hero**
- Eyebrow: For websites that run on form leads
- H1: See what your leads did *before they sent your form*.
- Sub: See what each person read before they sent your form, and which field the people who never sent it stopped on. Read one lead
  before you follow up. Read them all before you change a page or a form.
- CTA: Start free (-> /sign-up) · See a sample lead (-> /demo)
- Risk line: Free during early access · No card
- Trust lines: One script tag. No screen, mouse or keystroke recording. Visitors stay anonymous until they send a form. / Works next to
  your CRM: paste a lead's link into the contact note.
- Visual: sample lead panel (real chart and page-details components, made-up data, tagged "Sample data"): plain summary sentence ->
  visit chart -> page buttons (Home, Features, Pricing, Demo request; converted page pre-selected) -> page details -> time per field.
  Caption: A made-up lead, drawn by the same page your real leads get.

**Who opens it** (id `features`, so the header "Features" link works)
- H2: Sales reads one lead. Marketing reads *them all*. Both open the same page.
- Following up · inbound sales, SDRs, nurture: "Before you reply, read what they read." + body + sample "Lead at a glance" stats.
- Improving pages and forms · CRO, digital marketing, demand gen: "Find the field where people give up." + field timing for every
  tracked visitor, Hook questions in plain choices or own words, routes and first-touch sources + "Example" question panel.
- Running the team · heads of growth, managers: "Set it up for the team. Everyone sees the same lead." + roles, Qualified or Junk.
- Link: See everything a lead page shows ->

**How to read it**: "How to read a visit." · It is a chart of what was measured, not a video. · 3 numbered points · docs link.

**Setup** (id `setup`): "One script tag. Your next lead arrives with its visit." · 4 steps with the real snippet (YOUR-KEY) ·
"The facts IT and legal will ask for": script size, cookies, consent and privacy signals, which forms work, how to check · CTAs.

**Fit and limits**: "Built for sites that live on their contact form." · For you if / Not for you if · What it does not do yet ·
Free during early access, no card; notice first, nothing switches to paid on its own · Privacy link.

**Final CTA** (lime band): "See what your next lead *did*." · What happens after you click (4 steps) · Start free · Read the setup
guide first · Free during early access · No card · Remove the tag any time.

## 2. Design spec (applied in the preview)

- Kept: MarketingPage shell, Instrument Serif / Inter Tight / JetBrains Mono, lime on near-black, primaryBtn / ghostBtn, hairlines.
- Removed on this page: rope image, seasonal ghost, marquee, pulsing dots, "Est. 2026", "Scroll", lime row-flood hover.
- Text colours: headlines #f4f2ea (17.98:1), body #9d9b92 (7.23:1), secondary #8b8980 (5.75:1). Nothing dimmer for text. On lime:
  black and black/70 (7.91:1). Ghost-button border raised to #5f5d57 (3.06:1).
- Type: hero clamp(2.5rem,5.6vw,4.5rem); h2 clamp(2rem,4vw,3.25rem); h3 24 px serif; body 16 px; lead 18 px; labels mono 11 px.
- Container 1200 px; section padding py-20 / lg:py-28; one h2 per section (also used for measurement, see 5).
- Product visual wrapped in `.dark` (fixes light-mode rendering), keyboard-usable page buttons, visible focus rings, no motion
  longer than a hover transition; arrow nudge only under `motion-safe`.

## 3. Accuracy audit: every claim mapped to code, or removed

| Claim on the page | Proven by | Note |
|---|---|---|
| See what each person read before sending the form (pages, time, headings reached, scroll, came back) | `app/platform/leads/[lead_id]/page.jsx`, `lib/algorithms/leadProfile.js`, `components/leads/LeadStatsCard.tsx`, `components/leads/SelectedFrameDetails.tsx` | Needs a captured submission |
| Which field the people who never sent it stopped on | `jh-hook/schema.ts` (`formField.isLastTouched`: "On an abandoned form, this is where they gave up"; `formStatus`), `app/api/track-form-engagement/route.js` | Answered through Hook, not a dedicated screen |
| Field timing for every tracked visitor who starts the form | `public/tracker.js` (form engagement), `mds/documentation/tracker-spec-2026-10-07.md` | "Tracked" covers GPC/DNT/consent-mode exclusions |
| Ask in plain choices or type it in your own words | `components/hook/HookBuilder.tsx`, `components/hook/AskHook.tsx` | Production: confirmed by the founder 2026-10-09 |
| Route each converted lead took; first-touch referrer and campaign tags | `components/leads/ConvertedLeadCard.tsx`, `lib/analytics/classifyReferrer.js`, `components/charts/ReferrerDonutChart.tsx`, `components/charts/LeadOriginRadarChart.tsx` | |
| Qualified or Junk | `components/leads/LeadQualifyToggle.tsx` | |
| Invite your team with roles | `app/platform/settings/SettingsClients.jsx`, `lib/tracking/permissions.js` | |
| Paste a lead's link into the CRM note so a teammate can open it | lead pages live at `/platform/leads/[lead_id]` and require membership of the site (`requireSite`) | Only invited teammates can open it |
| One script tag; snippets for HTML, Next.js, Vite/React | `app/platform/create-site/InstallSteps.jsx` | |
| Mark the form with one attribute, or count every form | `app/platform/create-site/page.jsx`, `app/platform/settings/TrackingCards.jsx` (`FormModeCard`) | |
| No form yet? Setup gives you one | `app/platform/create-site/starterForm.mjs`, `InstallSteps.jsx` | |
| Setup confirms the script is live and opens the dashboard | `app/platform/create-site/page.jsx` (`PendingUI` polls verification, redirects) | |
| About 31 KB compressed, one file | Measured 2026-10-09: https://jellyhook.com/tracker.js served Brotli 31,381 bytes (gzip 30,535; raw 109,997) | Re-measure when the tracker changes |
| No cookies; random visitor ID in local storage | `public/tracker.js` (no `document.cookie`), tracker spec (storage table) | |
| No screen, mouse or keystroke recording; anonymous until a form is sent | tracker spec "What it does not collect", `app/privacy/page.tsx` | |
| Stays off with GPC / Do Not Track; optional consent mode | `public/tracker.js` (privacy gates), `app/docs/concepts/privacy-consent/page.tsx` | |
| Forms list and iframe limits | `app/docs/concepts/supported-forms/page.tsx`, `mds/reports/form-compatibility-2026-10-07.md` | |
| A built-in check tells you whether the script and form are set up | `app/platform/settings/TrackingCards.jsx` (`TrackingStatusCard`, `TrackingHealthCard`) | |
| How to read: one column per page in order; wider = longer; green = scrolled past; heading marks; highlighted = form sent; purple gap = time away | `framePlate/geometry/scaleFrameWidths.ts`, `framePlate/theme/defaultTheme.ts`, `framePlate/components/FullPagePlate.tsx`, `framePlate/geometry/buildTimeline.ts` | |
| Does not sync to CRM or export | No integration or export found in the code | True today; update when built |
| Free during early access, no card; notice first; nothing switches to paid on its own | `lib/pricing/tiers.ts`, `app/pricing/page.tsx` (FAQ); founder confirmed the notice promise at the checkpoint | |
| Sample visuals | `app/demo/sampleLead.ts` (made-up), labelled "Sample data" / "Example" | |

**Removed for accuracy during the process:** "every feature" (1-site limit for non-Elite accounts); "Every form lead arrives with the
visit behind it" (absolute: GPC/DNT, iframe forms, cleared storage); "field timing for everyone"; "get the answer across all your
visits"; "readable in ten seconds"; "one line of code" (step 3 also needs an attribute); "session replay"; any speed or load-time claim;
Google Tag Manager; Webflow/WordPress install claims; competitor names; any result promise.

## 4. What the founder must supply or decide

| # | Item | Why (who asked) |
|---|---|---|
| 1 | **Approve** replacing `app/page.tsx` with the preview (or ask for changes) | Required by the brief |
| 2 | **Real screenshots** from a demo site: a lead page, the visit chart with a page selected, field timing, a Hook answer to "Which form field do people give up on most?" (label as sample data) | CRO manager, consultant, sceptic: biggest believability gap |
| 3 | **Price intent after early access** (a ceiling or "small-team plan, price announced before any charge") | Head of growth, sceptic: their last blocker |
| 4 | **Data facts**: hosting region, retention, processors list, whether a DPA is available | Digital marketing, sceptic, head of growth |
| 5 | **Add `defer` to the HTML snippet** in `InstallSteps.jsx`, then **measure page-load impact** and publish it | 8 of 14 personas; currently "not published yet" |
| 6 | **Test a Google Tag Manager install** (custom HTML tag) and document it if it works | CRO manager |
| 7 | **Decide the 1-site limit** for early access (`lib/actions/site-management.actions.js` line 172) | Consultants and agencies; also contradicts "every feature" elsewhere (pricing page) |
| 8 | Header: "Get started" -> "Start free", and show it in the mobile bar (`components/marketing/SiteHeader.tsx`) | Agent B; outside the allowed folder |
| 9 | Footer: remove "All systems go" (`components/marketing/SiteFooter.tsx`) | Agent B: unverified status claim |
| 10 | Wrap the chart in `.dark` on `/demo` and the docs visit-chart page | Agent B: light-mode rendering bug |
| 11 | Claims ledger: add rows for 31 KB, no cookies, starter form, auto-detection, Hook in production (`marketing/claims-ledger.md`) | Keeps the marketing agents consistent |
| 12 | Optional: a public contact email for "questions before you install" | Agent B, Agent A |

## 5. Measurement plan

**What is already in place**
- The Jellyhook tracker runs on every public marketing page (`components/marketing/MarketingPage.tsx`), so the new page measures itself
  once it is live at "/".
- Every call to action carries `data-track-click` (names: `landing-hero-start-free`, `landing-hero-sample-lead`, `landing-sample-page`,
  `landing-docs-lead-page`, `landing-docs-visit-chart`, `landing-fact-open`, `landing-setup-start-free`, `landing-setup-guide`,
  `landing-final-start-free`, `landing-final-setup-guide`). Clicks land in the `click_events` table (`app/api/track/route.js`); there is
  no dashboard view for them yet, so read them in Supabase.
- Each section has exactly one h2, and the tracker captures h1 to h3 positions, so a visitor's visit chart shows which section headings
  they reached ("Headers on this page": Seen / Not seen), and Hook can filter page views of "/" by share of page seen (`seenPct`).

**Funnel to track weekly** (log in `marketing/metrics.md`)
1. Visitors to "/" (Jellyhook dashboard for jellyhook.com; exclude your own visits and any `/platform` paths).
2. Reached each section (headings seen) -> where most stop.
3. Clicks per CTA name (`click_events`).
4. Sign-ups (Clerk users) -> sites created -> sites verified -> first lead captured (`sites` table, lead counts).
5. Source of each sign-up: tag every outreach link with UTM (`?utm_source=linkedin&utm_campaign=w41-outreach`); first-touch source
   is stored per visitor.

**Replacing simulated judgments with real data**
- The simulation predicted *where* people would stop (CRM, speed, data facts, price). Check those predictions against real behaviour:
  which headings are reached, which fact lines are opened (`landing-fact-open`), which CTA gets clicked.
- With early traffic far too small for an A/B test, run 5-second tests with 5 to 8 real people in the target roles (ask: what is this,
  who is it for, what would you do next). Compare the winner with Alt 1 (R3C) that way, not with split traffic.
- Ask everyone who signs up one question in the first conversation: "What almost stopped you?" Log answers in `marketing/learnings.md`.
- Let the `growth-analyst` agent review the numbers weekly against thresholds set in advance (`marketing/experiments.md`).
- Only switch heroes on real evidence: a pattern across real visitors or interviews, never on the simulated scores alone.

## 6. Pain points for outbound (summary of `pain-points.md`)

- Only one simulated persona reached "interested" on v1 (the freelance CRO consultant); by round 3, several would sign up. The voices are
  simulated: validate wording in real conversations.
- **Best outbound targets now:** in-house CRO managers and freelance CRO consultants at B2B lead-gen sites ("which field does our demo
  form lose people on?"), and heads of growth at small B2B companies ("which of our demo requests are real?").
- **Words they use:** which field, drop off, stall, what they read first, before the first reply, real or junk, another tab, in the CRM.
- **What every near-miss asked for:** the visit where they already work (CRM or email) and facts they can forward (script size, data
  location, DPA, price). Copy has covered what is true today; the rest is product and founder work (section 4).
- **Angles:** CRO: "per-field timing and abandoned forms, tied to what each converter read, without watching replays". Growth: "settle
  'is this lead real' with what they actually read". Consultants: "a first-week audit input for low-traffic B2B clients" (only after
  the 1-site limit is resolved).
