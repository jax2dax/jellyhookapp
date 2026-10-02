// lib/supabase/browser.ts
//
// Browser-side Supabase client, authenticated with the caller's own Clerk
// session token via the accessToken callback — the same pattern
// lib/supabase/server.ts uses server-side (see that file). This is what
// lets a client-side Realtime subscription honor the exact same RLS
// policies as every server-side query against the same tables (see
// mds/database.md's RLS section) — a signed-in user only ever receives
// postgres_changes events for rows their own site_members row grants them,
// never another site's.
//
// This file has no access to Clerk's React context on its own (Clerk's
// client-side auth() is a hook, not an importable function), so the caller
// passes `getToken` in — see useAuth() from "@clerk/nextjs".
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createBrowserSupabaseClient(getToken: () => Promise<string | null>): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    async accessToken() {
      return getToken();
    },
  });
}
