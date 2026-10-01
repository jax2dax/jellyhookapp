# Doc-to-source map

Answers one question, cheaply: when a source file changes, which docs
pages need a second look? Reading the docs themselves has never been the
expensive part, they're a few KB each. The expensive part is figuring out
WHICH doc, out of a growing pile, makes a claim about the file you just
changed, without re-reading every page to check.

Rule going forward: whenever a doc page claims something about how a
specific file behaves, add that file to its row here. When you change a
file, grep this table for its path first. Only the doc pages listed
against it need checking. Everything else is provably unaffected.

| Doc page | Depends on |
|---|---|
| `saas-overview.md` | `public/tracker.js`, `app/api/track/route.js`, `app/api/track-form/route.js`, `app/api/track-form-engagement/route.js`, `lib/closeStaleSessions.js`, `lib/closeStaleFormEngagement.js`, `lib/algorithms/leadProfile.js`, `lib/actions/leadProfile.actions.js`, `lib/actions/leadQualify.action.js`, `lib/analytics/classifyReferrer.js`, `lib/actions/referrerBreakdown.action.ts`, `lib/actions/leadOriginBreakdown.action.ts`, `lib/actions/uniqueConversionRate.action.ts`, `lib/actions/pagesOverview.action.js`, `lib/actions/reachOverTime.action.ts`, `lib/actions/conversionsOverTime.action.ts`, `lib/actions/visitsOverTime.action.ts`, `lib/actions/rateConversion.action.ts`, `lib/actions/supabase.actions.js`, `lib/leadSessions/transform.js`, `framePlate/types.ts`, `framePlate/geometry/deriveVisitGeometry.ts`, `framePlate/geometry/buildTimeline.ts`, `framePlate/theme/defaultTheme.ts`, `framePlate/components/FullPagePlate.tsx`, `components/leads/SelectedFrameDetails.tsx`, `components/leads/SessionSummaryDrawer.tsx`, `components/leads/LeadSessionExplorer.tsx`, `components/leads/LeadsTable.tsx`, `components/dashboard/FramePlatePreviewCard.tsx`, `components/dashboard/LiveTicker.tsx`, `components/charts/ReachConversionsSection.tsx`, `components/charts/NewReachChart.tsx`, `components/charts/ConversionsAreaChart.tsx`, `components/charts/MergedReachConversionsChart.tsx`, `components/charts/visitsOverTime.tsx`, `components/charts/pageViewsBar.tsx`, `components/charts/conversionRate.tsx`, `components/charts/ReferrerDonutChart.tsx`, `components/charts/LeadOriginRadarChart.tsx`, `app/dashboard/page.tsx`, `app/platform/dashboard/page.jsx`, `app/platform/leads/page.jsx`, `app/platform/leads/[lead_id]/page.jsx`, `app/platform/conversions/page.jsx`, `app/platform/settings/page.jsx`, `app/platform/settings/SettingsClients.jsx` |
| `/docs/installation` | `app/platform/create-site/page.jsx`, `lib/actions/site-management.actions.js` (createSite, domain/email matching), `app/api/track/route.js` (verified flip), `public/tracker.js` (data-conversion attribute, specify_form gate) |
| `/docs/concepts/visitors-sessions` | `public/tracker.js` (`getVisitorId`, `getSessionId`, `SESSION_IDLE_TIMEOUT_MS`, `checkIdleAndMaybeSplitSession`), `lib/closeStaleSessions.js`, `framePlate/theme/defaultTheme.ts` (`sessionLiveBorder` vs `live` frame outcome) |
| `/docs/concepts/leads-qualification` | `components/leads/LeadQualifyToggle.tsx`, `lib/actions/leadQualify.action.js`, `components/leads/LeadsTable.tsx` (qualify filter). Deliberately does NOT cover `form_submissions.confidence` — excluded on purpose, see roadmap.md's writing rules. |
| `/docs/concepts/form-engagement` | `mds/database.md` (`form_engagement` section), `mds/features.md` (Form Engagement Tracking entry), `public/tracker.js` (FORM ENGAGEMENT TRACKING block), `app/api/track-form-engagement/route.js`, `lib/algorithms/leadProfile.js` (`fieldTimings`) |
| `/docs/concepts/session-replay` | `framePlate/theme/defaultTheme.ts` (frame/bulb/formImitation colors + sizing), `framePlate/geometry/deriveVisitGeometry.ts` (outcome, seen bands, formStatus/formFieldCount passthrough), `framePlate/components/FullPagePlate.tsx` (the form imitation box + field stripes, and the single-point bulb fallback), `framePlate/geometry/buildTimeline.ts` (away-gap threshold, live-frame logic), `lib/leadSessions/transform.js` (form_engagement → formTopY/formBottomY/formStatus/formFieldCount, no longer gated on `converted`), `components/leads/SelectedFrameDetails.tsx`. Renders a real `FramePlateChart` against a hand-built fixture (`exampleSession.ts`) — if `PageVisitRaw`/`SessionRaw`'s shape changes, this fixture needs updating too, not just the prose; `TerminologyDiagram.tsx` also hand-draws the form imitation box using real theme geometry, same risk. |
| `/docs/concepts/referrers-attribution` | `lib/analytics/classifyReferrer.js`, `public/tracker.js` (`getUtmParams`), `lib/actions/referrerBreakdown.action.ts`, `lib/actions/leadOriginBreakdown.action.ts` |

| `/docs/reference/dashboard` | `app/platform/dashboard/page.jsx`. Deliberately omits the Site Health card (`getIntentFailureAnalysis`) — excluded per roadmap.md's writing rules. |
| `/docs/reference/leads` | `app/platform/leads/page.jsx`, `components/leads/LeadsTable.tsx` |
| `/docs/reference/lead-profile` | `app/platform/leads/[lead_id]/page.jsx`, `lib/algorithms/leadProfile.js`. Deliberately omits Engagement Score (`LeadEngagementRadial`) — excluded per roadmap.md. |
| `/docs/reference/conversions` | `app/platform/conversions/page.jsx`, `components/charts/ReachConversionsSection.tsx`, `components/charts/ReferrerDonutChart.tsx`, `components/charts/LeadOriginRadarChart.tsx`, `lib/actions/leadOriginBreakdown.action.ts`, `components/leads/ConvertedLeadsExplorer.tsx` (date filter, pagination), `components/leads/ConvertedLeadCard.tsx` (per-card chart + frame-details), `lib/actions/conversionLeads.action.js`, `lib/leadSessions/transform.js` (`truncateSessionToSubmission`). Replaced the old "Top paths to conversion" list (`getConversionPaths` in `supabase.actions.js`, deleted — see progress_timeline.md 2026-10-01). |
| `/docs/reference/settings` | `app/platform/settings/SettingsClients.jsx`. Confirmed by reading it: there is no UI to change `specify_form` after site creation — this page says so explicitly, don't silently claim otherwise if a future settings redesign adds one, update this row and the page together. |

| `/docs/troubleshooting` | `lib/closeStaleSessions.js`, `app/api/track/route.js` (session_end page_view sweep), `app/docs/concepts/session-replay/exampleSession.ts` (the impossible-duration case this page documents was found and fixed in this exact file, see progress_timeline.md 2026-09-30) |

Add a row per page as it's written. If a page doesn't make any claim
tied to specific code (pure narrative, like the Introduction), it doesn't
need a row.
