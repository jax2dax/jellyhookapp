// lib/resolvePendingCountries.js
//
// Country resolution used to happen INSIDE app/api/track/route.js, blocking
// every single tracking request on a 3rd-party HTTP call before any DB
// write. That's removed — sessions are now inserted with country: null, and
// this function backfills them separately, called via next/server's after()
// from the track route so it runs AFTER the visitor's response is already
// sent. It rides along on real traffic (no cron needed, no idle cost) and
// processes a small batch each time so no single call does unbounded work.
import { resolveCountry } from "@/lib/countryProviders";

const BATCH_SIZE = 5;

// At most one run at a time in this server process: every tracking request calls this after its response, and without
// the guard many runs pick the same visitors and call the lookup service in parallel (found in the crowd test, 2026-10-27:
// the test server stopped answering). Across processes, the claim below makes sure each visitor is looked up once.
let running = false;

export async function resolvePendingCountries(supabase) {
  // the test project's fake addresses never resolve: JELLYHOOK_COUNTRY_LOOKUP=off (in .env.bench) skips the lookups
  if (process.env.JELLYHOOK_COUNTRY_LOOKUP === "off" || running) return;
  running = true;
  try {
    await run(supabase);
  } finally {
    running = false;
  }
}

async function run(supabase) {
  // There is no foreign key from sessions to visitors (production has none), so the API cannot join them. The visitors that
  // still hold a raw IP are exactly the ones waiting for a lookup (the IP is erased after one attempt), so start there.
  const { data: pending, error } = await supabase
    .from("visitors")
    .select("site_id, visitor_id, ip_address")
    .not("ip_address", "is", null)
    .order("last_seen", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[country-lookup] failed to fetch pending visitors:", error.message);
    return;
  }
  if (!pending || pending.length === 0) return;

  for (const visitor of pending) {
    // Claim the visitor by erasing its IP first, only if it is still there: a run elsewhere that already took it changes
    // nothing here and this one skips it. The raw IP was only kept for this lookup; it goes after ONE attempt, whether or
    // not the lookup works. What stays is visitors.ip_hash (see lib/tracking/ip.js).
    const { data: claimed } = await supabase
      .from("visitors")
      .update({ ip_address: null })
      .eq("site_id", visitor.site_id)
      .eq("visitor_id", visitor.visitor_id)
      .eq("ip_address", visitor.ip_address)
      .select("visitor_id");
    if (!claimed?.length) continue;
    const country = await resolveCountry(visitor.ip_address);
    if (!country) continue;

    const { error: updateError } = await supabase
      .from("sessions")
      .update({ country })
      .eq("site_id", visitor.site_id)
      .eq("visitor_id", visitor.visitor_id)
      .is("country", null);
    if (updateError) {
      console.error(`[country-lookup] failed to save country for visitor=${visitor.visitor_id}:`, updateError.message);
    }
  }
}
