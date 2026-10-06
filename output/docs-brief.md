# Results canvas: documentation brief

For the writer of the public docs (person or AI). It lists the key points
the "Results" page must cover, in note form. Read `rules.md` for exact
behaviour. Tone: professional SaaS, product words only, no em dashes, and
an example in every section.

## What it is
- After **Run hook**, the answer appears under the builder, drawn as what it is: people, sessions, pages, numbers. Never ids.
- The view is chosen automatically from what the hook returns.

## Numbers
- Big number plus context: "4 out of 52 sessions overall (7.7%)", or "across all page views: 12 sec" for averages and totals.
- The context is the same measure without your conditions (it costs about the same credits as the run).

## Breakdowns
- Per hour / day / week / month: bars over time, hover for values.
- Per anything else: a ranked bar list.

## Lists
- Sessions: full session replays, 6 at a time, **Show 6 more**.
- Page views and away periods: shown inside their sessions.
- Leads: mini profiles (name in yellow, email, phone, submitted date and page, qualified badge), **Show form answers** reveals the full form, **Open the lead**.
- Visitors: device, browser, first and last seen, sessions count, the lead's name if they submitted a form.
- Pages: views and form submissions per page.
- Form activity: status, fill time, fields touched, last field.
- Form fields: time in the field, typed or not, "gave up here".
- "Show more" is free: it doesn't re-run the hook or use credits. Results stay loadable for a day.
- Up to 500 items per list; the canvas says when there are more.

## Why a result is there (highlighting)
- Only when your hook looked at connected rows.
- Sessions filtered by their pages: the matching page visits are ringed, the rest of the session is dimmed, and the header says how many matched.
- Leads filtered by their session: the session they converted in appears under each lead.
- Visitors filtered by their sessions: up to 2 matching sessions under each visitor.
- Works with everything Hook can filter on, including journeys ("/blogs then /pricing").

## Comparing two hooks
- **Compare with another hook** adds Hook B and a result formula: A / B, A / B x 100 (%), A - B, change from B to A (%).
- Both hooks must return one number. **Run comparison** runs both.
- Example: converted sessions that saw /pricing (A) vs all converted sessions (B), A / B x 100 = the share of conversions that saw pricing.

## Privacy
- The canvas never shows internal ids; links go to the app's own pages.

## Do NOT claim
- Exporting results, sorting inside a list, overlaying two breakdowns, saving a canvas to a dashboard (not built).
