# Phase 0 synthesis: one landing page for Jellyhook

Date: 2026-10-09. Author: orchestrator. Inputs read: `marketing/strategy.md` (incl. 2026-10-09 updates), `mds/documentation/roadmap.md`,
`mds/documentation/doc_source_map.md`, `marketing/claims-ledger.md`, `marketing/banned-claims.md`, `app/page.tsx` (current, after the
2026-10-08 site-auditor pass), `components/marketing/*` (theme, fonts, header), `app/docs/page.tsx`, `app/docs/use-cases/page.tsx`,
`public/tracker.js` (privacy gates), `components/hook/AskHook.tsx`, `app/platform/create-site/*`.

## 1. The situation the page must handle

- No users, no logos, no quotes, no numbers. Proof can only be: the real product (screenshots / labelled sample data), honest specifics,
  ease of setup, risk removal (free, no card), and transparency (what it does not do).
- The real wall is not the sign-up; it is **installation and waiting for the first lead**. Sign-up -> create site -> paste script
  (and label the form in the default mode) -> wait for a real visit -> wait for a real form submission -> first value.
  The page must lower the perceived cost of that path and show the value before it, so people are willing to walk it.
- The founder's direction: CRO people are the strongest fit and new features will be shaped with them.

## 2. Audience map

| Segment | Their job | Moment of pain | What they would use | Buyer / user | Top objections |
|---|---|---|---|---|---|
| Inbound SDR / inside sales / AE | Follow up on form leads fast, qualify, book meetings | A lead arrives as name + email + one line; the first message is generic; a call opens blind | One lead's page: pages read, time, scroll, headings reached, returning visits, form details; Qualified/Junk | **User**. Rarely buys alone | "I live in the CRM, not another tab"; "I respond in minutes, no time to analyse"; "most leads read one page" |
| Follow-up automation / nurture owner (marketing automation) | Write sequences and follow-ups that match the lead | Every lead gets the same sequence | The same lead view to choose a track by hand; patterns across leads (Hook) to decide which tracks exist | User, sometimes buyer | No CRM/automation integration (true gap); "I can't segment automatically from it" |
| CRO specialist / manager | Find where visitors drop and what converters have in common; change pages/forms; run tests | "Conversion rate won't move and I don't know where people stall"; heatmaps are aggregate, video replays take hours | Field timing and abandoned forms; how far each converter read; paths to conversion; Hook to ask pattern questions | **Buyer and heaviest user** | "I already have Hotjar/Clarity/GA4"; "no A/B testing"; "is per-lead data enough on low traffic?"; "will it slow the site?" |
| Digital marketing manager | Channels, landing pages, reporting | Can't tell which pages and sources bring leads vs traffic | Sources of new visitors and converted leads (first touch), visits split by referrer/device/country, conversion paths, pages table | Buyer | "GA4 does this"; "another script"; privacy |
| Demand gen / growth lead | Pipeline from inbound | Leads are counted, not understood; handoff to sales is a name | Lead pages to share with sales; patterns via Hook; dashboard trend | Buyer, sets up for team | Time to value; team adoption |
| Business manager / head of growth | Set up the system and assign the tools | Team works from guesses; no shared view of what happens before a lead | Team invites with roles; dashboard; lead list with Qualified/Junk | **Economic buyer** | "Who on my team owns this?"; "is it safe for our visitors' data?"; "what happens after early access?" |
| Wrong fit (must self-select out) | Ecommerce checkout, single-offer ad landing pages, sites with no form, anyone wanting to identify anonymous companies | n/a | n/a | n/a | Will be disappointed: say so plainly |

## 3. Outcome map (only what is verifiably true)

Each row is something the page may say at category level. The specifics go to /docs.

| Outcome (reader's words) | Verified by | Ledger row |
|---|---|---|
| Know what a lead read before they contacted you (pages, time, scroll, in order) | `app/platform/leads/[lead_id]/page.jsx`, `lib/algorithms/leadProfile.js` | 2 |
| See whether they came back several times before converting | `components/leads/LeadStatsCard.tsx` (Visits, Time to convert, "after N earlier visits"), lead page badge "Returning · converted after N visits" | 2 (extend) |
| See which headings / parts of a page they actually reached | `components/leads/SelectedFrameDetails.tsx`, `framePlate/` | 4 |
| See where people hesitate in your form and which forms were started but never sent | Lead page "Form Engagement" and "Field Timing"; `app/api/track-form-engagement/route.js` | 3 |
| See the route converted leads took, start of visit to the form | `components/leads/ConvertedLeadCard.tsx` | 5 |
| See where new visitors and converted leads came from (first touch) | `components/charts/ReferrerDonutChart.tsx`, `LeadOriginRadarChart.tsx`, `lib/analytics/classifyReferrer.js` | 5 |
| Mark leads Qualified or Junk | `components/leads/LeadQualifyToggle.tsx` | 10 |
| Ask your own questions of the data (Hook) | `components/hook/HookWorkspace.tsx`; plain-language "Ask Hook" in `components/hook/AskHook.tsx` (uses an OpenAI provider, `jh-ai/providers/openai.ts`) | 15 (production: UNVERIFIED, ask founder) |
| Invite the team with roles | `app/platform/settings/SettingsClients.jsx`, `lib/tracking/permissions.js` | 14 |

Ease and risk-removal claims that are true:

| Claim | Verified by | Ledger |
|---|---|---|
| One script tag; snippets for HTML, Next.js (App/Pages), Vite/React | `app/platform/create-site/InstallSteps.jsx` | 1 |
| Works with your existing forms (HTML, HubSpot, Marketo, CF7, Gravity Forms, WPForms, Salesforce Web-to-Lead, Mailchimp); limits documented | `app/docs/concepts/supported-forms/page.tsx` | 11 |
| No form yet? A ready-made contact form is offered at setup | `app/platform/create-site/starterForm.mjs`, `InstallSteps.jsx` ("Give me a form") | (add row) |
| Setup detects the first visit by itself and opens the dashboard | `app/platform/create-site/page.jsx` (polls every 3 s, redirects on verify) | (add row) |
| A built-in check tells you if the script and form are set up right | `app/platform/settings/TrackingCards.jsx` | 13 |
| You choose which forms count (labelled form only, or every form) | `create-site/page.jsx`, `TrackingCards.jsx` `FormModeCard` | 12 |
| Visitors stay anonymous until they submit a form; no screen, mouse or keystroke recording | `app/privacy/page.tsx`, tracker spec | 17, 18 |
| Respects Global Privacy Control / Do Not Track; optional consent mode for your banner | `public/tracker.js` privacy gates, `/docs/concepts/privacy-consent` | 22 |
| Free during early access, every feature, no card | `lib/pricing/tiers.ts`, `app/pricing/page.tsx` | 16 |

Not claimable (stay off the page): identification of visitors/companies; video replay; compliance; outcome guarantees; intent or
psychology read by the product; CRM integration; A/B testing; converters vs non-converters comparison (no such screen); exports;
"Google Tag Manager works" (untested); page speed impact (unmeasured); anything excluded in roadmap.md.

## 4. Where the current landing page works and fails

Works:
- The hero headline says what it does, in the reader's words ("See what every lead did before they contacted you").
- Claims are now honest and ledger-backed; "free, no card, one script" is stated early.
- Visual identity is distinctive (serif display, mono labels, lime on near-black, grain) and coherent across marketing pages.

Fails:
1. **It is a feature tour.** Hero bullets, "Capabilities", four "What you get" cards and six Hook cards all list features. Nothing says
   why it matters to a specific person this week.
2. **No real proof.** The hero visual is a self-declared "illustration" with fake bars. The product's most persuasive asset (the visit
   chart, field timing) is never shown.
3. **Install fear is unaddressed.** "One script tag" is said, but not: how long, what if I use HubSpot, what if my developer has to do
   it, will it break or slow my site, what about consent. The single biggest wall gets one line.
4. **Audience is blurred.** "Sales / Marketing / Business managers" rows are generic job labels; no one sees their own moment of pain.
   CRO, the strongest fit, is not named at all.
5. **Hook dominates the second half** with detailed points (credits, chaining, Hanna) while its production state is unverified, and
   it competes with the main promise.
6. **No self-selection.** Nothing tells a wrong-fit visitor to leave, which also weakens trust for right-fit visitors.
7. Decorative noise competes with the message: seasonal ghost icon, rope animation, "Est. 2026", "Scroll ↓", marquee of feature words.
8. The final CTA restates features; there is no "what happens after you click" (setup steps), which is what reduces install anxiety.

## 5. Segment interactions (one page, several audiences)

- **Two scales of the same data.** Sales reads one lead; CRO/marketing reads many leads. Both are served by the same truth: every
  lead arrives with the visit behind it. The page can lead with the single-lead moment (concrete, visual, universal) and then show the
  "across all your leads" view as the second use. Leading with patterns would lose sales; leading only with one lead under-sells CRO.
- **Buyer vs user.** CRO/marketing/growth buy; sales uses. The page should be written to the buyer, with a short section that lets the
  buyer picture handing it to sales (that also serves the head-of-growth persona who "assigns the tools").
- **Vocabulary conflict.** Sales says "lead, follow-up, context, first call"; CRO says "drop-off, friction, converters, test";
  managers say "pipeline, team, visibility". One unifying promise must be phrased in neutral words that all three read as theirs.
- **Install is everyone's objection**, regardless of role. It deserves its own section, not a footnote.
- **The wrong-fit filter helps everyone**: saying who it is not for raises credibility for the right ones.

## 6. Open questions for the founder (to ask at the checkpoint)

- Does Hook (and "Ask Hook", which calls OpenAI) work in production today?
- Can you supply real screenshots (or a demo site with sample data) of: a lead page, the visit chart with a frame selected, field timing,
  the dashboard?
- Is the theme allowed to change, and how much?
- Keep or remove `/demo`?
