# Agent A: marketing research for the Jellyhook landing page

Date: 2026-10-09. Author: Agent A (marketing researcher). Inputs: `marketing/landing/synthesis.md`, `marketing/claims-ledger.md`,
`marketing/banned-claims.md`, `marketing/strategy.md`, a few code checks (noted where used), and web research (sources inline).

## How to read this file

**Evidence key**
- **Strong**: controlled experiments, meta-analyses, or very large behavioural datasets.
- **Moderate**: the same thing reported many times by experienced practitioners, or surveys with a stated method.
- **Anecdotal**: a single test, one practitioner's view, or what other companies' pages do (observed practice, not proof).
- **[vendor]**: published by a company that sells the related product or service. Treat its figures as directional.
- **[snippet only]**: seen in search-result summaries; the page itself could not be fetched. Not verified word for word.

**Fetches that failed** (so the related points are marked down): marketingexamples.com (HTTP 500); reddit.com (blocked for
this tool); G2, Capterra, Software Advice, TrustRadius review pages (403); HubSpot Community idea threads (403); gartner.com
and two news mirrors of the Gartner release (403); cxl.com articles (403); HBR full text (paywall; numbers taken from the
ResearchGate and search summaries of the same article); kunocreative.com (404).

**Rules kept:** no invented sources, quotes or numbers. Every headline below is new wording written for Jellyhook, not
copied from any page. Every promised outcome traces to synthesis.md section 3 / the claims ledger. Nothing from
banned-claims.md is used ("AI", "recordings", "identify", "compliant", "more leads", competitor names in public copy, etc.).

---

## 0. Top findings

1. **A visitor gives the page about 10 seconds to say what it is and who it is for.** The value has to be legible in the
   hero, in plain words (NN/g on a 2-billion-visit dataset; Unbounce's large but vendor dataset links simple reading level
   to higher conversion). Feature lists push the "what is it" answer further down.
2. **With no customers, the strongest honest proof is the product itself plus candour.** B2B buyers want to see the tool
   before talking to anyone, and a message that also says what the product does *not* do is more believable (two-sided
   messaging meta-analysis). Jellyhook's `/demo` sample lead page and a "who it is not for" block do this.
3. **Write the hero for the buyer, say one thing everyone shares, and use role-labelled sections instead of tabs.**
   Practitioners agree that you choose one primary reader. Content hidden behind tabs is often missed (NN/g). Choice overload
   is real only in some conditions, and they apply here: a new category, so visitors do not yet know what they prefer.
4. **Fear of installing is the main wall, and successful script tools answer it on the landing page itself.** They state
   the time it takes, the platforms it works on, a way to hand the job to a developer, speed and privacy, and when data
   appears. Jellyhook can truthfully say about half of this today. Install time and page-speed claims need measuring first:
   the plain-HTML snippet has no `defer`/`async`, and the tracker is about 110 KB raw, about 30 KB gzipped.
5. **Name sales' real constraint: speed.** Inbound reps are measured on how fast they respond (HBR audit of 2,241
   companies), and buyers avoid irrelevant outreach (Gartner, snippet only). Promise "know what they read before you
   reply" as a quick read on one page, not as analysis work.

**Recommended unifying promise (hero):** *"Every lead arrives with the visit behind it."*
Subhead direction: "Read one before you follow up. Read them together to see what your converters read and where your form makes them hesitate."
(The existing "See what every lead did before they contacted you" is also compliant; it is the fallback.)

**Recommended multi-audience approach:** one page. The hero is written for the CRO/marketing buyer in neutral words. Below
it comes a "same data, two scales" section with three role-labelled rows, all visible, no tabs (follow up / fix the page and
form / run the team). Then a dedicated install section, a "who it is not for" block, and one primary CTA. Role-specific
pages come later, starting with `/for/cro`, once there is one real example to show.

---

## 1. Tactics table

| # | Tactic | What it is | Why it works | Source | Evidence | How it applies to Jellyhook |
|---|---|---|---|---|---|---|
| 1 | Value in 10 seconds | Hero states what it is, for whom, and the result, legible without scrolling | Page-leave probability is highest in the first 10 s; pages that pass that test keep people for minutes | https://www.nngroup.com/articles/how-long-do-users-stay-on-web-pages/ (Microsoft Research data: 205,873 pages, >2 billion dwell times) | Strong | Hero = promise + one product visual + CTA. Remove decorative noise (synthesis §4 item 7) |
| 2 | Plain reading level | Short words, short sentences, about 5th–7th grade | Large dataset correlates simpler copy with higher conversion; SaaS pages at 5th–7th grade: 12.9% vs 2.1% at professional level | https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/ (57M conversions) | Moderate [vendor], correlational | Write "which parts of the page they reached", not "scroll depth telemetry" |
| 3 | Moderate length | SaaS pages with 250–725 words converted best in the dataset | Enough to explain an unfamiliar product without burying the CTA | Same Unbounce page | Moderate [vendor], correlational | A target of about 500–700 words of body copy; details go to /docs |
| 4 | Simple, familiar layout | Low visual complexity, conventional ("prototypical") structure | First impressions of appeal form in 17–50 ms; simple and familiar layouts rate highest | Tuch et al., Google Research: https://research.google.com/pubs/archive/38315.pdf | Strong (lab experiments) [snippet only] | Keep the serif/lime identity, but use a conventional section order; drop marquee, rope animation, seasonal icon |
| 5 | Voice-of-customer wording | Lift the words buyers use in reviews, forums and interviews into the copy | People recognise their own problem in their own words faster than in vendor words | https://copyhackers.com/2014/10/amazon-review-mining/ ; https://cxl.com/blog/voice-of-customer/ [snippet only] | Moderate | Mine reviews of heatmap/form-analytics/CRM tools and sales threads (section 2 pains); re-run after first user calls |
| 6 | Match the awareness stage | Start from the conversation already in the reader's head (Schwartz's 5 levels); problem-aware readers need the problem named first | A catch-all home page written for pain-aware readers beat the control in a 3-way test (+46% and +49% paid lift, 99% confidence) | https://copyhackers.com/2016/06/great-home-page-copy/ ; https://copyhackers.com/2020/07/how-to-write-a-landing-page-examples/ | Anecdotal (one test) + long-standing practitioner model | Outreach visitors are problem-aware (leads arrive as a name and an email). Name that moment, then the answer |
| 7 | Message layers in order | Clarity ("what is it"), then relevance ("for me"), then value ("want it"), then differentiation ("why this") | Visitors drop out at the first layer that fails; differentiation is useless if clarity fails | https://wynter.com/post/b2b-message-layers-framework-wynter | Moderate [vendor: Wynter sells message testing] | Hero = clarity + relevance. Differentiation (page-shaped visit chart, field timing tied to the whole visit) comes after |
| 8 | One primary reader | Pick the main buyer; secondary readers get a path, not equal space | Pages that try to speak to everyone feel written for no one | Wynter checklist ("one primary audience is clear"), same URL; https://copyhackers.com/2013/02/writing-a-page-for-2-audiences/ | Moderate | Primary = CRO/marketing buyer; sales gets a clearly labelled row (section 3) |
| 9 | Concrete, checkable claims | Claims a reader can picture and could prove false; claims only this product could make | Concrete images are remembered; checkable claims read as honest; generic claims blend in | Harry Dry, Marketing Examples (original page fetch failed, HTTP 500); secondary: https://www.storyrules.com/lessons-from-copywriting-with-harry-dry/ [snippet only] | Moderate (widely taught practitioner rule) | "See which headings they reached" can be pictured and checked; "unlock insights" cannot |
| 10 | Show the real product | Real UI (screenshots or a live sample) early on the page | 82% of surveyed B2B buyers used interactive demos/sandboxes/trials; buyers want to see the tool themselves | https://wynter.com/post/how-b2b-saas-marketing-leaders-buy-2024 (n=100 marketing execs, companies 200+ staff) | Moderate [vendor], small sample | Replace the "illustration" hero with a real lead-page visual labelled "sample data"; link `/demo` |
| 11 | Low-commitment "see it" CTA | A secondary CTA to explore the product without signing up | Gives skeptical visitors a step that costs nothing; tour-style CTAs above the fold did best in vendor data | https://www.navattic.com/report/state-of-the-interactive-product-demo-2026 [snippet only] | Anecdotal/Moderate [vendor] | "See a sample lead page" -> `/demo` next to the main sign-up CTA |
| 12 | Say what it does not do | Two-sided messaging: state limits and who it is not for | Meta-analysis: two-sided messages strongly raise source credibility; too much negative content can hurt | Eisend (2006), IJRM: https://www.sciencedirect.com/science/article/abs/pii/S0167811606000267 [snippet only] | Strong (meta-analysis) | "Not for: checkout funnels, sites with no form, finding out who anonymous visitors are." Keep it short |
| 13 | Trust without social proof | Show the process, mirror the reader's beliefs, show the people behind it | Showing the process reduces fear of the unknown; a real face anchors accountability | https://businesscasualcopywriting.com/how-to-earn-trust-without-social-proof/ (Joel Klettke) | Moderate (experienced practitioner) | "What happens after you click" steps; a short founder note with name and face |
| 14 | Founder transparency and "even if" objections | Early-stage startups share their own results and state objections openly ("works even if...") | Specificity and openly handled doubts replace missing testimonials | https://stripe.com/guides/atlas/landing-page-copy (Joanna Wiebe) | Moderate | "Works with your existing form, even if it is HubSpot, Marketo or WordPress-plugin forms" (ledger row 11 limits apply) |
| 15 | Remove anxiety and distraction near the CTA | LIFT model: value proposition, relevance, clarity, urgency drive; anxiety and distraction inhibit | A heuristic used to generate test ideas; the agency reports average lifts from its own tests | https://pageblock.io/resources/framework/lift ; https://conversion-uplift.co.uk/glossary-of-conversion-marketing/lift-model/ [snippet only] | Moderate (framework); its lift figure: [vendor], unverified | Put "free, no card, one script, visitors stay anonymous until they submit" beside the CTA, not in the footer |
| 16 | Fewer choices when the reader is unsure | Reduce options when preferences are uncertain and choices are hard to compare | The jam study found 30% vs 3% purchase, but meta-analysis shows the average effect near zero (D≈0.02); overload appears when preferences are uncertain or the set is complex | Iyengar & Lepper (2000); Scheibehenne et al. (2010): https://scheibehenne.com/ScheibehenneGreifenederTodd2010.pdf ; Chernev et al. (2015): https://myscp.onlinelibrary.wiley.com/doi/10.1016/j.jcps.2014.08.002 [snippet only] | Strong (meta-analyses), conditional | New category, so visitors are uncertain: one primary CTA, one secondary; no role picker before value is shown |
| 17 | Risk reversal | Free, no card, cancel anything | Removing the card is widely reported to raise sign-up volume (conversion to paid is lower, irrelevant during free early access) | Aggregated benchmarks: https://www.shno.co/marketing-statistics/free-trial-conversion-statistics | Anecdotal: aggregator figures, primary sources not verified | Already true (ledger 16). State it once near each CTA. Do not imply permanent free |
| 18 | Specific CTA wording | Button says what the reader gets ("See a sample lead page"), not "Submit" | Michael Aagaard's first-person test (+90%) did not repeat on a payment page (-24.95%) or in Danish; wording effects depend on context | https://resources.review42.com/call-to-action-tips/ [snippet only] | Anecdotal | Use outcome-specific CTAs; do not rely on "my vs your" |
| 19 | Answer the speed question | Address "will it slow my site" directly, with a measured figure | Buyers (CRO especially) know speed matters: a Google/Deloitte study links 0.1 s faster mobile pages to more page views in lead-gen (+7%) | https://www.thinkwithgoogle.com/_qs/documents/9757/Milliseconds_Make_Millions_report_hQYAbZJ.pdf (37 brands, 30M sessions) | Moderate [vendor: Google-commissioned], correlational | Do NOT claim speed yet (unmeasured, ledger). Measure, add `defer`, then state size/loading behaviour (section 5) |
| 20 | Make the install path visible | State install time, platforms, a "send to developer" path, verification, when data appears | Successful script tools all put these on or one click from the landing page (see section 5) | usefathom.com, plausible.io, clarity.microsoft.com, zuko.io (fetched 2026-10-09) | Anecdotal (observed practice) | A dedicated "Setup" section with true steps (create site, paste script, label form, first visit is detected automatically) |
| 21 | Shorten time to value; say what happens next | Show the path from click to first value and remove steps | Users who do not reach value quickly leave before they see it | Wes Bush, ProductLed: https://productled.com/blog/user-adoption-framework-bowling-alley [snippet only] | Moderate (practitioner) | Be honest that value needs a real form submission. Offer `/demo` while waiting. Verify the "fill in your own form" shortcut (section 5) |
| 22 | Speak to the job's real constraint | Copy for a role reflects how that role is measured | Inbound reps are judged on response speed; firms contacting within an hour were about 7x more likely to qualify a lead than those an hour later (audit of 2,241 US companies) | Oldroyd, McElheran, Elkington, HBR 2011: https://hbr.org/2011/03/the-short-life-of-online-sales-leads ; https://www.researchgate.net/publication/298137032_The_short_life_of_online_sales_leads | Moderate-Strong (large field audit, older) | Sales copy says "a quick read before you reply", never "analyse the lead" |
| 23 | Avoid "another tool" fatigue | Present it as one page to open, not a new workflow | Sales reps report tool overload (66% overwhelmed, 7,700+ reps, 2022 survey) | https://www.salesforce.com/news/stories/sales-research-2023/ | Moderate [vendor] | "One page per lead" framing; honest "no CRM link yet" |

---

## 2. Segments

Note on sources for "pain in their own words": Reddit and the review sites were not fetchable from this tool, so phrasing
comes from what could be reached: practitioner articles, a published SDR's notes, job-description summaries, a HubSpot
Community idea title, and review snippets in search results. Each phrase below is cited and marked by how it was seen.
**Before publishing any of this phrasing as "what people say", the founder should validate it in the first outreach calls.**

### 2.1 Inbound sales follow-up (SDR / inside sales / AE)

**Pain, in their words (and where it was seen)**
- "Sales says the leads are garbage." Article on lead handoff: https://cyberedgegroup.com/blog/why-does-lead-quality-fall-apart-between-marketing-and-sales/ (fetched).
- Leads "that lacked interest or didn't align with the Ideal Customer Profile"; "Don't let any inbound leads fall through the cracks"; a "10 minutes response" target. From a senior BDR's notes on working inbound: https://ernestteh.substack.com/p/10-things-i-learned-from-doing-inbound (fetched).
- "Want to see page view path prior to form submissions." Title of a HubSpot Community idea: https://community.hubspot.com/t5/HubSpot-Ideas/Want-to-see-page-view-path-prior-to-form-submissions/idi-p/312823 (title seen in search results; body 403).
- Buyers "actively avoid suppliers who send irrelevant outreach" (73%, Gartner survey of 632 B2B buyers, Aug–Sep 2024): https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-sales-survey-finds-61-percent-of-b2b-buyers-prefer-a-rep-free-buying-experience [snippet only, 403].
- Inbound job posts centre on speed-to-lead (often "under 5 minutes") and qualifying fit: https://yardstick.team/job-description/inbound-sales-development-representative-sdr [snippet only].

**Outcome to promise (true per synthesis §3):** Before you reply, see what this lead read on your site, how long they
spent, how far down they got, which headings they reached, whether they came back before converting, and how they filled in
the form. Mark them Qualified or Junk. The rep makes the call; Jellyhook shows behaviour, not intent.

**Headline candidates**
1. Know what they read before you reply.
2. Every demo request, with the visit behind it.
3. Open the first call with their visit, not a guess.
4. A name, an email, and every page they read first.
5. Before you follow up, see where they spent their time.

**Top objections and honest answers**
| Objection | Honest answer |
|---|---|
| "I live in the CRM, not another tab." | True, it does not connect to your CRM today. It is one page per lead that you open before the first reply. It works next to your CRM and does not replace it (ledger 20). |
| "I reply in minutes; I have no time to analyse." | It is one page, not a report. Do not claim a reading time unless it has been measured. |
| "Most leads only read one page." | Then that is what you see, and it tells you to keep the first message general. Narrow the pitch only when the visit shows a clear interest (strategy.md). |
| "Is this creepy for the lead?" | Visitors are anonymous until they submit a form. There is no screen, mouse or keystroke recording. Browsers that send Global Privacy Control or Do Not Track are not tracked (ledger 17, 18, 22). |
| "Does it tell me who is a good lead?" | No. There is no score. You see what they did and mark Qualified or Junk yourself. |

**Proof available without fabrication:** `/demo` sample lead page (labelled sample data), a real screenshot of a lead page
with sample data, a plain list of what a lead page shows (category level), and the honest "it does not score or identify" line.

**CTA wording options:** "See a sample lead page" (no sign-up) · "Try it on your site, free" · "Set it up free, no card".

### 2.2 Follow-up automation / nurture owner

**Pain, in their words**
- Nurture programmes that default to "a one size fits all" newsletter, and to "send another email". Practitioner articles: https://clickz.com/nurture-marketing-improving-on-the-heart-of-marketing-automation/32416/ and https://www.madisonlogic.com/blog/lead-nurturing-automation/ [snippet only].
- "Inconsistent, one-size-fits-all follow-up" cited as why MQLs do not convert. Same search set [snippet only, source page not individually verified].

**Outcome to promise:** See what each lead read, so you can choose by hand the follow-up track that fits. Look across leads
to decide which tracks should exist (Hook can filter leads by what they did, but its production status is UNVERIFIED, so
keep it secondary).

**Headline candidates**
1. Choose the follow-up from what they read, not just the form they sent.
2. Same form, different leads. See the difference before the first email.
3. Write follow-ups that match the visit.
4. Know which sequence a lead belongs in before you send it.
5. Two leads, one form, two very different visits.

**Top objections and honest answers**
| Objection | Honest answer |
|---|---|
| "Can it trigger my sequences or tag contacts?" | No. There is no integration with CRMs or automation tools, and no export. You read and decide by hand. |
| "I segment at scale, not one lead at a time." | The lead list and Hook filters help you find patterns. Automatic segmentation is not available. |
| "Will my form still work?" | Yes. It reads your existing form and does not replace it. Supported tools and limits are listed in docs (ledger 11). |

**Proof available:** the `/demo` sample, a side-by-side of two sample lead pages (clearly labelled sample data), and the
supported-forms list.

**CTA wording options:** "See two sample leads side by side" (only if built) · "See a sample lead page" · "Start free".

### 2.3 CRO specialist / manager (strongest fit, buyer and heaviest user)

**Pain, in their words**
- Reviewing recordings is "time-consuming" and people get "overwhelmed by 'useless' recordings, where users just idle on a page". Hotjar review cons on G2/Capterra: https://www.g2.com/products/hotjar-by-contentsquare/reviews?qs=pros-and-cons [snippet only, 403]. Do not name the tool in public copy.
- A heatmap that blends segments "produce[s] patterns that accurately represent no one". Practitioner article: https://deepsync.in/blog/common-heatmap-mistakes-wrong-decisions [snippet only].
- Job descriptions: "recognizing user friction points", "develop hypotheses", optimise "landing pages, forms". https://www.hirequotient.com/blog/conversion-rate-optimization-specialist-job-description and https://yardstick.team/job-description/conversion-rate-optimization-cro-specialist [snippet only].
- Form analytics vocabulary they already use: "hesitation time", "field-level abandonment", "which field". https://cxl.com/blog/form-analytics/ and https://exatom.io/form-analytics/ [snippet only].

**Outcome to promise:** For each person who converted, see how far they read, which headings they reached, the route they
took to the form, how long each form field took, and forms they started but never sent. Use that to form hypotheses about
your pages and form. Per-lead and pattern views; **no A/B testing and no converters-vs-non-converters screen** (say so).

**Headline candidates**
1. See where your form makes people hesitate.
2. See what your converters read, and where they slowed down.
3. Heatmaps show the crowd. This shows each person who converted.
4. Field timing and reading depth for every lead, tied to the whole visit.
5. Before you change the page, see what your leads actually reached.

**Top objections and honest answers**
| Objection | Honest answer |
|---|---|
| "I already have heatmaps and replays." | Keep them. This is a different view: one chart per lead's visit, field timing included, tied to the person who converted. It works alongside them. Do not name any tool in public copy (one-to-one replies only, per the ledger). |
| "No A/B testing?" | Correct. Use your testing tool for that. Jellyhook helps you decide what to test. |
| "Can I compare converters with non-converters?" | Not on a dedicated screen today. Say so. |
| "Is per-lead data enough on low traffic?" | On low traffic, per-lead detail is often what you have. Every lead is readable even when aggregate charts would be noise. Phrase this as reasoning, not a result claim. |
| "Will it slow the site?" | Unmeasured. Do not claim it. Fix and measure first (section 5). |
| "Privacy and consent?" | Visitors stay anonymous until they submit. No screen, mouse or keystroke recording. Respects GPC/DNT. Optional consent mode for your banner. Compliance is the site owner's job (ledger 22). |

**Proof available:** a real visit-chart screenshot with a frame selected (sample data), a field-timing card screenshot
(sample data), `/demo`, the "does not do" list, the privacy specifics.

**CTA wording options:** "See a sample lead's field timing" (links to `/demo` section) · "Install free on one site" · "Start free, no card".

### 2.4 Digital marketing manager

**Pain, in their words**
- "GA4 knows where someone came from, but the CRM knows whether they bought." Practitioner articles on lead attribution: https://www.darwinapps.com/blog/ga4-vs-crm-attribution-which-source-should-marketing-leaders-trust-for-revenue-reporting/ and https://www.lowcode.agency/blog/b2b-website-analytics-ga4-setup-for-lead-attribution [snippet only].
- Without consistent UTMs a large share of leads land in "direct" (an article claims 30–50%) [snippet only, unverified figure, do not reuse].
- "Form submission report based on contacts that visited a specific page." HubSpot Community thread title: https://community.hubspot.com/t5/Reporting-Analytics/Form-submission-report-based-on-contacts-that-visited-a-specific/td-p/808323 (title seen in search results).

**Outcome to promise:** See where new visitors and converted leads first came from, split visits by referrer, device or
country, see which pages leads read on the way to the form, and see per-page views, time and scroll.

**Headline candidates**
1. See which sources bring leads, not just visits.
2. Know which pages your leads read before they converted.
3. From first visit to form: the route each lead took.
4. Where your leads came from, and what they read next.
5. Your traffic report, with the leads' side of the story.

**Top objections and honest answers**
| Objection | Honest answer |
|---|---|
| "GA4 does this." | GA4 counts visits and conversions. Jellyhook ties each converted lead to its own visit: pages, reading depth, form behaviour. Use both. |
| "Another script on the site." | Yes, one script tag. State what it does and does not collect. Make the speed claim only after measuring. |
| "Does it attribute revenue?" | No. Source here is first touch, with no CRM revenue link. |
| "Can I export a report for my boss?" | No export today. Team members can be invited instead (ledger 14). |

**Proof available:** dashboard and source-chart screenshots (sample data), `/demo`, the docs page for sources.

**CTA wording options:** "See where your leads come from, free" · "Install free on one site" · "See a sample lead page".

### 2.5 Growth / demand gen lead

**Pain, in their words**
- "Sales says the leads are garbage." / "Marketing says sales never works them." https://cyberedgegroup.com/blog/why-does-lead-quality-fall-apart-between-marketing-and-sales/ (fetched; its "only 44% of MQLs accepted" figure is unsourced, do not reuse).
- "If you pass weak MQLs, Sales will eventually stop trusting what you send." Handoff articles: https://5k.co/blog/the-handoff-problem-why-marketing-sales-misalignment-is-killing-your-pipeline/ [snippet only].

**Outcome to promise:** Every lead your marketing produces arrives with the visit behind it. Sales and marketing look at
the same lead page and mark it Qualified or Junk. Patterns across leads help decide what to change (Hook: UNVERIFIED in
production, keep it secondary).

**Headline candidates**
1. Hand sales a lead with its visit attached.
2. Leads that arrive with context, not just a name.
3. Give marketing and sales the same view of every lead.
4. Every form fill, with the pages, time and form behaviour behind it.
5. See what each lead did, then agree together if it is qualified.

**Top objections and honest answers**
| Objection | Honest answer |
|---|---|
| "Time to value?" | Setup is one script, and the first visit is detected automatically. The first lead page needs a real form submission, so it depends on your traffic. Meanwhile `/demo` shows what you will get. |
| "Will my team adopt it?" | Invite them with roles (owner/admin/member). It is a page to open, not a process to learn. Do not claim adoption results. |
| "Does Qualified/Junk feed back into our CRM or scoring?" | No. It is a marking inside Jellyhook. |

**Proof available:** the team-invite screen, the Qualified/Junk toggle (screenshot), `/demo`, the install steps.

**CTA wording options:** "Set it up for your team, free" · "Start free, invite your team" · "See a sample lead page".

### 2.6 Business manager / head of growth (economic buyer)

**Pain, in their words**
- "66% of sales reps say they're overwhelmed by the number of tools". https://www.salesforce.com/news/stories/sales-research-2023/ (fetched; [vendor]; 7,700+ sales professionals, 2022).
- "Fewer than 40% of sales teams provide formal training on newly purchased tools" (attributed to Gartner in a search summary) [snippet only, unverified, do not reuse].
- Synthesis objections: "Who on my team owns this?", "Is it safe for our visitors' data?", "What happens after early access?"

**Outcome to promise:** Set it up once, invite the team with roles, and everyone sees the same thing: what happened before
each lead contacted you, plus a dashboard of visitors, leads and conversion rate against the previous period.

**Headline candidates**
1. One shared view of what happens before someone becomes a lead.
2. Your team sees the same lead, the same visit, the same verdict.
3. Know what your site does before anyone contacts you.
4. Install once, invite the team, and every lead arrives with its visit.
5. One script. Every lead with its visit. Free during early access.

**Top objections and honest answers**
| Objection | Honest answer |
|---|---|
| "Who owns it?" | Suggest owner = whoever owns the website/forms (CRO or marketing). Sales are members who read lead pages. |
| "Is our visitors' data safe?" | State the facts: anonymous until submit, no recording of screens, mouse or keys, GPC/DNT respected, IPs stored hashed (ledger 19: production salt UNVERIFIED, confirm before saying it). Never "compliant". |
| "What happens after early access?" | Pricing after early access is not set. Say so plainly. **Founder decision needed:** commit to a notice period before any charge (do not publish one until confirmed). |
| "Another tool?" | It sits next to your CRM and does not replace it. One script, one page per lead. |

**Proof available:** the privacy page, the "does not do" list, team roles, a founder note (name and face), the free/no-card statement.

**CTA wording options:** "Start free for your team" · "Set it up free, no card" · "Read how it handles visitor privacy" (secondary).

---

## 3. Serving several audiences on one page

| Approach | Pros | Cons | Sources |
|---|---|---|---|
| **A. Role switcher / tabs** (e.g. "For sales / For CRO / For managers" swaps the content) | Each role gets tailored copy; looks organised | Content in unselected tabs is often missed. It adds a decision before any value is shown. Visitors must click to compare. Proof and install content gets split or duplicated. Each variant gets too little traffic to learn from | NN/g: https://www.nngroup.com/articles/tabs-used-right/ (fetched); https://www.nngroup.com/articles/accordions-on-desktop/ [snippet only]; Buffer/ExamSoft tab examples reported in search results (source page not verified) |
| **B. "Use it three ways" section with role headers, all visible** | Every visitor sees every row, and each role spots its own label. Cheap to build. Shared proof and install sections stay single | Rows must stay short or the page gets long. The hero still has to be neutral | Copyhackers option 2 (section headers per audience): https://copyhackers.com/2013/02/writing-a-page-for-2-audiences/ (fetched; no test data) |
| **C. Single unifying promise** (one benefit all roles share) | Clear in 10 s, one CTA, one story; fits the "one primary audience" rule | Risk of vagueness if the shared benefit is abstract | Copyhackers' "Venn diagram of overlap" advice (same URL); Wynter layers: https://wynter.com/post/b2b-message-layers-framework-wynter |
| **D. Separate pages per role** (/for/cro, /for/sales) | Strongest relevance and message match for targeted traffic; matches the outreach-led plan | More pages to maintain while features change. Each page is thin without proof. Duplicated install/proof content | Wynter: https://wynter.com/post/website-messaging (fetched, Ringy example); agency view: https://www.apexure.com/blog/b2b-saas-marketing-the-right-landing-page-strategy/ (fetched) [vendor: agency]; Contentsquare/Hotjar nav by team (observed) |
| **E. Primary-buyer hero + short path for secondary roles** | Writes for the buyer while letting users self-identify; one page | Secondary roles may feel second-class if the row is weak | Copyhackers option 1 (same URL); multi-persona guidance [snippet only]: https://www.codedrips.com/journal/b2b-saas-websites-the-anatomy-of-a-high-converting-homepage/ |
| **F. Dynamic personalisation** (swap the hero by UTM or `?for=` parameter) | Message match for outreach links at no extra page | Engineering effort. Hard to QA. Hidden variants are invisible to the founder's review. Overkill with almost no traffic | CXL landing-page infrastructure [snippet only, 403]: https://cxl.com/blog/landing-page-infrastructure/ |

**Recommendation for Jellyhook now: C + B + E, no tabs, role pages later.**

1. **Hero = single unifying promise (C), phrased for the buyer (E):** "Every lead arrives with the visit behind it." Every
   role reads "lead" and "visit" as theirs. Sales reads context, CRO reads converter behaviour, managers read a shared view.
   It is also durable: it does not name a feature that can change.
2. **Directly under the product visual: "Same data, two scales" (B).** Three rows, all visible, each with a role label, the
   moment of pain in one line, and the outcome in one line:
   - *Following up on leads* (SDR, AE, nurture): read one lead before you reply.
   - *Improving pages and forms* (CRO, marketing): read them together to see what converters read and where the form slows them.
   - *Running the team* (growth, managers): everyone sees the same lead and marks it Qualified or Junk.
   Put the CRO row in the middle and give it the visual, because CRO is the strongest fit. Order the rows by the user's
   journey (one lead, then many, then the team), which matches synthesis §5 "two scales".
3. **Why not tabs:** with zero proof, the page depends on every visitor seeing the product visual, the install section and
   the "not for" block. Tabs hide content (NN/g) and add a choice before value while visitors are still uncertain (choice
   overload conditions, tactic 16). There is too little traffic to learn which tab works.
4. **Why not separate role pages yet:** traffic is founder outreach, and the outreach message already carries the
   role-specific framing (strategy.md). Build `/for/cro` first, once there is one real example. Until then, the role
   content would be thin and would multiply the copy that has to stay true as features change.
5. **Message match without extra pages:** in outreach, link to an anchor (for example `/#improve-pages` for CRO), so the
   reader lands on their own row of the same page. This is cheap and needs no personalisation engine.

---

## 4. How much feature mention helps vs hurts

**What the evidence says**
- Value and clarity must come first and fast: 10-second window (NN/g), simple language and 250–725 words do best in SaaS
  (Unbounce [vendor], correlational). Long feature lists add words and difficult terms.
- Features alone are a weak message and easy to copy: "Features might be unique today, but can easily be replicated by
  competitors" (Wynter, https://wynter.com/post/website-messaging). Lead with the problem solved.
- But B2B buyers do need specifics and want to see how it works. Buyers inspect the product before talking to anyone
  (Wynter buyer study, n=100 [vendor]). Peep Laja stresses "being specific and clear above all else"
  (https://sequel.io/cmo-series/peep-laja/ [snippet only]). In a new category, Wiebe says the page must explain the
  solution, not just claim the outcome (https://stripe.com/guides/atlas/landing-page-copy).
- Concrete and checkable beats abstract (Harry Dry's rules, secondary sources; tactic 9).

**Net:** feature *mentions* help when they are concrete evidence for an outcome the reader already wants. They hurt when
they arrive as a tour (synthesis §4 failure 1), when they name internal screens, or when they create claims that break as
the product changes.

**Recommendation (fits the founder's policy)**
1. **Outcome first, everywhere.** Every section opens with the reader's outcome. A capability may follow only as a short
   category-level sentence that proves the outcome is possible ("You see pages, time, scroll and which headings they reached").
2. **Use durable category nouns, not feature names.** Safe nouns: pages read, time, how far they scrolled, headings
   reached, time per form field, forms started but not sent, returning visits, where they came from, Qualified/Junk, team
   roles. Avoid: screen/card names ("Field Timing card"), counts ("first 80 headings"), Hook mechanics (credits, chaining),
   anything production-UNVERIFIED, anything "AI".
3. **Let the product visual carry the detail.** One real lead-page visual (sample data, labelled) shows more than six
   feature cards and does not commit the copy to specifics. Specifics live in `/docs`, linked once ("See everything a lead
   page shows").
4. **Budget:** about 500–700 words of body copy, at most one capability sentence per section, and no section whose
   headline is a feature name.
5. **Durability test before publishing each line:** "If this screen were redesigned or renamed next month, would this sentence
   still be true?" If not, move it to docs.

---

## 5. Reducing install anxiety

### What successful script-install tools put on their landing pages (fetched 2026-10-09; observed practice, anecdotal)

| Reassurance | Fathom (usefathom.com) | Plausible (plausible.io) | Microsoft Clarity (clarity.microsoft.com + Learn doc) | Zuko (zuko.io) |
|---|---|---|---|---|
| Time to install | "a few minutes" to see real data; one line in `<head>` | Not stated explicitly | Data visible "as soon as you add the code" (Learn doc) | "within minutes" |
| Platforms | Framework/CMS list (WordPress, Next, Vue, Webflow…) | WordPress plugin, GTM template, NPM | Shopify, Wix, WordPress, Squarespace + NPM | Platform list (HubSpot, WordPress, Shopify…) |
| Developer path | n/a | NPM for developers | "Share code" emails the snippet and instructions to a teammate | "no developer involvement" claimed |
| Performance | "lightweight", loads without holding up the page | Script size vs GA stated | "lightweight" | n/a |
| Privacy | Anonymous pageviews, no banner needed (their claim) | No cookies (their claim) | "GDPR & CCPA ready" (their claim) | n/a |
| Try before install | n/a | n/a | Live demo project with sample data | Free "health check" |
| Risk | 7-day trial | 30-day trial, no card | Free | No card |

Sources: https://usefathom.com/ ; https://plausible.io/ ; https://clarity.microsoft.com/ ;
https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup ; https://www.zuko.io/ (all fetched).
These are those vendors' own claims, not verified facts about their products.

### What Jellyhook can truthfully use today

| Reassurance | Can say? | Safe wording / note | Basis |
|---|---|---|---|
| One script tag | **Yes** | "One script tag in your site's `<head>`." | Ledger 1 |
| Snippets for common stacks | **Yes** | "Copy-paste snippets for plain HTML, Next.js and Vite/React." | synthesis §3, `InstallSteps.jsx` |
| Works with your existing forms | **Yes, with limits** | Name the supported form tools **as text, not logos**: logos read as integrations, and "integrates with HubSpot" is banned. Link the limits (iframe forms). | Ledger 11 |
| No form yet | **Yes** | "No form yet? Setup gives you a ready-made contact form." | synthesis §3 |
| Install is confirmed for you | **Yes** | "Setup notices your first visit and opens your dashboard. A settings check tells you if the script and form are set up right." | synthesis §3, ledger 13 |
| You choose which forms count | **Yes** | "Count only the form you label, or every form." | Ledger 12 |
| Try before installing | **Yes** | "See a sample lead page first, no sign-up." (labelled sample data) | Ledger 21 |
| Privacy facts | **Yes, as facts** | "Visitors stay anonymous until they submit a form. No screen, mouse or keystroke recording. Browsers sending Global Privacy Control or Do Not Track are left alone. Optional consent mode for your own banner." Never "compliant", "cookieless" or "no banner needed". | Ledger 17, 18, 22 |
| Free, no card | **Yes** | "Free during early access. Every feature. No card." | Ledger 16 |
| "Your developer can do it" | **Partly** | True: "If you can edit your site's `<head>`, you can install it; if not, it is a one-line change for whoever can." **No "share with developer" email feature exists** (no match in `app/platform/create-site`). Suggest building one; Clarity shows the pattern. | Code check |
| Time to install ("2 minutes") | **Not yet** | Unmeasured. Founder should time a fresh install on a plain HTML site and a Next.js site, then publish "about N minutes" only from that measurement. | Not in ledger |
| Time to first value | **Say honestly** | "Your first lead page appears after a real visitor submits your form." Possible shortcut: submit your own form after installing. **Verify first**: it needs a browser without GPC/DNT, since some browsers send GPC by default and the tracker then stays off. | Ledger 22 + inference, UNVERIFIED |
| Page speed / "won't slow your site" | **No** | Unmeasured (synthesis §3). Local check: `public/tracker.js` is about 110 KB raw, about 30 KB gzipped (whether it is served gzipped is unverified). The plain-HTML snippet is `<script src=... data-key=...>` with **no `defer` or `async`**, so in `<head>` it blocks rendering while it loads (the Next.js snippet uses `afterInteractive`). Recommend: add `defer` to the HTML snippet, measure with a performance tool, then state the size and "loads after your page" only if it is true. | `InstallSteps.jsx` line 100; file size measured locally |
| Google Tag Manager | **No** | Untested (synthesis §3). | — |
| WordPress / Webflow / Shopify logos | **No** | No platform-specific install docs found in `app/docs/installation/page.tsx`. Some supported form tools are WordPress plugins, but that is not the same as documented WordPress install steps. | Code check |

### Suggested "Setup" section shape (content only, not final copy)
1. A heading that answers the fear ("What setup actually involves").
2. Three or four true steps: create a site, then paste one script (snippets for HTML/Next.js/Vite), then label your form
   or let it count every form, then your first visit is detected and the dashboard opens.
3. A line on forms (supported tools as text; "no form? we give you one").
4. A line on privacy facts.
5. A line for people who can't edit code ("one line for whoever manages your site").
6. CTA pair: "Start free, no card" + "See a sample lead page first".

---

## 6. Things to verify or decide before copy is final (for the orchestrator/founder)
- Hook in production (affects the nurture and growth rows; keep it secondary until confirmed).
- Ledger 19 (hashed IPs): production salt set? Do not use until confirmed.
- Measure install time and script impact; add `defer` to the HTML snippet before any speed reassurance.
- Confirm the "submit your own form to see your own lead page" shortcut works end to end, including the GPC/DNT caveat.
- Decide on a post-early-access notice commitment (answers the head-of-growth objection).
- Validate the pain phrasing in section 2 against the first real outreach replies; replace any snippet-only phrasing with verbatim lines from those calls.
