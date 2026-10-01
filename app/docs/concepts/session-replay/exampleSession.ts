// app/docs/concepts/session-replay/exampleSession.ts
//
// A hand-built SessionRaw fixture, not the random generator in
// framePlate/fakeData/ — this is deliberately curated so every visit
// demonstrates one specific thing this doc page explains, by page path,
// rather than whatever a random seed happens to produce. Page paths are
// unique in this fixture on purpose, so the prose can point at "/pricing"
// or "/contact" and mean exactly one frame.
//
// buildExampleSession() is a FUNCTION, not a static export, and must stay
// one. An earlier version anchored this to a hardcoded absolute date
// (2026-01-15). Every day that passed after that date made the "still
// open" v4 visit's duration grow by another day, since its entered_at was
// fixed in the past while its leftAt/isOpen fall through to real "now" at
// render time — this docs example ended up demonstrating the exact
// runaway-duration bug it exists to teach. Calling this fresh, anchored to
// Date.now() every time, keeps every duration small and sensible no
// matter how long the docs page itself has been live.
import type { SessionRaw } from "@/framePlate";

const MIN = 60_000;

export function buildExampleSession(): SessionRaw {
  const start = Date.now() - 52 * MIN; // whole example spans ~52 minutes, ending "now"

  return {
    id: "example-session",
    visitorId: "example-visitor",
    startedAt: new Date(start).toISOString(),
    endedAt: null, // still open — this is what draws the green border around the whole chart
    visits: [
      {
        // Normal visit. Scrolls down, back up past an earlier point, then
        // down again — this is what produces the darker "seen twice" band.
        id: "v1",
        pagePath: "/",
        enteredAt: new Date(start).toISOString(),
        leftAt: new Date(start + 3 * MIN).toISOString(),
        pageHeightPx: 3200,
        viewportHeightPx: 900,
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 40_000, y: 0.55 },
          { t: 80_000, y: 0.7 },
          { t: 120_000, y: 0.25 },
          { t: 160_000, y: 0.85 },
          { t: 180_000, y: 0.6 },
        ],
        headers: [
          { text: "Headline", y: 0.03 },
          { text: "How it works", y: 0.35 },
          { text: "Pricing preview", y: 0.72 },
        ],
      },
      // Gap: 40 minutes away from the site before the next page view starts.
      // buildTimeline turns any gap longer than 15s between two visits into
      // its own purple "away" frame automatically, no extra data needed here.
      {
        // A form on this page was started, never submitted. Orange frame.
        // The form imitation still shows — it was SEEN (50% visible, which
        // needs no interaction at all), it just never got submitted, so it
        // renders in the ordinary (not bright) yellow. Two fields were
        // focused before they left, so it shows two stripes.
        id: "v2",
        pagePath: "/pricing",
        enteredAt: new Date(start + 3 * MIN + 40 * MIN).toISOString(),
        leftAt: new Date(start + 3 * MIN + 40 * MIN + 4 * MIN).toISOString(),
        pageHeightPx: 2400,
        viewportHeightPx: 900,
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 100_000, y: 0.6 },
          { t: 240_000, y: 0.65 },
        ],
        headers: [{ text: "Plans", y: 0.1 }],
        abandonedForm: true,
        formTopY: 1200,
        formBottomY: 1500,
        formStatus: "started",
        formFieldCount: 2,
      },
      {
        // The form here was actually submitted. Yellow frame, and the form
        // imitation box renders in the brighter submitted color (formStatus),
        // stretched to the form's real measured span (formTopY/formBottomY —
        // the same way form_engagement.form_top_y/form_bottom_y work for a
        // real visit) with four stripes, one per field that was focused
        // (formFieldCount) before they submitted.
        id: "v3",
        pagePath: "/contact",
        enteredAt: new Date(start + 3 * MIN + 40 * MIN + 4 * MIN).toISOString(),
        leftAt: new Date(start + 3 * MIN + 40 * MIN + 4 * MIN + 5 * MIN).toISOString(),
        pageHeightPx: 2000,
        viewportHeightPx: 900,
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 60_000, y: 0.4 },
          { t: 300_000, y: 0.75 },
        ],
        headers: [{ text: "Talk to us", y: 0.05 }],
        converted: true,
        formTopY: 1400,
        formBottomY: 1800,
        formStatus: "submitted",
        formFieldCount: 4,
      },
      {
        // Still open right now — this is the blue frame. Different signal
        // from the session-wide green border: the session can stay open
        // after a visitor leaves THIS specific page, so this only shows up
        // on whichever page view has no left_at yet, never inferred from
        // the session as a whole. entered_at is exactly 2 minutes before
        // "now" (see `start`'s 52-minute span above), so this always reads
        // as a short, sensible, currently-open visit.
        id: "v4",
        pagePath: "/deals",
        enteredAt: new Date(start + 3 * MIN + 40 * MIN + 4 * MIN + 5 * MIN).toISOString(),
        leftAt: new Date().toISOString(), // still "now" — isOpen below is what actually makes it blue
        pageHeightPx: 1800,
        viewportHeightPx: 900,
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 30_000, y: 0.3 },
        ],
        isOpen: true,
      },
    ],
  };
}
