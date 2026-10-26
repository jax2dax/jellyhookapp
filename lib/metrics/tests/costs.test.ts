// lib/metrics/tests/costs.test.ts - splitting the monthly plans across sites by measured work (lib/metrics/costs.ts).
// Run: npm run test:tracking
import { allocate, DEFAULT_PRICES, perLead, pricesFromEnv } from "../costs";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};
const near = (a: number | null, b: number) => a !== null && Math.abs(a - b) < 1e-6;

const prices = { supabaseMonthlyUsd: 25, vercelMonthlyUsd: 20 };
const sites = [
  { site_id: "a", events: 9000, leads: 30, server_ms: 3000, db_ms: 6000, run_ms: 1000, run_db_ms: 2000, apply_ms: 0 },
  { site_id: "b", events: 1000, leads: 0, server_ms: 1000, db_ms: 2000, run_ms: 0, run_db_ms: 0, apply_ms: 0 },
];
const r = allocate(sites, prices, 7);
const a = r.bySite.get("a")!;
const b = r.bySite.get("b")!;
ok(a.serverMs === 4000 && a.dbMs === 8000, "a site's work: tracker requests + lead batches (+ marks applied)");
ok(near(a.serverShare, 0.8) && near(a.dbShare, 0.8) && near(b.serverShare, 0.2), "shares of all the work");
ok(near(a.monthlyUsd, 0.8 * 20 + 0.8 * 25) && near(a.monthlyUsd + b.monthlyUsd, 45), "the plans are split exactly, no money lost or invented");
ok(near(r.totals.eventsPerMonth, (10000 / 7) * 30) && near(r.totals.usdPer1kEvents, 45 / ((10000 / 7) * 30 / 1000)), "per 1,000 events, at the month the period projects");
ok(near(r.totals.usdPerLead, 45 / ((30 / 7) * 30)), "per lead");
ok(near(r.totals.serverHoursPerMonth, (5000 / 7) * 30 / 3_600_000), "server hours a month");

const none = allocate([{ site_id: "x", events: 0, leads: 0, server_ms: 0, db_ms: 0, run_ms: 0, run_db_ms: 0, apply_ms: 0 }], prices, 7);
ok(none.bySite.get("x")!.monthlyUsd === 0 && none.totals.usdPer1kEvents === null && none.totals.usdPerLead === null, "no traffic: no division by zero, no made-up price");

ok(JSON.stringify(pricesFromEnv({})) === JSON.stringify(DEFAULT_PRICES), "prices: defaults");
ok(pricesFromEnv({ CR_SUPABASE_USD: "599", CR_VERCEL_USD: "x" }).supabaseMonthlyUsd === 599 && pricesFromEnv({ CR_VERCEL_USD: "x" }).vercelMonthlyUsd === 20, "prices: from the environment, a bad value keeps the default");

const pl = perLead({ run_leads: 4, run_ms: 2000, run_db_calls: 100, run_db_rows: 800 });
ok(pl.ms === 500 && pl.dbCalls === 25 && pl.dbRows === 200, "per lead in batches");
ok(perLead({ run_leads: 0, run_ms: 0, run_db_calls: 0, run_db_rows: 0 }).ms === null, "no batches: nothing per lead");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
