// lib/hook/specParam.ts
// A Hook query in a URL (?q=): JSON, UTF-8, base64url. Shared by the Hook page and anything that links into it
// ("Open in Hook" in the mark builder), so both always agree.
export function encodeSpecParam(s: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSpecParam(q: string): unknown {
  const bin = atob(q.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}
