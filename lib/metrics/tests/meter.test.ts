// lib/metrics/tests/meter.test.ts - the work meter (lib/metrics/meter.ts): rows from PostgREST's Content-Range, calls
// counted only inside a meter, nested meters, work scheduled for later in the same flow. Run: npm run test:tracking
import { currentMeter, databaseFailed, metered, meteredFetch, newMeter, rowsOf } from "../meter";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

ok(rowsOf("0-24/*") === 25 && rowsOf("0-0/1") === 1 && rowsOf("100-199/500") === 100, "rows from Content-Range");
ok(rowsOf("*/0") === 0 && rowsOf(null) === 0 && rowsOf("junk") === 0, "no rows when the header says none or is missing");

const realFetch = globalThis.fetch;
let served = 0;
globalThis.fetch = (async () => {
  served++;
  await new Promise((r) => setTimeout(r, 5));
  return new Response("[]", { status: 200, headers: { "content-range": "0-9/*" } });
}) as typeof fetch;

const run = async () => {
  await meteredFetch("https://x.supabase.co/rest/v1/a");
  ok(served === 1 && currentMeter() === null, "outside a meter: the request is made, nothing is counted");

  const m = newMeter();
  await metered(m, async () => {
    await meteredFetch("https://x.supabase.co/rest/v1/a");
    await Promise.all([meteredFetch("https://x.supabase.co/rest/v1/b"), meteredFetch("https://x.supabase.co/rest/v1/c")]);
  });
  ok(m.calls === 3 && m.rows === 30 && m.ms >= 10, `inside a meter: 3 calls, 30 rows, their time (${Math.round(m.ms)} ms)`);

  const outer = newMeter();
  const inner = newMeter();
  await metered(outer, async () => {
    await meteredFetch("https://x/1");
    await metered(inner, async () => {
      await meteredFetch("https://x/2");
      await meteredFetch("https://x/3");
    });
    await meteredFetch("https://x/4");
  });
  ok(outer.calls === 2 && inner.calls === 2, "nested meters: each counts its own work, nothing twice");

  // work scheduled now and done later (like Next's after()) still counts on the meter it was scheduled under
  const later = newMeter();
  let done: Promise<void> = Promise.resolve();
  metered(later, () => {
    done = new Promise<void>((resolve) => setTimeout(async () => {
      await meteredFetch("https://x/later");
      resolve();
    }, 10));
  });
  await done;
  ok(later.calls === 1, "work done later in the same flow is counted on its meter");

  // database failures: a 5xx answer or no answer at all counts; a 4xx (a bad request, a duplicate) does not
  let answer: number | "throw" = 200;
  globalThis.fetch = (async () => {
    if (answer === "throw") throw new TypeError("fetch failed");
    return new Response("{}", { status: answer });
  }) as typeof fetch;
  const f = newMeter();
  let thrown = false;
  await metered(f, async () => {
    answer = 409;
    await meteredFetch("https://x/dup");
    ok(!databaseFailed(), "a 409 (duplicate) is not a database failure");
    answer = 522;
    await meteredFetch("https://x/down");
    answer = "throw";
    try {
      await meteredFetch("https://x/gone");
    } catch {
      thrown = true;
    }
    ok(databaseFailed(), "a 522 or no answer is a database failure");
  });
  ok(f.failures === 2 && f.calls === 3 && thrown, "failures counted (2 of 3 calls), and the error still reaches the caller");
  ok(!databaseFailed(), "outside a meter: never a failure");

  globalThis.fetch = realFetch;
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
};
run();
