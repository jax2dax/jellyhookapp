# Phase 3: persona simulation results (page v1)

Date: 2026-10-09. 14 independent persona agents. Each saw only `page-v1-text.md` and its own card (`personas.md`), never the
strategy. Full answers: `persona-results/P01.md` ... `P14.md`.

**Honesty about the maths.** These are qualitative judgments produced by language-model role-play, not measurements. They show
where the page is likely to lose people and why. They do not predict a conversion rate. With 14 simulated readers, any percentage
would be false precision, so results are reported as counts.

## Outcomes

| ID | Persona | Outcome | Hook line (if any) | Main reason they stopped |
|---|---|---|---|---|
| P01 | Inbound SDR | skim and leave | "Before you reply, read what they read." | Can't install it herself; no CRM sync means another tab |
| P02 | Inside sales rep | skim and leave | (near) "Before you reply, read what they read." | Chart unreadable in 15 s; no junk signal; no CRM |
| P03 | Marketing automation | skim and leave | Hero headline | Reads leads one by one; no Marketo/Salesforce push; iframe doubt |
| P04 | In-house CRO manager | skim and leave | The field-timing bars (visual) | Only one sample lead, no aggregate drop-off; HubSpot iframe doubt; no speed figure; no GTM |
| P05 | CRO, lead-gen company | skim and leave | "Which form field do people give up on most?" | Looks like a sales tool; nothing on multi-step forms, many sites, export, price |
| P06 | Freelance CRO consultant | **interested** | "See where your form slows people down, and the route converters took." | Multi-site? data-collected list? export? |
| P07 | Digital marketing (WP + Salesforce) | skim and leave | "Read one lead... Read them all before you change a page." | No CRM/export; UTM/channel unclear; no GDPR facts for IT |
| P08 | Digital marketing (Webflow) | skim and leave | "See where your form slows people down..." | Webflow not named; no before/after of a page change |
| P09 | Demand gen lead | skim and leave | "Set it up once. Everyone sees the same lead." | No CRM path for sales |
| P10 | Head of growth, small co | skim and leave | "Set it up once. Everyone sees the same lead." | No price after free; no HubSpot; data location/DPA |
| P11 | Sceptic | skim and leave | "What Jellyhook does not do." | No speed figure; no data location/retention/processor facts |
| P12 | Heavy heatmap user | skim and leave | "Time on every form field. Forms people started and never sent." | No stated difference from current stack; no segmentation/export |
| P13 | Freelance web builder | skim and leave | Form plugin list | No multi-site/client access; chart too technical for clients; WordPress/Webflow setup not named |
| P14 | Wrong fit (Shopify) | ignore | none | Correctly filtered out in 10 to 15 s |

Counts: install today 0 · would sign up 0 · interested 1 · skim and leave 12 · ignore 1 (the intended wrong fit).

Range statement, with reasons: for right-fit visitors arriving cold, v1 is likely to produce mostly "skim and leave". The pain match
is strong (11 of 13 right-fit personas found their line), but the same scroll also delivers the reasons to stop. Published benchmarks
are not used here, because none apply to a no-proof, pre-launch page with this audience mix.

## What worked (keep)

1. **The headline matches the search intent.** 11 of 13 right-fit personas quoted it or recognised their pain immediately.
2. **Role labels in "Two ways to use it".** "Inbound sales, SDRs" and "CRO" being named made readers feel addressed (P01, P04).
3. **"Set it up once. Everyone sees the same lead."** Hooked the managers (P09, P10).
4. **The field-timing bars.** The strongest single visual for every CRO persona (P04, P05, P06, P12).
5. **The honesty section.** Built trust for the sceptic and the consultant (P06, P11). Not "AI-powered" was noticed as a relief.
6. **The wrong-fit filter** worked (P14).

## What failed (fix), ordered by how many personas it stopped

| # | Problem | Personas | Fix type |
|---|---|---|---|
| 1 | **"No CRM sync / export"** is the most common stop. It appears twice (Not for you + Plainly) and lands early. | P01 P02 P03 P07 P09 P10 P11 P12 P13 | Copy: say it once, lower, and give the honest workaround. **Product: the biggest gap** (see below) |
| 2 | **"We have not published a speed measurement yet."** Honest, but it reads as a red flag. | P04 P06 P07 P08 P10 P11 P12 P13 | **Measured now**: the live script is about 31 KB compressed (Brotli 31,381 bytes; gzip 30,535; 109,997 raw; fetched 2026-10-09). Publish the size. Load time still unmeasured. Product: add `defer` to the HTML snippet |
| 3 | **CRO people read it as a sales tool.** Everything shown is one lead; the "all leads" view is one sentence and an "example" panel. | P04 P05 P06 P12 | Copy and visual: show the across-all-leads view as the CRO row's visual; say field timing covers people who never sent the form |
| 4 | **The chart is too dense for a 5 to 15 s read.** | P02 P03 P09 P10 P13 | Put a one-line plain-text summary of the visit above the chart |
| 5 | **No data facts for IT/DPO**: where data is stored, retention, cookies, processors, DPA. | P07 P10 P11 P06 | Founder must supply facts (storage region, retention, DPA). Verified now: `tracker.js` sets no cookies (it uses local storage; no `document.cookie` in the file) |
| 6 | **Platforms not named**: Webflow, WordPress install, Google Tag Manager. | P04 P08 P13 | Test first, then name. Until tested: say "any site where you can add a script to the head" |
| 7 | **Agencies and consultants need several sites.** | P05 P06 P13 | **Product/pricing conflict**: `createSite` limits non-Elite accounts to 1 site (`lib/actions/site-management.actions.js` line 172) while the page says "every feature" is free. Decide, then say it |
| 8 | **No price after early access.** | P05 P08 P10 P11 P13 | Founder decision (a range or "no plans to charge before X") |
| 9 | **The "no recording" line reads as "less data"** to the heavy replay user. | P12 | Copy: frame what it shows instead, not only what it does not |

## Product changes the simulation points to (for the founder; outside the page)

1. **Get the visit to where sales and nurture work.** Most stops came from "another tab". Smallest honest step: a copyable plain-text
   visit summary plus a link on each lead page, or an email when a lead arrives with that summary. Later: HubSpot/Salesforce field push.
2. **Aggregate form-field drop-off as a screen**, not only through Hook. That is what CRO buyers expect to see first.
3. **Add `defer` to the HTML snippet, measure load impact, publish it.**
4. **Resolve the 1-site limit** for early access, or say it.
5. **A one-page data sheet** (storage region, retention, cookies, processors, DPA availability).
6. **Test and document Webflow, WordPress and GTM installs.**
