# Marketing strategy (update when it changes)

Last updated: 2026-10-08

## Positioning (working)
**See what each lead did before they contacted you, and which form field loses the rest.**
Lead with form field timing (the sharpest, easiest claim). Second: the per-lead visit chart (the visual difference).
Do not lead with Hook. Do not use "lead intelligence" (it sounds like company identification, which Jellyhook does not do).

## Who it is for
Not "anyone with a contact form". A website where all three are true:
1. the site's main job is to produce form fills (inbound leads),
2. a human follows up afterwards (the form is not the sale),
3. the content is multi-page and persuasive (so what they read matters).

Concrete segments (from `mds/reports/saas_validation.md`, an unverified AI-written hypothesis, not proof):
- **Wedge A (start here): B2B SaaS with a sales-assisted funnel** (a "Book a demo" / "Request a demo" form). Decide alone, understand "which content converts", install a script in minutes.
- **Wedge B (second): small demand-gen / marketing agencies and consultants** serving high-ticket verticals (law, higher-end home services, B2B services). One agency can mean several sites. Needs one real example first.
- **Angle for SEO/content managers**: "which pages did leads read before they contacted you". Proof that content produces leads.
- Buyer = person accountable for inbound lead conversion (growth lead, marketing manager, founder who sells). Sales reps are users, not buyers.

## Competitive reality (be honest in all copy and replies)
- Zuko: field-level form analytics, from about $56/month. Closest on form timing. It is form-only.
- HubSpot and similar CRMs: show pages viewed in a contact's timeline once the visitor is linked. A list, not a chart.
- LeadSources / Attributer: put source and pages into CRM fields.
- Hotjar, Clarity, FullStory: video and heatmaps. Clarity is free.
- Leadfeeder / Dealfront: identify visiting companies. Jellyhook does NOT.
- LightTrail: healthcare-focused. Don't target medical practices first.
- Not found elsewhere (my search was limited, not proof): one visit drawn as page-shaped frames showing which parts of each page and which headings the person reached.

## Known gaps (do not hide them from founder)
- No CRM link: reps live in the CRM. A visit-link field in the CRM record would fix it.
- No demo mode: someone must install and wait for traffic before seeing value.
- No banner of its own. The tracker now honours GPC/Do Not Track and has an optional consent mode; consent remains the site owner's responsibility (ledger row 22).
- Hook works in production: UNVERIFIED.
- The landing hero ("Stop chasing. Start hooking.") does not say what the product does.

## Channels that failed (do not repeat)
Posting and commenting about Jellyhook on Reddit and similar. Links were clicked out of curiosity; nobody installed.
Friends/family and local businesses are ruled out by the founder.

## What to do instead
Few, named, personal conversations with Wedge A and B people, backed by a clear landing page and a way to see
value fast. Measure: messages sent, replies, calls held, installs verified, leads captured, week-two returns.
Free during early access; the ask in return is feedback and a short call.

## Founder timezone
ASSUMED US Pacific (PT) on 2026-10-08 (machine clock). Not confirmed by founder. Ask; update here when answered.

## Outreach list (first pass, 2026-10-08)
`targets.csv` holds 12 B2B SaaS demo-form companies with named public role-holders. They skew mid-size (product-adoption, demo and revenue tooling). Small Wedge A sites were not found reliably. Wedge B (agencies) not started.

## Update 2026-10-08 (founder answers)
- Timezone confirmed: US Pacific (Oregon). Plan times stand.
- Everything is 0: no signups, sites or leads. The first real users will come from the named outreach in marketing/calendar/2026-W41.md.
- No booking link yet. Do not add a "Book a call" button until the founder has a calendar URL and wants it.
- The public sample lead page /demo now exists (app/demo/). Point every "what is it?" reply to jellyhook.com/demo.
- Landing analytics: the Jellyhook script on jellyhook.com is commented out in app/layout.tsx; visit counts are guesses until it is enabled.

## Update 2026-10-09: product-led, not sales-led
Founder decision: there is no paywall, so the ask is self-serve. Every message links to jellyhook.com/demo and the sign-up; a call or install help is offered only if the person asks. Do not put a call as the main ask or the success metric. Success = sign-ups and sites verified. Calls are optional learning.
Jellyhook's own tracker on jellyhook.com now loads only on public pages (MarketingPage), not inside /platform.

## Update 2026-10-09: who it is for, refined by the founder (SEO is a weak fit)
SEO roles optimise for rankings and traffic (before the click). Jellyhook is about what happens after the click. Better description of the buyer:
- **Primary: people whose job is to convert visitors into leads.** Titles: CRO (Conversion Rate Optimization) Specialist / Manager, Conversion Optimizer, Growth Marketing Manager, Digital Marketing Manager, Demand Generation Manager, Marketing Manager at a lead-gen site, Head of Growth. They study how converters behave and change page copy, layout or forms (psychology-driven), or tell the web team what to change.
- **Second: sales people who follow up on inbound leads.** SDR (inbound qualification), Inside Sales / Account Executive, and the marketing-automation or lead-nurturing owner who writes the follow-up. Use: read the lead's visit before the call, narrow the pitch if the visit shows a clear interest, go general if it does not.
- **SEO** stays a minor angle: only "which content do my leads read before they contact us".
- Honest gaps for these groups: no A/B testing, no converters-vs-non-converters comparison screen, no CRM link, no export/report for clients.
- Never claim Jellyhook reveals intent or psychology. It shows behaviour; the person draws the inference.
