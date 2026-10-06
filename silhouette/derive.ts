// silhouette/derive.ts
// hook -> silhouette model. Pure: no React, no database, no side effects,
// so it runs on every keystroke and is unit-tested on its own
// (silhouette/tests/derive.test.ts). The rules it implements, condition by
// condition, are written out in silhouette/rules.md: keep the two in step.
//
// Shape of the work:
//   1. The hook's entity decides which figures exist (a session figure, a
//      page figure, both, or none).
//   2. Conditions are folded into "drafts" (one per alternative of an OR
//      group; NOT groups become separate, red-hatched drafts).
//   3. Each draft is laid out into an ordered row of visits and away
//      periods (layoutSession).
//   4. Every sub-hook in a value gets its own, smaller figures.
import { describeCondition } from "../jh-hook/describe";
import { OP_LABEL, SCHEMA, type EntityKey, type Op } from "../jh-hook/schema";
import type { Condition, HookSpec, HookValue, ValueArg } from "../jh-hook/types";
import { formatMs, toMs } from "../jh-hook/units";
import type {
  AwayItem, Chip, Figure, FrameSpec, HeaderSpec, Item, PageFigure, PlateSpec, SessionFigure, Share, SilhouetteModel, Source, VisitItem,
} from "./types";

/** Drawing limits, so a hook asking for "between 1 and 500 pages" stays a readable picture. */
export const LIMITS = { maybePerGroup: 3, itemsPerFigure: 14, alternatives: 4, figures: 12 };

// ── context ─────────────────────────────────────────────────────────────
interface Ctx {
  hookPath: string;
  scale: "main" | "sub";
  notes: string[];
}
const src = (ctx: Ctx, path: string[]): Source => ({ hookPath: ctx.hookPath, conditionPath: path });
const isHook = (v: ValueArg | undefined): v is HookValue => typeof v === "object" && v !== null && !Array.isArray(v) && "hook" in v;

// ── values ──────────────────────────────────────────────────────────────
/** A literal as a plain number: durations to ms, numbers as-is. Anything else (dates, sub-hooks): null. */
function num(v: ValueArg | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && v !== null && !Array.isArray(v) && "amount" in v) {
    try {
      return toMs(v.amount, v.unit);
    } catch {
      return null;
    }
  }
  return null;
}

/** An integer range from a count comparison. Unknown (a sub-hook, "is not") gives null. */
function countRange(op: Op, v: ValueArg | undefined, v2: ValueArg | undefined): { min: number; max: number | null } | null {
  const a = num(v);
  const b = num(v2);
  if (a === null && op !== "isEmpty" && op !== "isNotEmpty") return null;
  const n = Math.max(0, Math.round(a ?? 0));
  switch (op) {
    case "=":
      return { min: n, max: n };
    case ">":
      return { min: n + 1, max: null };
    case ">=":
      return { min: n, max: null };
    case "<":
      return { min: 0, max: Math.max(0, n - 1) };
    case "<=":
      return { min: 0, max: n };
    case "between":
      return b === null ? null : { min: Math.min(n, Math.round(b)), max: Math.max(n, Math.round(b)) };
    default:
      return null;
  }
}

function rangeText(r: { min: number; max: number | null }, noun: string): string {
  if (r.max === null) return `${r.min}+ ${noun}`;
  if (r.min === r.max) return `${r.min} ${noun}`;
  return `${r.min} to ${r.max} ${noun}`;
}

/** "> 5 sec", "3 sec to 5 sec" for a duration comparison. */
function durationLabel(op: Op, v: ValueArg | undefined, v2: ValueArg | undefined): string | undefined {
  const a = num(v);
  if (a === null) return isHook(v) ? "from a sub-hook" : undefined;
  if (op === "between") {
    const b = num(v2);
    return b === null ? undefined : `${formatMs(a)} to ${formatMs(b)}`;
  }
  const sym: Partial<Record<Op, string>> = { ">": ">", ">=": ">=", "<": "<", "<=": "<=", "=": "=", "!=": "not" };
  return `${sym[op] ?? OP_LABEL[op]} ${formatMs(a)}`;
}

/** 0-1 frame width weight: 0 s -> 0.2, ~10 min -> 1 (log scale, like FramePlate's widths). */
function durationWeight(op: Op, v: ValueArg | undefined, v2: ValueArg | undefined): number | undefined {
  const a = num(v);
  if (a === null) return undefined;
  const ms = op === "between" ? (a + (num(v2) ?? a)) / 2 : a;
  return Math.max(0.2, Math.min(1, 0.2 + Math.log10(1 + ms / 1000) / 3.5));
}

function share(op: Op, v: ValueArg | undefined, v2: ValueArg | undefined): Share {
  const a = num(v);
  if (a === null) return { mentioned: true };
  const clamp = (x: number) => Math.max(0, Math.min(100, x));
  switch (op) {
    case ">":
    case ">=":
      return { atLeast: clamp(a) };
    case "<":
    case "<=":
      return { atMost: clamp(a) };
    case "=":
      return { atLeast: clamp(a), atMost: clamp(a) };
    case "between": {
      const b = num(v2) ?? a;
      return { atLeast: clamp(Math.min(a, b)), atMost: clamp(Math.max(a, b)) };
    }
    default:
      return { mentioned: true };
  }
}

/** A position (% down the page) for a bulb from a percent comparison. */
function position(op: Op, v: ValueArg | undefined, v2: ValueArg | undefined): number | true {
  const a = num(v);
  if (a === null) return true;
  const b = op === "between" ? (num(v2) ?? a) : a;
  return Math.max(0, Math.min(100, (a + b) / 2));
}

function headerFrom(op: Op, v: ValueArg | undefined): HeaderSpec | null {
  if (isHook(v)) return { kind: "any" };
  if (op === "=" && typeof v === "string" && v) return { kind: "exact", path: v };
  if (op === "in" && Array.isArray(v) && v.length) return v.length === 1 ? { kind: "exact", path: String(v[0]) } : { kind: "oneOf", paths: v.map(String) };
  if (op === "!=" && typeof v === "string" && v) return { kind: "except", paths: [v] };
  if (op === "notIn" && Array.isArray(v) && v.length) return { kind: "except", paths: v.map(String) };
  if ((op === "contains" || op === "startsWith" || op === "endsWith") && typeof v === "string" && v) return { kind: "pattern", op, text: v };
  return null;
}

/** Combines two descriptions of the same page address (AND): the more specific one wins. */
function mergeHeader(a: HeaderSpec, b: HeaderSpec): HeaderSpec {
  const rank = { any: 0, except: 1, pattern: 2, oneOf: 3, exact: 4 } as const;
  return rank[b.kind] >= rank[a.kind] ? b : a;
}

// ── a page visit, from conditions on a page view ────────────────────────
interface Template {
  plate: PlateSpec;
  frame: FrameSpec;
  anchor?: boolean;
}
interface Group {
  key: string;
  min: number;
  max: number | null;
  template: Template;
  position?: number | "first" | "last";
  before: Group[];
  after: Group[];
  caption?: string;
  source: Source[];
}

const blankTemplate = (): Template => ({ plate: { header: { kind: "any" }, bulbs: {}, notes: [] }, frame: { outcome: "unknown" } });

interface VisitDesc {
  template: Template;
  position?: number | "first" | "last";
  before: Group[];
  after: Group[];
  chips: Chip[];
  /** "in a converted session" and friends: facts about the surrounding session. */
  sessionConverted?: boolean;
  /** Conditions on "its session" (a page-result hook draws them as the session figure). */
  sessionConds: { conds: Condition[]; path: string[] }[];
  /** Positional / sequence conditions were used: the page's place in its session matters. */
  placed: boolean;
}

function describeVisit(conds: Condition[], ctx: Ctx, path: string[], keyBase: string): VisitDesc {
  const d: VisitDesc = { template: blankTemplate(), before: [], after: [], chips: [], sessionConds: [], placed: false };
  applyVisit(d, conds, ctx, path, keyBase);
  return d;
}

function applyVisit(d: VisitDesc, conds: Condition[], ctx: Ctx, path: string[], keyBase: string): void {
  const t = d.template;
  for (const c of conds) {
    const p = [...path, c.id];
    const s = src(ctx, p);
    if (c.kind === "group") {
      if (!c.not && c.mode === "and") applyVisit(d, c.where, ctx, path, keyBase);
      else if (c.not) t.plate.notes.push(describeCondition(c, "pageView"));
      else d.chips.push({ key: c.id, text: describeCondition(c, "pageView"), source: s });
      continue;
    }
    if (c.kind === "related") {
      const rel = SCHEMA.pageView.relations[c.relation];
      if (!rel) continue;
      if (c.relation === "session") {
        d.sessionConds.push({ conds: c.where, path: p });
        continue;
      }
      if (c.relation === "forms") {
        t.plate.form = formState(c.where) ?? "any";
        if (t.plate.form === "abandoned") t.frame.outcome = "abandoned";
        continue;
      }
      if (c.relation === "nextPage" || c.relation === "previousPage") {
        const inner = describeVisit(c.where, ctx, p, `${keyBase}.${c.id}`);
        const g: Group = { key: `${keyBase}.${c.id}`, min: 1, max: 1, template: inner.template, before: inner.before, after: inner.after, caption: c.relation === "nextPage" ? "next page" : "previous page", source: [s] };
        (c.relation === "nextPage" ? d.after : d.before).push(g);
        d.placed = true;
        continue;
      }
      if (c.relation === "pagesAfter" || c.relation === "pagesBefore") {
        const r = c.measure || c.op ? measuredRange(c) : { min: 1, max: 1 };
        const inner = describeVisit(c.where, ctx, p, `${keyBase}.${c.id}`);
        const caption = c.relation === "pagesAfter" ? "later" : "earlier";
        if (r) {
          const g: Group = { key: `${keyBase}.${c.id}`, min: r.min, max: r.max, template: inner.template, before: [], after: [], caption, source: [s] };
          (c.relation === "pagesAfter" ? d.after : d.before).push(g);
        } else d.chips.push({ key: c.id, text: describeCondition(c, "pageView"), source: s });
        d.placed = true;
        continue;
      }
      d.chips.push({ key: c.id, text: describeCondition(c, "pageView"), source: s }); // visitor and anything new
      continue;
    }
    // a field of the page view
    switch (c.field) {
      case "page": {
        const h = headerFrom(c.op, c.value);
        if (h) t.plate.header = mergeHeader(t.plate.header, h);
        break;
      }
      case "timeOnPage":
      case "visitDuration":
        t.frame.duration = durationLabel(c.op, c.value, c.value2) ?? t.frame.duration;
        t.frame.weight = durationWeight(c.op, c.value, c.value2) ?? t.frame.weight;
        break;
      case "seenPct":
        t.plate.seen = share(c.op, c.value, c.value2);
        break;
      case "seenTwicePct":
        t.plate.seenTwice = share(c.op, c.value, c.value2);
        break;
      case "notSeenPct":
        t.plate.notSeen = share(c.op, c.value, c.value2);
        break;
      case "revisited":
        if (c.op === "isTrue") t.plate.seenTwice = t.plate.seenTwice ?? { mentioned: true };
        break;
      case "entryPct":
        t.plate.bulbs.enter = position(c.op, c.value, c.value2);
        break;
      case "deepestPct":
        t.plate.bulbs.deepest = position(c.op, c.value, c.value2);
        break;
      case "exitPct":
        t.plate.bulbs.exit = position(c.op, c.value, c.value2);
        break;
      case "deepestAt":
      case "timeToDeepest":
        t.plate.bulbs.deepest = t.plate.bulbs.deepest ?? true;
        break;
      case "isConversionPage":
        if (c.op === "isTrue") {
          t.frame.outcome = "converted";
          t.plate.bulbs.converted = true;
          d.sessionConverted = true;
        }
        break;
      case "inConvertedSession":
        if (c.op === "isTrue" || c.op === "isFalse") d.sessionConverted = c.op === "isTrue";
        break;
      case "isLanding":
        if (c.op === "isTrue") d.position = "first";
        d.placed = true;
        break;
      case "isExit":
        if (c.op === "isTrue") d.position = "last";
        d.placed = true;
        break;
      case "position": {
        const r = countRange(c.op, c.value, c.value2);
        if (r && r.max !== null && r.min === r.max && r.min >= 1) d.position = r.min;
        else d.chips.push({ key: c.id, text: describeCondition(c, "pageView"), source: s });
        d.placed = true;
        break;
      }
      case "isOpen":
        if (c.op === "isTrue") t.frame.outcome = "live";
        break;
      case "pageHeight": {
        const a = num(c.value);
        if (a !== null && (c.op === ">" || c.op === ">=") && a >= 3000) t.plate.tall = true;
        d.chips.push({ key: c.id, text: describeCondition(c, "pageView"), source: s });
        break;
      }
      default:
        d.chips.push({ key: c.id, text: describeCondition(c, "pageView"), source: s });
    }
  }
}

function measuredRange(c: Extract<Condition, { kind: "related" }>): { min: number; max: number | null } | null {
  const m = c.measure ?? { agg: "count" as const };
  if (m.agg !== "count") return null;
  return countRange(c.op ?? ">=", c.value ?? 1, c.value2);
}

/** The form state a set of form-activity conditions describes. */
function formState(conds: Condition[]): PlateSpec["form"] | undefined {
  for (const c of conds) {
    if (c.kind === "field" && c.field === "status" && c.op === "=" && typeof c.value === "string") return c.value as PlateSpec["form"];
    if (c.kind === "field" && c.field === "status" && c.op === "in" && Array.isArray(c.value) && c.value.length === 1) return String(c.value[0]) as PlateSpec["form"];
  }
  return undefined;
}

// ── a session, from conditions on a session ─────────────────────────────
interface Draft {
  groups: Group[];
  away: { key: string; min: number; max: number | null; duration?: string; source: Source }[];
  total?: { min: number; max: number | null };
  landing?: HeaderSpec;
  exit?: HeaderSpec;
  converted: boolean | null;
  live: boolean;
  chips: Chip[];
  /** Which condition said each session-level thing, so the shape it draws points back to it. */
  sources: { converted?: Source; landing?: Source; exit?: Source; total?: Source };
}
const newDraft = (): Draft => ({ groups: [], away: [], converted: null, live: false, chips: [], sources: {} });

interface SessionOut {
  drafts: { draft: Draft; label?: string }[];
  excluded: { draft: Draft; label?: string }[];
}

function describeSession(conds: Condition[], ctx: Ctx, path: string[], keyBase: string): SessionOut {
  let drafts: { draft: Draft; label?: string }[] = [{ draft: newDraft() }];
  const excluded: { draft: Draft; label?: string }[] = [];
  for (const c of conds) {
    const p = [...path, c.id];
    if (c.kind === "group" && c.not) {
      // "none of these": what the session must NOT look like, as its own red-hatched figure(s)
      const inner = describeSession(c.mode === "and" ? c.where : [], ctx, p, `${keyBase}.${c.id}`);
      if (c.mode === "and") excluded.push(...inner.drafts.map((x) => ({ ...x, label: "must not look like this" })));
      else
        for (const branch of c.where) {
          const one = describeSession([branch], ctx, p, `${keyBase}.${c.id}`);
          excluded.push(...one.drafts.map((x) => ({ ...x, label: "must not look like this" })));
        }
      excluded.push(...inner.excluded);
      continue;
    }
    if (c.kind === "group" && c.mode === "or" && c.where.length > 1) {
      // "any of these": one alternative per branch, combined with what came before
      const next: { draft: Draft; label?: string }[] = [];
      c.where.forEach((branch, bi) => {
        for (const d of drafts) {
          const copy = structuredClone(d.draft);
          applySession(copy, [branch], ctx, p, `${keyBase}.${c.id}.${bi}`, excluded);
          next.push({ draft: copy, label: `option ${bi + 1} of ${c.where.length}` });
        }
      });
      if (next.length > LIMITS.alternatives) ctx.notes.push(`${next.length - LIMITS.alternatives} more alternatives are not drawn.`);
      drafts = next.slice(0, LIMITS.alternatives);
      continue;
    }
    for (const d of drafts) applySession(d.draft, [c], ctx, path, keyBase, excluded);
  }
  return { drafts, excluded };
}

function applySession(d: Draft, conds: Condition[], ctx: Ctx, path: string[], keyBase: string, excluded: SessionOut["excluded"]): void {
  for (const c of conds) {
    const p = [...path, c.id];
    const s = src(ctx, p);
    const key = `${keyBase}.${c.id}`;
    if (c.kind === "group") {
      // a nested group: AND folds in; OR / NOT inside an alternative are summarised as a chip
      if (!c.not && c.mode === "and") applySession(d, c.where, ctx, path, keyBase, excluded);
      else d.chips.push({ key: c.id, text: describeCondition(c, "session"), source: s });
      continue;
    }
    if (c.kind === "field") {
      switch (c.field) {
        case "converted":
          if (c.op === "isTrue" || c.op === "isFalse") {
            d.converted = c.op === "isTrue";
            d.sources.converted = s;
          }
          break;
        case "isOpen":
          if (c.op === "isTrue") d.live = true;
          break;
        case "landingPage": {
          const h = headerFrom(c.op, c.value);
          if (h) {
            d.landing = h;
            d.sources.landing = s;
          }
          break;
        }
        case "exitPage": {
          const h = headerFrom(c.op, c.value);
          if (h) {
            d.exit = h;
            d.sources.exit = s;
          }
          break;
        }
        default:
          d.chips.push({ key: c.id, text: describeCondition(c, "session"), source: s });
      }
      continue;
    }
    // connected rows of a session
    const measured = !!(c.measure || c.op);
    switch (c.relation) {
      case "pageViews": {
        const r = measured ? measuredRange(c) : { min: 1, max: 1 };
        const isDistinct = c.measure?.agg === "countDistinct";
        if (!r && !isDistinct) {
          d.chips.push({ key: c.id, text: describeCondition(c, "session"), source: s });
          break;
        }
        if (isDistinct) {
          const dr = countRange(c.op ?? ">=", c.value ?? 1, c.value2);
          if (!dr) {
            d.chips.push({ key: c.id, text: describeCondition(c, "session"), source: s });
            break;
          }
          const v = describeVisit(c.where, ctx, p, key);
          d.groups.push({ key, min: dr.min, max: dr.max, template: v.template, before: v.before, after: v.after, caption: "different page", source: [s] });
          d.chips.push(...v.chips);
          break;
        }
        if (!c.where.length && measured) {
          // "number of page views < 4": the whole session's size. A session
          // always has at least one page, so the minimum is never below 1.
          d.total = { min: Math.max(1, r!.min), max: r!.max === null ? null : Math.max(1, r!.max) };
          d.sources.total = s;
          break;
        }
        const v = describeVisit(c.where, ctx, p, key);
        if (v.sessionConverted !== undefined) d.converted = v.sessionConverted;
        d.groups.push({ key, min: r!.min, max: r!.max, template: v.template, position: v.position, before: v.before, after: v.after, source: [s] });
        d.chips.push(...v.chips);
        break;
      }
      case "awayGaps": {
        const r = measured ? measuredRange(c) : { min: 1, max: 1 };
        let duration: string | undefined;
        for (const w of c.where) if (w.kind === "field" && w.field === "duration") duration = durationLabel(w.op, w.value, w.value2);
        if (r) d.away.push({ key, min: r.min, max: r.max, duration, source: s });
        else d.chips.push({ key: c.id, text: describeCondition(c, "session"), source: s });
        break;
      }
      case "leads":
        d.converted = measured && measuredRange(c)?.max === 0 ? false : true;
        if (c.where.length || measured) d.chips.push({ key: c.id, text: describeCondition(c, "session"), source: s });
        break;
      case "forms": {
        const state = formState(c.where) ?? "any";
        const t = blankTemplate();
        t.plate.form = state;
        if (state === "abandoned") t.frame.outcome = "abandoned";
        if (state === "submitted") {
          t.frame.outcome = "converted";
          d.converted = true;
        }
        const r = measured ? measuredRange(c) : { min: 1, max: 1 };
        if (r) d.groups.push({ key, min: r.min, max: r.max, template: t, before: [], after: [], caption: "form", source: [s] });
        break;
      }
      default:
        d.chips.push({ key: c.id, text: describeCondition(c, "session"), source: s }); // its visitor, and anything new
    }
  }
}

// ── layout: draft -> ordered items ──────────────────────────────────────
function expand(g: Group): VisitItem[] {
  const out: VisitItem[] = [];
  const mk = (i: number, certainty: VisitItem["certainty"]): VisitItem => ({
    kind: "visit",
    key: `${g.key}#${i}`,
    certainty,
    plate: structuredClone(g.template.plate),
    frame: { ...g.template.frame },
    anchor: g.template.anchor,
    caption: g.caption,
    source: g.source,
  });
  for (let i = 0; i < g.min; i++) out.push(mk(i, "required"));
  if (g.max === null) out.push(mk(g.min, "more"));
  else for (let i = g.min; i < Math.min(g.max, g.min + LIMITS.maybePerGroup); i++) out.push(mk(i, "maybe"));
  if (!out.length) return out;
  // sequence neighbours hang off the first / last instance
  const before = g.before.flatMap(expandWithNeighbours);
  const after = g.after.flatMap(expandWithNeighbours);
  return [...before, ...out, ...after];
}
function expandWithNeighbours(g: Group): VisitItem[] {
  return expand(g);
}

const anyVisit = (key: string, certainty: VisitItem["certainty"], source: Source[]): VisitItem => ({
  kind: "visit",
  key,
  certainty,
  plate: { header: { kind: "any" }, bulbs: {}, notes: [] },
  frame: { outcome: "unknown" },
  source,
});

function layoutSession(d: Draft, keyBase: string, ctx: Ctx, rootSource: Source[]): { items: Item[]; pagesLabel?: string } {
  const first: VisitItem[] = [];
  const middle: VisitItem[] = [];
  const last: VisitItem[] = [];
  const placed: { at: number; items: VisitItem[] }[] = [];
  for (const g of d.groups) {
    const items = expand(g);
    if (g.position === "first") first.push(...items);
    else if (g.position === "last") last.push(...items);
    else if (typeof g.position === "number") placed.push({ at: g.position, items });
    else middle.push(...items);
  }
  const visits: VisitItem[] = [...first, ...middle];
  // "page number in the session is N": pad with unknown pages so it lands at N
  for (const pl of placed.sort((a, b) => a.at - b.at)) {
    const idx = pl.at - 1;
    while (visits.length < idx) visits.push(anyVisit(`${keyBase}.pad${visits.length}`, "required", rootSource));
    visits.splice(idx, 0, ...pl.items);
  }
  visits.push(...last);

  // landing / exit page described on the session itself
  if (d.landing) {
    const firstVisit = visits[0];
    if (firstVisit && first.length && firstVisit.plate.header.kind === "any") firstVisit.plate.header = d.landing;
    else if (!first.length) visits.unshift({ ...anyVisit(`${keyBase}.landing`, "required", d.sources.landing ? [d.sources.landing] : rootSource), plate: { header: d.landing, bulbs: {}, notes: [] }, caption: "landing page" });
  }
  if (d.exit) {
    if (!last.length) visits.push({ ...anyVisit(`${keyBase}.exit`, "required", d.sources.exit ? [d.sources.exit] : rootSource), plate: { header: d.exit, bulbs: {}, notes: [] }, caption: "exit page" });
    else if (visits[visits.length - 1].plate.header.kind === "any") visits[visits.length - 1].plate.header = d.exit;
  }

  // converted, but no visit says where: one yellow visit, place unknown
  if (d.converted === true && !visits.some((v) => v.frame.outcome === "converted")) {
    const conv: VisitItem = { ...anyVisit(`${keyBase}.converted`, "required", d.sources.converted ? [d.sources.converted] : rootSource), frame: { outcome: "converted" }, caption: "converted here" };
    conv.plate.bulbs.converted = true;
    const at = last.length ? visits.length - last.length : visits.length;
    visits.splice(at, 0, conv);
  }

  // the whole session's size ("fewer than 4 pages", "between 2 and 5")
  let pagesLabel: string | undefined;
  const required = visits.filter((v) => v.certainty === "required").length;
  if (d.total) {
    pagesLabel = rangeText(d.total, "pages");
    if (d.total.max !== null && d.total.max < required) ctx.notes.push(`A session can't have ${pagesLabel} and also contain ${required} described pages: this part matches nothing.`);
    const at = () => (last.length ? visits.length - last.length : visits.length);
    const totalSrc = d.sources.total ? [d.sources.total] : rootSource;
    for (let i = required; i < d.total.min; i++) visits.splice(at(), 0, anyVisit(`${keyBase}.fill${i}`, "required", totalSrc));
    const now = Math.max(required, d.total.min);
    if (d.total.max === null) {
      if (!visits.some((v) => v.certainty === "more")) visits.splice(at(), 0, anyVisit(`${keyBase}.more`, "more", totalSrc));
    } else for (let i = now; i < Math.min(d.total.max, now + LIMITS.maybePerGroup); i++) visits.splice(at(), 0, anyVisit(`${keyBase}.maybe${i}`, "maybe", totalSrc));
  }

  // a session always has at least one page; an undescribed one may have more
  if (!visits.length) visits.push(anyVisit(`${keyBase}.p0`, "required", rootSource), anyVisit(`${keyBase}.pmore`, "more", rootSource));
  // no page count described: the described pages are some of the session's
  // pages, not all of them ("has a page view of /blogs" = /blogs among others)
  else if (!d.total && !visits.some((v) => v.certainty === "more")) {
    const at = last.length ? visits.length - last.length : visits.length;
    visits.splice(at, 0, anyVisit(`${keyBase}.others`, "more", rootSource));
  }

  // away periods sit between visits: make sure there are enough visits around them
  const awayItems: AwayItem[] = [];
  for (const a of d.away) {
    for (let i = 0; i < a.min; i++) awayItems.push({ kind: "away", key: `${a.key}#${i}`, certainty: "required", duration: a.duration, source: [a.source] });
    if (a.max === null) awayItems.push({ kind: "away", key: `${a.key}#more`, certainty: "more", duration: a.duration, source: [a.source] });
    else for (let i = a.min; i < Math.min(a.max, a.min + LIMITS.maybePerGroup); i++) awayItems.push({ kind: "away", key: `${a.key}#${i}`, certainty: "maybe", duration: a.duration, source: [a.source] });
  }
  while (visits.length < awayItems.length + 1) visits.push(anyVisit(`${keyBase}.around${visits.length}`, "required", rootSource));
  const items: Item[] = [];
  visits.forEach((v, i) => {
    items.push(v);
    if (i < awayItems.length) items.push(awayItems[i]);
  });

  if (items.length > LIMITS.itemsPerFigure) {
    ctx.notes.push(`A session silhouette is limited to ${LIMITS.itemsPerFigure} shapes; ${items.length - LIMITS.itemsPerFigure} more are not drawn.`);
    return { items: items.slice(0, LIMITS.itemsPerFigure), pagesLabel };
  }
  return { items, pagesLabel };
}

function sessionFigures(out: SessionOut, ctx: Ctx, keyBase: string, title: string, rootSource: Source[], extra?: { chips?: Chip[]; anchor?: Group }): SessionFigure[] {
  const make = (x: { draft: Draft; label?: string }, i: number, excluded: boolean): SessionFigure => {
    const d = x.draft;
    if (extra?.anchor) d.groups.push(structuredClone(extra.anchor));
    const kb = `${keyBase}${excluded ? ".not" : ""}.${i}`;
    const { items, pagesLabel } = layoutSession(d, kb, ctx, rootSource);
    return {
      kind: "session",
      key: kb,
      title: x.label ? `${title}: ${x.label}` : title,
      scale: ctx.scale,
      excluded,
      chips: [...(extra?.chips ?? []), ...d.chips],
      items,
      live: d.live,
      converted: d.converted,
      pagesLabel,
    };
  };
  return [...out.drafts.map((x, i) => make(x, i, false)), ...out.excluded.map((x, i) => make(x, i, true))];
}

function pageFigure(v: VisitDesc, ctx: Ctx, key: string, title: string, source: Source[]): PageFigure {
  return {
    kind: "page",
    key,
    title,
    scale: ctx.scale,
    excluded: false,
    chips: v.chips,
    item: { kind: "visit", key: `${key}.visit`, certainty: "required", plate: v.template.plate, frame: v.template.frame, source },
  };
}

// ── the entry point ─────────────────────────────────────────────────────
export function deriveSilhouette(spec: HookSpec): SilhouetteModel {
  const notes: string[] = [];
  const figures = deriveHook(spec, { hookPath: "main", scale: "main", notes });
  if (figures.length > LIMITS.figures) {
    notes.push(`${figures.length - LIMITS.figures} more silhouettes are not drawn.`);
    return { figures: figures.slice(0, LIMITS.figures), notes };
  }
  return { figures, notes };
}

function deriveHook(spec: HookSpec, ctx: Ctx, feeds?: string): Figure[] {
  if (!spec || !SCHEMA[spec.entity] || !Array.isArray(spec.where)) return [];
  const name = spec.meta?.name;
  const base = ctx.scale === "sub" ? `Sub-hook${name ? `: ${name}` : ""}` : name || "";
  const root: Source[] = [src(ctx, [])];
  const kb = ctx.hookPath;
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const label = (what: string) => (base ? `${base} · ${what}` : cap(what));
  let figs: Figure[] = [];

  const sessionFrom = (conds: Condition[], path: string[], key: string, title: string, extra?: Parameters<typeof sessionFigures>[5]) =>
    sessionFigures(describeSession(conds, ctx, path, key), ctx, key, title, root, extra);

  switch (spec.entity as EntityKey) {
    case "session":
      figs = sessionFrom(spec.where, [], `${kb}.s`, label("session"));
      break;

    case "pageView": {
      // 1. the page itself: its own conditions, one big frame + plate
      const own = spec.where.filter((c) => !isSessionInvolving(c));
      const v = describeVisit(spec.where, ctx, [], `${kb}.p`);
      const pageOnly = describeVisit(own, ctx, [], `${kb}.p`);
      figs.push(pageFigure(pageOnly, ctx, `${kb}.p`, label("the page view"), root));
      // 2. its session, only when the hook involves the session
      if (v.sessionConds.length || v.placed || v.sessionConverted !== undefined) {
        const anchorT: Template = { plate: { header: pageOnly.template.plate.header, bulbs: {}, notes: [] }, frame: { outcome: v.template.frame.outcome === "converted" ? "converted" : "unknown" }, anchor: true };
        const anchor: Group = { key: `${kb}.anchor`, min: 1, max: 1, template: anchorT, position: v.position, before: v.before, after: v.after, caption: "this page view", source: root };
        const conds = v.sessionConds.flatMap((x) => x.conds);
        const out = describeSession(conds, ctx, v.sessionConds[0]?.path ?? [], `${kb}.s`);
        if (v.sessionConverted !== undefined) for (const x of out.drafts) x.draft.converted = v.sessionConverted;
        figs.push(...sessionFigures(out, ctx, `${kb}.s`, label("its session"), root, { anchor }));
      }
      break;
    }

    case "lead":
    case "visitor":
    case "form":
    case "formField":
    case "page":
    case "awayGap":
      figs = otherEntity(spec, ctx, kb, label);
      break;
  }

  if (feeds) for (const f of figs) f.feeds = feeds;
  // every sub-hook in a value: its own, smaller figures
  for (const t of findHookValues(spec.where, [], spec.entity)) {
    const subCtx: Ctx = { hookPath: `${ctx.hookPath}>${t.path[t.path.length - 1]}`, scale: "sub", notes: ctx.notes };
    figs.push(...deriveHook(t.value.hook, subCtx, t.feeds));
  }
  return figs;
}

/** Conditions on a page view that are about its session, or its place in it. */
function isSessionInvolving(c: Condition): boolean {
  if (c.kind === "related") return ["session", "nextPage", "previousPage", "pagesAfter", "pagesBefore"].includes(c.relation);
  if (c.kind === "field") return ["inConvertedSession", "isLanding", "isExit", "position"].includes(c.field);
  return false;
}

function otherEntity(spec: HookSpec, ctx: Ctx, kb: string, label: (w: string) => string): Figure[] {
  const figs: Figure[] = [];
  const root: Source[] = [src(ctx, [])];
  const chips: Chip[] = [];
  const e = spec.entity;
  const sessionWith = (conds: Condition[], path: string[], key: string, title: string, force?: { converted?: boolean; header?: HeaderSpec }) => {
    const out = describeSession(conds, ctx, path, key);
    if (force?.converted) for (const x of out.drafts) x.draft.converted = true;
    if (force?.header)
      for (const x of out.drafts) {
        const t = blankTemplate();
        t.plate.header = force.header;
        t.frame.outcome = "converted";
        t.plate.bulbs.converted = true;
        x.draft.groups.push({ key: `${key}.submitted`, min: 1, max: 1, template: t, before: [], after: [], caption: "submitted here", source: root });
      }
    return sessionFigures(out, ctx, key, title, root, { chips });
  };

  if (e === "lead") {
    let header: HeaderSpec | undefined;
    for (const c of spec.where) {
      if (c.kind === "field" && c.field === "page") header = headerFrom(c.op, c.value) ?? header;
      else if (c.kind !== "related") chips.push({ key: c.id, text: describeCondition(c, e), source: src(ctx, [c.id]) });
    }
    const sess = spec.where.filter((c) => c.kind === "related" && c.relation === "session") as Extract<Condition, { kind: "related" }>[];
    for (const c of spec.where) if (c.kind === "related" && c.relation !== "session") chips.push({ key: c.id, text: describeCondition(c, e), source: src(ctx, [c.id]) });
    if (sess.length || header) figs.push(...sessionWith(sess.flatMap((c) => c.where), sess[0] ? [sess[0].id] : [], `${kb}.s`, label("the session they converted in"), { converted: true, header }));
    return figs;
  }

  if (e === "visitor") {
    for (const c of spec.where) {
      if (c.kind === "related" && c.relation === "sessions") {
        const r = c.measure || c.op ? measuredRange(c) : null;
        const title = label(r ? `${rangeText(r, "sessions")} like this` : "a session like this");
        figs.push(...sessionWith(c.where, [c.id], `${kb}.${c.id}`, title));
      } else if (c.kind === "related" && c.relation === "pageViews") {
        figs.push(pageFigure(describeVisit(c.where, ctx, [c.id], `${kb}.${c.id}`), ctx, `${kb}.${c.id}`, label("a page view of theirs"), [src(ctx, [c.id])]));
      } else chips.push({ key: c.id, text: describeCondition(c, e), source: src(ctx, [c.id]) });
    }
    for (const f of figs) f.chips = [...chips, ...f.chips];
    return figs;
  }

  if (e === "page") {
    const v = describeVisit([], ctx, [], `${kb}.p`);
    for (const c of spec.where) {
      if (c.kind === "field" && c.field === "path") {
        const h = headerFrom(c.op, c.value);
        if (h) v.template.plate.header = mergeHeader(v.template.plate.header, h);
      } else if (c.kind === "related" && c.relation === "pageViews" && !(c.measure || c.op)) applyVisit(v, c.where, ctx, [c.id], `${kb}.p`);
      else v.chips.push({ key: c.id, text: describeCondition(c, e), source: src(ctx, [c.id]) });
    }
    figs.push(pageFigure(v, ctx, `${kb}.p`, label("the page"), root));
    return figs;
  }

  if (e === "form" || e === "formField") {
    const v = describeVisit([], ctx, [], `${kb}.p`);
    v.template.plate.form = "any";
    const sess: Condition[] = [];
    let sessPath: string[] = [];
    for (const c of spec.where) {
      const p = [c.id];
      if (c.kind === "field" && c.field === "page") {
        const h = headerFrom(c.op, c.value);
        if (h) v.template.plate.header = mergeHeader(v.template.plate.header, h);
      } else if (c.kind === "field" && (c.field === "status" || c.field === "formStatus") && c.op === "=" && typeof c.value === "string") {
        v.template.plate.form = c.value as PlateSpec["form"];
        if (c.value === "abandoned") v.template.frame.outcome = "abandoned";
        if (c.value === "submitted") v.template.frame.outcome = "converted";
      } else if (c.kind === "related" && c.relation === "session") {
        sess.push(...c.where);
        sessPath = p;
      } else if (c.kind === "related" && c.relation === "form") {
        const st = formState(c.where);
        if (st) v.template.plate.form = st;
        v.chips.push({ key: c.id, text: describeCondition(c, e), source: src(ctx, p) });
      } else v.chips.push({ key: c.id, text: describeCondition(c, e), source: src(ctx, p) });
    }
    figs.push(pageFigure(v, ctx, `${kb}.p`, label(e === "form" ? "the form" : "the form field"), root));
    if (sess.length) figs.push(...sessionWith(sess, sessPath, `${kb}.s`, label("its session")));
    return figs;
  }

  // away periods: a session with the described away period highlighted
  const out = describeSession([], ctx, [], `${kb}.s`);
  let duration: string | undefined;
  for (const c of spec.where) {
    if (c.kind === "field" && c.field === "duration") duration = durationLabel(c.op, c.value, c.value2);
    else if (c.kind === "related" && c.relation === "session") {
      const inner = describeSession(c.where, ctx, [c.id], `${kb}.s`);
      out.drafts = inner.drafts;
      out.excluded = inner.excluded;
    } else chips.push({ key: c.id, text: describeCondition(c, e), source: src(ctx, [c.id]) });
  }
  for (const x of out.drafts) x.draft.away.push({ key: `${kb}.away`, min: 1, max: 1, duration, source: root[0] });
  return sessionFigures(out, ctx, `${kb}.s`, label("the away period, in its session"), root, { chips });
}

/** Every sub-hook directly in these conditions (not inside sub-hooks), with what it feeds. */
function findHookValues(conds: Condition[], path: string[], entity: EntityKey): { path: string[]; value: HookValue; feeds: string }[] {
  const out: { path: string[]; value: HookValue; feeds: string }[] = [];
  for (const c of conds) {
    const p = [...path, c.id];
    if (c.kind !== "group") {
      const rel = c.kind === "related" ? SCHEMA[entity]?.relations[c.relation] : undefined;
      const what = c.kind === "field" ? (SCHEMA[entity]?.fields[c.field]?.label ?? c.field) : `the measure of ${rel?.label ?? c.relation}`;
      if (isHook(c.value)) out.push({ path: p, value: c.value, feeds: what });
      if (isHook(c.value2)) out.push({ path: p, value: c.value2, feeds: `${what} (upper bound)` });
    }
    if (c.kind === "group") out.push(...findHookValues(c.where, p, entity));
    else if (c.kind === "related") {
      const target = SCHEMA[entity]?.relations[c.relation]?.target;
      if (target) out.push(...findHookValues(c.where, p, target));
    }
  }
  return out;
}
