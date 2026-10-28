# Claims ledger: what marketing may say

Each row = a claim that is true in the code today. If it is not here, do not say it. Re-verify after big code changes.
"Needs" tells you when the claim only holds with certain setup.

| # | Claim (safe wording) | Proven by | Needs |
|---|---|---|---|
| 1 | One script tag installs it. | `app/platform/create-site/InstallSteps.jsx`, `public/tracker.js` | Script in the page `<head>` |
| 2 | Each lead has a page with their visits: pages viewed, time on page, scroll depth. | `app/platform/leads/[lead_id]/page.jsx`, `lib/algorithms/leadProfile.js` | A captured form submission |
| 3 | You can see time spent on each form field and forms a visitor started but never submitted. | Lead page cards "Form Engagement" and "Field Timing"; `app/api/track-form-engagement/route.js` | Form engagement rows (a real form being filled) |
| 4 | The visit chart shows which parts of each page were scrolled past, and whether each heading was reached ("Seen"/"Not seen"). | `components/leads/SelectedFrameDetails.tsx`, `framePlate/`, `public/tracker.js` (page structure, first 80 h1-h3) | Scroll data and captured headings |
| 5 | Conversion Paths shows the path each converted lead took, start of session to submission, plus where new visitors and converted leads came from (first touch). | `app/platform/conversions/page.jsx`, `components/leads/ConvertedLeadCard.tsx`, `lib/analytics/classifyReferrer.js` | Leads |
| 6 | The dashboard shows visitors online now, page views, sessions, leads and conversion rate with change vs the previous period. | `app/platform/dashboard/page.jsx`, `components/dashboard/WindowStatTile.tsx` | Traffic |
| 7 | "Sessions online" chart shows how many people were on the site at once, with conversions marked. | `main-chart/components/MainChart.tsx` | Traffic |
| 8 | Visits Over Time can be split by referrer, device or country. | `components/charts/visitsOverTime.tsx` | Traffic |
| 9 | Pages table: views, unique visitors, average time, average scroll per page. | `app/platform/dashboard/page.jsx` | Traffic |
| 10 | Mark a lead Qualified or Junk. | `components/leads/LeadQualifyToggle.tsx` | Leads |
| 11 | Works with your own HTML forms, HubSpot, Marketo, Contact Form 7, Gravity Forms, WPForms, Salesforce Web-to-Lead, Mailchimp forms. Typeform/Calendly/Jotform count as a lead without name or email. Other iframe forms cannot be tracked. | `app/docs/concepts/supported-forms/page.tsx`, `mds/reports/form-compatibility-2026-10-07.md` | Label the form (`data-conversion="true"`) or choose "every form" |
| 12 | You choose which forms count as leads (only the form you label, or every form). | `app/platform/create-site/page.jsx`, `app/platform/settings/TrackingCards.jsx` (`FormModeCard`) | none |
| 13 | A Settings page checks whether the tracker is installed and your form is marked correctly. | `app/platform/settings/TrackingCards.jsx` (`TrackingStatusCard`, `TrackingHealthCard`) | none |
| 14 | Team members can be invited with roles (owner, admin, member). | `app/platform/settings/SettingsClients.jsx`, `lib/tracking/permissions.js` | none |
| 15 | Hook lets you filter visits and leads by what they did (pages, time, scroll, forms) and see results as visit charts and lead profiles. | `components/hook/HookWorkspace.tsx`, `jh-hook/overview.md` | Production DB role: UNVERIFIED. Do not make Hook the headline. |
| 16 | Free during early access, every feature, no card required. | `lib/pricing/tiers.ts`, `app/pricing/page.tsx` | none |
| 17 | Visitors are anonymous until they submit a form. | `app/privacy/page.tsx`, `public/tracker.js` | none |
| 18 | The tracker does not record screens, mouse movement or keystrokes. | `mds/documentation/tracker-spec-2026-10-07.md` ("What it does not collect") | none |
| 19 | IPs are stored as a salted hash; a raw IP is held only briefly when the host gives no country, then deleted. | `lib/tracking/ip.js`, `lib/resolvePendingCountries.js` | Deployed with the 2026-10-08 fix; `IP_HASH_SALT` set in production: UNVERIFIED |
| 20 | It works next to a CRM; it does not replace one. | Product scope (no CRM features) | Do NOT say "integrates with" |
| 21 | A sample lead page with made-up data is public at /demo, no signup. It uses the same chart as a real lead page. | `app/demo/`, `components/leads/SelectedFrameDetails.tsx`, `framePlate/` | Always label it sample data |
| 22 | The tracker does nothing when the browser sends Global Privacy Control or Do Not Track, and a site can switch on a consent mode (`data-require-consent`) so it stays off until the site's own banner calls `window.jellyhook.consent(true)`. It has no banner of its own. | `public/tracker.js` (PRIVACY GATES), `app/docs/concepts/privacy-consent/page.tsx` | Site owner wires their banner. Never say "compliant". |
| 23 | A mark is a set of conditions about what a lead did before sending the form: pages in a visit, time on a page, headings read, which visit, their answers, how they filled the form. Every new lead that matches gets the mark's badge on the Leads page, with the reason; past leads are checked too, as chosen at save (last 30 days by default, or 90 days, all, none). Applying a mark lists its leads first. | `components/marks/MarksPanel.tsx`, `components/marks/v2/RuleEditor.tsx`, `jh-marks/v2/check.ts`, `lib/actions/marks.action.ts`, `components/marks/MarkBadge.tsx` | Leads. Heading conditions need heading time from the tracker; answer conditions need the form field in Settings → Form fields. Do not mention "Enter with AI" (banned: "AI" anything). Since 2026-10-27 (marks v3, `lib/marks/coverage.ts`, `lib/marks/backfill.ts`): do not say "every lead" or "all your leads" without the past-leads choice; an off mark checks nothing. |
| 24 | A hook watches every new lead. When a lead has all of the hook's marks, it is listed under Hooked leads and the team is told inside Jellyhook, and in Slack or by webhook when connected. The Slack message can carry a summary of the visit. | `components/notifications/Rules.tsx`, `lib/notifications/decide.ts`, `lib/notifications/message.ts`, `lib/actions/hooks.action.ts` | Slack connected (Integrations). Production delivery (migration 20, cron drain): UNVERIFIED by an agent. Do not mention ads in the Slack message (Acquisition is not in this ledger). |
| 25 | The home page has an interactive demo: the real Leads and Hooks screens on a made-up site, with a guided tour (build a mark, apply it, turn it into a hook). Nothing in it is saved or sent. | `components/showcase/`, `components/sandbox/sandbox.tsx`, `components/tour/Tour.tsx` | Always label it sample data. Desktop only (phones get a link to /demo). |

## Allowed comparisons
Describe what Jellyhook does. Never name competitors in ads. In honest 1:1 replies you may say "Zuko does form
analytics, Jellyhook ties it to the lead's whole visit".
