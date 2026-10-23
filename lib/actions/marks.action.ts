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
import { catalogMark, catalogVersion, type MarkVar } from "@/jh-marks/catalog";
import { cleanPath, compileRule, describeRule, MARK_LIMIT, RuleError, validateRule, type MarkRule } from "@/jh-marks/rule";
import { checkQuota, recordRequest } from "@/lib/ai/ledger";
import { listSitePages } from "@/lib/actions/hook.action";
import { siteOrThrow } from "@/lib/hook/site";
import { evaluateMark, type MarkToRun } from "@/lib/marks/evaluate";
import { getSiteStats } from "@/lib/stats/siteStats";
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
  /** null = made in Hook: edit it there (or a locked published mark) */
  rule: MarkRule | null;
  spec: HookSpec | null;
  reads: string | null;
  templateKey: string | null;
  /** own (built by the person), copy (of a published mark, theirs), connected (uses a published mark, plug icon) */
  source: "own" | "copy" | "connected";
  sourceKey: string | null;
  /** page variables of a connected mark: their definitions and the person's values */
  vars: MarkVar[];
  varValues: Record<string, string>;
  /** the publisher hid the formula: only page variables can be changed */
  locked: boolean;
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
  | { ok: true; ready: boolean; me: string; marks: MarkView[]; leadMarks: LeadMark[]; team: TeamMember[]; pages: string[]; limit: number; totalLimit: number }
  | { ok: false; error: string };

type Row = Record<string, unknown>;
const COLS = "id, name, description, color, active, visibility, shared_with, rule, spec, reads, template_key, created_by, created_by_email, created_at, updated_at, match_count, evaluated_at";
/** with the library columns (19-marks-library.sql); every read falls back to COLS when they do not exist yet */
const COLS_LIB: string = COLS + ", source, source_key, source_version, var_values, locked";
const libMissing = (msg: string | undefined) => !!msg && /source|var_values|locked/.test(msg);
/** At most this many marks per person per site: built by them (MARK_LIMIT) and in all, with copies and connected ones. */
const TOTAL_LIMIT = 15;

function connectedParts(r: Row): Pick<MarkView, "rule" | "spec" | "reads" | "vars"> {
  const c = catalogMark(r.source_key as string);
  if (!c) return { rule: null, spec: null, reads: "This published mark is no longer available.", vars: [] };
  const made = c.make({ vars: (r.var_values as Record<string, string>) ?? {}, stats: { sessionHighMs: null } });
  const rule = "rule" in made ? made.rule : null;
  const spec = "rule" in made ? compileRule(made.rule) : made.spec;
  const locked = !!r.locked || !!c.locked;
  return { rule: locked ? null : rule, spec: locked ? null : spec, reads: locked ? null : rule ? describeRule(rule) : c.reads ?? describeSpec(spec), vars: c.vars ?? [] };
}

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
  source: ((r.source as MarkView["source"]) ?? "own"),
  sourceKey: (r.source_key as string) ?? null,
  vars: [],
  varValues: (r.var_values as Record<string, string>) ?? {},
  locked: !!r.locked,
  ...(r.source === "connected" ? connectedParts(r) : {}),
  // a copy made from a published mark keeps its values editable until its formula is changed by hand in the builder
  ...(r.source === "copy" && r.source_version !== "edited" ? { vars: catalogMark(r.source_key as string)?.vars ?? [] } : {}),
});

/** One mark row the person can see, with the library columns when they exist. */
async function markRow(supabase: ReturnType<typeof createSupabaseClient>, siteId: string, id: string, cols = COLS_LIB): Promise<Row | null> {
  const first = await supabase.from("marks").select(cols).eq("id", id).eq("site_id", siteId).maybeSingle();
  if (first.error && libMissing(first.error.message)) return ((await supabase.from("marks").select(COLS).eq("id", id).eq("site_id", siteId).maybeSingle()).data as unknown as Row) ?? null;
  return (first.data as unknown as Row) ?? null;
}

const toRun = (r: Row): MarkToRun => ({ id: r.id as string, rule: (r.rule as MarkRule) ?? null, spec: (r.spec as HookSpec) ?? null, reads: (r.reads as string) ?? null, source: (r.source as MarkToRun["source"]) ?? "own", source_key: (r.source_key as string) ?? null, var_values: (r.var_values as Record<string, string>) ?? {} });

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
export async function loadMarks(opts: { leadIds?: string[]; withLeadMarks?: boolean } = {}): Promise<MarksState> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    type Res = { data: unknown[] | null; error: { message: string } | null };
    let res: Res = await supabase.from("marks").select(COLS_LIB).eq("site_id", siteId).order("created_at", { ascending: true });
    if (res.error && libMissing(res.error.message)) res = await supabase.from("marks").select(COLS).eq("site_id", siteId).order("created_at", { ascending: true });
    const { data, error } = res;
    if (error) {
      if (missingTable(error.message)) return { ok: true, ready: false, me: userId, marks: [], leadMarks: [], team: [], pages: [], limit: MARK_LIMIT, totalLimit: TOTAL_LIMIT };
      throw new Error(error.message);
    }
    const rows = (data ?? []) as Row[];
    // a connected mark whose published version changed: take the new name and purpose, and check the leads again
    for (const r of rows) {
      if (r.source !== "connected" || r.created_by !== userId) continue;
      const c = catalogMark(r.source_key as string);
      if (!c || r.source_version === catalogVersion(c)) continue;
      try {
        r.match_count = await evaluateMark(siteId, toRun(r));
        r.evaluated_at = new Date().toISOString();
        r.source_version = catalogVersion(c);
        r.name = c.name;
        r.description = c.purpose;
        await admin.from("marks").update({ source_version: r.source_version, name: c.name, description: c.purpose }).eq("id", r.id as string);
      } catch (e) {
        console.error("[marks] connected update failed", { mark: String(r.id).slice(0, 8), error: e instanceof Error ? e.message : String(e) });
      }
    }
    const marks = rows.map((r) => toView(r, userId));
    const active = marks.filter((m) => m.active).map((m) => m.id);
    let leadMarks: LeadMark[] = [];
    if (active.length && (opts.withLeadMarks || opts.leadIds)) {
      let q = supabase.from("lead_marks").select("lead_id, mark_id, reason").eq("site_id", siteId).in("mark_id", active).limit(20_000);
      if (opts.leadIds) q = q.in("lead_id", opts.leadIds.slice(0, 500));
      const { data: lm } = await q;
      leadMarks = (lm ?? []).map((r) => ({ leadId: r.lead_id as string, markId: r.mark_id as string, parts: ((r.reason as { parts?: string[] })?.parts ?? []).slice(0, 8) }));
    }
    const [members, pages] = await Promise.all([team(siteId), listSitePages()]);
    return { ok: true, ready: true, me: userId, marks, leadMarks, team: members, pages: pages.map((p) => p.path).slice(0, 200), limit: MARK_LIMIT, totalLimit: TOTAL_LIMIT };
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
      const existing = await markRow(supabase, siteId, input.id);
      if (existing?.source === "connected") return { ok: false, error: "This mark is connected to a published mark: only its values can be changed." };
      const { data, error } = await supabase.from("marks").update(existing?.source === "copy" ? { ...row, source_version: "edited" } : row).eq("id", input.id).eq("site_id", siteId).eq("created_by", userId).select(COLS).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { ok: false, error: "Only the person who made this mark can change it." };
      saved = data;
    } else {
      const limitError = await overLimit(supabase, siteId, userId, "own");
      if (limitError) return { ok: false, error: limitError };
      const email = (await currentUser())?.primaryEmailAddress?.emailAddress ?? null;
      const { data, error } = await supabase.from("marks").insert({ ...row, site_id: siteId, kind: "lead", created_by: userId, created_by_email: email, template_key: input.templateKey ?? null }).select(COLS).single();
      if (error) {
        if (/mark_limit/.test(error.message)) return { ok: false, error: `You have reached the limit (${MARK_LIMIT} of your own, ${TOTAL_LIMIT} in all). Delete one to add another.` };
        if (missingTable(error.message)) return { ok: false, error: "Marks are not set up yet (migration 18)." };
        throw new Error(error.message);
      }
      saved = data;
    }
    let warning: string | undefined;
    if (saved) {
      try {
        saved.match_count = await evaluateMark(siteId, { id: saved.id as string, rule, spec, reads, source: (saved.source as MarkToRun["source"]) ?? "own" });
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

/** null when the person may add one more mark of this kind; else what to tell them. */
async function overLimit(supabase: ReturnType<typeof createSupabaseClient>, siteId: string, userId: string, source: "own" | "copy" | "connected"): Promise<string | null> {
  const all = await supabase.from("marks").select("id, source").eq("site_id", siteId).eq("created_by", userId);
  const rows = (all.error && libMissing(all.error.message) ? (await supabase.from("marks").select("id").eq("site_id", siteId).eq("created_by", userId)).data : all.data) ?? [];
  const own = rows.filter((r) => ((r as Row).source ?? "own") === "own").length;
  if (rows.length >= TOTAL_LIMIT) return `Your library is full (${TOTAL_LIMIT} marks). Remove one to add another.`;
  if (source === "own" && own >= MARK_LIMIT) return `You have ${MARK_LIMIT} marks of your own, the most there can be. Delete one to make another (marks from the library don't count).`;
  return null;
}

/**
 * Takes a published mark (jh-marks/catalog.ts). "copy": it becomes the person's own mark (editable; later changes to
 * the published one do not reach it). "use": connected (its updates apply; only the page variables are theirs).
 * Either way it arrives OFF: they turn it on in the leads page. It is checked against the leads at once.
 */
export async function addFromLibrary(key: string, mode: "copy" | "use", vars: Record<string, string> = {}): Promise<SaveMarkResult> {
  try {
    const { userId, siteId } = await who();
    const c = catalogMark(key);
    if (!c) return { ok: false, error: "That mark is not in the library." };
    if (mode === "copy" && c.locked) return { ok: false, error: "The publisher does not allow copies of this mark. Use it instead." };
    const supabase = createSupabaseClient();
    const limitError = await overLimit(supabase, siteId, userId, mode === "copy" ? "copy" : "connected");
    if (limitError) return { ok: false, error: limitError };
    const cleanVars = cleanVarValues(c.vars ?? [], vars);
    const email = (await currentUser())?.primaryEmailAddress?.emailAddress ?? null;
    const base = { site_id: siteId, kind: c.kind, name: c.name, description: c.purpose, color: c.color, active: false, visibility: "private", shared_with: [], created_by: userId, created_by_email: email, template_key: c.key, source_key: c.key, updated_at: new Date().toISOString() };
    let row: Row;
    if (mode === "copy") {
      // a copy is frozen: this site's numbers and page names of today become its own formula
      const stats = await getSiteStats(siteId);
      const made = c.make({ vars: cleanVars, stats: { sessionHighMs: stats?.sessionDuration.beforeConversion?.high ?? null } });
      const rule = "rule" in made ? made.rule : null;
      const spec = "rule" in made ? compileRule(made.rule) : made.spec;
      row = { ...base, source: "copy", rule, spec, reads: rule ? describeRule(rule) : c.reads ?? describeSpec(spec), var_values: cleanVars, source_version: catalogVersion(c) };
    } else {
      row = { ...base, source: "connected", rule: null, spec: null, reads: null, var_values: cleanVars, source_version: catalogVersion(c), locked: !!c.locked };
    }
    const { data, error } = await supabase.from("marks").insert(row).select(COLS_LIB).single();
    if (error) {
      if (/mark_limit/.test(error.message)) return { ok: false, error: `Your library is full (${TOTAL_LIMIT} marks). Remove one to add another.` };
      if (libMissing(error.message) || missingTable(error.message)) return { ok: false, error: "The marks library is not set up yet (migration 19)." };
      throw new Error(error.message);
    }
    const saved = data as unknown as Row;
    let warning: string | undefined;
    try {
      saved.match_count = await evaluateMark(siteId, toRun(saved));
      saved.evaluated_at = new Date().toISOString();
    } catch (e) {
      console.error("[marks] library check failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
      warning = "Added, but the leads could not be checked right now. Use Re-check in a minute.";
    }
    return { ok: true, mark: toView(saved, userId), warning };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error("[marks] library add failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The mark could not be added. Try again." };
  }
}

/**
 * Copies a mark a teammate shared into the person's own marks (a copy, never a connection: later changes to the
 * teammate's mark do not reach it). The copy is switched ON and checked against the leads at once, so it can be used
 * in a notification rule straight away.
 */
export async function copySharedMark(id: string): Promise<SaveMarkResult> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    const src = await markRow(supabase, siteId, id); // only a mark the person can see comes back
    if (!src) return { ok: false, error: "That mark is not there anymore." };
    if (src.created_by === userId) return { ok: false, error: "This mark is already yours." };
    if (src.locked || src.source === "connected") return { ok: false, error: "This mark cannot be copied." };
    const limitError = await overLimit(supabase, siteId, userId, "copy");
    if (limitError) return { ok: false, error: limitError };
    const email = (await currentUser())?.primaryEmailAddress?.emailAddress ?? null;
    const row: Row = {
      site_id: siteId, kind: "lead", name: String(src.name).slice(0, 40), description: src.description ?? null, color: src.color, active: true,
      visibility: "private", shared_with: [], rule: src.rule ?? null, spec: src.spec, reads: src.reads ?? null, template_key: src.template_key ?? null,
      created_by: userId, created_by_email: email, source: "copy", updated_at: new Date().toISOString(),
    };
    let ins = await supabase.from("marks").insert(row).select(COLS_LIB).single();
    if (ins.error && libMissing(ins.error.message)) {
      delete row.source;
      ins = await supabase.from("marks").insert(row).select(COLS).single();
    }
    if (ins.error) {
      if (/mark_limit/.test(ins.error.message)) return { ok: false, error: `Your library is full (${TOTAL_LIMIT} marks). Remove one to add another.` };
      throw new Error(ins.error.message);
    }
    const saved = ins.data as unknown as Row;
    try {
      saved.match_count = await evaluateMark(siteId, toRun(saved));
      saved.evaluated_at = new Date().toISOString();
    } catch (e) {
      console.error("[marks] copy check failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
    }
    return { ok: true, mark: toView(saved, userId) };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error("[marks] copy failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The mark could not be copied. Try again." };
  }
}

/** Values: known keys only. A page is cleaned to an address; a number must be a whole number in a sane range; an
 *  empty number is left out (the mark then uses its own default). */
function cleanVarValues(defs: MarkVar[], values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of defs) {
    const v = values[d.key];
    if (typeof v !== "string" || !v.trim()) continue;
    if (d.type === "page") {
      out[d.key] = cleanPath(v);
      continue;
    }
    const n = Number(v);
    const max = d.type === "percent" ? 100 : d.type === "seconds" ? 86_400 : 1000;
    if (!Number.isFinite(n) || n < 1 || n > max) throw new RuleError(`${d.label} must be a number from 1 to ${max}.`);
    out[d.key] = String(Math.round(n));
  }
  return out;
}

/** Sets the page variables of a connected (or locked) mark, then checks the leads again. */
export async function setMarkVars(id: string, vars: Record<string, string>): Promise<SaveMarkResult> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    const row = await markRow(supabase, siteId, id);
    if (!row || row.created_by !== userId) return { ok: false, error: "Only the person who added this mark can change it." };
    const c = catalogMark(row.source_key as string);
    if (!c || (row.source !== "connected" && row.source !== "copy")) return { ok: false, error: "This mark has no values to set." };
    if (row.source === "copy" && row.source_version === "edited") return { ok: false, error: "This copy was changed by hand: edit it in the builder." };
    const varValues = cleanVarValues(c.vars ?? [], vars);
    const patch: Row = { var_values: varValues, updated_at: new Date().toISOString() };
    if (row.source === "copy") {
      // a copy's formula is its own: rebuilt from the new values (and this site's numbers of today), then frozen again
      const stats = await getSiteStats(siteId);
      const made = c.make({ vars: varValues, stats: { sessionHighMs: stats?.sessionDuration.beforeConversion?.high ?? null } });
      const rule = "rule" in made ? made.rule : null;
      const spec = "rule" in made ? compileRule(made.rule) : made.spec;
      Object.assign(patch, { rule, spec, reads: rule ? describeRule(rule) : c.reads ?? describeSpec(spec) });
    }
    const { data, error } = await supabase.from("marks").update(patch).eq("id", id).eq("created_by", userId).select(COLS_LIB).single();
    if (error) throw new Error(error.message);
    const saved = data as unknown as Row;
    saved.match_count = await evaluateMark(siteId, toRun(saved));
    saved.evaluated_at = new Date().toISOString();
    return { ok: true, mark: toView(saved, userId) };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error("[marks] variables failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "That didn't work. Try again." };
  }
}

/** Turns a mark on or off (only your own): one small update. Results are kept up to date either way (evaluate.ts), so
 *  nothing is re-checked, unless the mark was never checked at all. */
export async function setMarkActive(id: string, active: boolean): Promise<{ ok: true; matchCount: number | null; evaluatedAt: string | null } | { ok: false; error: string }> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("marks").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("site_id", siteId).eq("created_by", userId).select("id, match_count, evaluated_at").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, error: "Only the person who made this mark can turn it on or off." };
    if (!active || data.evaluated_at) return { ok: true, matchCount: (data.match_count as number) ?? null, evaluatedAt: (data.evaluated_at as string) ?? null };
    const row = await markRow(supabase, siteId, id);
    const n = await evaluateMark(siteId, toRun(row!));
    return { ok: true, matchCount: n, evaluatedAt: new Date().toISOString() };
  } catch (e) {
    console.error("[marks] on/off failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "That didn't work. Try again." };
  }
}

/** Checks a mark against every lead again (any mark you can see). */
export async function recheckMark(id: string): Promise<{ ok: true; matchCount: number; evaluatedAt: string } | { ok: false; error: string }> {
  try {
    const { siteId } = await who();
    const supabase = createSupabaseClient();
    const data = await markRow(supabase, siteId, id);
    if (!data) return { ok: false, error: "That mark is not available." };
    const n = await evaluateMark(siteId, toRun(data));
    return { ok: true, matchCount: n, evaluatedAt: new Date().toISOString() };
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
  const s = await loadMarks({ leadIds: [leadId], withLeadMarks: true });
  if (!s.ok) return [];
  return s.leadMarks.filter((l) => l.leadId === leadId).map((l) => ({ mark: s.marks.find((m) => m.id === l.markId)!, parts: l.parts })).filter((x) => x.mark);
}

/** The stored results of some marks (that you can see): the browser asks only for marks whose stamp moved. */
export async function leadMarksFor(markIds: string[]): Promise<{ ok: true; rows: LeadMark[] } | { ok: false; error: string }> {
  try {
    const { siteId } = await who();
    const ids = markIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);
    if (!ids.length) return { ok: true, rows: [] };
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("lead_marks").select("lead_id, mark_id, reason").eq("site_id", siteId).in("mark_id", ids).limit(20_000);
    if (error) throw new Error(error.message);
    return { ok: true, rows: (data ?? []).map((r) => ({ leadId: r.lead_id as string, markId: r.mark_id as string, parts: ((r.reason as { parts?: string[] })?.parts ?? []).slice(0, 8) })) };
  } catch (e) {
    console.error("[marks] results read failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Badges could not be loaded." };
  }
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
