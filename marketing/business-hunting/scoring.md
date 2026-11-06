# Business hunting: which websites need a lead's footprint

Started 2026-11-05. Founder's rubric, with field scores from a sample of real sites and the research behind them.
Use it two ways: (1) pick fields to hunt in, (2) score one business when the founder sends its website.
The rubric is the founder's and is expected to change. Edit the numbers here, not in chat.

## 1. The rubric (max 35)

Partial points are allowed: give +1 or +2 when a business does part of a criterion. C8 and C9 were added on
2026-11-05 (second version); scores in section 3 were made before that and are out of 25.

| # | Criterion | Points | What to look at on the site |
|---|---|---|---|
| C1 | Web lead gen heavy: the website is a main source of leads | +3 | Paid ads (UTMs on links, gclid), "Free consultation" / "Get a quote" in the header, a form on most pages, location pages. Lower it if leads mostly come from referrals or marketplaces (The Knot, Houzz, franchise portals, A Place for Mom). |
| C2 | Several services, each with its own page, or one or a few offers sold through a long, persuasive page with many sections | +3 | Count the service pages in the menu. A one-page site with a form scores 0. |
| C3 | Contacting sales is how a customer gets the service; the form is only a step | +4 | No prices, no "Add to cart", no "Book now" calendar. The next step is a consultation, quote, tour, or call. |
| C4 | A form fill is not a sure sale: tire kickers, wrong budgets, people comparing several providers | +4 | Big-ticket, comparison-shopped, free consultation or free quote. Published lead-to-sale rates when known. |
| C5 | Closing depends on the salesperson's skill and persuasion | +3 | Consultative sale, custom quote, design meeting, tour. Not price-only. |
| C6 | Even when the lead was referred, they still have to go to the site, read about the service and send the form there | +3 | Portfolio, case studies, "process" page, the form is the only door (no public email or booking link). |
| C7 | It is critical for sales to know what the person read before writing | +5 | Several distinct offers; long pages where the section a person stopped on means something (pricing tiers, packages, spaces, programs). Do not score the form here: that is C8. |
| C8 | The form does not ask "what are you here for" | +5 | No open message box and no "which service" picker = 5. Picker only = 2. Open box = 0. Founder's reason: if the lead writes what they want, much of the visit's value is gone. See the note under this table: 33 of 34 readable lead forms had an open box, so as written this almost always scores 0. |
| C9 | Depth: the site explains the service and the things that make people hesitate | +5 | Even when the message says "I want X", the person may still decline over cost, terms, risk, timing, process. The more article-like pages on those (how it works, fees, contract, what happens if, comparisons, FAQ) the better. One service with many deep pages counts as much as many services. Read two pages by hand: long text written for Google (city names, "as experienced contractors in NC, we...") is filler and scores 1 to 2. |

**Note on C8 (data, 2026-11-05):** in waves 1 and 2 plus PPB, 35 sites had a form the scanner could read. 33 had an
open message box. Of the other 2, one was a product search box (not a lead form) and one (acutrans.com) had service
checkboxes instead. So nearly every lead form already asks "what are you here for". Proposed grading, waiting for
the founder's decision: 5 = no box; 3 = an optional box with a generic label ("Message"); 1 = a box that prompts for
specifics ("tell us your budget, timeline, project"); 0 = a full intake questionnaire. This grades how much the form
already covers instead of whether a box exists.

### Flags (suggestions, not part of the founder's score yet)

Write these next to the score. They can stop a deal even when the score is high.

- **Health or other regulated data.** Rehab, plastic surgery, dental implants, mental health. The visitors are patients; Jellyhook signs no BAA. Treat as no-go for now (see Passages Malibu, 2026-10-30).
- **Phone first.** CallRail or another call-tracking tool on the site means many leads call instead of using the form. Jellyhook sees the visit but not the phone call. Ask what share of leads come by form.
- **Self-serve.** Prices, checkout, or a booking calendar on the site. The sales step is optional, so C3 drops.
- **Already on HubSpot.** Not a minus. They already get a page list on each contact; pitch the depth (time, scroll, sections, form fields) and the HubSpot card.
- **Marketplace leads.** If most leads arrive through a directory's own form, they never touch the business's site.

## 2. How to score one business (when the founder sends a URL)

1. Run `python -I marketing/business-hunting/scan.py out.json example.com`. It reports forms (open box, service
   picker), form tools, self-serve signs, prices, service-like pages, sitemap size, words / subheadings / long
   paragraphs / question headings / decision words on up to 6 service pages, and suggested C8 and C9. A form that loads
   with JavaScript is missed ("?"), so open the contact page and check it by hand.
2. Open the site: menu (count services), the contact form (which fields, does it ask which service?), the footer
   (public email, phone), and read two service pages to judge C9 (real decision content or SEO filler).
3. Score C1 to C9 with one line of evidence each. Add the flags.
4. Append the result to section 5 of this file.

## 3. Field scores

Scores are judgment from the sample in section 4 and the sources in section 6. Each field was sampled with 3 to 5 sites,
which shows what the sites look like, not how a whole industry behaves.

**Out of date (first version, max 25):** these were picked by me, not drawn at random, and scored before C8 and C9.
The random hunt (sections 8 and 9) already contradicts one of them: retirement and senior living sites failed the
depth check in wave 2 (0 of 4) and almost never mention cost or terms. Rescore a field here only after it passes the
hunt.

| Field (what the website looks like) | C1 | C2 | C3 | C4 | C5 | C6 | C7 | Total | Flags |
|---|---|---|---|---|---|---|---|---|---|
| **Custom luxury travel designer.** Destination and trip-style pages, sample itineraries, "Start planning" form, no checkout. | 3 | 3 | 4 | 4 | 3 | 3 | 4 | **24** | Avoid big operators with fixed prices online (Abercrombie & Kent shows prices). |
| **Franchisor recruiting franchisees.** "Own a franchise" site with investment, territory, support, FAQ sections and a "Request information" form. | 2 | 3 | 4 | 4 | 3 | 3 | 4 | **23** | Many leads come from franchise portals, not the site. Published: about 2% of all leads become a sale. |
| **Design-build remodeler.** Kitchen, bath, addition, whole-home pages, portfolio, "Schedule a consultation" form. | 2 | 3 | 4 | 4 | 3 | 3 | 4 | **23** | Referral-heavy. Some forms ask project type, which lowers C7. |
| **Custom software or app agency.** Service pages (web, mobile, AI, staff augmentation), industry and case study pages, "Tell us about your project" form. | 2 | 3 | 4 | 4 | 3 | 3 | 4 | **23** | Many leads via Clutch and referrals. Many tiny-budget leads. |
| **Senior living community.** Independent living, assisted living, memory care pages, floor plans, "Schedule a tour" form. | 3 | 3 | 4 | 3 | 3 | 3 | 4 | **23** | Phone first (CallRail on Aegis). Care needs are sensitive; check before pitching. Referral agencies send many leads. |
| **Residential AV and smart home integrator.** Theater, whole-home audio, lighting, shades, security pages, "Free design consultation" form. | 2 | 3 | 4 | 3 | 3 | 3 | 4 | **22** | Some sell gear online (checkout found on 2 of 3). |
| **Wedding and event venue.** Several spaces, packages, galleries, "Inquire" form with date and guest count. | 2 | 2 | 4 | 4 | 3 | 3 | 3 | **21** | The Knot and WeddingWire send their own leads. Tools like Tripleseat or HoneyBook already collect date and guests. |
| **Trade show exhibit builder.** Custom, rental, modular, sizes, portfolio, "Get a quote" form. | 3 | 3 | 4 | 3 | 3 | 2 | 4 | **22** | Rental vs purchase pages point to very different deals: strong C7. |
| **Custom pool builder.** Pool types, outdoor living, gallery, "Free consultation" form. | 3 | 2 | 4 | 4 | 3 | 2 | 3 | **21** | |
| **Corporate event production.** Conferences, galas, hybrid, experiential pages, "Start a project" form. | 2 | 3 | 4 | 3 | 3 | 3 | 3 | **21** | Some offer a Calendly link that skips the form. |
| **Commercial AV integrator.** Conference rooms, video walls, unified communications, managed services, industries, "Contact us" form. | 2 | 3 | 4 | 3 | 3 | 2 | 3 | **20** | Many deals come via RFPs and general contractors. Big ones (AVI-SPL, Pavion) run HubSpot. |
| **Fund or advisory platform** (like PPB). Four solution pages, "Connect with us" form with inquiry type. | 1 | 3 | 4 | 2 | 3 | 3 | 4 | **20** | Relationship-driven. Regulated; expect DPA questions. |
| **Personal injury law firm.** Practice area and location pages, "Free case evaluation" form, chat. | 3 | 3 | 4 | 4 | 2 | 2 | 2 | **20** | Phone first (CallRail on 3 of 4). What matters is the facts of the case, not what they read. Attorney advertising rules. |
| **Private K-12 school.** Divisions, programs, tuition, "Inquire" / "Request information" form. | 2 | 3 | 3 | 3 | 2 | 3 | 3 | **19** | Admissions staff, not salespeople. Visitors are parents of minors. |
| **Residential solar installer.** One main product, savings calculator, "Free quote" form. | 3 | 1 | 4 | 4 | 3 | 2 | 2 | **19** | Qualification is roof, bill and credit, not what they read. Heavy lead buying. |
| **Commercial cleaning.** Office, medical, industrial cleaning pages, "Get a quote" form. | 3 | 2 | 4 | 3 | 2 | 1 | 1 | **16** | Price-driven. Most quotes need square footage, not context. |
| **Addiction treatment center.** Detox, residential, outpatient, sober living pages, "How can we help you?" form. | 3 | 3 | 4 | 4 | 3 | 3 | 5 | (25) | **No-go: health data.** Shown for comparison only. |

**Reading the table:** the top fields share a pattern: several distinct offers, a consultation step, comparison shopping,
and a form that does not ask which offer the person cares about. The bottom fields are either price-driven (cleaning,
solar) or the important facts are not on the website (injury law).

## 4. Sample: what was found on real sites (scan of 2026-11-05)

58 sites, 53 readable. A form was detected on 44 of the 53. Real count is higher: Passages Malibu and Amplified
Renovations have forms (the founder pasted them) but they load with JavaScript, so the scan missed them.
HubSpot was found on 9 sites, CallRail on 8, a self-serve sign (checkout, Calendly, booking) on 11.

No published source gives "percent of businesses in field X with a contact form". The honest statement is: in this
sample, nearly every site in every field had one. The form is not what separates fields; C3, C4 and C7 are.

| Field | Sites (form seen / not seen / unreadable) |
|---|---|
| Design-build remodeler | lamontbros.com, mosaikdesign.com form; neilkelly.com, amplifiedrenovations.com not seen; squaredealremodeling.com unreadable |
| Custom pool builder | anthonysylvan.com, alliedoutdoorsolutions.com, selahpools.com form; poolsxdesign.com not seen |
| Residential AV / smart home | dreamediaav.com, aimhomeautomation.com form; electronicintegration.com unreadable; pureavcorp.com failed |
| Wedding / event venue | theestateyountville.com, charleskrug.com, pineridgevineyards.com form |
| Senior living | aegisliving.com, bayviewseattle.org, leisurecare.com form |
| Private K-12 school | brimmer.org, dextersouthfield.org, isbos.org, milton.edu form |
| Personal injury law | forthepeople.com, avrek.com, theadvocates.com, zaneslaw.com form |
| Custom luxury travel | foresttravel.com, tcsworldtravel.com form; abercrombiekent.com not seen; theafricaspecialists.com unreadable |
| Residential solar | solarmaxtech.com, solaroptimum.com form; gogreensolar.com not seen (sells online) |
| Franchisor | sendmeapro.com, homesmiles.com, terraceup.com form (consumer sites; franchise pages not scanned) |
| Commercial AV integrator | avispl.com, fordav.com, avdg.com, pavion.com form |
| Custom software agency | brainvire.com, weblineindia.com, 8thlight.com form; cygnismedia.com, thoughtbot.com not seen |
| Commercial cleaning | vanguardcleaning.com, janiking.com, jan-pro.com form; morfincleaning.com not seen |
| Trade show exhibit builder | absoluteexhibits.com, exponents.com form; pureexhibits.com unreadable |
| Corporate event production | raybloch.com, voloevents.com, eventsolutions.com form |
| Fund / advisory platform | ppbcapitalpartners.com form |

## 5. Scored businesses

Add one row per business the founder sends. Keep the evidence short.

| Date | Business | Field | C1-C9 | Total /35 | Flags | Evidence | Next step |
|---|---|---|---|---|---|---|---|
| 2026-11-05 | ppbcapitalpartners.com | Fund platform | 1,3,4,2,3,3,4,0,2 | 22 | Regulated | 4 solution pages, form with Inquiry Type + Message (C8 0), service pages about 600 words (C9 from scanner, not read by hand), HubSpot on site | Email drafted: `marketing/outreach/ppb-email.txt` |

## 6. Evidence and how much to trust it

**Sales side (people who answer leads)**
- HubSpot idea "Track time spent on webpage per contact": 8 people, 2020 to 2024, mostly for lead scoring. Read in full. https://community.hubspot.com/t5/HubSpot-Ideas/Track-time-spent-on-webpage-per-contact/idi-p/356675
- HubSpot idea "time a person spent on my landing page": about 6 people, 2017 to 2021; HubSpot measures time on page only when a next page loads. Read in full. https://community.hubspot.com/t5/HubSpot-Ideas/Ability-to-see-time-a-person-spent-on-my-landing-page-website/idi-p/10619
- Marketo Sales Insight is "the most misunderstood and underutilized tool" (consultancy opinion): raw page lists on a lead record often go unused. https://demandspring.com/blog/marketo-sales-insight-most-misunderstood-and-underutilized-tool-in-marketo-universe/
- A RevOps consultancy's Slack brief before each demo has name, company, enrichment, routing rule and form answers, no website activity. https://moonira.com/insights/chili-piper-automation-plays-revops
- Chili Piper: 14.1% of about 4 million B2B form submissions disqualified (spam, personal email, failing criteria). Vendor data, via a secondary source.

**Buyer side (people who send the form)**
- CSO Insights 2018: 23% of B2B buyers see sellers as a top resource; more than 70% wait to engage until the seller shows understanding of their needs. Old, secondary.
- Adience 2025 (350 B2B buyers): 30% say vendors waste their time with poor or repetitive questions and irrelevant content; vendors most often misread priorities (35%). Secondary.
- Salesforce State of Sales 2024: 59% of buyers say reps do not take the time to understand their business. https://www.salesforce.com/ca/news/stories/sales-ai-statistics-2024/
- Senior living mystery shops (George Mason students, since 2004): staff "overwhelmingly fail to ask the right questions"; Bild & Co.: 22% of inquiries become tours. Industry-sponsored.
- Franchise recruiting mystery shops: 39.8% of qualified form submissions got no personal response. Undated. https://www.franchising.com/articles/mystery_shopping_blues_annual_report_card_reveals_much_room_for_improvement.html
- Franchise development (AFDR): about 2% of all leads and 11 to 15% of qualified leads become a sale. https://www.franchising.com/amp/articles/2020_afdr_sales_closing_ratios_improved.html

**What this evidence does not show:** that seeing what a lead read changes the outcome of a sale. Several buyer-side
studies are about slow or missing follow-up, which a Slack alert helps with, but which is a different problem from
context. That still has to be tested in conversations (see `marketing/strategy.md`).

## 7. Visitor-identification tools (why B2B software buyers expect identification)

| Tool | Identifies | How | Note |
|---|---|---|---|
| RB2B | Person (US only) and company | Identity matching, not just IP; LinkedIn profile on Starter, business email on Pro | Free plan is company-level only |
| Warmly | Person and company | Deterministic and probabilistic matching | Vendor says about 15% of individuals, 65% of companies |
| Leadfeeder (Dealfront) | Company | IP to company | No contact details |
| HubSpot Buyer Intent | Company | IP to company | Shows visits and top pages per company |
| Salespanel | Company | IP to company, plus scoring | Reviewers: not for B2C |

These are built for visitors who did not send a form. Jellyhook is about people who did. A field where buyers expect
identification (B2B software selling to companies) will compare Jellyhook to these; service businesses answering their
own form leads mostly will not.

## 8. The hunt: random waves (founder's method, 2026-11-05)

Goal: find business types whose websites have a form and deep pages about the service and its concerns (C9), without
deciding the answer in advance. Start blind, drop what is far off, move closer to what fits, check again.

**Where the random businesses come from.** Google's business profile categories (4,044 names, scraped list:
https://daltonluka.com/blog/google-my-business-categories). Draw with Python `random.seed(<date>)` so a wave can be
repeated. Taken out before drawing: places of worship, government and public places, cuisine-specific restaurants
(hundreds of them), leaving 3,389. Public bodies the filter missed and health providers (no-go) are replaced by the next
draw and the swap is logged.

**Finding the sites.** One web search per category with a different US city each time, directories blocked (Yelp,
Angi, Thumbtack, BBB, Houzz, HomeAdvisor, A Place for Mom and similar). Pick 3 to 4 business sites, not chains' store
locators where an independent exists. Bias to know: search results favour sites that work hard on Google, so they
have more text than an average site in the same field. That is why C9 needs a hand read.

**When a site fits.** It has a form (seen by the scanner or by hand), C9 is 3 or more after reading two pages, and
the service is obtained through sales (no checkout, booking calendar or instant price as the main path).

**Rules per business type.**
1. Wave: 3 to 4 sites per type.
2. 2 or more fit: candidate. Save the fitting sites. Next wave: 3 to 4 fresh sites of that type from another city.
   - The fresh ones also mostly fit (2 or more): **validated**. Score the whole rubric (C1 to C9) for the field.
   - The fresh ones mostly fail: the field is not validated. Keep the fitting businesses as single prospects (outliers).
3. Exactly 1 fits: one retest wave with fresh sites. If they fail, keep that business, drop the field.
4. None fit: drop the field.
5. Each new wave: fresh random categories (dropped fields excluded) plus the retests and confirmations above.

## 9. Wave log

### Wave 1 (2026-11-05, seed 20261105, 15 categories, 50 sites)

Drawn and replaced: water works, civil defense, visa and passport office (public), radiotherapist (health) were
replaced by tool rental, tobacco shop, translation service, vocal instructor (MRI center skipped as health).

| Type | Sites | Fit | Verdict |
|---|---|---|---|
| Property management company | trlawing.com, hendersonproperties.com, qcmscharlotte.com, rpmcm.com | 4 of 4 | Candidate |
| Retirement home | newcassel.org, rlcommunities.com, heritage-communities.com, immanuel.com | 2 of 4 | Candidate |
| Floor sanding and polishing | christiesfloors.com, dbfloorsandingofmn.com, wedgewoodfloors.com, grainfloors.com | 2 of 4 | Candidate |
| Translation service | elitetranslingo.com, thetranslationcompany.com, polilingua.com (translators-usa.com unreadable) | 3 of 3 | Candidate |
| Concrete contractor | zonacrete.com, tucsonconcreters.com (arc... unreadable) | 1 of 2 | Retest |
| Bricklayer / masonry | phillipsmasonrywork.com, buccigrossi-masonry.com, jagimiglianomasonry.com, escajedamasonry.com | 1 of 4 | Retest |
| Cell phone store | eaststarwireless.com, cricketwireless.com (cellularsales.com unreadable) | 0 | Dropped: retail, self-serve |
| Ski school | shredderski.com, utahskilessons.com, brightonresort.com | 0 | Dropped: booked online |
| Japanese language instructor | naokoteaches.com, languagetrainers.com, japademy.com | 0 | Dropped: thin pages or bought online |
| Computer wholesaler | basscomputers.com, computerslv.com, orangehardwares.com | 0 | Dropped: catalogue and cart |
| Kite shop | drgravitys.com, kitesandfunthings.com, thekiteshoppe.com | 0 | Dropped: retail |
| Secondary school (private) | gracechristian.net, brightmontacademy.com (wakechristianacademy.com unreadable) | 0 of 2 | Dropped (small sample) |
| Tool rental service | gburentals.com, sunbeltrentals.com, hercrentals.com | 0 | Dropped: self-serve |
| Tobacco shop | cigarrealm.com, griffincigar.com, windycitycigars.com | 0 | Dropped: retail |
| Vocal instructor | thevocalacademy.co, thesongspotmusic.com, amberlightartists.com, loveyourvoice.coach | 0 | Dropped: thin pages, booked online |

### Wave 2 (2026-11-05, fresh sites for the 6 open types, new cities)

| Type | Fresh sites | Fit | Verdict |
|---|---|---|---|
| Property management company (Kansas City) | alpinekansascity.com, tm3propertymanagement.com, cjproperties.org, premiereproperty.com | 3 of 4 | **Validated** (7 of 8 over both waves) |
| Retirement home (Sacramento) | regencyplaceseniorliving.com, rosearborvillage.com, mercymcmahonterrace.org, pegasusseniorliving.com | 0 of 4 | Not validated. Keep heritage-communities.com and immanuel.com as single prospects. These sites almost never mention cost or terms (decision words near 0 per 1,000). |
| Floor sanding (Atlanta) | oakerds.com, triarthardwoods.com, orangecatflooring.com, trendingfloors.com | 3 of 4 by scanner | Depth passes, but the hand read (orangecatflooring.com) is generic "why refinish" copy, and jobs are small ($3 to $8 per square foot is the figure the sites quote). Low priority: rubric about 16 of 35. |
| Translation service (Chicago) | altalang.com, acutrans.com, calinterpreting.com, gmdlinguistics.com | 1 of 4 | Not validated (4 of 7 over both waves). Splits in two: multi-service agencies with deep pages (polilingua, altalang, thetranslationcompany) and certified-document shops with instant quotes. Keep the 4 agencies as single prospects. |
| Concrete contractor (Raleigh) | rgpackconcrete.com, legendaryconcreteraleigh.com, triangleconcrete.com, concretecontractorraleigh.com | 4 of 4 by scanner, 0 by hand | Dropped. Hand read: template text written for Google ("As experienced concrete contractors in NC, we..."); some look like lead-generation sites, not the contractor. |
| Bricklayer / masonry (Indianapolis) | galvanmasonry.com, smallingmasonry.com, emersonmasonry.com, hoosiermasonrysolutions.com | 3 of 4 by scanner | Dropped on hand read: credentials and service areas, few decision words, "Book Online Now". Keep emersonmasonry.com only if a later read shows real content. |

**Property management: why it fits (first look, to be scored in full).** The owner's form says "I want my rental
managed", but the pages show what they weigh: fee tiers, leasing-only versus full service, evictions, maintenance,
accounting, owner portals, buying help for out-of-state investors. Alpine (alpinekansascity.com) has 27 question
headings on its service pages. Provisional field score: C1 3, C2 3, C3 4, C4 3, C5 3, C6 2, C7 4, C8 0, C9 5 =
**27 of 35**. Flag: the same form also gets tenants, applicants and vendors, so many submissions are not owner leads.
Flag: rental-analysis and fee calculators let owners self-price, which lowers C3 a little.

### Next wave (not run yet)
- 15 fresh random categories from the same pool, dropped types excluded.
- Property management: score 5 of the 8 sites in full (section 5) and read their forms by hand.
- Moving closer (step 2 of the method): types that look like property management, where an owner hands over
  something ongoing and worries about fees, terms and risk. To test, not assumed: HOA / community association
  management, commercial property management, vacation rental management, bookkeeping firms, managed IT for small
  businesses.
