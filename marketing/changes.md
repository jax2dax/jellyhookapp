# Landing/docs change log

Every edit an agent makes to the public site is recorded here: date, file, before, after, reason, claim row from the ledger.
To revert a change, put the "before" text back.

## 2026-10-08 site-auditor pass 1 (app/page.tsx, app/pricing/page.tsx, app/layout.tsx)
`npx tsc --noEmit` passed after all edits.

### app/page.tsx
1. Hero H1. Ledger 2, 3. Reason: old line said nothing about the product.
   - Before: `Stop chasing.` / `Start <em>hooking</em>.` (font size clamp(3rem,7.5vw,6.25rem), leading 0.9)
   - After: `See what every lead did <em>before they contacted you</em>.` (font size clamp(2.5rem,6vw,5rem), leading 0.95, so the longer line fits)
2. Hero subhead (new paragraph under H1). Ledger 1, 2, 3, 4.
   - Before: none
   - After: `Add one script to your site. When someone fills in your form, you get the pages they read, how long they stayed, how far they scrolled and how long they spent on each form field. You also see the forms people started and never sent.`
3. Hero eyebrow. Reason: says who it is for, drops the category label.
   - Before: `Lead intelligence, conversion insights & form friction`
   - After: `For websites whose main job is to produce form leads`
4. Hero bullets (HERO_PROMISES). Reason: all four were banned result promises ("close more deals", "increase conversions"). Ledger 2, 3, 4.
   - Before: `Close more deals` / `Decrease form friction` / `Increase conversions` / `Grow your business`
   - After: `Pages read, time and scroll for each lead` / `Time spent on every form field` / `Forms started but never submitted` / `Which headings they reached`
   - Also: list max width max-w-md to max-w-xl; code comment rewritten (the old one mentioned "session replay").
5. Hero primary CTA. Ledger 16.
   - Before: `Start tracking your site`
   - After: `Start free`
6. Hero CTA note (new, signed-out only). Ledger 1, 16.
   - Before: none
   - After: `Free during early access. No card. One script tag.`
7. Hero mock panel (static placeholder). Reason: "Sample dashboard / preview" with bars looked like real data; now labelled as an illustration and describes what a lead page shows. Ledger 2, 3, 5.
   - Before: header `Sample dashboard` / `preview`; rows `Sessions: tracked`, `Scroll depth: captured`, `Form fills: linked to visitor`; footer `Conversion path: mapped end-to-end`
   - After: header `What each lead's page shows` / `illustration`; rows `Pages: read, in order`, `Scroll depth: per page`, `Form fields: time on each`; footer `Conversion path: start to submit`
8. Hero footer strip. Reason: "Not sampled or estimated" and "Every visit, charted" are not in the ledger. Ledger 1, 17.
   - Before: `One tracker script. Every visit, charted page by page. Not sampled or estimated.`
   - After: `One script tag. Visitors stay anonymous until they submit a form.`
9. Ticker. Reason: "Lead intelligence" is banned as a category; "Hook queries" put the unverified Hook in the hero band; the old list had 6 items but only 5 render, so "Conversion paths" never showed. Ledger 3, 4, 5.
   - Before: `["Visit chart", "Hook queries", "Scroll depth", "Lead intelligence", "HubSpot forms", "Conversion paths"]`
   - After: `["Field timing", "Visit chart", "Scroll depth", "Abandoned forms", "Conversion paths"]`
10. Section 02 H2 + paragraph. Reason: "intent discovery" is unexplained jargon and sits next to a banned feature. Ledger 1, 2, 4.
   - Before H2: `Built for conversion tracking & <em>intent discovery</em>.`
   - After H2: `One lead. Their whole visit, <em>before the form</em>.`
   - Before p: `Install one script and Jellyhook turns every visit into a page-by-page chart: pages seen, time spent, how far they scrolled. It also links every form submission straight back to that history. Here's what that means for the people who actually use it.`
   - After p: `Install one script and Jellyhook draws each visit as a page-by-page chart: pages read, time spent, how far they scrolled and which headings they reached. When someone submits a form, that visit is attached to the lead. Here's what that means for the people who use it.`
11. Audience "Sales". Reason: "what was on screen" is not recorded. Ledger 2, 4.
   - Before: `Walk into every call already knowing what a lead saw: which pages, how long, and what was on screen right before they converted. Wear their shoes before you ever say hello.`
   - After: `Before the call, open the lead's page. See which pages they read, how long they stayed, how far they scrolled and which headings they reached. Start from what they read.`
12. Audience "Marketing". Reason: "see whether a campaign change moved the needle" and "channels proven to bring in leads" are result claims. Ledger 5, 8.
   - Before: `Spot the pages and moments that actually push visitors to convert, see whether a campaign change really moved the needle, and put budget behind the channels proven to bring in leads.`
   - After: `See the path each converted lead took, from the start of the visit to the form. See where new visitors and converted leads came from, and split visits by referrer, device or country.`
13. Audience "Business managers". Ledger 6, 9.
   - Before: `Watch conversions trend over time and see, from the real visit charts, exactly which pages hold attention and which ones quietly lose it, giving your whole team a shared, factual picture to work from.`
   - After: `See visitors online now, page views, leads and conversion rate against the previous period. A pages table shows views, average time and average scroll for every page, so the team works from the same numbers.`
14. "Works with" strip. Reason: "most other form builders" was vague and overbroad. Ledger 11.
   - Before: `plain HTML forms · HubSpot embeds · most other form builders`
   - After: `plain HTML forms · HubSpot · Gravity Forms · WPForms · Contact Form 7 · full list and limits` (last item links to /docs/concepts/supported-forms)
15. Section 03 H2 + paragraph. Reason: referred to "the four things above" (the removed promises); "every lost lead had a reason" is unprovable. Ledger 3.
   - Before H2: `Every lost lead had a reason. <em>You just never saw it.</em>`
   - After H2: `You see the leads. <em>You never see who quit the form.</em>`
   - Before p: `A bounce rate tells you someone left. It never tells you why. Jellyhook is built to close that gap, so the four things above aren't just promises: they're what you actually get.`
   - After p: `A bounce rate tells you someone left. It does not tell you where. Jellyhook shows how long people spend on each form field and which forms were started but never submitted, next to what each lead read.`
16. PROMISE_DETAILS (four cards). Reason: titles and bodies were banned result claims. Ledger 2, 3, 4, 5.
   - Before titles: `Close more deals` / `Decrease form friction` / `Increase conversions` / `Grow your business` (with outcome copy, e.g. "so you can open with the thing that already has their attention")
   - After: `Read the visit before the call` (pages viewed, time on each, scroll) / `See where the form loses people` (time on each field, forms started never submitted) / `See which headings they reached` (parts scrolled past, headings reached) / `Follow each lead's path` (Conversion Paths, start of visit to submission)
17. Hook section H2 + intro. Reason: "anything" and "in seconds" overclaim; "Meet Hook, the new way" is hype; Hook is unverified in production. Ledger 15.
   - Before H2: `Ask your visitors <em>anything</em>. Get the answer in seconds.`
   - After H2: `Ask your own data a <em>precise</em> question.`
   - Before p: `Meet Hook, the new way to question your own data. Dashboards answer the questions someone thought of in advance. Hook answers yours: precise questions about sessions, leads, pages and forms, built from plain choices, answered live, drawn as the people and visits behind the numbers.`
   - After p: `Hook filters your visits and leads by what they did: pages, time, scroll and forms. You build the question from plain choices, and the results come back as visit charts and lead profiles.`
18. Hook examples label. Reason: "answers today" implies it is live for everyone (banned, unverified). Ledger 15.
   - Before: `Questions Hook answers today`
   - After: `Questions you can ask Hook`
19. Final CTA headline. Ledger 2.
   - Before: `Ready to <em>hook</em>` / `your leads?`
   - After: `See what your next` / `lead <em>did</em>.`
20. Final CTA paragraph. Ledger 1, 2, 16.
   - Before: `Create a site, drop the tracker script in, and watch your first visit appear. Free to start.`
   - After: `Create a site, add one script tag, and your next form submission arrives with the visit behind it. Free during early access, no card.`
21. Page metadata (title, description, openGraph). Ledger 1, 2, 3, 16.
   - Before title: `Lead Intelligence & Conversion Insights` (og: `Jellyhook: Lead Intelligence & Conversion Insights`)
   - After title: `See what each lead did before they contacted you` (og: `Jellyhook: See what each lead did before they contacted you`)
   - Before description: `Jellyhook shows you what a lead saw before they converted, exactly where your forms lose people, and which pages are actually turning visitors into leads.`
   - After description: `Add one script to your site. For every form lead, see the pages they read, how long they stayed, how far they scrolled and how long they spent on each form field. Free during early access.`

### app/layout.tsx
22. DESCRIPTION constant (site default meta, og, twitter). Reason: "lead intelligence" banned; "full session" and "worth chasing" imply replay and scoring. Ledger 1, 2, 3, 16.
   - Before: `Jellyhook is a lead intelligence and conversion insight platform. See every visitor's full session, exactly where your forms lose people, and which leads are actually worth chasing.`
   - After: `Add one script to your site. For every form lead, see the pages they read, how long they stayed, how far they scrolled and how long they spent on each form field. Free during early access.`
23. Default title, og title, twitter title (3 places).
   - Before: `${SITE_NAME}: Lead Intelligence & Conversion Insights`
   - After: `${SITE_NAME}: See what each lead did before they contacted you`
24. Organization JSON-LD description. Ledger 2, 3, 5.
   - Before: `Jellyhook is a lead intelligence and conversion insight platform offering visit charts, linked form submissions,  conversion path tracking and form friction analysis.`
   - After: `Jellyhook shows what each form lead did on a website before they contacted the owner: pages read, time, scroll depth, conversion paths and time spent on each form field.`

### app/pricing/page.tsx
25. Meta description + og description. Reason: "lead intelligence" banned. Ledger 3, 4, 5, 16.
   - Before: `Jellyhook is free during early access. Every feature on every account, including lead intelligence, conversion paths, and visit charts, is unlocked with no card required.`
   - After: `Jellyhook is free during early access. Every feature is on every account, including lead visit charts, form field timing and conversion paths. No card required.`
26. Hero paragraph. Ledger 16.
   - Before: `Jellyhook is in early access. Every feature (full sessions, lead intelligence, conversion paths, all of it) is unlocked on every account, no card required. Paid plans are coming later, but not yet.`
   - After: `Jellyhook is in early access. Every feature (lead visit charts, form field timing, conversion paths, all of it) is on every account, no card required. Paid plans are coming later, but not yet.`
27. Note under CTA (new). Source: marketing/strategy.md ("the ask in return is feedback and a short call"). Needs founder OK. Ledger 1.
   - Before: none
   - After: `In return we ask for feedback and a short call. Setup is one script tag.`
28. FAQ "site vs personal upgrade" answer (also feeds FAQPage JSON-LD). Reason: 100+ word hedge that made early-access visitors think about paid tiers.
   - Before: `Once paid plans launch, every paid tier will offer both. Upgrading a SITE upgrades it for everyone on it: anyone you invite as a team member inherits that tier's access, and upgrading is what unlocks inviting team members at all. Upgrading PERSONALLY gives just you that tier's access, solo, with no team invites. We haven't finalized whether the two will be priced and featured identically, so don't assume a site upgrade and a personal upgrade will end up giving exactly the same power; expect at least some differences once this is actually built out.`
   - After: `Once paid plans launch, each paid tier will come in two forms. Upgrading a site gives that tier to everyone you invite to it, and it is what unlocks team invites. Upgrading personally gives just you that tier, with no team invites. Pricing is not final, so the two may not cost or include the same things.`

## 2026-10-08 founder-requested build: public sample lead page (not an agent edit)
- New: app/demo/page.tsx, app/demo/DemoLead.tsx, app/demo/sampleLead.ts. Route /demo, public, no login. Uses the real FramePlateChart and SelectedFrameDetails with one made-up lead ("Sam Rivera", example.com), labelled "Sample data" three times on the page.
- app/page.tsx: added "See a sample lead page" link under the hero CTA note (signed-out visitors only).
- app/sitemap.ts: added /demo.
- Revert: delete app/demo/, remove the link in app/page.tsx and the sitemap line.

## 2026-10-09 docs-writer: audit, use-cases page, Introduction rewrite
- New: marketing/docs-audit.md (coverage table, gaps, trap numbers, mixed pages, next jobs).
- New: app/docs/use-cases/page.tsx ("What Jellyhook is for"). Problem, who it is for / not for, 5 example situations each mapped to a screen, Leads vs Conversions example, "what it does not do" table. Ledger 2, 3, 5, 6, 10, 12, 17, 18, 20, 21. Scenarios labelled as examples; no results claimed.
- app/docs/docsNav.ts: added { slug: "use-cases", title: "What Jellyhook is for" } as the first link after Introduction (sitemap picks it up from the nav).
- app/docs/page.tsx (Introduction), rewritten.
  - Before: "Jellyhook is a tracking script and dashboard for businesses that get leads through their website... compare it against other leads who converted the same way." plus Hook paragraph and one link to Installation. (The "compare against other leads" sentence was not verified against the code and is dropped.)
  - After: first paragraph says what it is, who it is for and what you see per lead; a "What it is, and what it is not" section with a link to /demo; a "Where to go next" table routing 8 intents to pages; "Two words to know first" (lead vs visitor, Leads vs Conversions).
- Meta description of /docs updated to match.
- Checks: npx tsc --noEmit clean, npm run docs:check in sync.


## 2026-10-22 founder-requested build: notifications and lead groups docs (not an agent edit)
- New: app/docs/reference/notifications/page.tsx, app/docs/reference/groups/page.tsx (feature reference, docs-standard sections).
- app/docs/docsNav.ts: added "Lead groups" and "Notifications" after "Lead profile page".
- No landing page claims added. The features are not in the claims ledger yet; do not market them until they are.
- Revert: delete the two folders and the two nav lines.

## 2026-10-25 founder-requested build: interactive demo on the home page (not an agent edit)
- app/page.tsx: new section `#try-it` ("01 / Try it") between the ticker and Features. Ledger 23, 24, 25.
  - Before: none (the hero was followed by the ticker, then "02 / Capabilities").
  - After: heading `Mark the leads who read your pricing. Hear about the next one.`; text `A mark is a set of conditions about what a lead did before sending your form: the pages they read, the time on each, their answers. Every lead that matches gets a badge. A hook watches new leads and tells your team, in Jellyhook and in Slack, when one has your marks. Try both below on the real screens, with sample data.`; then the demo (components/showcase/LeadsShowcase.tsx): the real Leads and Hooks screens on a made-up site, a start card ("Start the guided tour" / "Explore on my own"), a 22-step guided tour, "Restart the tour" and "Try it on your site" (/sign-up) under the frame. Phones see "The interactive demo needs a wider screen" with a link to /demo.
- The demo says "Sample data" in its browser bar, its sidebar and under the frame. The AI face of the mark builder answers that it is not part of the demo; the tour never mentions it. New hooks in the demo start without the ad parts of the Slack message (Acquisition is not in the ledger).
- marketing/claims-ledger.md: rows 23 (marks), 24 (hooks), 25 (the demo).
- Checks: npx tsc --noEmit clean; eslint clean on the new files; a scripted Chrome run walks all 22 steps at 1440 px and 1024 px wide, and calls no server action.
- Revert: remove the `#try-it` section and the LeadsShowcase import from app/page.tsx.

## 2026-10-25 founder-requested docs review (not an agent edit)
- app/docs/docsNav.ts: sidebar regrouped by job, URLs unchanged: Getting started; Leads (Leads page, Lead profile, Marks, Lead groups, Form fields); Hooks and integrations; Analytics (Dashboard, Conversions, Acquisition, Set up ad tracking); Core concepts; Privacy and data; Workspace (Settings, Team, Billing); Query builder (Hook), now after the daily features since the app hides it; Troubleshooting. All 42 pages listed once.
- app/docs/reference/dashboard/page.tsx: rewritten to the docs standard for the renovated dashboard. Removed sections for cards deleted on 2026-10-24 (Pages, Hook shortcut, Lead footprints, Live Ticker). Added the header, the five tiles as they are now, Hooked leads, Your marks, Latest leads, empty states, limits, related.
- app/docs/page.tsx: "Where to go next" adds Marks and Hooks; points to the home page's interactive demo; "Words to know first".
- Labels synced with the screens: "Session history", "Path to conversion", "Whole journey summary", "Conversion rate"; story highlighting described as it is now; Settings paths say "Settings → Tracker → ..." (the tab is Tracker). "The most powerful part of Hook" → "The deepest part of Hook".
- Checks: npm run docs:check in sync; tsc clean.


## 2026-10-27 founder-requested privacy update (not an agent edit; the founder asked for it)
- Why: the tracker now keeps unsent data, including a submitted form's values, in the tab's session storage and retries for up to 30 minutes (`public/tracker.js` OUTBOX, `mds/local_cache_schema.md` `jh_outbox`).
- app/privacy/page.tsx, visitor data list: new row "Waiting to be sent".
  - Before: none.
  - After: `If our servers do not answer, the tracker keeps what it was sending (including a submitted form's values, without the fields that are always left out) in that browser tab's session storage and tries again for up to 30 minutes. Each item is deleted as soon as our servers accept it, and in any case when the tab is closed.`
- app/privacy/page.tsx, consent section.
  - Before: `The tracker stores a random visitor ID and session details in the visitor's browser (local storage) and sends the data above to Jellyhook.` and `...and erases what it stored if the visitor says no.`
  - After: `The tracker stores a random visitor ID and session details in the visitor's browser (local storage), keeps anything still waiting to be sent in that tab's session storage, and sends the data above to Jellyhook.` and `...and erases what it stored, including anything waiting to be sent, if the visitor says no.` (true: `eraseStoredData` removes every `jh_` session storage key.)
- app/docs/concepts/privacy-consent/page.tsx: one sentence after "...to Jellyhook.": `If Jellyhook's servers do not answer, what was being sent (a submitted form's values too) waits in that tab's session storage and is sent again for up to 30 minutes; it is deleted once accepted, and in any case when the tab closes. (Not "after 30 minutes": if the visitor moves to a page without the tracker, an unsent item stays until the tab closes.)`
- No marketing claim added. Checks: npx tsc --noEmit clean, npm run docs:check in sync.

## 2026-10-27 founder-requested build: marks v3 (not an agent edit)
- Why: marks v3 (mds/build/marks/when-marks-run.md) checks new leads while a mark is on, plus the past leads chosen at save (default last 30 days). "Every lead that matches" was no longer exact.
- app/page.tsx, `#try-it` text.
  - Before: `Every lead that matches gets a badge.`
  - After: `Every new lead that matches gets a badge, and you choose which past leads to check.`
- marketing/claims-ledger.md row 23: claim reworded the same way; condition added (do not say "every lead" without the past-leads choice; an off mark checks nothing).
- app/docs/reference/marks/page.tsx: new section "Preview, and which leads are checked" (preview on the last 100 leads, the four past-leads choices, background check with progress, off means not checked, a changed rule clears old results, "not checked", Re-check its leads); "How it is checked" now says the order of checks and that the first failed condition ends a lead's check (the old line "Saving a mark checks every lead" is gone).
- mds/documentation/doc_source_map.md: marks row lists the v3 sources.
- Checks: npx tsc --noEmit clean, npm run docs:check in sync.

## 2026-10-28: marks docs, when new leads are checked (background queue)
- File: `app/docs/reference/marks/page.tsx`, "Preview, and which leads are checked", the "New leads" item.
- Before: "While a mark is on, every new lead is checked when the form is sent, and again when that visit ends."
- After: "While a mark is on, every new lead is checked, and again when that visit ends. A mark used by a notification
  rule is checked first, the moment the form is sent, so the notification never waits. Other marks are checked right
  after, in the background. When many forms arrive at once they can take a few minutes, so a badge may appear a little later."
- Why: migration 34, the queue of other marks (`mds/build/marks/queue-and-cap.md`). No ledger claim changes.

## 2026-10-28: notifications docs, the "Sent late" line
- File: `app/docs/reference/notifications/page.tsx`, "The Slack message" table.
- Before: no row about late messages.
- After: a row "Sent late": "Sent 54 minutes late. Jellyhook was busy when this form came in. The form was sent ...",
  right under the message; shown when the message goes out more than 2 minutes after the form; always on.
- Why: `lib/notifications/message.ts` `lateNote` (crowd test 2026-10-28: waiting leads were sent an hour late with no
  sign of it). No ledger claim changes.

## 2026-10-28 founder-requested build: hero hook box, Slack notification showcase (not an agent edit)
- app/page.tsx hero: the four-item promise list is replaced by a "write a hook" box (components/showcase/HeroHookBox.tsx). First line alternates "Notify me when..." / "Notify me on Slack when..."; under it, example conditions type out, erase and retype as a moving placeholder:
  `their budget is between $20k and $30k, and they stayed on the site for at least 2 minutes`; `they saw 90% or more of "/pricing" and did not hesitate on the form`; `they came from a Facebook ad and spent 40 seconds or more on "Best deals"`; `they came from a TikTok ad, opened "/" and went straight to "/contact"`. Visitors can type their own; "Hook it" goes to /sign-up?hook=... Ledger 23 (widened to name where the visit came from, per the founder's examples).
  - Before: the list "Pages read, time and scroll for each lead / Time spent on every form field / Forms started but never submitted / Which headings they reached".
- New section `#get-told` "02 / Get told" (components/showcase/SlackDesktopShowcase.tsx): a Windows desktop where Slack notifications from Jellyhook slide in for three sample leads ("🔥 Hot lead: <name> just filled out a form"), with the marks matched and a visit line; taskbar Slack badge counts up. Heading `A lead does what you hooked. Slack tells you.` Ledger 24. No speed claim (delivery goes through a queue).
- Sections renumbered: 03 Capabilities, 04 Why it matters, 05 Get started.
- Founder asked for the subject "High intent level 5 🔥 just filled out a form"; used "🔥 Hot lead: <name> just filled out a form" instead because "intent level" reads as lead scoring (banned-claims.md). One-line change in TOASTS if the founder wants it.
- Checks: tsc clean, eslint clean, screenshots at 1440 px.
- 2026-10-28 (same section): each cycle now zooms the screen in on the Slack toast (2x), a pointer presses an orange **Contact lead** button with the HubSpot logo, then zooms back out. `HubSpotLogo` (components/notifications/Brand.tsx) takes a `color` (white on the orange button). Note: the real Slack button is labelled "Open in HubSpot", and HubSpot is not in the claims ledger; banned-claims.md still says "No integration exists" (out of date since 2026-10-25, founder setup pending).

## 2026-10-28 design taste test: magazine look preview (app/v2/page.tsx, new)
Founder rejected the black + lime look and the fonts and chose "The Magazine Issue" (white paper, ink black, one tangerine
spot #d4380a, Young Serif + Albert Sans, heavy rules, two-column grid). Built as a separate, not-indexed preview at /v2; the
live app/page.tsx is unchanged. Copy is placeholder until the founder sends new words; it reuses lines already on the live
page (ledger 1-4, 16, 23). The lead route is labelled "Example data".
- New: `app/v2/page.tsx`, `app/v2/v2.css`, `components/showcase/v2/IssueHookBox.tsx` (the hook box restyled).
- Changed: `components/showcase/HeroHookBox.tsx` now exports PREFIXES, EXAMPLES and useTypewriter (no visible change).
- `npx tsc --noEmit` passed. Design brief: `.impeccable/surfaces/app-v2-page-tsx.md`.

## 2026-10-28 /v2 preview: green spot color and the founder's new copy
- Spot color tangerine #d4380a to green #0f7a3d (white text on it passes 4.5:1); light band #eef2ec.
- All copy replaced with the founder's 10-section landing copy (pasted 2026-10-28). One em dash changed to a comma (style rule).
- NOT in the claims ledger yet, check before /v2 replaces the live page:
  1. Section 05 (ads, UTM, "which sources bring leads"): Acquisition is not in the ledger (CLAUDE.md rule 7).
  2. "Use Google Tag Manager" (hero and setup step 2): no ledger row.
  3. Section 06 "Compare journeys across converted and non-converted visitors" and "sections frequently reached before conversion": no ledger row.
  4. "Flag potential confusion" / "intent markers" wording: marks exist (ledger 23); "intent" wording sits near banned "intent score".
  5. "Stop watching session videos": contrasts with replay, does not claim it; banned list only bans calling the chart a replay.

## 2026-10-28 the magazine look becomes the live home page (app/page.tsx)
- Before: app/page.tsx (black + lime, Instrument Serif / Inter Tight). Kept unrouted at `app/_legacy-home/page.tsx`; to revert,
  move it back to `app/page.tsx`.
- After: the /v2 design (white, ink, green #0f7a3d, Young Serif + Albert Sans) with the founder's copy. Files: `app/page.tsx`,
  `app/landing.css`, `components/showcase/v2/{IssueHookBox,HookMark,Reveal,HubSpotCardShowcase}.tsx`. /v2 removed.
- Review fixes: own tracker script kept (same key as MarketingPage); interactive demo (LeadsShowcase) kept as a dark
  spread; real title/description (not "Preview", indexed); no Clerk avatar; hero trimmed to headline, one paragraph,
  button and the Tag Manager note, the three bullets moved to a strip under it; broken "J" replaced by a fish-hook mark
  (eye, shank, bend, barb), also in the cover art, where it sways on its line.
- New section in 08: a HubSpot contact record (example data) with the Jellyhook card outlined in green; it zooms on the
  card, underlines the summary, then the pointer clicks Call and a call starts. Copy: "Every form's footprint shows up in
  a Jellyhook card on the HubSpot contact. Read it and call, without leaving HubSpot." (ledger 28)
- Motion: below-the-fold headings and rows lift out of a soft blur once, section rules draw in, cover shapes settle.
  Nothing animates with reduced motion; content shows without JavaScript.
- Ledger: rows 26 (Tag Manager, verified in InstallSteps.jsx and tracker.js), 27 (source and UTM per lead), 28 (HubSpot card) added.
- Section 06 bullets reworded to what the product does today: "See which headings and sections converted leads reached",
  "Compare converted leads with visitors who never sent the form", "Investigate which pages and sections your best leads read"
  (were: "sections frequently reached before conversion", "compare journeys across converted and non-converted visitors").
- Section 07 shortened by one clause ("or completes a combination of actions"; "applies your rules to recorded lead activity").
- `npx tsc --noEmit` passed; design detector clean.

## 2026-10-28 the other marketing pages take the home page's look
- Pages: /pricing, /about, /privacy, /terms, /demo, /docs (all pages), sign-in, sign-up. Shell: `components/marketing/`
  (MarketingPage, SiteHeader, SiteFooter, MarketingTheme, fonts, PricingCards).
- Colours only, no copy changed: the old dark palette's 19 colours were swapped for tokens (ink, ink-soft, rule, paper,
  paper-2), set in MarketingTheme.tsx under `.jh-mkt`; `--lime` now holds the green inside `.jh-mkt`, so lime classes turn
  green. The home page's dark demo band keeps the old lime (`:root`).
- Fonts: Young Serif + Albert Sans (code stays in JetBrains Mono). Italic emphasis became plain green (the serif has no italic).
- Header: the home page's masthead (serif wordmark with the hook mark, caps links, 6px ink rule). No Clerk avatar; signed-in
  visitors get a Dashboard button. Footer: one rule, caps links. Grain overlay removed.
- Buttons on green use white text. `npx tsc --noEmit` passed.

## 2026-10-28 founder review: pricing, docs negatives, sign-in/up cards
- app/pricing/page.tsx: removed the "Where pricing is headed" section (PricingCards, site vs just-me toggle) and the
  paid-plan FAQs ("What happens when paid plans launch?", "upgrading a site vs upgrading just me"). Added "Can my team use
  it?" (ledger 14, 16). Hero: "Paid plans are coming later, but not yet." removed; now "...marks, hooks, all of it) is on
  every account, for your whole team, no card required."
- app/docs/reference/billing/page.tsx: "Subscription page" paragraph (future site/personal upgrade) replaced by "Your team".
- app/docs/use-cases/page.tsx: "What it does not do" (six "No." rows, one wrong: "There is no CRM integration") became
  "Good to know" with plain facts, CRM row now names the HubSpot card (ledger 28).
- app/about/page.tsx: "What it isn't" (Not a CRM...) became "Where it fits". CTA button text white on black.
- app/privacy/page.tsx: Google Analytics / Vercel Analytics row shortened to "Visit statistics for jellyhook.com." (kept
  listed: a privacy policy names the tools that process visits to our own site).
- Sign-in / sign-up: AuthCardFrame, SignInCard, SignUpCard and both pages in the magazine look (wordmark + hook over an ink
  rule, white card with a 2px ink border, green button, no glow).
- Docs sidebar: active page on light green, not black. `npx tsc --noEmit` and `npm run docs:check` passed.

## 2026-10-28 privacy docs and notices
- app/docs/concepts/privacy-consent/page.tsx rewritten: full storage key list (adds jh_consent, jh_ignore, jh_outbox),
  automatic banner reading and its four states, consent mode for other banners, retention, erasing a person, where data
  is stored with the no-DPA notice for EU/UK sites, and a privacy-notice text for customers.
- app/privacy/page.tsx: consent paragraph (banner followed automatically, no cookies, no DPA), retention (13 months
  default, erase by email), "Last updated October 28, 2026".
- app/docs/installation/page.tsx: sign-up forms with a password are not leads; Google Tag Manager install; banner line.
- app/docs/reference/settings/page.tsx: Privacy section. app/docs/reference/billing: "unlocked" became "on".
- Ledger: row 22 rewritten (automatic banner, never "compliant"), row 29 added (retention, erasure).

## 2026-10-28 founder review 3 (home, docs on phones, pricing)
- Docs on phones: the sidebar is a folded "Docs / Menu" bar above the page (lg and up keeps the side column);
  app/docs/DocsSidebar.tsx, app/docs/layout.tsx.
- Home: first letter of the hero paragraph is larger but inline (no float, no indent); the "Q" over the hook box removed;
  "Which new lead should someone call right now?" became "Which new lead should you call first?"; the numbered example
  route replaced by the real visit chart on example data with click-to-inspect (ExampleFramePlate, ledger 2, 4, 21);
  setup step 1 shows the tracker snippet.
- Pricing FAQ "Is this actually free": adds the limits (5 sites per account, 10 hooks per person per site, 500 Slack and
  webhook messages per site per day; app/docs/reference/notifications Limits, pricing FAQ).

## 2026-10-28 founder review 4 (home)
- Journey: components/showcase/v2/JourneyChart.tsx plays public/frameplatedemo.mp4 (muted, looping) first, with an
  "Explanation" / "Interactive chart" button by "One lead's visit chart" and a "See the interactive chart" button over the
  video's bottom-right corner (it hides the recorder's watermark); the area turns over to the real visit chart. No video
  file yet: the chart shows straight away.
- "See the journey, not just the numbers." became "No more sitting through session videos to piece together one visit."
- Hero question takes turns (QuestionFlip.tsx): "Which new lead should you call first?" / "Filter out the "just checking"
  visitors. Call the leads who are ready."
- Band: CoverArt.tsx, water drifting in two waves; every 7 s the hook drops, the green fish swims to it and is pulled out.
- Logo: the real Jellyhook mark (public/jellyhook-nobg.png) next to the wordmark on the home page, the shared header and
  the sign-in/up card.
- CRM section: "CRM" in HubSpot orange, a "Works with HubSpot" badge (ledger 11, 28), and a line on starting automation
  from a hook's webhook (Zapier, Make, n8n, your CRM; ledger 24).

## 2026-10-28 founder review 5
- Band (CoverArt.tsx, landing.css): the hook rests under the water most of the time; every 22 s the fish (now facing the
  way it swims) appears, swims to the hook and is pulled out.
- Hero question alternates every 11 s (was 5 s).
- Hero hook box: third variant "Start an automation when..." (webhook, ledger 24).
- Docs: reference/notifications (Earlier visits row, the form left unsent in the visit summary, previous_visits and
  automation via webhooks), reference/lead-profile (key events).

## 2026-10-28 founder review 6
- /demo (app/demo/page.tsx): the static sample lead page replaced by the interactive demo at full width, with the tour;
  lead pages work inside the demo (components/showcase/DemoLeadPage.tsx). Ledger row 21 rewritten.
- Home: the question alternates "Which lead should you reach out to first?" / "Prioritize the high-intent leads." (the
  "just checking" line removed). The explanation video is public/assets/Scene.mp4.
- Home demo's phone note no longer links to /demo (it now needs a computer too).

## 2026-10-28 CRM line and SEO
- Home CRM section: added "Jellyhook gives you the context your CRM is missing." above the HubSpot line.
- SEO: share image (app/opengraph-image.tsx, twitter-image.tsx), root title/description to the new positioning
  ("Stop treating every lead like a stranger"), root canonical removed, SoftwareApplication JSON-LD on the home page,
  sitemap dates, robots disallows for internal pages, IndexNow key and `npm run seo:indexnow`. Notes: mds/build/seo.md.

## 2026-10-28 the enterprise-suite gap (home, before the closing call to action)
- New section: "The big marketing suites can do this. At a price a lean sales team never pays." Two columns: an
  enterprise marketing suite (top-tier lock, onboarding, unused features) vs Jellyhook (one script, free during early
  access, only what a sales team uses, a Slack summary card seconds after a matching lead sends the form).
- From the founder's note. HubSpot and the $890/month figure were left out on purpose: the rules forbid naming
  competitors on the site, the page praises HubSpot elsewhere, and the price was not verified. Ledger rows 1, 16, 23, 24.

## 2026-10-28 CRM line
- Home: 'Every form's footprint shows up right inside your CRM, in a Jellyhook card on the HubSpot contact.' (ledger 28)


## 2026-10-28 hero: See the demo
- Home hero: a 'See the demo' button (to /demo) beside 'Try Jellyhook for free'. Ads land on / (marketing/calendar/2026-W44.md).


## 2026-10-28 docs tone and structure pass
- Removed 28 filler uses of "actually" across the docs.
- Intros that opened with a rhetorical question rewritten as statements: reference/marks, notifications, dashboard,
  acquisition, form-fields, guides/ad-tracking. reference/marks: "notification rule" became "hook" (2 places).
- reference/groups: 7 sections to 4 (Using groups, How it works, Limits and troubleshooting, Related); "notification
  rule" became "hook"; the intro no longer opens with a question.
- reference/settings: 10 sections to 6, in the order of the Settings sidebar (General with pause, team and leaving;
  Installation; Connection with allowed hosts; Attribute check; Forms; Privacy).
- Checked: no casual phrasing (let's, you'll, don't worry, exclamation marks) left. `npm run docs:check` passed.

## 2026-10-29 home: qualify from the visit, and one concrete rule
- New section after the three hero lines: "Long forms scare off big buyers. Chatbots annoy them." Body: Jellyhook
  qualifies a lead from what they already did on the site (pages, time, scroll, how they filled in the form); keep the
  form short. Three columns: fifteen qualifying questions (they leave halfway), a chatbot (they close it), Jellyhook
  (nothing extra to answer; an example visit: pricing read twice, 3 min on Enterprise services, longest pause on the
  budget field). Ledger rows 2, 3, 4, 23. From the founder's "silent context filtering" note; the word "silent" was
  left out (reads as covert next to a tracking script).
- "Define your ideal lead": the closing line became "Apply a mark and its leads come first. Less guesswork, a clearer
  way to prioritize." (ledger 23). Added a rule card under it: example mark "Whale" (budget form answer over $4,000,
  at least 3 minutes on /enterprise-services, before the form is sent) feeding a hook that messages #sales in Slack
  (ledger 23, 24). Same rule as the "set the rules" video.
- Not used, on purpose: "top 5%" (invented number), "lead scoring", "watches", ad-creative previews (not built).
