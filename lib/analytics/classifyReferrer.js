// lib/analytics/classifyReferrer.js
// Turns a session's (utm_source, utm_medium, referrer) into one human
// label for the referrer breakdown chart. UTM always wins when present —
// it's the marketer's own deliberate tag, more trustworthy than inferring
// from a raw referrer URL (see mds/progress_timeline.md's UTM entry for
// why plain document.referrer alone is not reliable enough to build a
// source-attribution chart on).
const KNOWN_DOMAINS = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\./, "Bing"],
  [/(^|\.)duckduckgo\./, "DuckDuckGo"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)facebook\./, "Facebook"],
  [/(^|\.)instagram\./, "Instagram"],
  [/(^|\.)linkedin\./, "LinkedIn"],
  [/(^|\.)(twitter\.|x\.com)/, "Twitter/X"],
  [/(^|\.)tiktok\./, "TikTok"],
  [/(^|\.)youtube\./, "YouTube"],
  [/(^|\.)reddit\./, "Reddit"],
  [/(^|\.)pinterest\./, "Pinterest"],
];

// utm_source spellings that mean the same platform (2026-10-14): "fb", "Facebook" and "facebook.com" are one source.
// Matched after lower-casing, trimming and dropping "www." and a trailing ".com"; anything not listed is title-cased.
// Labels match KNOWN_DOMAINS above, so a tagged and an untagged visit from the same platform land on the same label.
const SOURCE_ALIASES = {
  fb: "Facebook", facebook: "Facebook", meta: "Facebook", "m.facebook": "Facebook", "l.facebook": "Facebook",
  ig: "Instagram", insta: "Instagram", instagram: "Instagram",
  li: "LinkedIn", linkedin: "LinkedIn", lnkd: "LinkedIn", "lnkd.in": "LinkedIn",
  x: "Twitter/X", twitter: "Twitter/X", "t.co": "Twitter/X",
  tt: "TikTok", tiktok: "TikTok",
  yt: "YouTube", youtube: "YouTube",
  reddit: "Reddit",
  google: "Google", adwords: "Google", "google ads": "Google", "google_ads": "Google",
  bing: "Bing", pinterest: "Pinterest", duckduckgo: "DuckDuckGo", yahoo: "Yahoo",
};

/** One label for a utm_source however it was spelled. Exported for tests and other charts. */
export function normalizeSource(raw) {
  const key = String(raw || "").trim().toLowerCase().replace(/^www./, "").replace(/.com$/, "");
  if (!key) return null;
  return SOURCE_ALIASES[key] || titleCase(key);
}

function titleCase(s) {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * @param {{ utm_source?: string|null, referrer?: string|null }} session
 * @returns {string} human label, e.g. "Google", "Facebook", "example.com", "Direct"
 */
export function classifyReferrer(session) {
  if (session.utm_source) return normalizeSource(session.utm_source) || "Direct";

  const host = session.referrer ? hostnameOf(session.referrer) : null;
  if (!host) return "Direct";

  for (const [pattern, label] of KNOWN_DOMAINS) {
    if (pattern.test(host)) return label;
  }
  return host.replace(/^www\./, "");
}
