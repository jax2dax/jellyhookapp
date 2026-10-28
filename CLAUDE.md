# Jellyhook: handbook for every agent working in this repo

Jellyhook is a script + dashboard for websites whose main job is to produce form leads. The owner (a solo founder, "Jash")
has **no users yet** and is giving everything free during early access. Goal right now: ~10 real sites installed and used.
Not revenue.

## What the product is, in one honest sentence
You can see what each lead did on your site before they filled in the form (pages read, time, scroll, which headings
they reached, time per form field), and where your form loses the people who start it.

## Marketing rules (non-negotiable)
1. Say only what `marketing/claims-ledger.md` allows. Every claim there cites the file that proves it.
2. Never use anything in `marketing/banned-claims.md`.
3. Never invent numbers, testimonials, results, customer names or "expected +X%" figures. A plan may state a
   *hypothesis* with a metric and a pass/fail threshold; it may not state a predicted result as fact.
4. Do not post, send, DM, email or publish on the founder's behalf. Produce the exact final text and where/when to
   post it; the founder posts. The one exception is editing this repo's landing page and docs (see below).
5. The founder already tried generic posting and commenting: it failed. Do NOT recommend broadcast posts to random
   people, "approach local businesses", friends/family, or "comment about Jellyhook in threads". Work from
   `marketing/strategy.md`.
6. Read the current date/weekday before planning. Plans are day-by-day with a time and a place.
7. Excluded on purpose (see `mds/documentation/roadmap.md`): lead `confidence`, `/platform/intent`, Engagement Score.
   Never market them. (`/platform/acquisition` was rebuilt and documented at the founder's request on 2026-10-24; its
   claims are not in the claims ledger yet, so do not market it until they are.)

## Where things are
- Product facts: `SAAS_PRODUCT_AUDIT.md`, `saas-overview.md`, `mds/documentation/*`, `public/tracker.js`
- Landing page: `app/page.tsx` (magazine look since 2026-10-28, styles in `app/landing.css`, parts in `components/showcase/v2/`; the old page is kept unrouted in `app/_legacy-home/page.tsx`). Pricing: `app/pricing/page.tsx`. About: `app/about/page.tsx`. Docs: `app/docs/**`.
  Privacy: `app/privacy/page.tsx`. Site metadata: `app/layout.tsx`.
- Validation and market research: `business-validation.md`, `mds/reports/saas_validation.md`
- Marketing memory (read first, update last): `marketing/`

## Editing the landing page and docs (agents may do this)
- Allowed: copy (strings) and small layout tweaks in `app/page.tsx`, `app/pricing/page.tsx`, `app/about/page.tsx`,
  `app/docs/**`. Allowed to improve headlines, subheads, CTAs, ordering of sections.
- Every edit: record before/after in `marketing/changes.md`, run `npx tsc --noEmit`, and keep every claim inside the ledger.
- Not allowed: touching `.env*`, `app/api/**`, `lib/**`, `public/tracker.js`, auth, billing, or the database.
- Docs pages tied to Hook/preview/results are fingerprinted: if you edit them run `npm run docs:check`.

## Definition of done for any feature
A feature that changes what a user sees is not done until the docs are updated in the same change (use the `docs-writer` agent or the
`document-feature` skill). Rules and page template: `mds/documentation/docs-standard.md`. Open gaps: `marketing/docs-audit.md`.

## Style
No em dashes. No hype words ("unlock", "seamless", "powerful", "revolutionary"). Short sentences. Plain words:
"leads", "form", "visit". Do not call the visit chart "session replay": it is a chart, not a video.

## Every .md file and what it contains
Keep this list current: add a line when you create a .md file, change it when a file's job changes.

**Root**
- `CLAUDE.md`: this handbook (rules for agents, where things are, this index).
- `PRODUCT.md`: product record for the impeccable design skill (users, purpose, brand commitments, no-invention rule).
- `README.md`: the default Next.js readme (how to run the dev server).
- `RESUME_INVENTORY.md`: inventory of the whole project (features, files, tech) for a resume/portfolio.
- `SAAS_PRODUCT_AUDIT.md`: full product, feature and data-flow audit. A source of product facts.
- `saas-overview.md`: product overview (what it does, pages, data). A source of product facts.
- `business-validation.md`: long Q&A on whether the market cares and who would buy.

**Agents and skills (`.claude/`)**
- `agents/copywriter.md`, `docs-writer.md`, `growth-analyst.md`, `marketing-manager.md`, `site-auditor.md`: subagent definitions (role, tools, rules).
- `skills/document-feature`, `landing-audit`, `weekly-plan`, `write-post` (`SKILL.md` each): repeatable task instructions.

**Issues**
- `mds/issues/prod-issues.md`: every production bug and incident, its evidence and its fix, plus the open list. Read before debugging slowness or errors.
- `mds/issues/free-tier-mode.md`: what was turned down to fit Supabase free compute, and what to turn back on after upgrading.

**Product and progress (`mds/`)**
- `mds/progress_timeline.md`: dated log of everything built and what the founder must run. Update after every change.
- `mds/product/what-jellyhook-is.md`: full description of the product and how it looks. `what-jellyhook-is-summary.md`: the 1,388-word summary.
- `mds/features.md`: list of features.
- `mds/database.md`: database schema (tables, columns, policies).
- `mds/local_cache_schema.md`: what the app keeps in localStorage/sessionStorage.
- `mds/todos.md`: the founder's raw to-do notes.
- `mds/problems.md`, `mds/jh-question.md`: founder notes and open product questions (raw).
- `mds/personal_problems.md`: founder notes on product assumptions (for example not every form is a lead).
- `mds/cacls/specAlgs.md`: notes on section-time calculations. `mds/cacls/alghorithm-scoring.md`, `mds/alghorithms.md`, `mds/build/Header-Sectioning.md`: empty.

**Developer references (`mds/documentation/`)**
- `docs-standard.md`: rules and template for public docs pages. `doc_source_map.md`: which code each docs page depends on. `roadmap.md`: docs roadmap and the excluded features.
- `attribution.md`: source/attribution names. `sensitive-fields.md`: fields never stored. `url-state.md`: what lives in the address bar.
- `form-dashboard.md`, `hook-forms.md`: form dashboard and Hook-with-forms references.
- `ingestion-flow-2026-10-07.md`, `tracker-spec-2026-10-07.md`, `sites-keys-roles-2026-10-07.md`, `usage-and-limits-2026-10-07.md`: ingestion, tracker, site keys/roles and usage limits specs.
- `dashboard-2026-10-06.md`, `leads-conversions-calendar-2026-10-06.md`: change notes for those screens.

**Reports (`mds/reports/`)**
- `saas_validation.md`: market validation. `Traffic.md`: traffic and backend capacity. `form-compatibility-2026-10-07.md`: which forms are captured. `tracker-backend-audit-2026-10-07.md`: tracker and backend audit.

**Feature build docs (`mds/build/`)**
- `notifications/`: notification rules and lead groups. `overview.md` (summary and build status), `requirements.md` (founder's decisions R1-R37), `notifications.md`, `groups.md`, `architecture.md`, `data-flow.md`, `performance.md`, `tech-options.md` (queue choice and cost), `webhooks.md` (exact Slack/webhook formats), `personal-data.md`, `ui-ux.md`, `open-questions.md` (answered decisions, HubSpot note), `slack-oauth.md` (Connect Slack through Slack's screen: flow, setup, planned visit-chart image), `session-summary.md` (visit and page summaries in hook messages, summary versions, the form-page snapshot, failure handling).
- `integrations/hubspot.md`: HubSpot OAuth, Open in HubSpot from Slack (resolved at the click), the Jellyhook app card on contacts and its visit-chart embed, founder setup, failure table.
- `marks/queue-and-cap.md`: the background queue for marks no hook uses and the per-minute cap on mark work (migration 34): design, numbers, who runs it, gaps, how to measure.
- `marks/review-2026-10-27.md`: marks and hooks review: how a lead goes through them, what cannot be changed later, production readiness, capacity on Nano.
- `acquisition/plan.md`: where leads come from (platform, campaign, ad), credit model, radars, "came from an ad" in marks.
- `marks/marks.md`: marks on leads, library, site statistics (v1, the chip builder). `marks/marks-v2-plan.md`: the new builder (visit blocks, page sequences, headings, form answers and activity): plan, founder decisions, build status. `marks/when-marks-run.md`: when marks run (before v3, what other products do, the v3 plan, built 2026-10-27; section 8: does a check stop at the first failed condition).
- `privacy/privacy.md`: the tracker following the site's cookie banner, the "no banner" warning, retention (migration 35), erasing a person, the EU/no-DPA notice, tests.
- `heading-time/plan.md`: time per heading (tracker, storage, heat map).
- `forms/lead-forms.md`: which form submissions are leads (per-form switches, data-conversion as an override, form_key on every lead, skipped counts), the rule, the flow, tests, docs still to rewrite.
- `mds/bench/overview.md`: the test environment in one place: why, the pieces, `.env.bench` variables, the `hook_reader.<ref>` login and `HOOK_DATABASE_URL`, day to day, safety nets, problems met and their fix.
- `mds/crowd-test/`: crowd tests of the pipeline on the test project. `README.md` (method, the six variants), `roadmap.md` (v2 and v3 plans), `heavy-marks.md` (the heavy marks for variants 3 to 6), `v1/summary.md` (the situation before the speed changes: measured numbers, discoveries and actions), `v2/summary.md` (what v2 changed and why, how it is measured, results), `v3/summary.md` (v3, when marks run: what changed, the database change, how it is measured), `v2/run-2026-10-27-marks-off.md` (1,000 visitors with all marks off: database saturated, LOST not known, next runs), `v2/run-2026-10-28-heavy-marks.md` (the same burst with the 5 heavy marks: the database stopped answering), `v1/` (code before changes: `variant1.md` to `variant6.md`, `problems-and-cost.md` with problems, compute, database growth); later `v2/`, `v3/` after each round of fixes.
- `mds/bench/WHICH-SQL-WHERE.md`: which SQL runs in the production project and which in the test (bench) project, and the safety nets; `01-mark-test-database.sql` is for the test project only.
- `control-room.md`: the founder's control room (/admin): every metric and its source, how work is measured (meter, pipeline_runs), cost split, the test environment (.env.bench, dev:bench, the traffic simulator).
- `settings/sidebar.md`: the Settings page as a grouped sidebar (sections, addresses, what each shows, how it is built, wording fixed).
- `form-study/`: `plan.md`, `averages-and-versions.md` (form dashboard versions and reference), `tracker-changes.md`.
- `ai-hook-translate/`: Ask Hook (question to Hook query). `README.md` index, `Architecture.md`, `data-flow.md`, `prompt-and-rules.md`, `models-and-cost.md`, `ledger-and-limits.md`, `eval-and-tests.md`, `security-and-privacy.md`, `setup-and-env.md`, `roadmap.md`.
- `mcp/`: MCP server. `plan.md`, `architecture.md`, `build-log.md`, `resume.md`.
- `showcase/interactive-demo.md`: the home page's interactive demo and the guided-tour engine (sandbox, demo store, `data-tour` handles, how to add a tour, what to keep in step).

**Subsystem docs**
- `jh-hook/`: Hook (the query feature). `overview.md`, `plan.md`, `progress.md`, `architecture.md`, `data-flow.md`, `reference.md` (every field), `user-guide.md`, `ui-ux.md`, `naming.md`, `docs-brief.md`, `documentation.md` (index).
- `output/`: results canvas. `overview.md`, `plan.md`, `rules.md`, `architecture.md`, `data-flow.md`, `docs-brief.md`.
- `silhouette/`: the preview silhouette. `overview.md`, `plan.md`, `rules.md`, `architecture.md`, `data-flow.md`, `docs-brief.md`.
- `main-chart/`: pages/sessions online chart. `overview.md`, `docs/architecture.md`, `docs/data-flow.md`, `docs/ui-ux.md`.
- `framePlate/`: visit chart notes. `ui-ux.md` (highlighting visits), `control.md`, `data-flow.md`, `markers.md` (tracker bugs); `architecture.md`, `progress-plan.md` empty.
- `report/`: `numbers.md` (numbers ledger), `interview-cheatsheet.md`.

**Marketing (`marketing/`)**
- `strategy.md` (the plan to follow), `claims-ledger.md` (allowed claims), `banned-claims.md`, `changes.md` (every landing/docs edit, before/after), `docs-audit.md`, `experiments.md`, `learnings.md`, `metrics.md`, `calendar/2026-W41.md` (week plan).
- `landing/`: landing page research. `synthesis.md`, `agent-a-marketing.md`, `agent-b-design.md`, `draft-v1.md`, `final.md`, `page-v1-text.md`, `alternatives.md`, `pain-points.md`, `personas.md` (14 persona cards), `phase3-results.md`, `variants.md` (variant log).
- `landing/persona-results/P01.md` to `P14.md`: each persona's reaction to page v1.
- `landing/variants/V1-V4.md`, `R2A-R2C.md`, `R3A-R3C.md`: landing page variant texts. `variants/round1/`, `round2/`, `round3/` (`D.md`, `P01`, `P04`, `P06`, `P07`, `P10`, `P11`): persona and outsider reviews per round.
