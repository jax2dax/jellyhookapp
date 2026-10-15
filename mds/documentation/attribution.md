# Attribution and source names - developer reference

Added 2026-10-14. Public pages: `/docs/concepts/referrers-attribution` (the mechanism, with examples) and `/docs/reference/conversions` (the Leads Origin chart, what you see).

## One visit, one source (`lib/analytics/classifyReferrer.js`)
1. `utm_source` when present, normalized by `normalizeSource` (lower case, trim, drop `www.` and a trailing `.com`, then the alias table: fb/facebook/meta -> Facebook, li/linkedin/lnkd -> LinkedIn, x/twitter/t.co -> Twitter/X, ig -> Instagram, yt -> YouTube, tt -> TikTok, adwords/google ads -> Google, ...). Unknown names are title-cased.
2. Otherwise the referrer's host, through `KNOWN_DOMAINS` (same labels as the alias table, so tagged and untagged visits of one platform match).
3. Otherwise `Direct`.
Used by every source chart: referrer donut, leads origin, visits over time by source.

## Which visit gets the credit (`lib/analytics/attribution.js`, `lib/actions/leadOriginBreakdown.action.ts`)
| Model | Leads | Visitors (the blue shape) |
|---|---|---|
| `first` (default, `?origin=first` or no param) | the visitor's first session | `visitors.first_utm_source` / `first_referrer` (recorded since 2026-10-07; older visitors without `first_touch_at` are left out) |
| `lastNonDirect` (`?origin=last`) | the last non-Direct session that STARTED at or before the visitor's first submission; Direct only if all of them were Direct | the last non-Direct session overall, from the site's most recent 50,000 sessions |

The chart shows leads as counts, or, with "Show where all unique visitors came from" on (default), both shapes as shares of their own totals. Spokes: lead sources first, then the biggest visitor-only sources, then placeholders.

Note: `lastNonDirectLabel` lives in `lib/analytics/attribution.js` because a `"use server"` file may only export async functions.

## Tests
`lib/tracking/tests/attribution.test.ts` (7): name merging, and the three founder scenarios (fb then direct; fb then Google; direct then fb) under both models. Runs in `npm run test:forms`.

## Not done
- `utm_content` / `utm_term` are not recorded by the tracker, so the radar cannot split by subreddit, group, ad or keyword yet (see the demo at `/dev/utm-demo`).
- The referrer donut and visits-over-time still use the first visit only.
