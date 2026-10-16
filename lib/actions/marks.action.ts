// lib/actions/marks.action.ts
// Marks on leads: list, save, turn on/off, delete, re-check, share, and "Enter with AI". The site always comes from
// the server (siteOrThrow), never from the browser. Marks are read and written with the user's own login, so the
// database's rules apply on top of these checks (mds/migrations/18-marks.sql): a mark is personal unless shared, and
// only its creator can change it. Which leads have a mark is decided by the server only (lib/marks/evaluate.ts).
// Design: mds/build/marks/marks.md.
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { describeSpec } from "@/jh-hook/describe";
import { migrateSpec } from "@/jh-hook/migrate";
import type { HookSpec } from "@/jh-hook/types";
import { creditsFor, resolveModel } from "@/jh-ai/models";
import { providerFor, ProviderError } from "@/jh-ai/providers";
import { translateMark, type MarkAiResult } from "@/jh-marks/ai";
import { compileRule, describeRule, MARK_LIMIT, RuleError, validateRule, type MarkRule } from "@/jh-marks/rule";
import { checkQuota, recordRequest } from "@/lib/ai/ledger";
import { listSitePages } from "@/lib/actions/hook.action";
import { siteOrThrow } from "@/lib/hook/site";
import { evaluateMark } from "@/lib/marks/evaluate";
import { createSupabaseClient } from "@/lib/supabase";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type Visibility = "private" | "team" | "members";

export interface MarkView {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  visibility: Visibility;
  sharedWith: string[];
  /** null = made in Hook: edit it there */
  rule: MarkRule | null;
  spec: HookSpec;
  reads: string | null;
  templateKey: string | null;
  mine: boolean;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  matchCount: number | null;
  evaluatedAt: string | null;
}

export interface LeadMark {
  leadId: string;
  markId: string;
  parts: string[];
}

export interface TeamMember {
  userId: string;
  email: string | null;
}

export type MarksState =
  | { ok: true; ready: boolean; me: string; marks: MarkView[]; leadMarks: LeadMark[]; team: TeamMember[]; pages: string[]; limit: number }
  | { ok: false; error: string };

type Row = Record<string, unknown>;
const COLS = "id, name, description, color, active, visibility, shared_with, rule, spec, reads, template_key, created_by, created_by_email, created_at, updated_at, match_count, evaluated_at";

const toView = (r: Row, me: string): MarkView => ({
  id: r.id as string,
  name: r.name as string,
  description: (r.description as string) ?? null,
  color: r.color as string,
  active: !!r.active,
  visibility: (r.visibility as Visibility) ?? "private",
  sharedWith: (r.shared_with as string[]) ?? [],
  rule: (r.rule as MarkRule) ?? null,
  spec: r.spec as HookSpec,
  reads: (r.reads as string) ?? null,
  templateKey: (r.template_key as string) ?? null,
  mine: r.created_by === me,
  createdByEmail: (r.created_by_email as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  matchCount: (r.match_count as number) ?? null,
  evaluatedAt: (r.evaluated_at as string) ?? null,
});

async function who(): Promise<{ userId: string; siteId: string }> {
  const { userId } = await auth();
  if (!userId) throw new RuleError("You're signed out. Sign in again.");
  const siteId = await siteOrThrow();
  return { userId, siteId };
}

const missingTable = (msg: string | undefined) => !!msg && /marks|lead_marks/.test(msg) && /does not exist|schema cache|relation/.test(msg);

async function team(siteId: string): Promise<TeamMember[]> {
  const { data } = await admin.from("site_members").select("user_id, user_email").eq("site_id", siteId).eq("status", "active");
  return (data ?? []).filter((m) => !String(m.user_id).startsWith("pending:")).map((m) => ({ userId: m.user_id as string, email: (m.user_email as string) ?? null }));
}

/** Everything the leads page needs about marks: the visible marks, which leads have the active ones, the team, pages. */
export async function loadMarks(opts: { leadIds?: string[] } = {}): Promise<MarksState> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("marks").select(COLS).eq("site_id", siteId).order("created_at", { ascending: true });
    if (error) {
      if (missingTable(error.message)) return { ok: true, ready: false, me: userId, marks: [], leadMarks: [], team: [], pages: [], limit: MARK_LIMIT };
      throw new Error(error.message);
    }
    const marks = (data ?? []).map((r) => toView(r, userId));
    const active = marks.filter((m) => m.active).map((m) => m.id);
    let leadMarks: LeadMark[] = [];
    if (active.length) {
      let q = supabase.from("lead_marks").select("lead_id, mark_id, reason").eq("site_id", siteId).in("mark_id", active).limit(20_000);
      if (opts.leadIds) q = q.in("lead_id", opts.leadIds.slice(0, 500));
      const { data: lm } = await q;
      leadMarks = (lm ?? []).map((r) => ({ leadId: r.lead_id as string, markId: r.mark_id as string, parts: ((r.reason as { parts?: string[] })?.parts ?? []).slice(0, 8) }));
    }
    const [members, pages] = await Promise.all([team(siteId), listSitePages()]);
    return { ok: true, ready: true, me: userId, marks, leadMarks, team: members, pages: pages.map((p) => p.path).slice(0, 200), limit: MARK_LIMIT };
  } catch (e) {
    return { ok: false, error: e instanceof RuleError ? e.message : "Marks could not be loaded." };
  }
}

export interface SaveMarkInput {
  id?: string | null;
  name: string;
  description?: string | null;
  color: string;
  active: boolean;
  visibility: Visibility;
  sharedWith?: string[];
  /** from the chip builder */
  rule?: unknown;
  /** from Hook ("Save as mark"): a query on leads */
  spec?: unknown;
  templateKey?: string | null;
}

export type SaveMarkResult = { ok: true; mark: MarkView; warning?: string } | { ok: false; error: string };

/** Creates or edits a mark (only your own), then checks it against every lead when it is on. */
export async function saveMark(input: SaveMarkInput): Promise<SaveMarkResult> {
  try {
    const { userId, siteId } = await who();
    const name = String(input.name ?? "").trim().slice(0, 40);
    if (!name) return { ok: false, error: "Give the mark a name." };
    if (!/^#[0-9a-fA-F]{6}$/.test(String(input.color))) return { ok: false, error: "Pick a colour." };
    const description = input.description ? String(input.description).trim().slice(0, 500) || null : null;
    const visibility: Visibility = input.visibility === "team" || input.visibility === "members" ? input.visibility : "private";
    const members = await team(siteId);
    const sharedWith = visibility === "members" ? (input.sharedWith ?? []).filter((u) => members.some((m) => m.userId === u) && u !== userId).slice(0, 50) : [];
    if (visibility === "members" && !sharedWith.length) return { ok: false, error: "Choose who to share it with, or share it with the whole team." };

    let rule: MarkRule | null = null;
    let spec: HookSpec;
    let reads: string;
    if (input.rule) {
      rule = validateRule(input.rule);
      spec = compileRule(rule);
      reads = describeRule(rule);
    } else if (input.spec) {
      const m = migrateSpec(input.spec);
      if (m.spec.entity !== "lead") return { ok: false, error: "A mark needs a query that returns leads (form submissions)." };
      spec = { ...m.spec, output: { kind: "ids" } };
      reads = describeSpec(spec);
    } else return { ok: false, error: "Add at least one condition." };

    const supabase = createSupabaseClient();
    const row = { name, description, color: input.color, active: !!input.active, visibility, shared_with: sharedWith, rule, spec, reads, updated_at: new Date().toISOString() };
    let saved: Row | null = null;
    if (input.id) {
      const { data, error } = await supabase.from("marks").update(row).eq("id", input.id).eq("site_id", siteId).eq("created_by", userId).select(COLS).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { ok: false, error: "Only the person who made this mark can change it." };
      saved = data;
    } else {
      const { count } = await supabase.from("marks").select("id", { count: "exact", head: true }).eq("site_id", siteId).eq("created_by", userId);
      if ((count ?? 0) >= MARK_LIMIT) return { ok: false, error: `You have ${MARK_LIMIT} marks, the most there can be. Delete one to make another.` };
      const email = (await currentUser())?.primaryEmailAddress?.emailAddress ?? null;
      const { data, error } = await supabase.from("marks").insert({ ...row, site_id: siteId, kind: "lead", created_by: userId, created_by_email: email, template_key: input.templateKey ?? null }).select(COLS).single();
      if (error) {
        if (/mark_limit/.test(error.message)) return { ok: false, error: `You have ${MARK_LIMIT} marks, the most there can be. Delete one to make another.` };
        if (missingTable(error.message)) return { ok: false, error: "Marks are not set up yet (migration 18)." };
        throw new Error(error.message);
      }
      saved = data;
    }
    let warning: string | undefined;
    if (saved && row.active) {
      try {
        saved.match_count = await evaluateMark(siteId, { id: saved.id as string, rule, spec, reads });
        saved.evaluated_at = new Date().toISOString();
      } catch (e) {
        console.error("[marks] check failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
        warning = "Saved, but the leads could not be checked right now. Use Re-check in a minute.";
      }
    }
    return { ok: true, mark: toView(saved!, userId), warning };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error("[marks] save failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The mark could not be saved. Try again." };
  }
}

/** Turns a mark on or off (only your own). Turning it on checks every lead. */
export async function setMarkActive(id: string, active: boolean): Promise<{ ok: true; matchCount: number | null } | { ok: false; error: string }> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("marks").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("site_id", siteId).eq("created_by", userId).select("id, rule, spec, reads").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, error: "Only the person who made this mark can turn it on or off." };
    if (!active) return { ok: true, matchCount: null };
    const n = await evaluateMark(siteId, { id, rule: (data.rule as MarkRule) ?? null, spec: data.spec as HookSpec, reads: data.reads as string });
    return { ok: true, matchCount: n };
  } catch (e) {
    console.error("[marks] on/off failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "That didn't work. Try again." };
  }
}

/** Checks a mark against every lead again (any mark you can see). */
export async function recheckMark(id: string): Promise<{ ok: true; matchCount: number } | { ok: false; error: string }> {
  try {
    const { siteId } = await who();
    const supabase = createSupabaseClient();
    const { data } = await supabase.from("marks").select("id, rule, spec, reads, active").eq("id", id).eq("site_id", siteId).maybeSingle();
    if (!data) return { ok: false, error: "That mark is not available." };
    const n = await evaluateMark(siteId, { id, rule: (data.rule as MarkRule) ?? null, spec: data.spec as HookSpec, reads: data.reads as string });
    return { ok: true, matchCount: n };
  } catch (e) {
    console.error("[marks] re-check failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The leads could not be checked right now. Try again in a minute." };
  }
}

/** Deletes a mark (only your own); its badges go with it. */
export async function deleteMark(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("marks").delete().eq("id", id).eq("site_id", siteId).eq("created_by", userId).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) return { ok: false, error: "Only the person who made this mark can delete it." };
    return { ok: true };
  } catch (e) {
    console.error("[marks] delete failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The mark could not be deleted. Try again." };
  }
}

/** The marks one lead has (active marks you can see), with the reasons: the top of the lead's page. */
export async function marksOfLead(leadId: string): Promise<{ mark: MarkView; parts: string[] }[]> {
  const s = await loadMarks({ leadIds: [leadId] });
  if (!s.ok) return [];
  return s.leadMarks.filter((l) => l.leadId === leadId).map((l) => ({ mark: s.marks.find((m) => m.id === l.markId)!, parts: l.parts })).filter((x) => x.mark);
}

function friendly(e: ProviderError): string {
  if (e.kind === "rate_limit") return "The AI is busy right now. Try again in a moment.";
  if (e.kind === "timeout") return "The AI took too long. Try again, or use the keys below.";
  return "The AI is not available right now. Use the keys below.";
}

/** "Enter with AI": a sentence -> a rule for the builder. Same allowance and ledger as Ask Hook. */
export async function markFromAi(sentence: string): Promise<{ ok: true; result: MarkAiResult; usedToday: number; limitToday: number } | { ok: false; error: string }> {
  const s = typeof sentence === "string" ? sentence.trim() : "";
  if (!s) return { ok: false, error: "Describe the lead first." };
  if (s.length > 400) return { ok: false, error: "Keep it under 400 characters." };
  let userId = "";
  let siteId = "";
  try {
    ({ userId, siteId } = await who());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No site is available." };
  }
  if (process.env.AI_ENABLED === "0" || !process.env.OPENAI_API_KEY) return { ok: false, error: "The AI is not available right now. Use the keys below." };
  const quota = await checkQuota(userId);
  if (!quota.ok) return { ok: false, error: quota.reason === "user_limit" ? `You've used today's ${quota.limitToday} AI questions. They reset at midnight UTC.` : "The AI is not available right now." };
  const { def } = resolveModel();
  try {
    const pages = (await listSitePages()).map((p) => p.path).filter((p) => p.startsWith("/") && p.length <= 60 && !/@|[0-9a-f]{8,}|\d{6,}/i.test(p));
    const { result, trace } = await translateMark(s, pages, { provider: providerFor(def.provider), model: def });
    await recordRequest({ userId, siteId, feature: "mark_translate", status: result.status, trace, model: def.id, credits: creditsFor(trace.costUsd), questionChars: s.length, question: s, spec: result.status === "ok" ? result.rule : undefined });
    return { ok: true, result, usedToday: quota.usedToday + 1, limitToday: quota.limitToday };
  } catch (e) {
    await recordRequest({ userId, siteId, feature: "mark_translate", status: "error", trace: null, model: def.id, credits: 0, questionChars: s.length });
    if (e instanceof ProviderError) return { ok: false, error: friendly(e) };
    console.error("[marks] ai failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Something went wrong on our side. Use the keys below." };
  }
}
