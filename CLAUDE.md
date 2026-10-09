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
7. Excluded on purpose (see `mds/documentation/roadmap.md`): lead `confidence`, `/platform/intent`, Engagement Score,
   `/platform/acquisition`. Never market them.

## Where things are
- Product facts: `SAAS_PRODUCT_AUDIT.md`, `saas-overview.md`, `mds/documentation/*`, `public/tracker.js`
- Landing page: `app/page.tsx`. Pricing: `app/pricing/page.tsx`. About: `app/about/page.tsx`. Docs: `app/docs/**`.
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
