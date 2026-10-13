// jh-mcp/shape.ts
// A canvas view (what the Hook screen draws) as compact JSON for an AI app: capped to a few rows, personal details
// masked unless the token allows them, and NEVER the raw form answers (lead.fields), which can hold anything a
// visitor typed. Pure: no database, no network.
import type { HookSpec } from "../jh-hook/types";
import { formatValue } from "../output/format";
import type { CanvasView, SessionCard } from "../output/types";
import { mask, piiOutputKind, type PiiKind } from "./mask";

export interface ShapeOptions {
  allowPii: boolean;
  maxRows: number;
}

export interface Shaped {
  /** What the tool returns to the AI app (JSON text). */
  text: string;
  /** Rows returned, for the call record. */
  rows: number;
}

type Obj = Record<string, unknown>;

function session(card: SessionCard): Obj {
  const s = card.session;
  return {
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    device: card.deviceType,
    pages: s.visits.map((v) => ({
      path: v.pagePath,
      enteredAt: v.enteredAt,
      seconds: Math.max(0, Math.round((new Date(v.leftAt).getTime() - new Date(v.enteredAt).getTime()) / 1000)),
      converted: v.converted === true,
      form: v.formStatus ?? null,
      matchedTheHook: card.highlight.includes(v.id) || undefined,
    })),
    why: card.reason,
  };
}

export function shapeView(view: CanvasView, spec: HookSpec, opts: ShapeOptions): Shaped {
  const piiKind: PiiKind | null = opts.allowPii ? null : piiOutputKind(spec);
  const hide = (kind: PiiKind, v: string | null | undefined) => (opts.allowPii ? (v ?? null) : mask(kind, v));
  const cap = <T,>(items: T[]) => items.slice(0, opts.maxRows);
  const base = { hook: view.kind === "compare" ? undefined : view.sentence };

  const done = (o: Obj, rows: number): Shaped => ({ text: JSON.stringify(o), rows });

  switch (view.kind) {
    case "number":
      return done({ ...base, answer: formatValue(view.value, view.type), raw: piiKind && typeof view.value === "string" ? mask(piiKind, view.value) : view.value, outOf: view.base ? { value: view.base.value, label: view.base.label, share: view.base.share } : undefined }, 1);
    case "ranking":
    case "timeSeries": {
      const rows = cap(view.rows).map((r) => ({ key: piiKind && r.key ? mask(piiKind, r.key) : r.key, value: r.value }));
      return done({ ...base, rows, totalRows: view.rows.length, truncated: view.rows.length > rows.length || undefined }, rows.length);
    }
    case "values": {
      const values = cap(view.values).map((v) => (piiKind ? mask(piiKind, v) : v));
      return done({ ...base, values, totalValues: view.values.length, truncated: view.truncated || view.values.length > values.length || undefined }, values.length);
    }
    case "sessions": {
      const items = cap(view.items).map(session);
      return done({ ...base, total: view.total, returned: items.length, sessions: items }, items.length);
    }
    case "leads": {
      const items = cap(view.items).map((l) => ({
        name: hide("name", l.name),
        email: hide("email", l.email),
        phone: hide("phone", l.phone),
        submittedAt: l.submittedAt,
        page: l.page,
        qualified: l.qualified,
        sessions: l.sessions.map(session),
      }));
      return done({ ...base, total: view.total, returned: items.length, leads: items }, items.length);
    }
    case "visitors": {
      const items = cap(view.items).map((v) => ({
        device: v.device,
        browser: v.browser,
        os: v.os,
        firstSeen: v.firstSeen,
        lastSeen: v.lastSeen,
        sessionsCount: v.sessionsCount,
        lead: v.lead ? { name: hide("name", v.lead.name), email: hide("email", v.lead.email) } : null,
        sessions: v.sessions.map(session),
      }));
      return done({ ...base, total: view.total, returned: items.length, visitors: items }, items.length);
    }
    case "pages": {
      const items = cap(view.items);
      return done({ ...base, total: view.total, returned: items.length, pages: items }, items.length);
    }
    case "forms": {
      const items = cap(view.items);
      return done({ ...base, total: view.total, returned: items.length, forms: items }, items.length);
    }
    case "formFields": {
      const items = cap(view.items);
      return done({ ...base, total: view.total, returned: items.length, formFields: items }, items.length);
    }
    case "compare":
      return done({ a: view.a, b: view.b, result: view.result, label: view.resultLabel }, 1);
  }
}
