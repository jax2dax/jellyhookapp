// jh-hook/engine/sqlmap.ts
// Server side of jh-hook/schema.ts: where each entity's rows come from,
// how each field is computed, and how entities join. Every source goes
// through scoped() (engine/sql.ts), so every row read is this site's.
//
// Derived fields (seen %, position in session, landing page...) are plain
// SQL expressions over one row (plus a correlated subquery where needed),
// so they can be filtered, measured and grouped exactly like raw columns.
import { AWAY_GAP_MIN_MS, type EntityKey } from "../schema";
import { scoped } from "./sql";

export interface EntitySql {
  /** FROM-clause fragment for this entity's rows, under `alias`. */
  source: (alias: string) => string;
  /** Unique per row: what staged execution chains on. */
  key: (a: string) => string;
  /** What "ids" returns and what tunnels carry (schema's `ref`). */
  ref: (a: string) => string;
  fields: Record<string, (a: string) => string>;
  /** relation key -> join predicate between parent alias `p` and child alias `c`. */
  joins: Record<string, (p: string, c: string) => string>;
}

const ms = (expr: string) => `(EXTRACT(EPOCH FROM (${expr})) * 1000)`;

// ── Scroll geometry (see mds/database.md "Scroll geometry" and
// framePlate/geometry/deriveVisitGeometry.ts). *_scroll_depth columns are
// fractions of the SCROLLABLE RANGE, not of the page:
//   vFrac   = viewport_height / page_height    (one screen as a page fraction)
//   top(s)  = s * (1 - vFrac)                  (scroll fraction -> page position)
// Null viewport or page height => every seen % is null ("unknown"), never
// a made-up number. Careful: Postgres's LEAST/GREATEST IGNORE nulls
// (LEAST(1.0, NULL) = 1.0), which would silently read an unmeasured screen
// as "the whole page fits on one screen" = 100% seen. Hence the explicit
// guard instead of relying on null propagation.
const vFrac = (a: string) => `LEAST(1.0, ${a}.viewport_height::float8 / NULLIF(${a}.page_height, 0))`;
const measured = (a: string) => `(${a}.viewport_height > 0 AND ${a}.page_height > 0)`;
/** Percent from a page fraction, only when the geometry is measured; rounded so float4 noise (58.0000007) never leaks. */
const geo = (a: string, frac: string) => `(CASE WHEN ${measured(a)} THEN round((100 * (${frac}))::numeric, 4)::float8 END)`;
const top = (a: string, s: string) => `((${s}) * (1 - ${vFrac(a)}))`;
const seenTop = (a: string) =>
  top(a, `LEAST(COALESCE(${a}.entry_scroll_depth, 0), COALESCE(${a}.revisit_start_scroll_depth, ${a}.entry_scroll_depth, 0))`);
const seenBottom = (a: string) => `LEAST(1.0, ${top(a, `COALESCE(${a}.max_scroll_depth, ${a}.entry_scroll_depth, 0)`)} + ${vFrac(a)})`;

const pvEarlier = (a: string) =>
  `EXISTS (SELECT 1 FROM ${scoped("page_views", "e")} WHERE e.session_id = ${a}.session_id AND e.entered_at < ${a}.entered_at)`;
const pvLater = (a: string) =>
  `EXISTS (SELECT 1 FROM ${scoped("page_views", "e")} WHERE e.session_id = ${a}.session_id AND e.entered_at > ${a}.entered_at)`;
const converted = (sessionIdExpr: string) =>
  `EXISTS (SELECT 1 FROM ${scoped("form_submissions", "cv")} WHERE cv.session_id = ${sessionIdExpr})`;
const firstPage = (a: string, dir: "ASC" | "DESC") =>
  `(SELECT e.page_path FROM ${scoped("page_views", "e")} WHERE e.session_id = ${a}.session_id ORDER BY e.entered_at ${dir} LIMIT 1)`;

export const SQL: Record<EntityKey, EntitySql> = {
  pageView: {
    source: (al) => scoped("page_views", al),
    key: (a) => `${a}.id`,
    ref: (a) => `${a}.id::text`,
    fields: {
      id: (a) => `${a}.id::text`,
      page: (a) => `${a}.page_path`,
      url: (a) => `${a}.page_url`,
      title: (a) => `${a}.page_title`,
      session: (a) => `${a}.session_id`,
      visitor: (a) => `${a}.visitor_id`,
      enteredAt: (a) => `${a}.entered_at`,
      leftAt: (a) => `${a}.left_at`,
      timeOnPage: (a) => `${a}.time_on_page`,
      visitDuration: (a) => ms(`${a}.left_at - ${a}.entered_at`),
      isOpen: (a) => `(${a}.left_at IS NULL)`,
      seenPct: (a) => geo(a, `${seenBottom(a)} - ${seenTop(a)}`),
      seenTwicePct: (a) =>
        geo(a, `CASE WHEN ${a}.revisit_start_scroll_depth IS NULL THEN 0 ELSE ${seenBottom(a)} - ${top(a, `${a}.revisit_start_scroll_depth`)} END`),
      notSeenPct: (a) => geo(a, `1 - (${seenBottom(a)} - ${seenTop(a)})`),
      entryPct: (a) => geo(a, top(a, `${a}.entry_scroll_depth`)),
      deepestPct: (a) => geo(a, seenBottom(a)),
      exitPct: (a) => geo(a, top(a, `${a}.scroll_depth`)),
      revisited: (a) => `(${a}.revisit_start_scroll_depth IS NOT NULL)`,
      deepestAt: (a) => `${a}.max_scroll_reached_at`,
      timeToDeepest: (a) => ms(`${a}.max_scroll_reached_at - ${a}.entered_at`),
      pageHeight: (a) => `${a}.page_height`,
      viewportHeight: (a) => `${a}.viewport_height`,
      viewportMeasured: (a) => `(${a}.viewport_height IS NOT NULL)`,
      position: (a) =>
        `((SELECT count(*) FROM ${scoped("page_views", "e")} WHERE e.session_id = ${a}.session_id AND e.entered_at < ${a}.entered_at) + 1)`,
      isLanding: (a) => `(NOT ${pvEarlier(a)})`,
      isExit: (a) => `(NOT ${pvLater(a)})`,
      isConversionPage: (a) =>
        `EXISTS (SELECT 1 FROM ${scoped("form_submissions", "cs")} WHERE cs.session_id = ${a}.session_id AND ${a}.id = (SELECT ce.id FROM ${scoped("page_views", "ce")} WHERE ce.session_id = ${a}.session_id AND ce.entered_at <= cs.submitted_at ORDER BY ce.entered_at DESC LIMIT 1))`,
      inConvertedSession: (a) => converted(`${a}.session_id`),
      enteredHour: (a) => `EXTRACT(HOUR FROM ${a}.entered_at AT TIME ZONE 'UTC')`,
      enteredWeekday: (a) => `EXTRACT(DOW FROM ${a}.entered_at AT TIME ZONE 'UTC')`,
    },
    joins: {
      session: (p, c) => `${c}.session_id = ${p}.session_id`,
      visitor: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
      forms: (p, c) => `${c}.session_id = ${p}.session_id AND ${c}.page_path = ${p}.page_path`,
      // Sequence joins: same session, ordered by entered_at.
      nextPage: (p, c) =>
        `${c}.id = (SELECT e.id FROM ${scoped("page_views", "e")} WHERE e.session_id = ${p}.session_id AND e.entered_at > ${p}.entered_at ORDER BY e.entered_at ASC LIMIT 1)`,
      previousPage: (p, c) =>
        `${c}.id = (SELECT e.id FROM ${scoped("page_views", "e")} WHERE e.session_id = ${p}.session_id AND e.entered_at < ${p}.entered_at ORDER BY e.entered_at DESC LIMIT 1)`,
      pagesAfter: (p, c) => `${c}.session_id = ${p}.session_id AND ${c}.entered_at > ${p}.entered_at`,
      pagesBefore: (p, c) => `${c}.session_id = ${p}.session_id AND ${c}.entered_at < ${p}.entered_at`,
    },
  },

  session: {
    source: (al) => scoped("sessions", al),
    key: (a) => `${a}.session_id`,
    ref: (a) => `${a}.session_id`,
    fields: {
      id: (a) => `${a}.session_id`,
      visitor: (a) => `${a}.visitor_id`,
      startedAt: (a) => `${a}.started_at`,
      endedAt: (a) => `${a}.ended_at`,
      lastActivityAt: (a) => `${a}.last_activity_at`,
      duration: (a) => ms(`COALESCE(${a}.ended_at, ${a}.last_activity_at) - ${a}.started_at`),
      isOpen: (a) => `(${a}.ended_at IS NULL)`,
      converted: (a) => converted(`${a}.session_id`),
      landingPage: (a) => firstPage(a, "ASC"),
      exitPage: (a) => firstPage(a, "DESC"),
      referrer: (a) => `${a}.referrer`,
      utmSource: (a) => `${a}.utm_source`,
      utmMedium: (a) => `${a}.utm_medium`,
      utmCampaign: (a) => `${a}.utm_campaign`,
      country: (a) => `${a}.country`,
      timezone: (a) => `${a}.timezone`,
      startedHour: (a) => `EXTRACT(HOUR FROM ${a}.started_at AT TIME ZONE 'UTC')`,
      startedWeekday: (a) => `EXTRACT(DOW FROM ${a}.started_at AT TIME ZONE 'UTC')`,
    },
    joins: {
      pageViews: (p, c) => `${c}.session_id = ${p}.session_id`,
      awayGaps: (p, c) => `${c}.session_id = ${p}.session_id`,
      leads: (p, c) => `${c}.session_id = ${p}.session_id`,
      forms: (p, c) => `${c}.session_id = ${p}.session_id`,
      visitor: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
    },
  },

  lead: {
    source: (al) => scoped("form_submissions", al),
    key: (a) => `${a}.id`,
    ref: (a) => `${a}.id::text`,
    fields: {
      id: (a) => `${a}.id::text`,
      name: (a) => `${a}.name`,
      email: (a) => `${a}.email`,
      phone: (a) => `${a}.phone`,
      page: (a) => `${a}.page_path`,
      submittedAt: (a) => `${a}.submitted_at`,
      qualified: (a) => `${a}.qualified`,
      confidence: (a) => `${a}.confidence`,
      visitor: (a) => `${a}.visitor_id`,
      session: (a) => `${a}.session_id`,
    },
    joins: {
      session: (p, c) => `${c}.session_id = ${p}.session_id`,
      visitor: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
    },
  },

  visitor: {
    source: (al) => scoped("visitors", al),
    key: (a) => `${a}.id`,
    ref: (a) => `${a}.visitor_id`,
    fields: {
      id: (a) => `${a}.visitor_id`,
      firstSeen: (a) => `${a}.first_seen`,
      lastSeen: (a) => `${a}.last_seen`,
      device: (a) => `${a}.device_type`,
      browser: (a) => `${a}.browser`,
      os: (a) => `${a}.os`,
      language: (a) => `${a}.language`,
      isLead: (a) => `EXISTS (SELECT 1 FROM ${scoped("form_submissions", "e")} WHERE e.visitor_id = ${a}.visitor_id)`,
    },
    joins: {
      sessions: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
      pageViews: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
      leads: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
      forms: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
    },
  },

  form: {
    source: (al) => scoped("form_engagement", al),
    key: (a) => `${a}.id`,
    ref: (a) => `${a}.id::text`,
    fields: {
      id: (a) => `${a}.id::text`,
      page: (a) => `${a}.page_path`,
      formIndex: (a) => `${a}.form_index`,
      status: (a) => `${a}.status`,
      lastFieldType: (a) => `${a}.last_field_type`,
      viewedAt: (a) => `${a}.viewed_at`,
      firstInputAt: (a) => `${a}.first_input_at`,
      endedAt: (a) => `${a}.ended_at`,
      timeToFirstInput: (a) => ms(`${a}.first_input_at - ${a}.viewed_at`),
      fillTime: (a) => ms(`${a}.ended_at - ${a}.first_input_at`),
      fieldsTouched: (a) => `(SELECT count(*) FROM jsonb_object_keys(COALESCE(${a}.field_timings, '{}'::jsonb)))`,
      session: (a) => `${a}.session_id`,
      visitor: (a) => `${a}.visitor_id`,
    },
    joins: {
      session: (p, c) => `${c}.session_id = ${p}.session_id`,
      visitor: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
      fields: (p, c) => `${c}.form_id = ${p}.id::text`,
    },
  },

  formField: {
    // One row per field a visitor focused in a form, unpacked from
    // form_engagement.field_timings (jsonb, see mds/database.md "Per-field
    // timing"). Keys are "name" / "email" / "phone" or "custom:<raw key>".
    // Every jsonb value is type-checked before casting, so one malformed
    // entry becomes an empty value instead of failing the whole query.
    source: (al) =>
      `(SELECT (f.id::text || ':' || ft.key) AS id, f.id::text AS form_id, f.session_id, f.visitor_id, f.page_path, f.status AS form_status, ` +
      `f.last_field_type, f.last_field_key, ft.key AS field_key, ` +
      `CASE WHEN ft.key LIKE 'custom:%' THEN 'custom' ELSE ft.key END AS field_type, ` +
      `CASE WHEN ft.key LIKE 'custom:%' THEN substr(ft.key, 8) ELSE ft.key END AS field_name, ` +
      `CASE WHEN jsonb_typeof(ft.value->'order') = 'number' THEN (ft.value->>'order')::float8 END AS field_order, ` +
      `CASE WHEN jsonb_typeof(ft.value->'totalFocusedMs') = 'number' THEN (ft.value->>'totalFocusedMs')::float8 END AS focused_ms, ` +
      `CASE WHEN (ft.value->>'firstFocusAt') ~ '^[0-9]{4}-' THEN (ft.value->>'firstFocusAt')::timestamptz END AS first_focus_at, ` +
      `CASE WHEN (ft.value->>'firstKeydownAt') ~ '^[0-9]{4}-' THEN (ft.value->>'firstKeydownAt')::timestamptz END AS first_key_at, ` +
      `CASE WHEN (ft.value->>'lastUnfocusAt') ~ '^[0-9]{4}-' THEN (ft.value->>'lastUnfocusAt')::timestamptz END AS last_left_at ` +
      `FROM ${scoped("form_engagement", "f")} CROSS JOIN LATERAL jsonb_each(COALESCE(f.field_timings, '{}'::jsonb)) ft ` +
      `WHERE jsonb_typeof(ft.value) = 'object') ${al}`,
    key: (a) => `${a}.id`,
    ref: (a) => `${a}.id`,
    fields: {
      name: (a) => `${a}.field_name`,
      fieldType: (a) => `${a}.field_type`,
      order: (a) => `${a}.field_order`,
      focusedTime: (a) => `${a}.focused_ms`,
      typed: (a) => `(${a}.first_key_at IS NOT NULL)`,
      timeToFirstKey: (a) => ms(`${a}.first_key_at - ${a}.first_focus_at`),
      isLastTouched: (a) =>
        `(CASE WHEN ${a}.field_type = 'custom' THEN ${a}.last_field_type = 'custom' AND ${a}.last_field_key = ${a}.field_name ELSE ${a}.last_field_type = ${a}.field_type END)`,
      firstFocusAt: (a) => `${a}.first_focus_at`,
      firstKeyAt: (a) => `${a}.first_key_at`,
      lastLeftAt: (a) => `${a}.last_left_at`,
      formStatus: (a) => `${a}.form_status`,
      page: (a) => `${a}.page_path`,
      session: (a) => `${a}.session_id`,
      visitor: (a) => `${a}.visitor_id`,
    },
    joins: {
      form: (p, c) => `${c}.id::text = ${p}.form_id`,
      session: (p, c) => `${c}.session_id = ${p}.session_id`,
    },
  },

  page: {
    // One row per distinct page_path this site has ever recorded a view on.
    source: (al) => `(SELECT DISTINCT x.page_path AS path FROM ${scoped("page_views", "x")} WHERE x.page_path IS NOT NULL) ${al}`,
    key: (a) => `${a}.path`,
    ref: (a) => `${a}.path`,
    fields: { path: (a) => `${a}.path` },
    joins: {
      pageViews: (p, c) => `${c}.page_path = ${p}.path`,
      leads: (p, c) => `${c}.page_path = ${p}.path`,
      forms: (p, c) => `${c}.page_path = ${p}.path`,
    },
  },

  awayGap: {
    // A gap between one page view's left_at and the next one's entered_at,
    // inside the same session, at least AWAY_GAP_MIN_MS long: the same
    // definition (and threshold) FramePlate draws a purple away frame with.
    // Shorter gaps are ordinary page-to-page navigation, not "away".
    source: (al) =>
      `(SELECT g.* FROM (SELECT x.id::text AS id, x.session_id, x.visitor_id, x.left_at AS started_at, ` +
      `lead(x.entered_at) OVER (PARTITION BY x.session_id ORDER BY x.entered_at) AS ended_at ` +
      `FROM ${scoped("page_views", "x")}) g WHERE g.started_at IS NOT NULL AND g.ended_at IS NOT NULL ` +
      `AND g.ended_at - g.started_at >= interval '${AWAY_GAP_MIN_MS / 1000} seconds') ${al}`,
    key: (a) => `${a}.id`,
    ref: (a) => `${a}.id`,
    fields: {
      startedAt: (a) => `${a}.started_at`,
      endedAt: (a) => `${a}.ended_at`,
      duration: (a) => ms(`${a}.ended_at - ${a}.started_at`),
      session: (a) => `${a}.session_id`,
    },
    joins: {
      session: (p, c) => `${c}.session_id = ${p}.session_id`,
    },
  },
};
