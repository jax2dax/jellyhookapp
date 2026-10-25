// lib/actions/pageHeadings.action.ts
// The headings of one page of the site, for the mark builder's heading picker: each with the key the tracker gives it
// (lib/tracking/headingTime.js keyOfText, "#2" for a repeated text), so a mark matches time per heading exactly.
// From the page's stored structure (page_structure_versions, newest first; the old page_structure as a fallback).
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { keyOfText } from "@/lib/tracking/headingTime";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface PageHeading {
  key: string;
  text: string;
  /** h1, h2 or h3 */
  tag: string;
}

/** Keys as the tracker makes them: in page order, the second heading with the same text gets "#2". */
function keyed(list: { text: string; tag: string }[]): PageHeading[] {
  const seen = new Map<string, number>();
  return list.map((h) => {
    const base = keyOfText(h.text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { key: n > 1 ? base + "#" + n : base, text: h.text, tag: h.tag };
  });
}

export async function loadPageHeadings(path: string): Promise<{ ok: true; headings: PageHeading[] } | { ok: false; error: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
    const siteId = await siteOrThrow();
    const p = String(path ?? "").split("?")[0].slice(0, 200);
    if (!p.startsWith("/")) return { ok: true, headings: [] };
    const { data: versions } = await admin.from("page_structure_versions").select("headers, first_seen_at").eq("site_id", siteId).eq("page_path", p).order("first_seen_at", { ascending: false }).limit(3);
    const out: PageHeading[] = [];
    const have = new Set<string>();
    for (const v of versions ?? []) {
      const list = (Array.isArray(v.headers) ? v.headers : [])
        .filter((h: { text?: unknown }) => typeof h?.text === "string" && h.text.trim())
        .sort((a: { i?: number }, b: { i?: number }) => (a.i ?? 0) - (b.i ?? 0))
        .map((h: { text: string; tag?: string }) => ({ text: h.text.replace(/\s+/g, " ").trim(), tag: String(h.tag ?? "h2").toLowerCase() }));
      for (const h of keyed(list)) {
        if (have.has(h.key)) continue;
        have.add(h.key);
        out.push(h);
      }
    }
    if (!out.length) {
      const { data: legacy } = await admin.from("page_structure").select("header_index, header_text, header_tag").eq("site_id", siteId).eq("page_path", p).order("header_index");
      out.push(...keyed((legacy ?? []).map((r) => ({ text: String(r.header_text ?? "").replace(/\s+/g, " ").trim(), tag: String(r.header_tag ?? "h2").toLowerCase() })).filter((h) => h.text)));
    }
    return { ok: true, headings: out.slice(0, 80) };
  } catch (e) {
    console.error("[pageHeadings] failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "The page's headings could not be loaded." };
  }
}
