// lib/tracking/headingTime.js
// Time per heading on one page view (page_views.heading_time). Written by the tracker's heading meter (public/tracker.js,
// "HEADING TIME"), cleaned here on the way in, read back here for the lead page. Plan and rules:
// mds/build/heading-time/plan.md.
//
// Stored shape (compact on purpose, about 40-150 bytes per page view):
//   { t: 1, h: [["k3j9a", 1, 0, 120, 2], ["^", 0, -1, 30, 1], ...] }
//   t  the page's top heading level (1 = its sections are h1s; 2 when the page has no h1)
//   h  one entry per heading that got time: [key, level 1-3 (0 for "^"), order on the page (-1 for "^"),
//      tenths of a second, times it became the active heading]
//   key  keyOfText(heading text), "#2" appended for the second heading with the same text; "^" = above the first heading

const MAX_ENTRIES = 40;
const KEY_RE = /^(\^|[0-9a-z]{1,8}(#\d{1,2})?)$/;

/** The key the tracker gives a heading text. Must stay identical to keyOfText in public/tracker.js (tested). */
export function keyOfText(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const int = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);

/**
 * Validates what the tracker sent. Returns the object to store, or null when there is nothing usable.
 * @param {unknown} raw
 * @param {number} durationMs the page view's own duration: no heading can have more time than the page had
 */
export function cleanHeadingTime(raw, durationMs) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.h)) return null;
  const t = int(raw.t, 1, 3) ?? 1;
  const capTenths = Number.isFinite(durationMs) && durationMs > 0 ? Math.ceil(durationMs / 100) + 20 : 864_000;
  const out = [];
  const keys = new Set();
  for (const e of raw.h.slice(0, MAX_ENTRIES + 1)) {
    if (!Array.isArray(e) || out.length >= MAX_ENTRIES) continue;
    const [k, l, o, d, n] = e;
    if (typeof k !== "string" || !KEY_RE.test(k) || keys.has(k)) continue;
    const level = k === "^" ? 0 : int(l, 1, 3);
    const order = k === "^" ? -1 : int(o, 0, 199);
    // 0 is allowed only for a section heading: kept so the time of its sub-headings can be grouped under it
    const tenths = int(d, level === t ? 0 : 1, 864_000);
    if (level === null || order === null || tenths === null) continue;
    out.push([k, level, order, Math.min(tenths, capTenths), int(n, 0, 10_000) ?? 1]);
    keys.add(k);
  }
  return out.some((e) => e[3] > 0) ? { t, h: out } : null;
}

/**
 * Reads a stored value back, naming each heading from the page's structure rows (header_text, header_tag) of the
 * version the visit was drawn with. A heading not found there (the page changed since) keeps text null.
 * @returns {{ top: number, items: { key: string, level: number, order: number, ms: number, entries: number, text: string | null }[] } | null}
 */
export function readHeadingTime(stored, structureRows) {
  if (!stored || typeof stored !== "object" || !Array.isArray(stored.h)) return null;
  const textOf = new Map();
  const seen = new Map();
  for (const r of Array.isArray(structureRows) ? [...structureRows].sort((a, b) => (a.header_index ?? 0) - (b.header_index ?? 0)) : []) {
    const text = typeof r?.header_text === "string" ? r.header_text.replace(/\s+/g, " ").trim() : "";
    if (!text) continue;
    const base = keyOfText(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    textOf.set(n > 1 ? base + "#" + n : base, text);
  }
  const items = stored.h
    .filter((e) => Array.isArray(e) && typeof e[0] === "string")
    .map(([key, level, order, tenths, entries]) => ({ key, level: Number(level) || 0, order: Number(order), ms: (Number(tenths) || 0) * 100, entries: Number(entries) || 0, text: key === "^" ? null : (textOf.get(key) ?? null) }))
    .sort((a, b) => a.order - b.order);
  return items.length ? { top: Number(stored.t) || 1, items } : null;
}

/**
 * Groups headings into sections: a section is a heading of the page's top level, with the lower-level headings
 * after it until the next top-level one. Headings before the first section, and the part above the first heading,
 * form the "top of the page". A section's time is its own plus its sub-headings'.
 * @returns {{ text: string | null, ms: number, entries: number, isTop: boolean, subs: { text: string | null, ms: number, entries: number }[] }[]}
 */
export function sectionsOf(read) {
  if (!read) return [];
  const sections = [];
  let current = { text: null, ms: 0, entries: 0, isTop: true, subs: [] };
  for (const it of read.items) {
    if (it.key !== "^" && it.level === read.top) {
      if (current.ms > 0) sections.push(current);
      current = { text: it.text, ms: it.ms, entries: it.entries, isTop: false, subs: [] };
    } else if (it.key === "^" || current.isTop) {
      current.ms += it.ms;
      current.entries += it.entries;
    } else {
      current.ms += it.ms;
      current.subs.push({ text: it.text, ms: it.ms, entries: it.entries });
    }
  }
  if (current.ms > 0) sections.push(current);
  return sections;
}

/**
 * The page's sections WITH their place on the page, for drawing them on the visit chart's plate (components in
 * framePlate/). Built from the page's stored headings (structure rows of the version the visit was drawn with), so a
 * section the visitor never reached is still there (with no time), and the bands tile the whole page.
 *   section   a heading of the top level (stored.t) or higher, with the lower headings after it until the next one
 *   top       everything above the first section heading
 * y0 / y1 are fractions of the page height (0 to 1). A section's ms includes its sub-headings'; ownMs is its heading's
 * own time (the stretch before its first sub-heading). Time on a heading that is not in the structure (the page
 * changed since) is returned as unplacedMs, never drawn.
 * Returns null when there are no usable structure rows: the caller then has no places to draw (use sectionsOf).
 * @returns {{ sections: { text: string | null, y0: number, y1: number, col: number, cols: number, ms: number, ownMs: number, entries: number, isTop: boolean, subs: { text: string, y0: number, y1: number, ms: number, entries: number }[] }[], unplacedMs: number } | null}
 */
export function layoutSections(stored, structureRows) {
  if (!stored || typeof stored !== "object" || !Array.isArray(stored.h) || !Array.isArray(structureRows) || structureRows.length === 0) return null;
  const pageHeight = Number(structureRows[0]?.page_height);
  if (!(pageHeight > 0)) return null;
  const top = Number(stored.t) || 1;
  const seen = new Map();
  const rows = [];
  for (const r of [...structureRows].sort((a, b) => (a.header_index ?? 0) - (b.header_index ?? 0))) {
    const text = typeof r?.header_text === "string" ? r.header_text.replace(/\s+/g, " ").trim() : "";
    const y = Number(r?.position_y);
    const level = Number(String(r?.header_tag ?? "").replace(/\D/g, "")) || 3;
    if (!text || !Number.isFinite(y)) continue;
    const base = keyOfText(text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    rows.push({ key: n > 1 ? base + "#" + n : base, text, level, y: Math.min(1, Math.max(0, y / pageHeight)) });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a.y - b.y);

  const timeOf = new Map(); // key -> { ms, entries }
  let aboveMs = 0;
  let aboveEntries = 0;
  for (const e of stored.h) {
    if (!Array.isArray(e) || typeof e[0] !== "string") continue;
    const ms = (Number(e[3]) || 0) * 100;
    const entries = Number(e[4]) || 0;
    if (e[0] === "^") { aboveMs += ms; aboveEntries += entries; } else timeOf.set(e[0], { ms, entries });
  }

  const sections = [];
  let cur = { text: null, y0: 0, y1: 1, col: 0, cols: 1, ms: aboveMs, ownMs: aboveMs, entries: aboveEntries, isTop: true, subs: [] };
  const used = new Set();
  for (const r of rows) {
    const t = timeOf.get(r.key) ?? { ms: 0, entries: 0 };
    if (timeOf.has(r.key)) used.add(r.key);
    if (r.level <= top) {
      cur.y1 = r.y;
      sections.push(cur);
      cur = { text: r.text, y0: r.y, y1: 1, col: 0, cols: 1, ms: t.ms, ownMs: t.ms, entries: t.entries, isTop: false, subs: [] };
    } else {
      cur.ms += t.ms;
      if (cur.isTop) cur.ownMs += t.ms; // a small heading before the first section belongs to the top of the page
      cur.subs.push({ text: r.text, y0: r.y, y1: 1, ms: t.ms, entries: t.entries });
    }
  }
  sections.push(cur);
  // Section headings on the same row (columns side by side) share one band: same y0 and y1, told apart by col / cols.
  // The page does not record where across a heading sits, so their order is the order in the page's code, and the
  // smaller headings under a row are given to its last column.
  const tie = 24 / pageHeight;
  const bands = [];
  for (const s of sections) {
    const last = bands[bands.length - 1];
    if (!s.isTop && last && !last[0].isTop && s.y0 - last[0].y0 <= tie) last.push(s);
    else bands.push([s]);
  }
  bands.forEach((band, i) => {
    const nextY = i + 1 < bands.length ? bands[i + 1][0].y0 : 1;
    band.forEach((s, c) => {
      s.y0 = band[0].y0;
      s.y1 = nextY;
      s.col = c;
      s.cols = band.length;
    });
  });
  // a sub-heading ends where the next one starts, or where its section ends
  for (const s of sections) s.subs.forEach((x, i) => { x.y1 = i + 1 < s.subs.length ? s.subs[i + 1].y0 : s.y1; });
  // the top band is empty when the first heading is at the very top: drop it unless it has time
  const out = sections.filter((s) => !(s.isTop && s.y1 - s.y0 < 0.002 && s.ms === 0 && !s.subs.length));
  let unplacedMs = 0;
  timeOf.forEach((v, k) => { if (!used.has(k)) unplacedMs += v.ms; });
  return { sections: out, unplacedMs };
}
