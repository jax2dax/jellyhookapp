// lib/metrics/meter.ts
// Counts the database work one piece of work does (a tracker request, a batch of new leads, applying a mark), for the
// control room (app/admin, mds/build/control-room.md). A meter is attached to the current async flow with
// AsyncLocalStorage; every Supabase call made through a metered client (lib/db/admin.ts meteredAdmin) inside that
// flow adds one call, its time to the response headers, and the rows PostgREST says it returned (Content-Range). Code
// that runs outside a meter is not slowed or counted. Nested meters do not add up: the innermost one counts.
//
// What it does not see: the direct Postgres pool used by Hook queries (lib/hook/pgDb.ts, v1 marks), and the database's
// own CPU and disk work behind each call. It measures what Jellyhook asks for, which is what Jellyhook can change.
import { AsyncLocalStorage } from "node:async_hooks";

export interface Meter {
  /** when the work started (ms) */
  started: number;
  /** Supabase requests */
  calls: number;
  /** time waiting for them (ms, to the response headers) */
  ms: number;
  /** rows returned (Content-Range), a measure of how much was read */
  rows: number;
}

const store = new AsyncLocalStorage<Meter>();

export const newMeter = (): Meter => ({ started: Date.now(), calls: 0, ms: 0, rows: 0 });

/** Runs `fn` with `m` as the current meter (for everything it awaits, including after() callbacks it schedules). */
export function metered<T>(m: Meter, fn: () => T): T {
  return store.run(m, fn);
}

export const currentMeter = (): Meter | null => store.getStore() ?? null;

/** Rows in a PostgREST Content-Range header: "0-24/*" is 25, "*\/0" or a missing header is 0. */
export function rowsOf(contentRange: string | null | undefined): number {
  if (!contentRange) return 0;
  const m = /^(\d+)-(\d+)\//.exec(contentRange);
  return m ? Number(m[2]) - Number(m[1]) + 1 : 0;
}

/** fetch for the Supabase client: the same request, counted on the current meter when there is one. */
export const meteredFetch: typeof fetch = async (input, init) => {
  const m = store.getStore();
  if (!m) return fetch(input, init);
  const t0 = performance.now();
  const res = await fetch(input, init);
  m.calls += 1;
  m.ms += performance.now() - t0;
  m.rows += rowsOf(res.headers.get("content-range"));
  return res;
};
