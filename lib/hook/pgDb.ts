// lib/hook/pgDb.ts
// The one door from the Hook engine to Postgres: a direct connection that
// logs in as the read-only `hook_reader` role (setup: jh-hook/setup.sql and
// jh-hook/architecture.md, "Database access"). Server only. The role can
// SELECT and nothing else, and carries its own statement_timeout, so a bad
// hook can't write or run away.
import "server-only";
import { Pool } from "pg";
import type { HookDb } from "@/jh-hook/engine/run";

const g = globalThis as unknown as { __hookPool?: Pool };

function pool(): Pool {
  const url = process.env.HOOK_DATABASE_URL;
  if (!url) throw new Error("HOOK_DATABASE_URL is not set. See jh-hook/architecture.md, \"Database access\".");
  if (!g.__hookPool) {
    g.__hookPool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 30_000,
      // Supabase's pooler expects TLS. Encrypted, without pinning Supabase's
      // CA (that needs their CA file; see architecture.md). Set
      // HOOK_DATABASE_SSL=off only for a local Postgres.
      ssl: process.env.HOOK_DATABASE_SSL === "off" ? false : { rejectUnauthorized: false },
    });
  }
  return g.__hookPool;
}

export const pgHookDb: HookDb = {
  async query(sql, params) {
    const r = await pool().query(sql, params as unknown[]);
    return r.rows;
  },
  async explain(sql, params) {
    const r = await pool().query("EXPLAIN (FORMAT JSON) " + sql, params as unknown[]);
    const plan = (r.rows[0]["QUERY PLAN"] as Array<{ Plan: Record<string, number> }>)[0].Plan;
    return { rows: plan["Plan Rows"], cost: plan["Total Cost"] };
  },
};
