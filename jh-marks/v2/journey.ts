// jh-marks/v2/journey.ts
// One lead's JOURNEY (./check.ts) from database rows, as lib/marks/journey.ts reads them. Pure, so the mapping is
// tested (./tests/journey.test.ts) with rows shaped exactly like the database's:
//   - visits are numbered over the visitor's whole history (1 = first visit ever), and kept up to sending;
//   - in every visit only the page views opened at or before sending count;
//   - the visit the form was sent in lasts up to sending; earlier visits to their end (or last activity);
//   - time on a page = left minus entered (the "Time on page" of the visit chart); share seen = Hook's seenPct;
//   - time per heading from page_views.heading_time, without "passing through" ("~") and above the first heading ("^");
//   - the sent form = the submitted form activity of that visit that ended closest to sending;
//   - "left while filling" = between the first key and sending, another page was opened or the visitor was away 10 s+.
import type { JFieldTiming, JForm, JPage, JSession, Journey } from "./check";
import { seenPct } from "../reason";

export interface LeadRow {
  id: string;
  visitor_id: string | null;
  session_id: string | null;
  submitted_at: string;
  raw_data: unknown;
}

type Row = Record<string, unknown>;

const AWAY_MS = 10_000;
const t = (v: unknown) => (typeof v === "string" ? Date.parse(v) : NaN);
const num = (v: unknown) => (Number.isFinite(t(v)) ? t(v) : null);

/** Time per heading of one page view: key -> ms, and the total on headings (not "^", not "~"). null before it was recorded. */
export function headingMap(stored: unknown): { map: Map<string, number> | null; total: number } {
  const h = (stored as { h?: unknown } | null)?.h;
  if (!Array.isArray(h)) return { map: null, total: 0 };
  const map = new Map<string, number>();
  let total = 0;
  for (const e of h) {
    if (!Array.isArray(e) || typeof e[0] !== "string" || e[0] === "~" || e[0] === "^") continue;
    const ms = (Number(e[3]) || 0) * 100;
    map.set(e[0], (map.get(e[0]) ?? 0) + ms);
    total += ms;
  }
  return { map, total };
}

export function fieldTimings(raw: unknown): Record<string, JFieldTiming> {
  const out: Record<string, JFieldTiming> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, Row>)) {
    if (!v || typeof v !== "object") continue;
    out[k] = {
      firstFocusAt: num(v.firstFocusAt),
      firstKeyAt: num(v.firstKeydownAt),
      focusedMs: typeof v.totalFocusedMs === "number" ? v.totalFocusedMs : null,
      edits: typeof v.edits === "number" ? v.edits : 0,
      errors: typeof v.errors === "number" ? v.errors : 0,
      filled: typeof v.filled === "boolean" ? v.filled : null,
    };
  }
  return out;
}

/**
 * @param lead            form_submissions row
 * @param visitorSessions sessions rows of the lead's visitor (any order, any time)
 * @param pagesBySession  page_views rows by session_id
 * @param device          visitors.device_type
 * @param sentForms       form_engagement rows with status "submitted" in the lead's visit
 */
export function buildJourney(lead: LeadRow, visitorSessions: Row[], pagesBySession: Map<string, Row[]>, device: string | null, sentForms: Row[]): Journey {
  const sentAt = t(lead.submitted_at);
  const all = visitorSessions.filter((s) => Number.isFinite(t(s.started_at))).sort((a, b) => t(a.started_at) - t(b.started_at));
  const sessions: JSession[] = [];
  all.forEach((s, i) => {
    const start = t(s.started_at);
    if (start > sentAt) return;
    const sending = s.session_id === lead.session_id;
    const pages: JPage[] = (pagesBySession.get(s.session_id as string) ?? [])
      .filter((p) => t(p.entered_at) <= sentAt)
      .sort((a, b) => t(a.entered_at) - t(b.entered_at))
      .map((p) => {
        const h = headingMap(p.heading_time);
        const left = num(p.left_at);
        return {
          path: (p.page_path as string) ?? "",
          enteredAt: t(p.entered_at),
          ms: left !== null ? Math.max(0, left - t(p.entered_at)) : null,
          seenPct: seenPct(p as never),
          headings: h.map,
          headingTotalMs: h.total,
        };
      });
    const end = num(s.ended_at) ?? num(s.last_activity_at);
    const ms = sending ? Math.max(0, Math.min(end ?? sentAt, sentAt) - start) : end !== null ? Math.max(0, end - start) : null;
    sessions.push({ id: s.session_id as string, number: i + 1, startedAt: start, ms, referrer: (s.referrer as string) ?? null, utmSource: (s.utm_source as string) ?? null, pages });
  });

  let form: JForm | null = null;
  const f = [...sentForms].sort((a, b) => Math.abs((num(a.ended_at) ?? 0) - sentAt) - Math.abs((num(b.ended_at) ?? 0) - sentAt))[0];
  if (f) {
    const firstInput = num(f.first_input_at);
    const ended = num(f.ended_at);
    let left: boolean | null = null;
    const visitPages = lead.session_id ? pagesBySession.get(lead.session_id) : undefined;
    if (firstInput !== null && ended !== null && visitPages) {
      const ps = [...visitPages].sort((a, b) => t(a.entered_at) - t(b.entered_at));
      left = ps.some((p) => p.page_path !== f.page_path && t(p.entered_at) > firstInput && t(p.entered_at) < ended);
      for (let i = 0; !left && i < ps.length - 1; i++) {
        const out = num(ps[i].left_at);
        if (out !== null && out >= firstInput && out < ended && t(ps[i + 1].entered_at) - out >= AWAY_MS) left = true;
      }
    }
    form = {
      viewedAt: num(f.viewed_at),
      firstInputAt: firstInput,
      endedAt: ended,
      fieldKeys: Array.isArray(f.form_fields) ? (f.form_fields as { key?: string }[]).map((x) => x.key).filter((k): k is string => !!k) : null,
      timings: fieldTimings(f.field_timings),
      leftWhileFilling: left,
    };
  }

  return {
    leadId: lead.id,
    submittedAt: sentAt,
    convertingSessionId: lead.session_id,
    sessions,
    device,
    answers: lead.raw_data && typeof lead.raw_data === "object" ? (lead.raw_data as Record<string, unknown>) : {},
    form,
  };
}
