// lib/tracking/hosts.js
// Which website an event came from, and whether that website is the one the
// site was registered for. Pure: no database, no network.
//
// A site registered as "example.com" accepts events from example.com,
// www.example.com and any subdomain (shop.example.com), plus any host the
// owner added to the site's allowed hosts (for example localhost while
// testing, or a separate checkout domain). Anything else is NOT accepted:
// it is counted as an "unmatched host" so the owner can see it and choose
// to allow it. See mds/audit/tracker-backend-audit-2026-10-07.md, problem 2.

/** "https://www.Example.com:8080/a?b" or "WWW.example.com." -> "example.com". "" if it can't be read. */
export function normalizeHost(input) {
  if (typeof input !== "string") return "";
  let s = input.trim().toLowerCase();
  if (!s) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//.test(s)) {
    try {
      s = new URL(s).hostname;
    } catch {
      return "";
    }
  } else {
    s = s.split("/")[0].split("?")[0].split("#")[0];
    // strip a port, but leave an IPv6 literal alone
    if (!s.startsWith("[")) s = s.replace(/:\d+$/, "");
  }
  s = s.replace(/\.$/, "").replace(/^www\./, "");
  return /^[a-z0-9.\-[\]:]+$/.test(s) ? s : "";
}

/** The host of a full URL, or "". */
export function hostFromUrl(url) {
  return typeof url === "string" && url ? normalizeHost(url) : "";
}

/**
 * The host an event came from. The browser's own Origin header wins when there
 * is one: a visitor's browser sets it itself and the page's JavaScript cannot
 * forge it, unlike a host written into the body. Without an Origin (server-side
 * senders, sandboxed frames that send "null") it falls back to the host the
 * tracker reported, then the page URL, then Referer. A non-browser client can
 * still claim any host: host matching stops mistakes and casual abuse of a
 * public key, it is not authentication.
 * @param {{host?: string, page_url?: string}} event
 * @param {{get(name: string): string | null} | null} headers
 */
export function hostFromEvent(event, headers) {
  const origin = headers?.get?.("origin");
  const originHost = origin && origin !== "null" ? hostFromUrl(origin) : "";
  return originHost || normalizeHost(event?.host) || hostFromUrl(event?.page_url) || hostFromUrl(headers?.get?.("referer")) || "";
}

/** true when `host` is the site's own domain, a subdomain of it, or an allowed host (or a subdomain of one). */
export function hostMatchesSite(host, site) {
  const h = normalizeHost(host);
  if (!h) return false;
  const domain = normalizeHost(site?.domain);
  const candidates = [domain, ...(Array.isArray(site?.allowed_hosts) ? site.allowed_hosts.map(normalizeHost) : [])].filter(Boolean);
  return candidates.some((c) => h === c || h.endsWith("." + c));
}

/** A host the owner may add: a real hostname, localhost or an IP, nothing else. Returns the normalized host or "". */
export function validateAllowedHost(input) {
  const h = normalizeHost(input);
  if (!h || h.length > 253) return "";
  if (h === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h;
  return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(h) ? h : "";
}
