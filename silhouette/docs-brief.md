# Silhouette: documentation brief

For the writer of the public docs (person or AI). It lists the key points
the "Preview" page must cover, in note form. Read `rules.md` for the exact
behaviour. Tone: professional SaaS, product words only, no em dashes, and
at least one example per section.

## What it is
- A live picture, beside the builder, of what your hook describes, drawn in the same shapes as session replay (FramePlate).
- Fills in as you build: the more you describe, the more detailed it gets.
- Shows the question, not the answer: it doesn't change when you run, uses no credits, and reads no visitor data.
- Faint at rest; pulses once per edit; the parts that changed glow (no motion with "reduce motion").

## When a picture appears
- Hooks on sessions: always (an empty session hook shows "one page, maybe more").
- Hooks on page views: a big single page for the page's own conditions; plus its session when the hook involves the session (its session, converted, landing/exit, page number, next/previous page, pages after/before).
- Pages, forms, form fields: a page with a form.
- Leads: only when their session is described. Visitors: one picture per described session.
- Nothing appears for conditions that have no shape (dates, campaign, country): they show as text chips under the picture.

## Reading the shapes (legend)
- Dashed white plate: any page, not chosen yet; the label says how many pages it could be ("12+"), hover lists them.
- Solid plate with an address: a specific page.
- Yellow frame: converted here. Orange frame: a form was abandoned. Cyan border: session still open.
- Purple bar: time away from the site, labelled.
- Light green band: share of page seen. Dark green: seen 2x+. Hatched: never seen.
- Green / blue / red bulbs: where they entered / furthest point / where they left.
- Faint plate with "?": may or may not exist (inside a range). "+": possibly more.
- Cyan ring: the page view your hook returns, inside its session.
- Red diagonal lines: excluded, matching rows must NOT look like this. Red corner on a plate: that page must not be something.

## Ranges and counts
- "Exactly 4 pages": 4 plates. "Between 2 and 5": 2 + 3 faint. "At least 3": 3 + "+".
- Labelled under the title ("2 to 5 pages").

## Alternatives, exclusions, sub-hooks
- "Match any (OR)": one picture per alternative ("option 1 of 2").
- "Exclude (NOT)": an extra picture with red diagonal lines.
- Sub-hooks: smaller pictures under "Sub-hooks, flowing in through tunnels", saying where their result flows.

## Sequences
- "The next page", "the previous page", "the pages after it", "the pages before it": drawn in order, captioned.
- Example: converted on this page + exactly 3 pages after it = a yellow frame followed by 3 dashed plates.

## Contradictions
- If the description can't match anything, the preview says so.

## Do NOT claim
- Editing the hook by dragging the preview (that is v3, not built).
- That the preview shows real visitors or real numbers.
