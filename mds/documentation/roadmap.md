# Documentation roadmap

Plan for what goes on /docs, in what order. Originally written for review
before more got built; as of 2026-10-02, every section below is built,
including two pages (Team and invites, Billing and plans) added past the
original plan once a full audit found real screens in `/platform` that
had no doc page at all. Kept as a reference for the structure and the
writing rules, not as a "still to do" list.

## How this is structured

Every doc site that actually works splits into the same few kinds of
page, because a reader wants different things at different moments:

- **Getting started**: the shortest path from nothing to seeing real data.
- **Core concepts**: the "why" behind a number, not the button that shows
  it. This is what the "i" icons on charts will link into.
- **Feature reference**: one page per screen in the app, what it shows
  and what each control does.
- **Troubleshooting**: what to check when something looks wrong or
  missing.

Pages are grouped by what the reader is trying to do, not by which part
of the codebase built it. One page, one job. A page that tries to cover
setup and troubleshooting and advanced config at once just gets skimmed
and abandoned.

## Section order

### 1. Getting started (build first, this session)
- **Introduction**: what Jellyhook actually does, one paragraph, no
  pitch language.
- **Installation and Setup**: create a site, install the tracker
  script, confirm it's actually live. This is the one being written now.

### 2. Core concepts (build next)
These are the pages every chart's "i" icon will eventually link to. Each
one explains a real mechanism in the tracker or the data model, not a
button.
- Visitors, sessions, and page views (what a session boundary actually
  is, why the same person can show up as several sessions)
- Leads and qualification (form_submissions, the qualify flag vs. the
  automatic confidence score, why they're different things)
- Form engagement (viewed, started, submitted, abandoned, per-field
  timing, what "abandoned" actually means and when it gets marked)
- Session replay (FramePlate) (reading the frame colors, the bulbs, what
  each one is measuring)
- Referrers and attribution (UTM vs. plain referrer, why "direct" doesn't
  always mean direct, first-touch counting)

### 3. Feature reference (build after concepts exist to link to)
One page per real screen:
- Dashboard overview (including the live "Sessions online" chart added
  2026-10-01, the Lead footprints preview, and the Live Ticker)
- Leads page
- Lead profile page
- Conversions page (the three view modes, the referrer donut, leads
  origin radar)
- Site settings (the specify-form toggle, API key, team members, and the
  danger-zone deactivate action, distinct from pause)
- Team and invites (added 2026-10-02: the Network page and Settings'
  embedded team section are the same feature, two layouts; covers roles,
  inviting, accepting/declining, and the current lack of a self-serve
  "leave a site" control)
- Billing and plans (added 2026-10-02: what the Billing and Subscription
  pages show during early access, when nothing is actually charged)

**Not documented, on purpose, as of 2026-10-02:** `/platform/acquisition`.
It exists and is reachable by direct URL, but is not linked from the
sidebar (see `components/app-sidebar.tsx`) because it isn't considered to
have real content yet. Give it a doc page once it's actually part of the
product again, not before.

### 4. Troubleshooting (build last, needs real support questions to be
useful, can start with the obvious ones)
- Tracker installed but no data showing
- A lead's confidence/qualify status looks wrong
- Referrer shows "Direct" when it shouldn't

## The "i" icon plan

Confirming what was already described: each "i" above a chart or card
gets a short inline explanation (a sentence or two, in the tooltip
itself, the same pattern already built for the FramePlate chart legend).
The tooltip is NOT the full explanation. It links out to the matching
Core Concepts page for the real depth. Tooltip = "what is this," docs
page = "why does it work this way."

This means Core Concepts pages need to exist before the "i" icons get
wired up with real links, not the other way around. Once section 2 above
is written, going back through the app adding "i" icons is a fast,
mechanical pass, not a design decision each time.

## Writing rules for every page

- No em dashes, anywhere.
- No marketing language. Not "unlock insights," not "seamlessly," not
  "powerful." Say what the thing does.
- Every claim about what data is collected or how something is
  calculated has to match what the code actually does, not what would be
  nice. If a feature has a real limitation, the doc says so.
- Short sentences. A page is not more credible for being longer.
- Not everything the app does gets documented. Excluded, on purpose:
  - `confidence` (the automatic email-presence score on a lead). Decided
    not worth documenting, only `qualified` (the human flag) matters.
  - The `/intent` page and anything it calls an algorithm. It's
    if-condition template sentences dressed up as analysis, not something
    to hold up as a real feature in the docs.
  - Engagement Score on the lead profile page (`LeadEngagementRadial`),
    same reason: an arbitrary heuristic, not a fact.
  - General rule behind all three: if a number on screen is a guess or a
    made-up scoring formula rather than a measured fact, it does not get
    a docs page treating it like one.
