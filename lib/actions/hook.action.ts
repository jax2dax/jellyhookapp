// lib/actions/hook.action.ts
// Server entry points for the Hook engine (jh-hook/). The site comes from
// the signed-in user's current site (preferred-site cookie) and is
// access-checked here; the browser never supplies a site id. So a hook can
// only ever read the current site, and only for an active member of it.
//
// Errors: a HookError (the query can't run as written) goes back verbatim,
// it tells the person what to fix. Anything else (database, network) is
// logged here with a reference code, and the person gets the code, never
// the raw message (it can carry SQL or connection details). In development
// the raw message is appended, to save a trip to the terminal.
"use server";

import { pgHookDb } from "@/lib/hook/pgDb";
import { failure, siteOrThrow } from "@/lib/hook/site";
import { runHook } from "@/jh-hook/engine/run";
import { escapeLike, scoped } from "@/jh-hook/engine/sql";
import { hookLog } from "@/jh-hook/debug";
import type { HookResult, HookSpec } from "@/jh-hook/types";

const DEFAULT_MAX_CREDITS = Number(process.env.HOOK_MAX_CREDITS ?? 200);

export type HookRunResponse = { ok: true; result: HookResult } | { ok: false; error: string; ref?: string };

export async function runHookAction(spec: HookSpec): Promise<HookRunResponse> {
  const t0 = Date.now();
  let siteId = "";
  try {
    siteId = await siteOrThrow();
    const result = await runHook(pgHookDb, siteId, spec, { maxCredits: DEFAULT_MAX_CREDITS });
    // One line per run, always: the raw material for metering and pricing.
    console.info(
      "[hook] run",
      JSON.stringify({
        site: siteId.slice(0, 8),
        entity: spec?.entity,
        output: spec?.output?.kind,
        credits: result.cost.credits,
        planMs: result.timing.planMs,
        execMs: result.timing.execMs,
        strategy: result.plan.strategy,
        steps: result.plan.steps.length,
        tunnels: result.tunnels.length,
      }),
    );
    hookLog.debug("run sql", result.sql);
    return { ok: true, result };
  } catch (e) {
    return failure(e, { what: "run", siteId, t0 });
  }
}

/**
 * Value suggestions for text fields in the builder (pages, utm sources,
 * countries, browsers...): the distinct values this site actually has, most
 * common first. Only the fields listed here can be suggested.
 */
const SUGGEST: Record<string, { table: Parameters<typeof scoped>[0]; column: string }> = {
  "pageView.page": { table: "page_views", column: "page_path" },
  "pageView.title": { table: "page_views", column: "page_title" },
  "session.landingPage": { table: "page_views", column: "page_path" },
  "session.exitPage": { table: "page_views", column: "page_path" },
  "session.referrer": { table: "sessions", column: "referrer" },
  "session.utmSource": { table: "sessions", column: "utm_source" },
  "session.utmMedium": { table: "sessions", column: "utm_medium" },
  "session.utmCampaign": { table: "sessions", column: "utm_campaign" },
  "session.country": { table: "sessions", column: "country" },
  "session.timezone": { table: "sessions", column: "timezone" },
  "lead.page": { table: "form_submissions", column: "page_path" },
  "lead.name": { table: "form_submissions", column: "name" },
  "lead.email": { table: "form_submissions", column: "email" },
  "visitor.browser": { table: "visitors", column: "browser" },
  "visitor.os": { table: "visitors", column: "os" },
  "visitor.language": { table: "visitors", column: "language" },
  "form.page": { table: "form_engagement", column: "page_path" },
  "formField.page": { table: "form_engagement", column: "page_path" },
  "page.path": { table: "page_views", column: "page_path" },
};

export async function suggestHookValues(entity: string, field: string, text = ""): Promise<{ value: string; n: number }[]> {
  const s = SUGGEST[`${entity}.${field}`];
  if (!s) return [];
  try {
    const siteId = await siteOrThrow();
    const q = text.trim().slice(0, 100);
    const rows = await pgHookDb.query(
      `SELECT x.${s.column} AS value, count(*)::int AS n FROM ${scoped(s.table, "x")} WHERE x.${s.column} IS NOT NULL` +
        (q ? ` AND x.${s.column} ILIKE $2::text` : "") +
        ` GROUP BY 1 ORDER BY n DESC LIMIT 50`,
      q ? [siteId, `%${escapeLike(q)}%`] : [siteId],
    );
    return rows as { value: string; n: number }[];
  } catch (e) {
    // Suggestions are a convenience: a failure must never break the builder.
    hookLog.warn("suggestions unavailable", { field: `${entity}.${field}`, error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

/**
 * Every page address of the site with its view count (most viewed first,
 * up to 500). The silhouette uses it for "N+" plate headers and their hover
 * list. Empty on failure: a preview must never break the page.
 */
export async function listSitePages(): Promise<{ path: string; views: number }[]> {
  try {
    const siteId = await siteOrThrow();
    const rows = await pgHookDb.query(
      `SELECT x.page_path AS path, count(*)::int AS views FROM ${scoped("page_views", "x")} WHERE x.page_path IS NOT NULL GROUP BY 1 ORDER BY views DESC LIMIT 500`,
      [siteId],
    );
    return rows as { path: string; views: number }[];
  } catch (e) {
    hookLog.warn("site pages unavailable", { error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}
