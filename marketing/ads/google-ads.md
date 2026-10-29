# Google Ads: the setup, and what to do next (2026-10-28)

## The campaign (as set up by the founder)
- Search only (Search partners and Display Network off). US first (add UK, CA, AU if wanted).
- Final URL: https://jellyhook.com/ (the hero has "See the demo" next to the main button).
- Bidding: Clicks, max CPC $2.50. Budget: $20/day. Google's estimate: about $2.46 a click, about 58 clicks a week, about $143 a week.
- Keywords (phrase match): "form abandonment tracking", "track form drop off", "see which pages leads visited",
  "lead behavior tracking", "website visitor journey", "which pages do leads read", "form field analytics".
- 15 headlines, 4 descriptions, 4 sitelinks (/demo, /#journey, /pricing, /docs/installation), 5 callouts, display path
  jellyhook.com/leads/tracking.
- Google tag: the existing Analytics tag G-055K1J7VB9 (app/layout.tsx) is reused.

## Next
1. Negative keywords (Campaigns > Keywords > Negative keywords): free download, jobs, course, template, plugin, crm.
2. Conversion: Goals > Conversions > New conversion action > Website. Category Sign-up; page load where the URL contains
   /platform/create-site (every new account lands there); no value; count One; 30-day window.
3. Days 2-3: Keywords > Search terms; add negatives for anything irrelevant.
4. Wed 2026-11-04: decide with the numbers (3+ sign-ups: keep; clicks and no sign-ups: fix the page or offer; few
   clicks: raise the max CPC, not the budget).

## How to stop spending
- Pause: ads.google.com > Campaigns > the toggle (green dot) next to the campaign > Paused. Stops within minutes,
  nothing is lost, switch it back on any time.
- Remove for good: tick the campaign > Edit > Remove.
- Phone: the Google Ads app, the campaign, the same toggle.
- Billing: you pay only for clicks; you are charged when spend reaches the billing threshold or every 30 days.
  Billing > Summary shows the total so far.
