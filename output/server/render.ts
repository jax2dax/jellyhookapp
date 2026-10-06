// output/server/render.ts
// The output engine: hook result -> canvas views. It follows the plan from
// output/plan.ts (what to show, which evidence), fetches exactly the rows on
// the first page (output/server/data.ts), and seals the rest so "Show more"
// can load them later without re-running the hook and without raw ids ever
// reaching the browser. See output/architecture.md.
import "server-only";
import { describeSpec } from "../../jh-hook/describe";
import { HookError } from "../../jh-hook/errors";
import { runHook } from "../../jh-hook/engine/run";
import { SCHEMA } from "../../jh-hook/schema";
import type { HookResult, HookSpec } from "../../jh-hook/types";
import { pgHookDb } from "@/lib/hook/pgDb";
import { evidenceNote, pageViewConditionsIn, planOutput, type OutputPlan } from "../plan";
import type { CanvasView, CompareSide, Formula, LeadCard, ListKind, SessionCard, VisitorCard } from "../types";
import {
  fieldRows, formCards, iso, leadRows, matchingSessionsOfVisitors, matchingVisits, orderFormFields, orderForms, orderLeads, orderPages, orderSessions,
  orderVisitors, pageCards, sessionCards, sessionReplays, sessionsOfPageViews, str, visitorRows,
} from "./data";
import { open, seal } from "./seal";

/** The most items a list view keeps (first page + sealed tokens). Beyond it, the view says so. */
export const MAX_LIST_ITEMS = 500;

type SessionToken = { id: string; h?: string[] };
type ItemData = SessionToken | string;

// ── items of one page, for any list kind ────────────────────────────────
async function resolveItems(siteId: string, spec: HookSpec, plan: OutputPlan, kind: ListKind, data: ItemData[]) {
  const ids = data.map((d) => (typeof d === "string" ? d : d.id));
  switch (kind) {
    case "sessions": {
      const replays = await sessionReplays(siteId, ids);
      let highlight = new Map<string, Iterable<string>>();
      if (plan.evidence.kind === "visits") highlight = await matchingVisits(siteId, plan.evidence.conditions, ids);
      else if (plan.evidence.kind === "returnedVisits") highlight = new Map(data.map((d) => [(d as SessionToken).id, (d as SessionToken).h ?? []]));
      return sessionCards(ids, replays, highlight);
    }
    case "leads": {
      const rows = await leadRows(siteId, ids);
      let sessions = new Map<string, SessionCard>();
      if (plan.evidence.kind === "leadSession") {
        const sids = [...new Set(rows.map((r) => str(r.session_id)).filter((x): x is string => !!x))];
        const [replays, hl] = await Promise.all([sessionReplays(siteId, sids), matchingVisits(siteId, pageViewConditionsIn(plan.evidence.sessionConditions), sids)]);
        sessions = new Map(sessionCards(sids, replays, hl, "the session they converted in").map((c) => [c.session.id, c]));
      }
      return rows.map((r): LeadCard => {
        const raw = r.raw_data && typeof r.raw_data === "object" && !Array.isArray(r.raw_data) ? (r.raw_data as Record<string, unknown>) : {};
        const sid = str(r.session_id);
        return {
          href: `/platform/leads/${String(r.id)}`,
          name: str(r.name),
          email: str(r.email),
          phone: str(r.phone),
          submittedAt: iso(r.submitted_at),
          page: str(r.page_path),
          qualified: r.qualified == null ? null : !!r.qualified,
          fields: Object.entries(raw)
            .slice(0, 40)
            .map(([key, value]) => ({ key, value: typeof value === "string" ? value : JSON.stringify(value) })),
          sessions: sid && sessions.has(sid) ? [sessions.get(sid)!] : [],
        };
      });
    }
    case "visitors": {
      const { visitors, leads, sessions } = await visitorRows(siteId, ids);
      let evidence = new Map<string, string[]>();
      let cards = new Map<string, SessionCard>();
      if (plan.evidence.kind === "visitorSessions") {
        evidence = await matchingSessionsOfVisitors(siteId, plan.evidence.sessionConditions, ids);
        const sids = [...new Set([...evidence.values()].flat())];
        const [replays, hl] = await Promise.all([
          sessionReplays(siteId, sids),
          matchingVisits(siteId, pageViewConditionsIn(plan.evidence.sessionConditions.flatMap((c) => c.where)), sids),
        ]);
        cards = new Map(sessionCards(sids, replays, hl, "matched your session conditions").map((c) => [c.session.id, c]));
      }
      return ids.map((id): VisitorCard => {
        const v = visitors.get(id);
        const l = leads.get(id);
        return {
          device: str(v?.device_type),
          browser: str(v?.browser),
          os: str(v?.os),
          firstSeen: iso(v?.first_seen),
          lastSeen: iso(v?.last_seen),
          sessionsCount: sessions.get(id) ?? 0,
          lead: l ? { name: str(l.name), email: str(l.email), href: `/platform/leads/${String(l.id)}` } : null,
          sessions: (evidence.get(id) ?? []).map((sid) => cards.get(sid)).filter((c): c is SessionCard => !!c),
        };
      });
    }
    case "pages":
      return pageCards(siteId, ids);
    case "forms":
      return formCards(siteId, ids);
    case "formFields":
      return fieldRows(siteId, ids);
  }
}

async function orderedItems(siteId: string, spec: HookSpec, ids: string[]): Promise<ItemData[]> {
  switch (spec.entity) {
    case "session":
      return (await orderSessions(siteId, ids)).map((id) => ({ id }));
    case "pageView":
    case "awayGap":
      return sessionsOfPageViews(siteId, ids);
    case "lead":
      return orderLeads(siteId, ids);
    case "visitor":
      return orderVisitors(siteId, ids);
    case "page":
      return orderPages(siteId, ids);
    case "form":
      return orderForms(siteId, ids);
    case "formField":
      return orderFormFields(siteId, ids);
  }
}

// ── the main entry ──────────────────────────────────────────────────────
export async function renderCanvas(siteId: string, spec: HookSpec, result: HookResult, opts: { maxCredits: number }): Promise<CanvasView> {
  const plan = planOutput(spec);
  const sentence = describeSpec(spec);
  const a = result.answer;

  if (plan.view === "number" && a.shape === "one") {
    const view: CanvasView = { kind: "number", sentence, type: a.type, value: a.value };
    if (plan.baseRate && spec.where.length) {
      // the same measure over everything: "out of 1,240 sessions"
      const base = await runHook(pgHookDb, siteId, { ...spec, where: [], order: undefined }, opts);
      if (base.answer.shape === "one") {
        const isCount = spec.output.kind === "count" || spec.output.kind === "countDistinct";
        const share = isCount && typeof a.value === "number" && typeof base.answer.value === "number" && base.answer.value > 0 ? a.value / base.answer.value : null;
        view.base = { value: base.answer.value, label: isCount ? `${SCHEMA[spec.entity].plural} overall` : `across all ${SCHEMA[spec.entity].plural}`, share };
      }
    }
    return view;
  }
  if ((plan.view === "ranking" || plan.view === "timeSeries") && a.shape === "table") {
    if (plan.view === "timeSeries" && spec.output.kind === "groupBy")
      return { kind: "timeSeries", sentence, bucket: spec.output.bucket ?? "day", valueType: a.valueType, rows: [...a.rows].sort((x, y) => String(x.key).localeCompare(String(y.key))) };
    return { kind: "ranking", sentence, keyType: a.keyType, valueType: a.valueType, rows: a.rows };
  }
  if (plan.view === "values" && a.shape === "list") return { kind: "values", sentence, type: a.type, values: a.values, truncated: a.truncated };

  if (plan.listOf && a.shape === "list") {
    const all = await orderedItems(siteId, spec, a.values);
    const kept = all.slice(0, MAX_LIST_ITEMS);
    const size = plan.pageSize!;
    const items = await resolveItems(siteId, spec, plan, plan.listOf, kept.slice(0, size));
    const more = kept.slice(size).map((d) => seal(siteId, plan.listOf!, d));
    const note = [evidenceNote(plan.evidence, spec.entity), all.length > MAX_LIST_ITEMS ? `Showing the first ${MAX_LIST_ITEMS} of ${all.length}.` : null].filter(Boolean).join(" ") || undefined;
    return { kind: plan.listOf, sentence, total: all.length, truncated: a.truncated || all.length > MAX_LIST_ITEMS, items, more, pageSize: size, note } as CanvasView;
  }
  throw new HookError("This result can't be displayed yet.");
}

/** The next page of a list view, from sealed tokens. No hook re-run, no credits. */
export async function loadMore(siteId: string, spec: HookSpec, kind: ListKind, tokens: string[]) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  if (tokens.length > 50) throw new HookError("Too many items requested at once.");
  const plan = planOutput(spec);
  if (plan.listOf !== kind) throw new HookError("These results belong to a different hook. Run it again.");
  const data = tokens.map((t) => open<ItemData>(siteId, kind, t));
  return resolveItems(siteId, spec, plan, kind, data);
}

// ── comparison: two hooks and a formula ─────────────────────────────────
export async function compareHooks(siteId: string, a: HookSpec, b: HookSpec, formula: Formula, opts: { maxCredits: number }): Promise<{ view: CanvasView; credits: number }> {
  const [ra, rb] = await Promise.all([runHook(pgHookDb, siteId, a, opts), runHook(pgHookDb, siteId, b, opts)]);
  const side = (spec: HookSpec, r: HookResult, label: string): CompareSide => {
    if (r.answer.shape !== "one" || (r.answer.value !== null && typeof r.answer.value !== "number"))
      throw new HookError(`Hook ${label} must return one number (the number of, or a calculation) to be compared.`);
    return { sentence: describeSpec(spec), type: r.answer.type, value: r.answer.value as number | null };
  };
  const A = side(a, ra, "A");
  const B = side(b, rb, "B");
  let result: number | null = null;
  let resultLabel = "";
  if (A.value === null || B.value === null) resultLabel = "One side is empty, so there's nothing to compute.";
  else if ((formula === "ratio" || formula === "percent" || formula === "change") && B.value === 0) resultLabel = "B is 0, so this can't be divided.";
  else {
    result = formula === "ratio" ? A.value / B.value : formula === "percent" ? (A.value / B.value) * 100 : formula === "difference" ? A.value - B.value : ((A.value - B.value) / B.value) * 100;
    resultLabel = formula === "percent" || formula === "change" ? `${+result.toFixed(2)}%` : String(+result.toFixed(4));
  }
  return { view: { kind: "compare", a: A, b: B, formula, result, resultLabel }, credits: ra.cost.credits + rb.cost.credits };
}
