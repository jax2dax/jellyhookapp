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

// ── Around a form (2026-10-16, for marks). The form's own moments: seen (viewed_at), first input, end (ended_at, or
// last activity while still open). An "away" here is 10 s or more between leaving one page and opening the next in
// the same visit (the founder's threshold for these signals; awayGap below uses AWAY_GAP_MIN_MS for the chart).
const FORM_AWAY = "interval '10 seconds'";
const formEnd = (a: string) => `COALESCE(${a}.ended_at, ${a}.last_activity_at)`;
/** page views of the form's visit that start an away period of 10 s or more */
const awayStarts = (a: string, alias: string) =>
  `${scoped("page_views", alias)} WHERE ${alias}.session_id = ${a}.session_id AND ${alias}.left_at IS NOT NULL ` +
  `AND (SELECT min(nx.entered_at) FROM ${scoped("page_views", "nx")} WHERE nx.session_id = ${alias}.session_id AND nx.entered_at > ${alias}.entered_at) - ${alias}.left_at >= ${FORM_AWAY}`;

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
      beforeSending: (a) => `EXISTS (SELECT 1 FROM ${scoped("form_submissions", "bs")} WHERE bs.visitor_id = ${a}.visitor_id AND bs.submitted_at >= ${a}.entered_at)`,
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
      // the last moment of the sending visit (its last page left) minus the moment of sending; empty while still open
      timeAfterSending: (a) => `GREATEST(0, ${ms(`(SELECT max(e.left_at) FROM ${scoped("page_views", "e")} WHERE e.session_id = ${a}.session_id) - ${a}.submitted_at`)})`,
      qualified: (a) => `${a}.qualified`,
      confidence: (a) => `${a}.confidence`,
      visitor: (a) => `${a}.visitor_id`,
      session: (a) => `${a}.session_id`,
    },
    joins: {
      session: (p, c) => `${c}.session_id = ${p}.session_id`,
      visitor: (p, c) => `${c}.visitor_id = ${p}.visitor_id`,
      // up to and including the moment of sending (a page entered after it is not "before contacting you")
      pagesBeforeSubmit: (p, c) => `${c}.visitor_id = ${p}.visitor_id AND ${c}.entered_at <= ${p}.submitted_at`,
      visitPagesBeforeSubmit: (p, c) => `${c}.session_id = ${p}.session_id AND ${c}.entered_at <= ${p}.submitted_at`,
      visitsBeforeSubmit: (p, c) => `${c}.visitor_id = ${p}.visitor_id AND ${c}.started_at <= ${p}.submitted_at`,
      submittedForm: (p, c) => `${c}.session_id = ${p}.session_id AND ${c}.status = 'submitted'`,
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
      // since 17-form-versions.sql
      formKey: (a) => `${a}.form_key`,
      version: (a) => `${a}.form_version_id::text`,
      status: (a) => `${a}.status`,
      lastFieldType: (a) => `${a}.last_field_type`,
      viewedAt: (a) => `${a}.viewed_at`,
      firstInputAt: (a) => `${a}.first_input_at`,
      endedAt: (a) => `${a}.ended_at`,
      timeToFirstInput: (a) => ms(`${a}.first_input_at - ${a}.viewed_at`),
      fillTime: (a) => ms(`${a}.ended_at - ${a}.first_input_at`),
      fieldsTouched: (a) => `(SELECT count(*) FROM jsonb_object_keys(COALESCE(${a}.field_timings, '{}'::jsonb)))`,
      // Since 2026-10-14 (13-form-signals.sql adds the two columns). Every jsonb value is type-checked before use.
      timeOnScreenBeforeStart: (a) => `${a}.onscreen_before_start_ms::float8`,
      totalFields: (a) => `(CASE WHEN jsonb_typeof(${a}.form_fields) = 'array' THEN jsonb_array_length(${a}.form_fields)::float8 END)`,
      // fields of the form with no focused entry in field_timings (an entry that only recorded validation errors has no firstFocusAt)
      fieldsNotTouched: (a) =>
        `(CASE WHEN jsonb_typeof(${a}.form_fields) = 'array' THEN (SELECT count(*)::float8 FROM jsonb_array_elements(${a}.form_fields) e WHERE NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(${a}.field_timings) = 'object' THEN ${a}.field_timings ELSE '{}'::jsonb END) t WHERE t.key = e->>'key' AND jsonb_typeof(t.value) = 'object' AND (t.value->>'firstFocusAt') ~ '^[0-9]{4}-')) END)`,
      validationErrors: (a) =>
        `(SELECT COALESCE(sum(CASE WHEN jsonb_typeof(t.value->'errors') = 'number' THEN (t.value->>'errors')::float8 END), 0) FROM jsonb_each(CASE WHEN jsonb_typeof(${a}.field_timings) = 'object' THEN ${a}.field_timings ELSE '{}'::jsonb END) t WHERE jsonb_typeof(t.value) = 'object')`,
      leftWhileFilling: (a) =>
        `(${a}.first_input_at IS NOT NULL AND (` +
        `EXISTS (SELECT 1 FROM ${scoped("page_views", "lw")} WHERE lw.session_id = ${a}.session_id AND lw.page_path IS DISTINCT FROM ${a}.page_path AND lw.entered_at > ${a}.first_input_at AND lw.entered_at < ${formEnd(a)})` +
        ` OR EXISTS (SELECT 1 FROM ${awayStarts(a, "la")} AND la.left_at >= ${a}.first_input_at AND la.left_at < ${formEnd(a)})))`,
      awaysAfterSeen: (a) => `(SELECT count(*)::float8 FROM ${awayStarts(a, "aw")} AND aw.left_at >= ${a}.viewed_at)`,
      pagesSeenToSent: (a) =>
        `(SELECT count(DISTINCT ps.page_path)::float8 FROM ${scoped("page_views", "ps")} WHERE ps.session_id = ${a}.session_id AND ps.page_path IS DISTINCT FROM ${a}.page_path AND ps.entered_at > ${a}.viewed_at AND ps.entered_at <= ${formEnd(a)})`,
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
      `CASE WHEN (ft.value->>'lastUnfocusAt') ~ '^[0-9]{4}-' THEN (ft.value->>'lastUnfocusAt')::timestamptz END AS last_left_at, ` +
      // false only for an entry that ONLY recorded validation errors (it was never clicked into); every other entry, even an old one
      // without a focus time, is a field that was touched, exactly as before
      `NOT ((ft.value->>'firstFocusAt') IS NULL AND ft.value ? 'errors') AS touched, ` +
      `CASE WHEN jsonb_typeof(ft.value->'visits') = 'array' THEN jsonb_array_length(ft.value->'visits')::float8 END AS visits, ` +
      `CASE WHEN jsonb_typeof(ft.value->'filled') = 'boolean' THEN (ft.value->>'filled')::boolean END AS filled, ` +
      `CASE WHEN jsonb_typeof(ft.value->'edits') = 'number' THEN (ft.value->>'edits')::float8 END AS changes, ` +
      `CASE WHEN jsonb_typeof(ft.value->'errors') = 'number' THEN (ft.value->>'errors')::float8 END AS errors, ` +
      `(SELECT (e->>'required')::boolean FROM jsonb_array_elements(CASE WHEN jsonb_typeof(f.form_fields) = 'array' THEN f.form_fields ELSE '[]'::jsonb END) e WHERE e->>'key' = ft.key AND jsonb_typeof(e->'required') = 'boolean' LIMIT 1) AS required ` +
      `FROM ${scoped("form_engagement", "f")} CROSS JOIN LATERAL jsonb_each(COALESCE(f.field_timings, '{}'::jsonb)) ft ` +
      `WHERE jsonb_typeof(ft.value) = 'object' ` +
      `UNION ALL ` +
      // the form's fields nobody focused (form_fields is only recorded for forms seen after 2026-10-14): one row each
      `SELECT (f.id::text || ':' || (e->>'key')), f.id::text, f.session_id, f.visitor_id, f.page_path, f.status, f.last_field_type, f.last_field_key, e->>'key', ` +
      `CASE WHEN (e->>'key') LIKE 'custom:%' THEN 'custom' ELSE e->>'key' END, ` +
      `CASE WHEN (e->>'key') LIKE 'custom:%' THEN substr(e->>'key', 8) ELSE e->>'key' END, ` +
      `NULL::float8, NULL::float8, NULL::timestamptz, NULL::timestamptz, NULL::timestamptz, false, NULL::float8, NULL::boolean, NULL::float8, ` +
      `CASE WHEN jsonb_typeof(f.field_timings) = 'object' AND jsonb_typeof(f.field_timings->(e->>'key')) = 'object' THEN CASE WHEN jsonb_typeof(f.field_timings->(e->>'key')->'errors') = 'number' THEN (f.field_timings->(e->>'key')->>'errors')::float8 END END, ` +
      `CASE WHEN jsonb_typeof(e->'required') = 'boolean' THEN (e->>'required')::boolean END ` +
      `FROM ${scoped("form_engagement", "f")} CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(f.form_fields) = 'array' THEN f.form_fields ELSE '[]'::jsonb END) e ` +
      `WHERE jsonb_typeof(e) = 'object' AND e->>'key' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(f.field_timings) = 'object' THEN f.field_timings ELSE '{}'::jsonb END) t WHERE t.key = e->>'key' AND jsonb_typeof(t.value) = 'object')) ${al}`,
    key: (a) => `${a}.id`,
    ref: (a) => `${a}.id`,
    fields: {
      name: (a) => `${a}.field_name`,
      fieldType: (a) => `${a}.field_type`,
      order: (a) => `${a}.field_order`,
      focusedTime: (a) => `${a}.focused_ms`,
      // empty (not false) for a field nobody clicked into, so "clicked in but never typed" does not count it
      typed: (a) => `(CASE WHEN ${a}.touched THEN ${a}.first_key_at IS NOT NULL END)`,
      touched: (a) => `${a}.touched`,
      visits: (a) => `${a}.visits`,
      filled: (a) => `${a}.filled`,
      changes: (a) => `${a}.changes`,
      errors: (a) => `${a}.errors`,
      required: (a) => `${a}.required`,
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
