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

export async function resolvePendingCountries(supabase) {
  const { data: pending, error } = await supabase
    .from("sessions")
    .select("id, visitor_id, site_id, visitors!inner(ip_address)")
    .is("country", null)
    .not("visitors.ip_address", "is", null)
    .order("started_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[country-lookup] failed to fetch pending sessions:", error.message);
    return;
  }
  if (!pending || pending.length === 0) return;

  for (const session of pending) {
    const ip = session.visitors?.ip_address;
    const country = await resolveCountry(ip);
    if (!country) continue;

    const { error: updateError } = await supabase
      .from("sessions")
      .update({ country })
      .eq("id", session.id);
    if (updateError) {
      console.error(`[country-lookup] failed to save country for session=${session.id}:`, updateError.message);
    }
  }
}
