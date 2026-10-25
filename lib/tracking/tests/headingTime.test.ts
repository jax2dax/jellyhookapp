/* eslint-disable @typescript-eslint/no-explicit-any -- test fixtures */
// lib/tracking/tests/headingTime.test.ts - time per heading (lib/tracking/headingTime.js, mds/build/heading-time/plan.md).
// Run: npm run test:tracking
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { keyOfText, cleanHeadingTime, readHeadingTime, sectionsOf, layoutSections, headingTimeExtras } from "../headingTime.js";
import { sectionTimeStory, sectionSentences, pageStorySentences } from "../../leadSessions/story";
import { splitStory } from "../../leadSessions/storyParts";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

// the tracker's own keyOfText, taken from public/tracker.js, must give the same key as the server's
const src = readFileSync(join(process.cwd(), "public/tracker.js"), "utf8");
const body = src.match(/function keyOfText\(text\) \{([\s\S]*?)\n    \}/);
ok(!!body, "found keyOfText in the tracker");
const trackerKey = new Function("text", body ? body[1] : "return ''") as (t: string) => string;
const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120); // what the tracker does before hashing
for (const t of ["Pricing", "  Hi, I'm   Beny Shelman ", "Ünïcödé — ok", "x".repeat(300)]) {
  ok(trackerKey(norm(t)) === keyOfText(t), "same key in the tracker and on the server: " + t.slice(0, 20));
}

// cleaning what the tracker sent
const raw = { t: 1, h: [["^", 0, -1, 30, 1], [keyOfText("Hero"), 1, 0, 0, 1], [keyOfText("Why us"), 2, 1, 50, 2], [keyOfText("Pricing"), 1, 2, 120, 2], [keyOfText("Plans"), 2, 3, 40, 1], ["BAD KEY", 1, 4, 10, 1], [keyOfText("Pricing"), 1, 2, 999, 1], [keyOfText("FAQ"), 2, 5, 0, 1]] };
const clean = cleanHeadingTime(raw, 30_000)!;
ok(!!clean && clean.h.length === 5, "bad keys, repeats and a zero-time sub-heading are dropped (" + clean?.h.length + " kept)");
ok(clean.h.some((e) => e[3] === 0 && e[1] === 1), "a section heading with no time of its own is kept (for grouping)");
ok(cleanHeadingTime({ t: 1, h: [["abc", 1, 0, 99999, 1]] }, 2000)!.h[0][3] === 40, "no heading gets more time than the page view had");
ok(cleanHeadingTime({ t: 1, h: [["abc", 1, 0, 0, 1]] }, 2000) === null, "nothing but zeros: nothing stored");
ok(cleanHeadingTime("junk", 1000) === null && cleanHeadingTime({ h: "x" }, 1000) === null, "junk is ignored");
ok(JSON.stringify(clean).length < 200, "small: " + JSON.stringify(clean).length + " bytes for 5 headings");

// reading it back with the page's headings, and grouping into sections
const structure = ["Hero", "Why us", "Pricing", "Plans", "FAQ"].map((t, i) => ({ header_index: i, header_text: t, header_tag: i % 2 ? "h2" : "h1" }));
const read = readHeadingTime(clean, structure)!;
ok(read.items.find((x) => x.key === keyOfText("Pricing"))?.text === "Pricing", "headings are named from the page's structure");
const sections = sectionsOf(read);
ok(sections.length === 3, "3 sections: top of page, Hero, Pricing (" + sections.map((s) => s.text ?? "top").join(", ") + ")");
const hero = sections.find((s) => s.text === "Hero")!;
const pricing = sections.find((s) => s.text === "Pricing")!;
ok(hero.ms === 5000 && hero.subs[0].text === "Why us", "Hero's time is its sub-heading's (5 s under \"Why us\")");
ok(pricing.ms === 16000 && pricing.subs.length === 1, "Pricing = 12 s own + 4 s on \"Plans\"");
ok(readHeadingTime(clean, [])!.items.every((x) => x.text === null), "a page that changed since: no names, times kept");

// placing sections on the page (the plate): page 3000 px, intro above the first heading
const placedRows = [["Hero", "h1", 300], ["Why us", "h2", 700], ["Pricing", "h1", 1300], ["Plans", "h2", 1700], ["FAQ", "h2", 2200], ["Contact", "h1", 2600]].map(([t, tag, y], i) => ({ header_index: i, header_text: t, header_tag: tag, position_y: y, page_height: 3000 }));
const lay = layoutSections({ t: 1, h: [["^", 0, -1, 30, 1], [keyOfText("Hero"), 1, 0, 0, 1], [keyOfText("Why us"), 2, 1, 50, 2], [keyOfText("Pricing"), 1, 2, 120, 2], [keyOfText("Plans"), 2, 3, 40, 1], [keyOfText("Gone"), 2, 9, 70, 1]] }, placedRows)!;
ok(lay.sections.map((x) => x.text ?? "top").join(",") === "top,Hero,Pricing,Contact", "sections tile the page: top, Hero, Pricing, Contact (a section never reached is still there)");
const near = (a: number, b: number) => Math.abs(a - b) < 0.001;
ok(near(lay.sections[0].y0, 0) && near(lay.sections[0].y1, 0.1) && near(lay.sections[1].y0, 0.1) && near(lay.sections[1].y1, 1300 / 3000) && near(lay.sections[3].y1, 1), "bands run from one section heading to the next (the last to the page end)");
ok(lay.sections.every((x, i) => i === 0 || near(x.y0, lay.sections[i - 1].y1)), "no gaps and no overlaps between sections");
ok(lay.sections[0].ms === 3000 && lay.sections[1].ms === 5000 && lay.sections[2].ms === 16000 && lay.sections[3].ms === 0, "times: top 3 s, Hero 5 s (all in Why us), Pricing 16 s, Contact none");
ok(lay.sections[1].subs.length === 1 && near(lay.sections[1].subs[0].y0, 700 / 3000) && near(lay.sections[1].subs[0].y1, 1300 / 3000), "a sub-heading runs to the next section heading");
ok(lay.sections[2].subs.length === 2 && near(lay.sections[2].subs[0].y1, 2200 / 3000), "Pricing has Plans and FAQ; Plans ends where FAQ starts");
ok(lay.unplacedMs === 7000, "time on a heading the page no longer has is set aside, not drawn (7 s)");
ok(layoutSections({ t: 1, h: [] }, []) === null && layoutSections({ t: 1, h: [] }, [{ header_text: "x", position_y: 5, page_height: 0 }]) === null, "no usable headings: null (the caller uses the plain section list)");
const noTop = layoutSections({ t: 1, h: [[keyOfText("Hero"), 1, 0, 10, 1]] }, [{ header_index: 0, header_text: "Hero", header_tag: "h1", position_y: 0, page_height: 1000 }])!;
ok(noTop.sections.length === 1 && noTop.sections[0].text === "Hero", "a first heading at the very top leaves no empty top band");

// two main headings on the same row (side-by-side columns)
const colRows = [["Intro", "h1", 100], ["Left", "h1", 1000], ["Right", "h1", 1010], ["Details", "h2", 1300], ["After", "h1", 2000]].map(([t, tag, y], i) => ({ header_index: i, header_text: t, header_tag: tag, position_y: y, page_height: 3000 }));
const cl = layoutSections({ t: 1, h: [[keyOfText("Left"), 1, 1, 50, 1], [keyOfText("Right"), 1, 2, 30, 1]] }, colRows)!;
const row = cl.sections.filter((x) => x.text === "Left" || x.text === "Right");
ok(row.length === 2 && row[0].cols === 2 && row[1].cols === 2 && row[0].col === 0 && row[1].col === 1, "two main headings on one row are columns 0 and 1 of 2");
ok(near(row[0].y0, row[1].y0) && near(row[0].y1, row[1].y1) && near(row[0].y1, 2000 / 3000), "they share one band, down to the next row");
ok(cl.sections.find((x) => x.text === "Intro")!.cols === 1, "a heading alone on its row is one column");
ok(cl.sections.every((x) => x.y1 > x.y0), "no band has zero height");

// two headings with the same text
const dup = readHeadingTime({ t: 2, h: [[keyOfText("Learn more") + "#2", 2, 3, 20, 1]] }, [{ header_index: 0, header_text: "Learn more" }, { header_index: 1, header_text: "Learn more" }])!;
ok(dup.items[0].text === "Learn more", "the second \"Learn more\" is found by its #2 key");

// the story
const story = sectionTimeStory(sections);
console.log("  story:", story);
ok(story === 'Spent 16s in total on the "Pricing" section. Spent 5s in total on the "Hero" section.', "one sentence per main section, biggest first; \"in total\" when it has smaller headings; no top of page");
const sents = sectionSentences(sections);
ok(sents[0].more === '4s on "Plans"', "the smaller headings are the detail a sentence opens");

// skimming, a glance at the page, one heading taking most of the time
const sec = (text: string, ms: number, subs: [string, number][] = []) => ({ text, ms, entries: 1, isTop: false, subs: subs.map(([t, m]) => ({ text: t, ms: m, entries: 1 })) });
const sk = sectionSentences([sec("Hi", 10_000, [["What we do", 2000], ["How are you", 8000]]), sec("FAQ", 1200), sec("Contact", 2000)]);
ok(sk[0].more === '8s on "How are you", skimmed "What we do" (2s)', "a smaller heading under 2.5 s is \"skimmed\": " + sk[0].more);
ok(sk[sk.length - 1].text === 'Skimmed through "FAQ" (1s) and "Contact" (2s).', "main sections under 2.5 s are said together as skimmed: " + sk[sk.length - 1].text);
const visit = (durationMs: number, sections: unknown, extra: object = {}) =>
  ({ kind: "visit", id: "v", pagePath: "/blogs", durationMs, pageHeightPx: 3000, seenOnceTop: 0.6, seenTwiceTop: null, maxScrollY: 0.7, seenBottom: 0.95, viewportFraction: 0.25, viewportEstimated: false, enterY: 0, exitY: 0.7, converted: false, outcome: "exitedNormally", headers: [{ text: "Performance", y: 0.7 }, { text: "Conclusion", y: 0.9 }, { text: "Intro", y: 0.1 }], sections, ...extra }) as any;
const brief = pageStorySentences(visit(2400, null)).map((x) => x.text);
ok(brief[0] === "Spent only 2s on the /blogs page and left almost immediately." && brief[1] === '"Performance" and "Conclusion" were on screen.' && brief.length === 3, "under 3 s: left almost immediately, what was on screen, nothing about reading: " + brief.join(" | "));
const dom = pageStorySentences(visit(100_000, [sec("Hi I am Matt", 100_000, [["Learn with me", 82_000]])])).map((x) => x.text);
ok(dom[1] === 'Spent most of their time on the "Learn with me" part (1m 22s).', "one heading with 80% of a page view over 10 s is the headline: " + dom[1]);
const noDom = pageStorySentences(visit(8000, [sec("Hi", 8000, [["Learn", 7000]])])).map((x) => x.text);
ok(!noDom.some((t) => t.startsWith("Spent most of their time")), "not for a page view of 10 s or less");

ok(sectionTimeStory([]) === "" && sectionTimeStory(null) === "", "no data: no sentence");
ok(splitStory(story).some((p) => p.kind === "heading" && p.text === '"Pricing"'), "headings are highlighted in the story");

// ── "~" passing through (trackers from 2026-10-24): kept, never a heading, counted so the page adds up ──
{
  const k1 = keyOfText("Hero");
  const clean = cleanHeadingTime({ t: 1, h: [[k1, 1, 0, 40, 1], ["~", 0, -2, 15, 0], ["^", 0, -1, 5, 1]] }, 6000);
  ok(!!clean && clean.h.some((e) => e[0] === "~" && e[2] === -2 && e[3] === 15), "passing through is accepted and stored");
  const read = readHeadingTime(clean, [{ header_text: "Hero", header_tag: "h1", header_index: 0, position_y: 0, page_height: 1000 }]);
  ok(!!read && !read.items.some((it) => it.key === "~"), "passing through is not listed as a heading");
  const rows = [{ header_text: "Hero", header_tag: "h1", header_index: 0, position_y: 100, page_height: 1000 }];
  const ex = headingTimeExtras(clean, rows);
  ok(!!ex && ex.passingMs === 1500 && ex.unplacedMs === 0, "extras: passing 1.5 s, nothing unplaced");
  const unknown = cleanHeadingTime({ t: 1, h: [[k1, 1, 0, 40, 1], [keyOfText("Transmission Successful"), 1, 5, 30, 1]] }, 7000);
  ok(headingTimeExtras(unknown, rows)?.unplacedMs === 3000, "time on a heading missing from the stored headings is reported, not dropped");
  const placed = layoutSections(clean, rows);
  const total = (placed?.sections ?? []).reduce((n, x) => n + x.ms, 0) + (placed?.passingMs ?? 0) + (placed?.unplacedMs ?? 0);
  ok(total === 6000, "sections + passing + unplaced = everything the tracker sent (" + total + " ms)");
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
