// lib/db/admin.ts
// The service-role Supabase client for server code that does measured work (tracker routes, the lead queue, marks,
// hooks, HubSpot): the same client as createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY), but every request is
// counted on the current meter (lib/metrics/meter.ts) when one is running. Outside a meter it behaves exactly as before.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { meteredFetch } from "@/lib/metrics/meter";

export function meteredAdmin(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { global: { fetch: meteredFetch } });
}
