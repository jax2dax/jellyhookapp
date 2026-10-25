// lib/actions/marksAi.action.ts
// "Enter with AI" for the new mark builder (jh-marks/v2/ai.ts). Same allowance and ledger as the old one
// (feature "mark_translate"). Gives the model the site's pages, its form fields (never answers) and, only when the
// sentence names a part of a page, the site's headings that match those words.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { creditsFor, resolveModel } from "@/jh-ai/models";
import { providerFor, ProviderError } from "@/jh-ai/providers";
import { sectionPhrases, translateMarkV2, type AiHeading, type MarkAiV2Result } from "@/jh-marks/v2/ai";
import { checkQuota, recordRequest } from "@/lib/ai/ledger";
import { listSitePages } from "@/lib/actions/hook.action";
import { loadFormFields } from "@/lib/actions/formFields.action";
import { siteOrThrow } from "@/lib/hook/site";
import { keyOfText } from "@/lib/tracking/headingTime";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** The site's headings (latest structure of each page), keyed like the tracker keys them. Read only when needed. */
async function siteHeadings(siteId: string): Promise<AiHeading[]> {
  const { data } = await admin.from("page_structure_versions").select("page_path, headers, first_seen_at").eq("site_id", siteId).order("first_seen_at", { ascending: false }).limit(300);
  const out: AiHeading[] = [];
  const pagesDone = new Set<string>();
  for (const v of data ?? []) {
    if (pagesDone.has(v.page_path as string)) continue; // newest version of each page only
    pagesDone.add(v.page_path as string);
    const seen = new Map<string, number>();
    const list = (Array.isArray(v.headers) ? v.headers : []).filter((h: { text?: unknown }) => typeof h?.text === "string" && h.text.trim()).sort((a: { i?: number }, b: { i?: number }) => (a.i ?? 0) - (b.i ?? 0));
    for (const h of list as { text: string }[]) {
      const text = h.text.replace(/\s+/g, " ").trim();
      const base = keyOfText(text);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      out.push({ key: n > 1 ? base + "#" + n : base, text, page: v.page_path as string });
    }
  }
  return out;
}

export async function markFromAiV2(sentence: string): Promise<{ ok: true; result: MarkAiV2Result; usedToday: number; limitToday: number } | { ok: false; error: string }> {
  const s = typeof sentence === "string" ? sentence.trim() : "";
  if (!s) return { ok: false, error: "Describe the lead first." };
  if (s.length > 400) return { ok: false, error: "Keep it under 400 characters." };
  let userId = "";
  let siteId = "";
  try {
    const a = await auth();
    if (!a.userId) return { ok: false, error: "You're signed out. Sign in again." };
    userId = a.userId;
    siteId = await siteOrThrow();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No site is available." };
  }
  if (process.env.AI_ENABLED === "0" || !process.env.OPENAI_API_KEY) return { ok: false, error: "The AI is not available right now. Build the mark by hand." };
  const quota = await checkQuota(userId);
  if (!quota.ok) return { ok: false, error: quota.reason === "user_limit" ? `You've used today's ${quota.limitToday} AI questions. They reset at midnight UTC.` : "The AI is not available right now." };
  const { def } = resolveModel();
  try {
    const [pagesRaw, fieldsRes, headings] = await Promise.all([listSitePages(), loadFormFields(), sectionPhrases(s).length ? siteHeadings(siteId) : Promise.resolve([] as AiHeading[])]);
    const pages = pagesRaw.map((p) => p.path).filter((p) => p.startsWith("/") && p.length <= 60 && !/@|[0-9a-f]{8,}|\d{6,}/i.test(p));
    const fields = fieldsRes.ok ? fieldsRes.fields.map((f) => ({ key: f.key, name: f.name, kind: f.kind, options: f.options, min: f.min, max: f.max })) : [];
    const { result, trace } = await translateMarkV2(s, { pages, fields, headings }, { provider: providerFor(def.provider), model: def });
    await recordRequest({ userId, siteId, feature: "mark_translate", status: result.status === "missingField" ? "clarify" : result.status, trace, model: def.id, credits: creditsFor(trace.costUsd), questionChars: s.length, question: s, spec: result.status === "ok" ? result.rule : undefined });
    return { ok: true, result, usedToday: quota.usedToday + 1, limitToday: quota.limitToday };
  } catch (e) {
    await recordRequest({ userId, siteId, feature: "mark_translate", status: "error", trace: null, model: def.id, credits: 0, questionChars: s.length });
    if (e instanceof ProviderError) return { ok: false, error: "The AI did not answer. Try again in a moment." };
    console.error("[marks] ai v2 failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Something went wrong on our side. Build the mark by hand." };
  }
}
