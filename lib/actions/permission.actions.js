// lib/actions/permission.actions.js
"use server";
import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// getAuthUser
// ─────────────────────────────────────────────────────────────────────────────
export async function getAuthUser() {
  const user = await currentUser();
  console.log(`[permission] getAuthUser: userId=${user?.id ?? "none"}`);
  if (!user) {
    console.log("[permission] getAuthUser: no user — redirecting to /sign-in");
    redirect("/sign-in");
  }
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserSite — checks in order:
//
// Path 1: site_members WHERE user_id = userId AND status = 'active'
//         Covers owners AND accepted members. Fast path after first login.
//
// Path 2: site_members WHERE user_id = 'pending:{email}' AND status = 'pending_invite'
//         ✅ FIXED: Does NOT auto-resolve here anymore.
//         Returns { __pendingInvite: true } so requireSite redirects to /platform/invite
//         The invite page handles accept/decline with the user's consent.
//
// Path 3: sites WHERE user_id = userId AND is_active = true
//         Legacy fallback for sites created before site_members table existed.
//         Backfills a site_members owner row so Path 1 works on next call.
//
// Returns: site object | { __pendingInvite: true } | null
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserSite(userId) {
  console.log(`[permission] getUserSite: userId=${userId}`);

  const supabase = await createSupabaseClient(); // ✅ await

  // ── Path 1: active membership ──────────────────────────────────────────────
  const { data: membership, error: memberError } = await supabase
    .from("site_members")
    .select(`
      role, status,
      sites (
        id, plan, domain, api_key, is_active, monthly_event_limit,
        created_at, specify_form, name, user_id
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active") // ← only active memberships — pending/declined are excluded
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memberError) console.error("[permission] getUserSite Path 1 error:", memberError.message);

  if (membership?.sites && membership.sites.is_active) {
    console.log(`[permission] getUserSite: ✅ Path 1 — siteId=${membership.sites.id} role=${membership.role}`);
    return membership.sites;
  }

  // ── Path 2: pending invite — DO NOT auto-resolve ───────────────────────────
  // Get user's email from Clerk to check for pending invites sent before signup
  const clerkUser = await currentUser();
  const userEmail = clerkUser?.emailAddresses?.find(
    (e) => e.id === clerkUser.primaryEmailAddressId
  )?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || "";

  if (userEmail) {
    const pendingKey = `pending:${userEmail.toLowerCase()}`;
    console.log(`[permission] getUserSite: checking pending invite for ${pendingKey}`);

    const { data: pendingRow, error: pendingError } = await supabase
      .from("site_members")
      .select("id, status")
      .eq("user_id", pendingKey)
      .eq("status", "pending_invite") // ← only look at pending invites, not active/declined
      .limit(1)
      .maybeSingle();

    if (pendingError) console.error("[permission] getUserSite Path 2 error:", pendingError.message);

    if (pendingRow) {
      // ✅ FIXED: Return signal instead of auto-resolving
      // Old code was auto-updating user_id and returning the site directly.
      // That bypassed accept/decline entirely — user got added without consent.
      console.log(`[permission] getUserSite: pending invite found for ${userEmail} — signaling redirect to /platform/invite`);
      return { __pendingInvite: true };
    } else {
      console.log(`[permission] getUserSite: no pending invite for ${pendingKey}`);
    }
  }

  // ── Path 3: legacy sites.user_id fallback ─────────────────────────────────
  const { data: legacySite, error: legacyError } = await supabase
    .from("sites")
    .select("id, plan, domain, api_key, is_active, monthly_event_limit, created_at, specify_form, name, user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacyError) {
    console.error("[permission] getUserSite Path 3 error:", legacyError.message);
    return null;
  }

  if (legacySite) {
    console.log(`[permission] getUserSite: ✅ Path 3 — siteId=${legacySite.id} — backfilling site_members`);

    // Backfill so Path 1 works on next call
    const { error: backfillError } = await supabase.from("site_members").insert({
      site_id: legacySite.id,
      user_id: userId,
      user_email: userEmail || "",
      role: "owner",
      status: "active",
    });

    if (backfillError) {
      if (!backfillError.message.includes("duplicate") && !backfillError.message.includes("unique")) {
        console.warn("[permission] getUserSite backfill error (non-fatal):", backfillError.message);
      }
    } else {
      console.log("[permission] getUserSite: ✅ backfilled owner row");
    }

    return legacySite;
  }

  console.log(`[permission] getUserSite: no site found for userId=${userId}`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireSite — redirects appropriately based on getUserSite result
// ─────────────────────────────────────────────────────────────────────────────
export async function requireSite(userId) {
  const result = await getUserSite(userId);

  if (!result) {
    console.log("[permission] requireSite: no site — redirecting to /platform/create-site");
    redirect("/platform/create-site");
  }

  // ✅ Handle pending invite signal — redirect to invite page
  if (result.__pendingInvite) {
    console.log("[permission] requireSite: pending invite — redirecting to /platform/invite");
    redirect("/platform/invite");
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan checks
// ─────────────────────────────────────────────────────────────────────────────

export async function isProOrHigher() {
  const { has } = await auth();
  const result = has({ plan: "pro" }) || has({ plan: "elite" });
  console.log(`[permission] isProOrHigher: ${result}`);
  return result;
}

export async function isElite() {
  const { has } = await auth();
  const result = has({ plan: "elite" });
  console.log(`[permission] isElite: ${result}`);
  return result;
}

export async function isProOnly() {
  const { has } = await auth();
  const result = has({ plan: "pro" }) && !has({ plan: "elite" });
  console.log(`[permission] isProOnly: ${result}`);
  return result;
}

export async function getPlanLabel() {
  const { has } = await auth();
  if (has({ plan: "elite" })) return "elite";
  if (has({ plan: "pro" })) return "pro";
  return "free";
}

const PLAN_LEVELS = { free: 0, pro: 1, elite: 2 };

export async  function hasPlan(userPlan, required) {
  console.log(`[permission] hasPlan: user=${userPlan} required=${required}`);
  return (PLAN_LEVELS[userPlan] ?? 0) >= (PLAN_LEVELS[required] ?? 0);
}