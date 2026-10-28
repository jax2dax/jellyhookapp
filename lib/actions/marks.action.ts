// lib/actions/marks.action.ts
// Marks on leads: list, save, turn on/off, delete, re-check, share, and "Enter with AI". The site always comes from
// the server (siteOrThrow), never from the browser. Marks are read and written with the user's own login, so the
// database's rules apply on top of these checks (mds/migrations/18-marks.sql): a mark is personal unless shared, and
// only its creator can change it. Which leads have a mark is decided by the server only (lib/marks/evaluate.ts).
// Design: mds/build/marks/marks.md.
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { describeSpec } from "@/jh-hook/describe";
import { migrateSpec } from "@/jh-hook/migrate";
import type { HookSpec } from "@/jh-hook/types";
import { creditsFor, resolveModel } from "@/jh-ai/models";
import { providerFor, ProviderError } from "@/jh-ai/providers";
import { translateMark, type MarkAiResult } from "@/jh-marks/ai";
import { catalogMark, catalogVersion, type MarkVar } from "@/jh-marks/catalog";
import { cleanPath, compileRule, describeRule, MARK_LIMIT, RuleError, validateRule, type MarkRule } from "@/jh-marks/rule";
import { describeRuleV2, isRuleV2, RuleV2Error, validateRuleV2, type MarkRuleV2 } from "@/jh-marks/v2/rule";
import { checkQuota, recordRequest } from "@/lib/ai/ledger";
import { listSitePages } from "@/lib/actions/hook.action";
import { siteOrThrow } from "@/lib/hook/site";
import { evaluateMark, type MarkToRun } from "@/lib/marks/evaluate";
import { CHECK_COLS, checkOf, clearResults, continueBackfills, countLeadsSince, runBackfill, startBackfill, stopChecks, v3Missing, V3MissingError } from "@/lib/marks/backfill";
import { DEFAULT_PAST, PAST_CHOICES, pastFrom, type MarkCheck, type PastChoice } from "@/lib/marks/coverage";
import { matchV2 } from "@/lib/marks/journey";
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
  /** v1 (the old chip builder) or v2 (visit blocks, answers, form; jh-marks/v2). null = made in Hook: edit it there (or a locked published mark) */
  rule: MarkRule | MarkRuleV2 | null;
  /** the Hook query of a v1 or Hook mark; null for a v2 mark (checked by lib/marks/journey.ts) */
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
  /** which leads it has checked, and the background check of past leads (lib/marks/coverage.ts); null or absent before
   *  migration 33 (every lead checked) and in the home page demo */
  check?: MarkCheck | null;
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
/** with the checks of v3 (33-marks-v3.sql): what each mark has checked; reads fall back to COLS_LIB without them */
const COLS_V3: string = COLS_LIB + ", " + CHECK_COLS;

/** A select of marks with the newest columns this database has (v3, then the library, then the first ones). */
async function selectMarks<T extends { error: { message: string } | null }>(run: (cols: string) => PromiseLike<T>): Promise<T> {
  const v3 = await run(COLS_V3);
  if (!v3.error || !(v3Missing(v3.error.message) || libMissing(v3.error.message))) return v3;
  const lib = await run(COLS_LIB);
  if (!lib.error || !libMissing(lib.error.message)) return lib;
  return run(COLS);
}
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
  rule: (r.rule as MarkRule | MarkRuleV2) ?? null,
  spec: (r.spec as HookSpec) ?? null,
  reads: (r.reads as string) ?? null,
  templateKey: (r.template_key as string) ?? null,
  mine: r.created_by === me,
  createdByEmail: (r.created_by_email as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  matchCount: (r.match_count as number) ?? null,
  evaluatedAt: (r.evaluated_at as string) ?? null,
  check: checkOf(r),
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
async function markRow(supabase: ReturnType<typeof createSupabaseClient>, siteId: string, id: string): Promise<Row | null> {
  const res = await selectMarks((cols) => supabase.from("marks").select(cols).eq("id", id).eq("site_id", siteId).maybeSingle());
  return (res.data as unknown as Row) ?? null;
}

const toRun = (r: Row): MarkToRun => ({ id: r.id as string, rule: (r.rule as MarkRule | MarkRuleV2) ?? null, spec: (r.spec as HookSpec) ?? null, reads: (r.reads as string) ?? null, source: (r.source as MarkToRun["source"]) ?? "own", source_key: (r.source_key as string) ?? null, var_values: (r.var_values as Record<string, string>) ?? {} });

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
    const { data, error } = await selectMarks((cols) => supabase.from("marks").select(cols).eq("site_id", siteId).order("created_at", { ascending: true }));
    if (error) {
      if (missingTable(error.message)) return { ok: true, ready: false, me: userId, marks: [], leadMarks: [], team: [], pages: [], limit: MARK_LIMIT, totalLimit: TOTAL_LIMIT };
      throw new Error(error.message);
    }
    const rows = (data ?? []) as unknown as Row[];
    // a connected mark whose published version changed: take the new name and purpose, and check the leads again
    for (const r of rows) {
      if (r.source !== "connected" || r.created_by !== userId) continue;
      const c = catalogMark(r.source_key as string);
      if (!c || r.source_version === catalogVersion(c)) continue;
      try {
        // v3: a new version, its leads checked again in the background (the same past leads as before); before
        // migration 33, every lead inside this load, as before
        if ("rule_version" in r && r.active) {
          await startBackfill(siteId, r.id as string, (r.checked_from as string) ?? null, true);
          after(() => runBackfill(r.id as string, RUN_MS));
          Object.assign(r, { match_count: 0, backfill_state: "running", backfill_done: 0, backfill_cursor_at: null, backfill_until: new Date().toISOString() });
        } else if ("rule_version" in r) await clearResults(r.id as string);
        else {
          r.match_count = await evaluateMark(siteId, toRun(r));
          r.evaluated_at = new Date().toISOString();
        }
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
  /** v3: which past leads to check when the rule is new or changed, or the mark is turned on (default: last 30 days
   *  for a new mark, the same as before for an edit) */
  past?: PastChoice;
}

/** `checking`: past leads being checked in the background (v3); the screens show the progress. */
export type SaveMarkResult = { ok: true; mark: MarkView; warning?: string; checking?: number } | { ok: false; error: string };

/** How long a runner started by a save keeps going before the drainer (or the open leads page) takes over. */
const RUN_MS = 40_000;

/**
 * After a mark changed (v3): decides what to check and starts it in the background. Returns how many past leads will be
 * checked. Before migration 33 it checks every lead now, inside the request, as before v3.
 *   - off: nothing is checked; a changed rule clears the old results; turned off: new leads stop being checked;
 *   - on, and the rule is new or changed, or it was just turned on: the chosen past leads, in the background.
 */
async function checkAfterChange(siteId: string, row: Row, o: { ruleChanged: boolean; turnedOn: boolean; turnedOff: boolean; past?: PastChoice; isNew?: boolean }): Promise<{ checking?: number; matchCount?: number }> {
  const id = row.id as string;
  try {
    if (!row.active) {
      if (o.turnedOff) await stopChecks(id);
      if (o.ruleChanged) await clearResults(id);
      return {};
    }
    if (!o.ruleChanged && !o.turnedOn) return {};
    const past = o.past && PAST_CHOICES.includes(o.past) ? o.past : null;
    // no choice sent: a new mark gets the default, an edited one keeps the past leads it had
    const from = past ? pastFrom(past) : o.isNew ? pastFrom(DEFAULT_PAST) : ((row.checked_from as string) ?? null);
    const checking = await startBackfill(siteId, id, from, o.ruleChanged);
    if (checking) after(() => runBackfill(id, RUN_MS));
    return { checking };
  } catch (e) {
    if (!(e instanceof V3MissingError)) throw e;
    // before migration 33: every lead, now (the old way)
    return { matchCount: await evaluateMark(siteId, toRun(row)) };
  }
}

/** Creates or edits a mark (only your own); its leads are checked in the background (checkAfterChange). */
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

    let rule: MarkRule | MarkRuleV2 | null = null;
    let spec: HookSpec | null;
    let reads: string;
    if (isRuleV2(input.rule)) {
      // the new builder: checked by its own checker, no Hook query (migration 22 lets spec be empty)
      rule = validateRuleV2(input.rule);
      spec = null;
      reads = describeRuleV2(rule).join(" ");
    } else if (input.rule) {
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
    let existing: Row | null = null;
    if (input.id) {
      existing = await markRow(supabase, siteId, input.id);
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
    let checking: number | undefined;
    // the database (jsonb) does not keep the order of keys: compare with sorted keys
    const stable = (v: unknown): string =>
      Array.isArray(v) ? "[" + v.map(stable).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().filter((k) => (v as Row)[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable((v as Row)[k])).join(",") + "}" : JSON.stringify(v ?? null);
    const same = (a: unknown, b: unknown) => stable(a) === stable(b);
    const ruleChanged = !existing || !same(existing.rule, rule) || !same(existing.spec, spec);
    try {
      const fresh = (await markRow(supabase, siteId, saved!.id as string)) ?? saved!;
      const r = await checkAfterChange(siteId, fresh, { ruleChanged, turnedOn: !!fresh.active && !!existing && !existing.active, turnedOff: !fresh.active && !!existing?.active, past: input.past, isNew: !existing });
      checking = r.checking;
      saved = (await markRow(supabase, siteId, saved!.id as string)) ?? fresh;
      if (r.matchCount !== undefined) Object.assign(saved, { match_count: r.matchCount, evaluated_at: new Date().toISOString() });
    } catch (e) {
      console.error("[marks] check failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
      warning = "Saved, but the leads could not be checked right now. Use Re-check in a minute.";
    }
    return { ok: true, mark: toView(saved!, userId), warning, checking };
  } catch (e) {
    if (e instanceof RuleError || e instanceof RuleV2Error) return { ok: false, error: e.message };
    if (e instanceof Error && /spec/.test(e.message) && /null/.test(e.message)) return { ok: false, error: "The new marks are not set up on this database yet (migration 22)." };
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
    // v3: it arrives off, and "off" means not checked: its leads are checked when it is turned on. Before migration 33,
    // every lead at once, as before.
    const saved = ((await markRow(supabase, siteId, (data as unknown as Row).id as string)) ?? (data as unknown as Row)) as Row;
    let warning: string | undefined;
    if (!("rule_version" in saved)) {
      try {
        saved.match_count = await evaluateMark(siteId, toRun(saved));
        saved.evaluated_at = new Date().toISOString();
      } catch (e) {
        console.error("[marks] library check failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
        warning = "Added, but the leads could not be checked right now. Use Re-check in a minute.";
      }
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
    let saved = ins.data as unknown as Row;
    let checking: number | undefined;
    try {
      const fresh = (await markRow(supabase, siteId, saved.id as string)) ?? saved;
      const r = await checkAfterChange(siteId, fresh, { ruleChanged: true, turnedOn: false, turnedOff: false, isNew: true });
      checking = r.checking;
      saved = (await markRow(supabase, siteId, saved.id as string)) ?? fresh;
      if (r.matchCount !== undefined) Object.assign(saved, { match_count: r.matchCount, evaluated_at: new Date().toISOString() });
    } catch (e) {
      console.error("[marks] copy check failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) });
    }
    return { ok: true, mark: toView(saved, userId), checking };
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
    const { error } = await supabase.from("marks").update(patch).eq("id", id).eq("created_by", userId);
    if (error) throw new Error(error.message);
    // new values are a new rule: checked again in the background, the same past leads as before (v3)
    const fresh = (await markRow(supabase, siteId, id))!;
    const r = await checkAfterChange(siteId, fresh, { ruleChanged: true, turnedOn: false, turnedOff: false });
    const saved = (await markRow(supabase, siteId, id)) ?? fresh;
    if (r.matchCount !== undefined) Object.assign(saved, { match_count: r.matchCount, evaluated_at: new Date().toISOString() });
    return { ok: true, mark: toView(saved, userId), checking: r.checking };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error("[marks] variables failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "That didn't work. Try again." };
  }
}

/** What a change of checks returns to the screens: the mark's count, stamp and checks, and how many past leads are
 *  being checked in the background (v3). */
export type CheckResult = { ok: true; matchCount: number | null; evaluatedAt: string | null; check?: MarkCheck | null; checking?: number } | { ok: false; error: string };

const checkResult = (r: Row, checking?: number): CheckResult => ({ ok: true, matchCount: (r.match_count as number) ?? null, evaluatedAt: (r.evaluated_at as string) ?? null, check: checkOf(r), checking });

/**
 * Turns a mark on or off (only your own). v3: "off" means its new leads are not checked; turning it on checks the
 * chosen past leads (`past`, default the last 30 days) in the background. Before migration 33: off only hid the badges,
 * and turning on checked every lead if it had never been checked.
 */
export async function setMarkActive(id: string, active: boolean, past?: PastChoice): Promise<CheckResult> {
  try {
    const { userId, siteId } = await who();
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("marks").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("site_id", siteId).eq("created_by", userId).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ok: false, error: "Only the person who made this mark can turn it on or off." };
    let row = (await markRow(supabase, siteId, id))!;
    if (!("rule_version" in row) && (!active || row.evaluated_at)) return checkResult(row);
    const r = await checkAfterChange(siteId, row, { ruleChanged: false, turnedOn: active, turnedOff: !active, past: past ?? DEFAULT_PAST });
    row = (await markRow(supabase, siteId, id)) ?? row;
    if (r.matchCount !== undefined) Object.assign(row, { match_count: r.matchCount, evaluated_at: new Date().toISOString() });
    return checkResult(row, r.checking);
  } catch (e) {
    console.error("[marks] on/off failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "That didn't work. Try again." };
  }
}

/** Checks a mark's leads again (any mark you can see that is on): v3, the same past leads as before, in the background. */
export async function recheckMark(id: string): Promise<CheckResult> {
  try {
    const { siteId } = await who();
    const supabase = createSupabaseClient();
    const data = await markRow(supabase, siteId, id);
    if (!data) return { ok: false, error: "That mark is not available." };
    if (!("rule_version" in data)) {
      const n = await evaluateMark(siteId, toRun(data));
      return { ok: true, matchCount: n, evaluatedAt: new Date().toISOString(), check: null };
    }
    if (!data.active) return { ok: false, error: "This mark is off, so it checks no leads. Turn it on first." };
    const checking = await startBackfill(siteId, id, (data.checked_from as string) ?? null, false);
    if (checking) after(() => runBackfill(id, RUN_MS));
    return checkResult((await markRow(supabase, siteId, id)) ?? data, checking);
  } catch (e) {
    console.error("[marks] re-check failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The leads could not be checked right now. Try again in a minute." };
  }
}

/** Progress of the marks' checks of past leads, for the leads page while one runs. A check nobody is running (its runner
 *  ran out of time) is continued after this answer. */
export async function markProgress(ids: string[]): Promise<{ ok: true; marks: { id: string; matchCount: number | null; evaluatedAt: string | null; check: MarkCheck | null }[] } | { ok: false; error: string }> {
  try {
    const { siteId } = await who();
    const list = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 50);
    if (!list.length) return { ok: true, marks: [] };
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.from("marks").select("id, match_count, evaluated_at, " + CHECK_COLS).eq("site_id", siteId).in("id", list);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Row[];
    const now = Date.now();
    if (rows.some((r) => r.backfill_state === "running" && (!r.backfill_lease || Date.parse(r.backfill_lease as string) < now))) after(() => continueBackfills(RUN_MS, siteId));
    return { ok: true, marks: rows.map((r) => ({ id: r.id as string, matchCount: (r.match_count as number) ?? null, evaluatedAt: (r.evaluated_at as string) ?? null, check: checkOf(r) })) };
  } catch (e) {
    console.error("[marks] progress failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Progress could not be read." };
  }
}

/** How many leads each past-leads choice covers, for the choice at save and when turning a mark on. */
export async function pastLeadCounts(): Promise<{ ok: true; counts: Record<PastChoice, number> } | { ok: false; error: string }> {
  try {
    const { siteId } = await who();
    const [d30, d90, all] = await Promise.all([countLeadsSince(siteId, pastFrom("30d")), countLeadsSince(siteId, pastFrom("90d")), countLeadsSince(siteId, null)]);
    return { ok: true, counts: { "30d": d30, "90d": d90, all, none: 0 } };
  } catch (e) {
    console.error("[marks] counts failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Counts could not be read." };
  }
}

/** How many leads the preview checks while a mark is built: the site's newest. */
const PREVIEW_LEADS = 100;

/** A rule being built (v2), checked on the site's last 100 leads: how many match, and the first few with their evidence.
 *  Nothing is saved. */
export async function previewMark(rule: unknown): Promise<{ ok: true; checked: number; count: number; leads: { id: string; label: string; at: string | null; parts: string[] }[] } | { ok: false; error: string }> {
  try {
    const { siteId } = await who();
    if (!isRuleV2(rule)) return { ok: false, error: "Only the new builder has a preview." };
    const valid = validateRuleV2(rule);
    const { data, error } = await admin.from("form_submissions").select("id, name, email, submitted_at").eq("site_id", siteId).order("submitted_at", { ascending: false }).limit(PREVIEW_LEADS);
    if (error) throw new Error(error.message);
    const leads = data ?? [];
    if (!leads.length) return { ok: true, checked: 0, count: 0, leads: [] };
    const hits = await matchV2(siteId, valid, leads.map((l) => l.id as string));
    const found = leads.filter((l) => hits.has(l.id as string));
    return {
      ok: true,
      checked: leads.length,
      count: found.length,
      leads: found.slice(0, 8).map((l) => ({ id: l.id as string, label: (l.name as string) || (l.email as string) || "Unnamed lead", at: (l.submitted_at as string) ?? null, parts: (hits.get(l.id as string) ?? []).slice(0, 3) })),
    };
  } catch (e) {
    if (e instanceof RuleV2Error) return { ok: false, error: e.message };
    console.error("[marks] preview failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "The preview is not available right now." };
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
