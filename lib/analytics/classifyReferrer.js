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
  if (session.utm_source) return titleCase(session.utm_source);

  const host = session.referrer ? hostnameOf(session.referrer) : null;
  if (!host) return "Direct";

  for (const [pattern, label] of KNOWN_DOMAINS) {
    if (pattern.test(host)) return label;
  }
  return host.replace(/^www\./, "");
}
