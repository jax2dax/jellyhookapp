// lib/metrics/costs.ts
// What each site costs Jellyhook, for the control room (app/admin). Pure.
//
// Jellyhook pays fixed monthly plans (Supabase for the database, Vercel for the server). This splits each plan across
// the sites in proportion to the work each one really caused in the period, measured (lib/metrics/meter.ts):
//   database plan  by database time (tracker requests + lead batches)
//   server plan    by server time   (tracker requests + lead batches + marks applied to old leads)
// So a site's cost is "its share of what we pay", not a marginal price; with one busy site it carries nearly everything.
// The plan prices come from the environment (CR_SUPABASE_USD, CR_VERCEL_USD), defaults below; the page says they are
// calculated. Projections to a month scale the period linearly.

export interface Prices {
  supabaseMonthlyUsd: number;
  vercelMonthlyUsd: number;
}

export const DEFAULT_PRICES: Prices = { supabaseMonthlyUsd: 25, vercelMonthlyUsd: 20 };

export function pricesFromEnv(env: Record<string, string | undefined> = process.env): Prices {
  const n = (v: string | undefined, d: number) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return { supabaseMonthlyUsd: n(env.CR_SUPABASE_USD, DEFAULT_PRICES.supabaseMonthlyUsd), vercelMonthlyUsd: n(env.CR_VERCEL_USD, DEFAULT_PRICES.vercelMonthlyUsd) };
}

/** The columns of jh_admin_sites this needs. */
export interface SiteWork {
  site_id: string;
  events: number;
  leads: number;
  server_ms: number;
  db_ms: number;
  run_ms: number;
  run_db_ms: number;
  apply_ms: number;
}

export interface SiteCost {
  serverMs: number;
  dbMs: number;
  /** share of all sites' work, 0 to 1 */
  serverShare: number;
  dbShare: number;
  /** its share of the monthly plans, in dollars */
  monthlyUsd: number;
}

export interface CostReport {
  bySite: Map<string, SiteCost>;
  totals: {
    serverMs: number;
    dbMs: number;
    monthlyUsd: number;
    /** the period's work projected to 30 days */
    serverHoursPerMonth: number;
    dbHoursPerMonth: number;
    eventsPerMonth: number;
    leadsPerMonth: number;
    /** dollars per 1,000 tracked events and per lead, at the projected month; null without traffic */
    usdPer1kEvents: number | null;
    usdPerLead: number | null;
  };
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export function allocate(sites: SiteWork[], prices: Prices, periodDays: number): CostReport {
  const work = sites.map((s) => ({ id: s.site_id, serverMs: num(s.server_ms) + num(s.run_ms) + num(s.apply_ms), dbMs: num(s.db_ms) + num(s.run_db_ms) }));
  const serverMs = work.reduce((n, w) => n + w.serverMs, 0);
  const dbMs = work.reduce((n, w) => n + w.dbMs, 0);
  const bySite = new Map<string, SiteCost>();
  for (const w of work) {
    const serverShare = serverMs > 0 ? w.serverMs / serverMs : 0;
    const dbShare = dbMs > 0 ? w.dbMs / dbMs : 0;
    bySite.set(w.id, { serverMs: w.serverMs, dbMs: w.dbMs, serverShare, dbShare, monthlyUsd: serverShare * prices.vercelMonthlyUsd + dbShare * prices.supabaseMonthlyUsd });
  }
  const days = Math.max(periodDays, 1 / 24);
  const perMonth = (v: number) => (v / days) * 30;
  const events = sites.reduce((n, s) => n + num(s.events), 0);
  const leads = sites.reduce((n, s) => n + num(s.leads), 0);
  const monthlyUsd = prices.supabaseMonthlyUsd + prices.vercelMonthlyUsd;
  const eventsPerMonth = perMonth(events);
  const leadsPerMonth = perMonth(leads);
  return {
    bySite,
    totals: {
      serverMs,
      dbMs,
      monthlyUsd,
      serverHoursPerMonth: perMonth(serverMs) / 3_600_000,
      dbHoursPerMonth: perMonth(dbMs) / 3_600_000,
      eventsPerMonth,
      leadsPerMonth,
      usdPer1kEvents: eventsPerMonth > 0 ? monthlyUsd / (eventsPerMonth / 1000) : null,
      usdPerLead: leadsPerMonth > 0 ? monthlyUsd / leadsPerMonth : null,
    },
  };
}

/** Per lead in a batch: time and database calls (null without batches). */
export function perLead(run: { run_leads: number; run_ms: number; run_db_calls: number; run_db_rows: number }) {
  const leads = num(run.run_leads);
  if (!leads) return { ms: null, dbCalls: null, dbRows: null };
  return { ms: num(run.run_ms) / leads, dbCalls: num(run.run_db_calls) / leads, dbRows: num(run.run_db_rows) / leads };
}
