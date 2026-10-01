// lib/actions/siteAccess.js
// Every server action that takes a siteId from a client component MUST
// call this first. This check is the application-layer authorization —
// see mds/progress_timeline.md's RLS rewrite for the full story. Uses
// service role, same reasoning as permission.actions.js/settings.actions.js/
// site-management.actions.js: `sites` grants nothing to `authenticated` in
// RLS at all (so the legacy-owner fallback below would always return
// nothing through the JWT client), and this sidesteps relying on
// auth.uid()/auth.jwt() resolving correctly inside RLS for this check
// specifically — the ownership check happens here, in JS, against the
// caller's real Clerk userId, not inside a policy.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Throws if the signed-in caller doesn't have access to siteId. Returns the
 * caller's userId on success, so call sites that also need it don't have to
 * call auth() a second time.
 * @param {string} siteId
 */
export async function requireSiteAccess(siteId) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  if (!siteId) throw new Error("Missing siteId");

  const { data: membership, error: memberError } = await supabaseAdmin
    .from("site_members")
    .select("id")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (memberError) console.error("[siteAccess] site_members lookup error:", memberError.message);
  if (membership) return userId;

  // Legacy fallback — sites created before site_members existed, same
  // pattern as settings.actions.js's verifyOwner.
  const { data: siteRow, error: siteError } = await supabaseAdmin.from("sites").select("user_id").eq("id", siteId).maybeSingle();
  if (siteError) console.error("[siteAccess] sites lookup error:", siteError.message);
  if (siteRow?.user_id === userId) return userId;

  throw new Error("You don't have access to this site");
}
