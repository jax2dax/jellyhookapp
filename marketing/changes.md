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
