// lib/leadSessions/storyParts.ts
// Splits a story (lib/leadSessions/story.ts) into plain text, pages (/pricing, "/" for the home page) and dates or
// times (Oct 12, 8m 24s, 1h 54m, 6 days), so the page can highlight them (components/leads/StoryText.tsx). Pure.
const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const PAGE = "(?<![\\w/.])/(?:[A-Za-z0-9_\\-/]+(?:\\.[A-Za-z0-9]+)*)?(?=[\\s,;:.)\"]|$)";
const DATE = `(?:${MONTHS}) \\d{1,2}`;
const TIME = "\\d+h \\d+m|\\d+m(?: \\d+s)?|\\d+s";
const DAYS = "\\d+ days?"; // a span of days is a date-like thing: it takes the date colour
// the home page "/" is only a page when it stands alone: a "/" glued to words (1/2, and/or) is not
// a heading is quoted in the story ("Pricing"); matched first, so a time or a page inside a heading stays part of it
const QUOTE = '"[^"\\n]{1,80}"';
const RE = new RegExp(`(${QUOTE})|(${PAGE})|(${DATE})|(?<![\\w])(${DAYS})(?![\\w])|(?<![\\w])(${TIME})(?![\\w])`, "g");

export type StoryPart = { text: string; kind: "page" | "when" | "date" | "heading" | null };

export function splitStory(text: string): StoryPart[] {
  const out: StoryPart[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), kind: null });
    out.push({ text: m[0], kind: m[1] !== undefined ? "heading" : m[2] !== undefined ? "page" : m[3] !== undefined || m[4] !== undefined ? "date" : "when" });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: null });
  return out;
}
