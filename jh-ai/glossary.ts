// jh-ai/glossary.ts
// How people SAY things, mapped to what Hook calls them. This is what lets "the page was seen at least 3%
// and the converted session has at least 3 pages" become the right fields. It is part of the static,
// cached prompt, so it costs almost nothing per question. Every entry's `refs` are checked against the
// schema by a test, so a renamed field fails the build instead of silently misleading the model.
// Add a line whenever a real question got mapped wrong: that is the cheapest way to improve accuracy.

export interface GlossaryEntry {
  /** Phrases people use. */
  say: string[];
  /** What to do with them, in Hook's words. */
  means: string;
  /** "entity.field" references, verified against the schema. */
  refs: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  { say: ["page seen", "how much of the page was seen", "saw X% of the page", "read X% of the page"], means: "pageView.seenPct (percent 0-100, plain number: 3% is 3)", refs: ["pageView.seenPct"] },
  { say: ["scrolled back", "went back up", "re-read"], means: "pageView.revisited (bool), or pageView.seenTwicePct for how much was seen twice", refs: ["pageView.revisited", "pageView.seenTwicePct"] },
  { say: ["never saw", "didn't see", "missed"], means: "pageView.notSeenPct", refs: ["pageView.notSeenPct"] },
  { say: ["scrolled to", "went X% down", "how far they scrolled", "reached"], means: "pageView.deepestPct (furthest point, % down the page)", refs: ["pageView.deepestPct"] },
  { say: ["stayed", "spent X on the page", "time on page", "read for real", "engaged"], means: "pageView.visitDuration (the 'time on page' the visit chart shows). 'Read for real' with no number means more than 5 sec.", refs: ["pageView.visitDuration"] },
  { say: ["bounced", "left straight away", "single page visit"], means: "session whose page views count is 1 (related pageViews, measure count, op =, value 1)", refs: ["session.pageViews"] },
  { say: ["converted", "became a lead", "submitted the form", "filled the form"], means: "session.converted isTrue (for sessions), pageView.inConvertedSession isTrue (for page views), or entity lead (the submissions themselves)", refs: ["session.converted", "pageView.inConvertedSession"] },
  { say: ["did not convert", "didn't convert", "never converted"], means: "session.converted isFalse", refs: ["session.converted"] },
  { say: ["the conversion session", "session that converted", "converted session"], means: "session.converted isTrue; or, from a lead or page view, relation session whose where has converted isTrue", refs: ["session.converted"] },
  { say: ["contains at least N pages", "visited N pages", "N page views", "viewed N pages"], means: "session related pageViews with measure {agg:count}, op >=, value N", refs: ["session.pageViews"] },
  { say: ["different pages", "distinct pages", "unique pages"], means: "session related pageViews with measure {agg:countDistinct, field:page}", refs: ["pageView.page"] },
  { say: ["landed on", "entered through", "came in on", "first page"], means: "session.landingPage (or pageView.isLanding isTrue, pageView.position = 1)", refs: ["session.landingPage", "pageView.isLanding", "pageView.position"] },
  { say: ["left from", "exited on", "last page"], means: "session.exitPage (or pageView.isExit isTrue)", refs: ["session.exitPage", "pageView.isExit"] },
  { say: ["from google", "from facebook", "from a campaign", "ad traffic", "paid"], means: "session.utmSource (text) / utmMedium / utmCampaign. 'Paid' is utmMedium in cpc,ppc,paid_social. Referrer is a separate raw text field.", refs: ["session.utmSource", "session.utmMedium", "session.utmCampaign", "session.referrer"] },
  { say: ["from <country>"], means: "session.country, as the English country name (United States, Germany)", refs: ["session.country"] },
  { say: ["on mobile", "on phone", "on desktop"], means: "visitor.device = mobile|desktop. From a session or page view use the related visitor (relation visitor, where device = ...)", refs: ["visitor.device", "session.visitor"] },
  { say: ["returning visitors", "came back", "repeat"], means: "entity visitor with related sessions, measure count, op >=, value 2", refs: ["visitor.sessions"] },
  { say: ["leads", "submissions", "enquiries", "contacts"], means: "entity lead. 'Qualified' is lead.qualified isTrue. Their name/email/phone are text fields.", refs: ["lead.qualified", "lead.name", "lead.email"] },
  { say: ["abandoned the form", "gave up on the form", "started but didn't finish"], means: "entity form with status = abandoned (or started)", refs: ["form.status"] },
  { say: ["where people give up", "which field", "the field they stopped on"], means: "entity formField, isLastTouched isTrue and formStatus = abandoned, usually a groupBy on name", refs: ["formField.isLastTouched", "formField.formStatus", "formField.name"] },
  { say: ["slowest field", "takes longest"], means: "entity formField, groupBy name with measure avg focusedTime", refs: ["formField.focusedTime"] },
  { say: ["clicked but didn't type"], means: "entity formField, typed isFalse", refs: ["formField.typed"] },
  { say: ["away", "left and came back", "stepped away"], means: "entity awayGap (duration = time away), or session related awayGaps", refs: ["awayGap.duration", "session.awayGaps"] },
  { say: ["session length", "how long the visit lasted"], means: "session.duration", refs: ["session.duration"] },
  { say: ["how many", "number of", "count"], means: "output {kind:count}. 'How many different X' is countDistinct on field X. Use count ONLY when the person asks how many / the number of.", refs: [] },
  { say: ["sessions that...", "visitors who...", "leads who...", "show me", "give me", "list"], means: "A question that names rows without asking how many ('sessions that bounced', 'visitors using Chrome', 'show me the leads') wants the rows themselves: output {kind:ids}. The entity is the thing named ('sessions with...' = entity session, even if the condition is about page views: use a related condition).", refs: [] },
  { say: ["which pages", "which sources", "which campaigns", "which countries", "bring the most", "most views", "where do sessions end", "where do people leave", "which field"], means: "A ranking: output groupBy on that field with measure count, sort valueDesc (campaigns/sources bring leads = sessions where converted isTrue, grouped by utmSource). Plain 'which values exist' with no ranking is {kind:values, field}.", refs: ["session.utmSource", "session.exitPage"] },
  { say: ["never", "did not", "didn't", "without", "no ... at all", "haven't"], means: "NEGATION IS A NOT GROUP. 'sessions that never visited pricing' = group mode and, not true, containing the related pageViews where page = /pricing. Never drop the 'never'. For a simple field use the opposite operator (isFalse, !=, isEmpty).", refs: [] },
  { say: ["using Chrome", "on Safari", "on Windows", "browser", "operating system"], means: "browser and os values include versions, so use op contains (not =).", refs: ["visitor.browser", "visitor.os"] },
  { say: ["per day", "by day", "each week", "over time", "trend"], means: "output groupBy on a time field with bucket day|week|month|hour (page views: enteredAt, sessions: startedAt, leads: submittedAt)", refs: ["pageView.enteredAt", "session.startedAt", "lead.submittedAt"] },
  { say: ["top N", "most", "biggest", "best"], means: "groupBy with sort valueDesc and limit N", refs: [] },
  { say: ["average", "typical", "median", "total"], means: "output {kind:aggregate, agg: avg|median|sum, field}", refs: [] },
  { say: ["last week", "last 7 days", "this week"], means: "A time field > {ago:7, unit:day}. 'Last month' = {ago:1, unit:month}. Calendar-exact ranges ('September') use ISO dates.", refs: [] },
  { say: ["between <date> and <date>"], means: "time field op between, value ISO date, value2 ISO date (UTC). Dates are inclusive of the day.", refs: [] },
  { say: ["the pricing page", "the homepage", "the blog"], means: "Use the real path from the SITE PAGES list ('/pricing'). Homepage is '/'. 'The blog' means paths that start with the blog prefix: use contains or startsWith.", refs: ["pageView.page"] },
  { say: ["before", "after", "then"], means: "Order of pages in a visit: use relation pagesBefore / pagesAfter / nextPage / previousPage on a page view, not time fields", refs: ["pageView.pagesBefore", "pageView.pagesAfter", "pageView.nextPage"] },
  { say: ["compare to last month", "vs last week", "growth"], means: "NOT expressible as one hook (needs two). Answer status unsupported and say to use Compare with another hook, or ask for each period separately.", refs: [] },
];

export function renderGlossary(): string {
  return GLOSSARY.map((g) => `- ${g.say.map((s) => `"${s}"`).join(", ")} -> ${g.means}`).join("\n");
}
