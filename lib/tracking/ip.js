// lib/tracking/ip.js
// Visitor IP handling. A raw IP is personal data, and Jellyhook only ever
// needed it to find a country. So:
//   - on Vercel the country comes straight from the platform's own header
//     (x-vercel-ip-country), with no IP lookup and no third party;
//   - what is stored about the IP is a salted HMAC hash (visitors.ip_hash),
//     enough to recognise a repeat device, useless as an address;
//   - the raw IP is kept only when the platform gave no country and a lookup
//     is still pending, and is erased as soon as that lookup is done.
import { createHmac } from "node:crypto";

/** Salted HMAC-SHA256 of an IP, hex. Returns null when there is no IP or no salt (never hashes with an empty salt). */
export function hashIp(ip, salt = process.env.IP_HASH_SALT) {
  if (!ip || ip === "unknown" || !salt) return null;
  return createHmac("sha256", salt).update(String(ip)).digest("hex");
}

const regionNames = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

/**
 * "US" -> "United States", the same English names the old IP lookup stored in
 * sessions.country. Returns null for anything that isn't a 2-letter region
 * (including Vercel's "XX" for unknown).
 */
export function countryNameFromCode(code) {
  if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code) || code.toUpperCase() === "XX") return null;
  try {
    const name = regionNames?.of(code.toUpperCase());
    return name && name !== code.toUpperCase() ? name : null;
  } catch {
    return null;
  }
}
