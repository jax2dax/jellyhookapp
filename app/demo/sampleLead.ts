// app/demo/sampleLead.ts
//
// Everything on /demo is this one made-up lead. Nothing here is real customer data, and the page says so.
// Same shape the real lead page feeds the visit chart (SessionRaw), so /demo renders the real chart component.
//
// A FUNCTION, not a constant: times are anchored to "now" when the page loads, so durations stay small and
// sensible however long the deploy has been live (same reason as app/docs/concepts/session-replay/exampleSession.ts).
import type { SessionRaw } from "@/framePlate";

const SEC = 1000;
const MIN = 60 * SEC;

export const SAMPLE_LEAD = {
  name: "Sam Rivera",
  email: "sam@example.com",
  company: "Example Co (made up)",
  /** facts from the form, as the lead page would show them under "Submitted form details" */
  details: [
    { key: "Team size", value: "11–50" },
    { key: "What are you hoping to improve?", value: "See why demo requests drop off" },
  ],
};

/** Seconds spent in each form field, in the order the (made-up) visitor filled them in. */
export const SAMPLE_FIELD_TIMINGS = [
  { label: "Work email", seconds: 4 },
  { label: "Company", seconds: 6 },
  { label: "Team size", seconds: 19 },
  { label: "What are you hoping to improve?", seconds: 41 },
  { label: "Phone (optional)", seconds: 3 },
];

export function buildSampleSession(): SessionRaw {
  // ends "now" so nothing looks stale; the whole visit spans about 36 minutes
  const start = Date.now() - 36 * MIN;
  const at = (ms: number) => new Date(start + ms).toISOString();

  const v1In = 0;
  const v1Out = 100 * SEC;
  const v2In = v1Out;
  const v2Out = v2In + 180 * SEC;
  const v3In = v2Out;
  const v3Out = v3In + 260 * SEC;
  // 26 minutes away from the site, then back
  const v4In = v3Out + 26 * MIN;
  const v4Out = v4In + 160 * SEC;

  return {
    id: "sample-session",
    visitorId: "sample-visitor",
    startedAt: at(0),
    endedAt: at(v4Out),
    visits: [
      {
        id: "s1",
        pagePath: "/",
        enteredAt: at(v1In),
        leftAt: at(v1Out),
        pageHeightPx: 3000,
        viewportHeightPx: 900,
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 30 * SEC, y: 0.5 },
          { t: 70 * SEC, y: 0.7 },
        ],
        headers: [
          { text: "Headline", y: 0.04 },
          { text: "Who it is for", y: 0.4 },
        ],
      },
      {
        id: "s2",
        pagePath: "/features",
        enteredAt: at(v2In),
        leftAt: at(v2Out),
        pageHeightPx: 4200,
        viewportHeightPx: 900,
        // stops about halfway: the lower headings are never reached
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 60 * SEC, y: 0.45 },
          { t: 150 * SEC, y: 0.55 },
        ],
        headers: [
          { text: "What you see per lead", y: 0.1 },
          { text: "Works with your forms", y: 0.38 },
          { text: "Integrations", y: 0.8 },
        ],
      },
      {
        id: "s3",
        pagePath: "/pricing",
        enteredAt: at(v3In),
        leftAt: at(v3Out),
        pageHeightPx: 2600,
        viewportHeightPx: 900,
        // reads down to the FAQ, scrolls back up to the plans, then down again: a "seen twice" band
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 70 * SEC, y: 0.9 },
          { t: 140 * SEC, y: 0.35 },
          { t: 200 * SEC, y: 0.9 },
        ],
        headers: [
          { text: "Plans", y: 0.08 },
          { text: "Compare plans", y: 0.4 },
          { text: "FAQ", y: 0.85 },
        ],
      },
      {
        id: "s4",
        pagePath: "/demo-request",
        enteredAt: at(v4In),
        leftAt: at(v4Out),
        pageHeightPx: 1900,
        viewportHeightPx: 900,
        scrollTrace: [
          { t: 0, y: 0 },
          { t: 20 * SEC, y: 0.6 },
          { t: 100 * SEC, y: 0.75 },
        ],
        headers: [{ text: "Book a demo", y: 0.05 }],
        converted: true,
        formTopY: 700,
        formBottomY: 1500,
        formStatus: "submitted",
        formFieldCount: 5,
      },
    ],
  };
}
