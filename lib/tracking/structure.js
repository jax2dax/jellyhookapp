// lib/tracking/structure.js
// Page structure (headings and where they sit), versioned. Server side.
//
// The tracker reports a page's headings. The server fingerprints them; the
// same fingerprint again means "unchanged", a new one means the page changed
// and becomes a NEW version (the old one is kept, with its dates). So every
// recorded visit can be drawn with the headings the page really had when it
// was visited. See mds/migrations/2026-10-07-ingestion-hardening.sql and
// lib/leadSessions/resolveStructure.js (which picks the version for a visit).
import { createHash } from "node:crypto";

export const MAX_HEADERS = 80;
const MAX_TEXT = 200;
const TAGS = new Set(["h1", "h2", "h3"]);
/** A heading's position is rounded to this many px, so sub-pixel layout jitter is not a "change". */
const Y_STEP = 50;
/** The page height is rounded to this many px for the same reason. */
const HEIGHT_STEP = 100;

/** Validates and cleans what the tracker sent. Returns [] if nothing usable. */
export function normalizeHeaders(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const h of raw.slice(0, MAX_HEADERS)) {
    const text = typeof h?.header_text === "string" ? h.header_text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
    const tag = typeof h?.header_tag === "string" ? h.header_tag.toLowerCase() : "";
    const y = Number(h?.position_y);
    if (!text || !TAGS.has(tag) || !Number.isFinite(y) || y < 0 || y > 10_000_000) continue;
    out.push({ i: out.length, text, tag, y: Math.round(y) });
  }
  return out;
}

export function pageHeightOf(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n < 10_000_000 ? Math.round(n) : 0;
}

/** Stable identity of a structure: tags, normalized text, rounded positions, rounded page height. */
export function fingerprint(headers, pageHeight) {
  const body = JSON.stringify([
    headers.map((h) => [h.tag, h.text.toLowerCase(), Math.round(h.y / Y_STEP) * Y_STEP]),
    Math.round(pageHeight / HEIGHT_STEP) * HEIGHT_STEP,
  ]);
  return createHash("sha256").update(body).digest("hex").slice(0, 24);
}

/** "mobile" under 768 px wide, otherwise "desktop" (also when the width is unknown). */
export function deviceClassFromWidth(width) {
  const w = Number(width);
  return Number.isFinite(w) && w > 0 && w < 768 ? "mobile" : "desktop";
}

/** At most this many versions are kept per (site, page, device class). */
export const MAX_VERSIONS_PER_PAGE = 50;
/** A new version cannot appear sooner than this after the previous one. */
export const MIN_VERSION_GAP_MS = 10 * 60 * 1000;

/**
 * Whether a structure the server has not seen before may become a new version.
 * Pages whose headings change on every load (a name, a cart count, a date in a
 * heading) would otherwise create a version per visit and grow without bound.
 * A refused structure is not lost: the page view links to the newest version.
 * @param {{ count: number, newestFirstSeenAt: string | null, now?: number }} p
 */
export function canCreateVersion({ count, newestFirstSeenAt, now = Date.now() }) {
  if (count >= MAX_VERSIONS_PER_PAGE) return false;
  if (newestFirstSeenAt && now - new Date(newestFirstSeenAt).getTime() < MIN_VERSION_GAP_MS) return false;
  return true;
}
