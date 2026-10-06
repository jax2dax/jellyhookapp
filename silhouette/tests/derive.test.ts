// silhouette/tests/derive.test.ts
// The drawing rules (silhouette/rules.md), pinned down. Pure: no database,
// no browser. Run: npm run test:silhouette
import { deriveSilhouette } from "../derive";
import type { PageFigure, SessionFigure, VisitItem } from "../types";
import type { Condition, HookSpec, Output } from "../../jh-hook/types";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) {
    passes++;
    console.log("ok:", m);
  } else {
    fails++;
    console.log("FAIL:", m);
  }
};
const H = (entity: HookSpec["entity"], where: Condition[], output: Output = { kind: "count" }): HookSpec => ({ v: 3, entity, where, output });
const sessions = (s: HookSpec) => deriveSilhouette(s).figures.filter((f): f is SessionFigure => f.kind === "session");
const visits = (f: SessionFigure) => f.items.filter((i): i is VisitItem => i.kind === "visit");
const cert = (f: SessionFigure) => visits(f).map((v) => v.certainty[0]).join("");

// 1. a session with nothing described: one page for sure, maybe more
let f = sessions(H("session", []))[0];
ok(!!f && cert(f) === "rm", "an undescribed session draws one page and a 'more' stub");

// 2. converted -> a yellow visit appears
f = sessions(H("session", [{ id: "cv", kind: "field", field: "converted", op: "isTrue" }]))[0];
ok(visits(f).some((v) => v.frame.outcome === "converted" && v.plate.bulbs.converted), "converted = true draws a yellow (converted) visit");
ok(visits(f).find((v) => v.frame.outcome === "converted")!.source[0].conditionPath.join(">") === "cv", "the yellow visit points back to the converted condition");

// 3-5. page counts and ranges
f = sessions(H("session", [{ id: "n", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: "=", value: 4 }]))[0];
ok(cert(f) === "rrrr" && f.pagesLabel === "4 pages", "exactly 4 pages: 4 dashed plates, labelled");
f = sessions(H("session", [{ id: "n", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: "between", value: 2, value2: 5 }]))[0];
ok(cert(f) === "rrmmm" && f.pagesLabel === "2 to 5 pages", "between 2 and 5 pages: 2 solid + 3 'maybe'");
f = sessions(H("session", [{ id: "n", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: ">=", value: 3 }]))[0];
ok(cert(f) === "rrrm", "at least 3 pages: 3 + a '+' stub");
f = sessions(H("session", [{ id: "n", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: "<", value: 4 }]))[0];
ok(cert(f) === "rmm" && f.pagesLabel === "1 to 3 pages", "fewer than 4 pages: 1 solid (a session always has one) + 2 'maybe', labelled 1 to 3");

// 6. OR -> one silhouette per alternative
const or = sessions(H("session", [{ id: "g", kind: "group", mode: "or", where: [
  { id: "a", kind: "field", field: "converted", op: "isTrue" },
  { id: "b", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: "=", value: 2 },
] }]));
ok(or.length === 2 && /option 1 of 2/.test(or[0].title) && /option 2 of 2/.test(or[1].title), "an OR of two session descriptions draws two silhouettes");

// 7. NOT -> a red-hatched silhouette
const not = sessions(H("session", [{ id: "n", kind: "group", mode: "and", not: true, where: [{ id: "x", kind: "field", field: "converted", op: "isTrue" }] }]));
ok(not.some((s) => s.excluded) && not.some((s) => !s.excluded), "a NOT group draws an extra silhouette marked as excluded");

// 8. a page-view result with page-only conditions: just the page figure
let all = deriveSilhouette(H("pageView", [
  { id: "p", kind: "field", field: "page", op: "=", value: "/pricing" },
  { id: "s", kind: "field", field: "seenPct", op: ">=", value: 70 },
])).figures;
const pf = all[0] as PageFigure;
ok(all.length === 1 && pf.kind === "page" && pf.item.plate.header.kind === "exact" && pf.item.plate.seen?.atLeast === 70, "page view of /pricing seen >= 70%: one big page figure, exact header, seen band at 70%");

// 9. a page-view result that involves its session: page figure + session figure with an anchor
all = deriveSilhouette(H("pageView", [
  { id: "p", kind: "field", field: "page", op: "=", value: "/pricing" },
  { id: "r", kind: "related", relation: "session", where: [{ id: "c", kind: "field", field: "converted", op: "isTrue" }] },
])).figures;
const sf = all.find((x): x is SessionFigure => x.kind === "session");
ok(all.length === 2 && !!sf && visits(sf).some((v) => v.anchor) && visits(sf).some((v) => v.frame.outcome === "converted"), "page view whose session converted: page figure + session figure (with 'this page view' anchor and a yellow visit)");

// 10. sequence: 3 pages after the conversion
f = sessions(H("session", [{ id: "pv", kind: "related", relation: "pageViews", where: [
  { id: "cp", kind: "field", field: "isConversionPage", op: "isTrue" },
  { id: "pa", kind: "related", relation: "pagesAfter", where: [], measure: { agg: "count" }, op: "=", value: 3 },
] }]))[0];
const vs = visits(f);
const ci = vs.findIndex((v) => v.frame.outcome === "converted");
ok(ci >= 0 && vs.slice(ci + 1).filter((v) => v.caption === "later").length === 3, "converted page with exactly 3 pages after it: yellow frame, then 3 dashed plates");

// 11. landing page
f = sessions(H("session", [{ id: "l", kind: "field", field: "landingPage", op: "=", value: "/" }]))[0];
ok(visits(f)[0].plate.header.kind === "exact", "landing page = / labels the first plate");

// 12. away periods sit between visits
f = sessions(H("session", [{ id: "a", kind: "related", relation: "awayGaps", where: [{ id: "d", kind: "field", field: "duration", op: ">", value: { amount: 2, unit: "min" } }] }]))[0];
ok(f.items.length >= 3 && f.items[1].kind === "away" && /2 min/.test((f.items[1] as { duration?: string }).duration ?? ""), "an away period longer than 2 min: a purple gap between two visits, labelled");

// 13. sub-hooks get smaller, labelled figures
all = deriveSilhouette(H("pageView", [{ id: "v", kind: "field", field: "visitor", op: "in", value: { hook: { ...H("session", [{ id: "c", kind: "field", field: "converted", op: "isTrue" }], { kind: "values", field: "visitor" }), meta: { name: "Converters" } } } }])).figures;
const sub = all.find((x) => x.scale === "sub");
ok(!!sub && /Converters/.test(sub.title) && sub.feeds === "visitor id", "a sub-hook describing a session draws a smaller silhouette, named, saying what it feeds (visitor id)");

// 14. leads: only drawn when their session is described
ok(deriveSilhouette(H("lead", [{ id: "n", kind: "field", field: "name", op: "contains", value: "hanna" }])).figures.length === 0, "a plain lead filter draws nothing");
all = deriveSilhouette(H("lead", [{ id: "r", kind: "related", relation: "session", where: [{ id: "u", kind: "field", field: "utmSource", op: "=", value: "google" }] }])).figures;
ok(all.length === 1 && (all[0] as SessionFigure).converted === true && all[0].chips.some((c) => /google/.test(c.text)), "leads whose session came from google: a converted session silhouette with a 'google' chip");

// 15. contradictions are called out
const m = deriveSilhouette(H("session", [
  { id: "t", kind: "related", relation: "pageViews", where: [], measure: { agg: "count" }, op: "<=", value: 1 },
  { id: "x", kind: "related", relation: "pageViews", where: [{ id: "p", kind: "field", field: "page", op: "=", value: "/a" }], measure: { agg: "count" }, op: ">=", value: 2 },
]));
ok(m.notes.some((n) => /matches nothing/.test(n)), "at most 1 page but 2 described: the preview says this matches nothing");

// 16. sources point at the condition that drew the shape (the v3 hook)
f = sessions(H("session", [{ id: "pv", kind: "related", relation: "pageViews", where: [{ id: "p", kind: "field", field: "page", op: "=", value: "/blogs" }] }]))[0];
ok(visits(f).some((v) => v.source.some((s) => s.hookPath === "main" && s.conditionPath.join(">") === "pv")), "a drawn visit records the condition that produced it");

// 16b. described pages without a page count end with "+" (there may be others)
ok(cert(f) === "rm", "has a page view of /blogs: the /blogs plate, then '+' (other pages may exist)");

// 17. keys are stable when an unrelated condition is added
const k1 = visits(f).map((v) => v.key);
const f2 = sessions(H("session", [
  { id: "pv", kind: "related", relation: "pageViews", where: [{ id: "p", kind: "field", field: "page", op: "=", value: "/blogs" }] },
  { id: "u", kind: "field", field: "utmSource", op: "=", value: "google" },
]))[0];
ok(k1.every((k) => visits(f2).some((v) => v.key === k)), "adding an unrelated condition keeps existing shapes' keys (only the change glows)");

// 18. page number N lands at position N
f = sessions(H("session", [{ id: "pv", kind: "related", relation: "pageViews", where: [{ id: "n", kind: "field", field: "position", op: "=", value: 3 }, { id: "p", kind: "field", field: "page", op: "=", value: "/x" }] }]))[0];
ok(visits(f)[2]?.plate.header.kind === "exact" && visits(f)[0].plate.header.kind === "any", "page number 3 in the session: the described plate is third, two unknown pages before it");

// 19. form friction: abandoned form on the page
all = deriveSilhouette(H("form", [{ id: "s", kind: "field", field: "status", op: "=", value: "abandoned" }])).figures;
ok(all.length === 1 && (all[0] as PageFigure).item.plate.form === "abandoned" && (all[0] as PageFigure).item.frame.outcome === "abandoned", "an abandoned form: one page figure, orange frame, form mini-plate");

// 20. visitors with 2 sessions like this
all = deriveSilhouette(H("visitor", [{ id: "s", kind: "related", relation: "sessions", where: [{ id: "c", kind: "field", field: "converted", op: "isTrue" }], measure: { agg: "count" }, op: ">=", value: 2 }])).figures;
ok(all.length === 1 && /2\+ sessions like this/.test(all[0].title), "visitors with at least 2 converted sessions: one silhouette titled '2+ sessions like this'");

console.log(fails ? `\n${fails} FAILED, ${passes} passed` : `\nALL ${passes} PASS`);
process.exit(fails ? 1 : 0);
