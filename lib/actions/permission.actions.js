// lib/actions/permission.actions.js
"use server";
import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getPreferredSiteId } from "@/lib/actions/site-cookie";

// Service role — required for `subscriptions` reads. The RLS-scoped client
// from lib/supabase.ts authorizes by the caller's own Clerk JWT, and
// `subscriptions` has no policy granting a user SELECT on their own row (see
// lib/actions/billing.actions.ts, which uses service role for this exact
// table for the same reason) — using the RLS client here would silently
// return nothing and make planFromDb() always report "free".
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
// getAllUserSites
// Returns ALL non-deleted sites the user is a member/owner of.
// deleted_at IS NULL only. Includes is_active=false sites.
// Used for site switcher UI.
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllUserSites(userId) {
  console.log(`[permission] getAllUserSites: userId=${userId}`);
  const supabase = await createSupabaseClient();

  const clerkUser = await currentUser();
  const userEmail =
    clerkUser?.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    "";

  // Path 1: all active memberships
  const { data: memberships, error: memberError } = await supabase
    .from("site_members")
    .select(`
      role, status,
      sites (
        id, plan, domain, name, api_key, is_active,
        monthly_event_limit, created_at, specify_form, user_id, verified, deleted_at
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active");

  if (memberError) {
    console.error("[permission] getAllUserSites memberError:", memberError.message);
  }

  const sitesFromMemberships = (memberships || [])
    .map((m) => ({ ...m.sites, role: m.role }))
    .filter((s) => s && s.deleted_at === null);

  // Path 2: legacy sites.user_id fallback
  const { data: legacySites, error: legacyError } = await supabase
    .from("sites")
    .select("id, plan, domain, name, api_key, is_active, monthly_event_limit, created_at, specify_form, user_id, verified, deleted_at")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (legacyError) {
    console.error("[permission] getAllUserSites legacyError:", legacyError.message);
  }

  // Merge, deduplicate by id, tag legacy as owner
  const allById = {};
  for (const s of sitesFromMemberships) {
    allById[s.id] = s;
  }
  for (const s of (legacySites || [])) {
    if (!allById[s.id]) {
      allById[s.id] = { ...s, role: "owner" };

      // Backfill site_members
      await supabase.from("site_members").insert({
        site_id: s.id,
        user_id: userId,
        user_email: userEmail,
        role: "owner",
        status: "active",
      }).then(() => {
        console.log(`[permission] getAllUserSites: backfilled owner for siteId=${s.id}`);
      }).catch(() => {});
    }
  }

  const result = Object.values(allById).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  console.log(`[permission] getAllUserSites: found ${result.length} sites`);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserSite — THE canonical "which site am I viewing" function.
//
// Priority:
// 1. Cookie preferred_site_id — if set AND user has access to it → return it
// 2. Latest non-deleted site from memberships/legacy
// 3. Pending invite signal → { __pendingInvite: true }
// 4. null → no sites
//
// After resolving, always writes the resolved site_id back to cookie
// so subsequent server renders are consistent.
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserSite(userId) {
  console.log(`[permission] getUserSite: userId=${userId}`);
  const supabase = await createSupabaseClient();

  const clerkUser = await currentUser();
  const userEmail =
    clerkUser?.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ||
    clerkUser?.emailAddresses?.[0]?.emailAddress ||
    "";

  // ── Step 1: Read cookie ────────────────────────────────────────────────────
  const preferredSiteId = await getPreferredSiteId();
  console.log(`[permission] getUserSite: preferredSiteId from cookie=${preferredSiteId}`);

  if (preferredSiteId) {
    // Verify user has access to preferred site — query site_members by site_id directly
    const { data: membership } = await supabase
      .from("site_members")
      .select(`
        role, status,
        sites (
          id, plan, domain, name, api_key, is_active,
          monthly_event_limit, created_at, specify_form, user_id, verified, deleted_at
        )
      `)
      .eq("user_id", userId)
      .eq("site_id", preferredSiteId)
      .eq("status", "active")
      .maybeSingle();

    const cookieSite = membership?.sites;
    if (cookieSite && cookieSite.deleted_at === null) {
      console.log(`[permission] getUserSite: ✅ resolved from cookie siteId=${cookieSite.id}`);
      return { ...cookieSite, role: membership.role };
    }

    // Cookie pointed to a site user can't access or is deleted — fall through
    console.log(`[permission] getUserSite: cookie siteId=${preferredSiteId} invalid or inaccessible — falling through`);
  }

  // ── Step 2: Active membership — most recent non-deleted site ──────────────
  const { data: memberships, error: memberError } = await supabase
    .from("site_members")
    .select(`
      role, status,
      sites (
        id, plan, domain, name, api_key, is_active,
        monthly_event_limit, created_at, specify_form, user_id, verified, deleted_at
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (memberError) console.error("[permission] getUserSite Path 1 error:", memberError.message);

  const validMembership = (memberships || []).find(
    (m) => m.sites && m.sites.deleted_at === null
  );

  if (validMembership?.sites) {
    const site = { ...validMembership.sites, role: validMembership.role };
    console.log(`[permission] getUserSite: ✅ Path 1 — siteId=${site.id} role=${validMembership.role}`);
    // ✅ Do NOT write cookie here — getUserSite runs in Server Component context
    // Cookie is written only from Server Actions (createSite, switchSite, acceptInvite)
    return site;
  }

  // ── Step 3: Pending invite ─────────────────────────────────────────────────
  if (userEmail) {
    const pendingKey = `pending:${userEmail.toLowerCase()}`;
    const { data: pendingRow } = await supabase
      .from("site_members")
      .select("id, status")
      .eq("user_id", pendingKey)
      .eq("status", "pending_invite")
      .limit(1)
      .maybeSingle();

    if (pendingRow) {
      console.log(`[permission] getUserSite: pending invite found for ${userEmail}`);
      return { __pendingInvite: true };
    }
  }

  // ── Step 4: Legacy sites.user_id fallback ─────────────────────────────────
  const { data: legacySite, error: legacyError } = await supabase
    .from("sites")
    .select("id, plan, domain, name, api_key, is_active, monthly_event_limit, created_at, specify_form, user_id, verified, deleted_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacyError) {
    console.error("[permission] getUserSite Path 3 error:", legacyError.message);
    return null;
  }

  if (legacySite) {
    console.log(`[permission] getUserSite: ✅ Path 3 legacy siteId=${legacySite.id} — backfilling`);
    await supabase.from("site_members").insert({
      site_id: legacySite.id,
      user_id: userId,
      user_email: userEmail,
      role: "owner",
      status: "active",
    }).catch(() => {});

   // await setPreferredSiteId(legacySite.id);
    return { ...legacySite, role: "owner" };
  }

  console.log(`[permission] getUserSite: no site found for userId=${userId}`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireSite
// ─────────────────────────────────────────────────────────────────────────────
export async function requireSite(userId) {
  const result = await getUserSite(userId);

  if (!result) {
    console.log("[permission] requireSite: no site — redirecting to /platform/create-site");
    redirect("/platform/create-site");
  }

  if (result.__pendingInvite) {
    console.log("[permission] requireSite: pending invite — redirecting to /platform/invite");
    redirect("/platform/invite");
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan checks
//
// `auth().has({ plan })` reads plan claims baked into the current session's
// JWT, which Clerk refreshes on its own schedule (docs: up to ~1 minute
// after a plan actually changes) — right after subscribing, in the same
// session, `has()` can still say "free" even though the purchase went
// through. Our `subscriptions` table is written by the billing webhook,
// which typically fires within seconds of the purchase, so it's the fresher
// signal in exactly that window. Neither one is trustworthy 100% of the time
// on its own (has() lags right after a change; the DB mirror lags if a
// webhook is ever delayed/dropped), so getEffectivePlan() takes whichever of
// the two currently reports the HIGHER tier — never the lower one — so a
// user is never locked out by whichever signal happens to be stale.
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_LEVELS = { free: 0, pro: 1, elite: 2 };

function planFromHas(has) {
  if (has({ plan: "elite" })) return "elite";
  if (has({ plan: "pro" })) return "pro";
  return "free";
}

// Reads our own webhook-synced mirror. A canceled plan still counts until
// its current_period_end passes — see app/api/webhooks/clerk/route.ts.
async function planFromDb(userId) {
  if (!userId) return "free";
  try {
    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[permission] planFromDb error:", error.message);
      return "free";
    }
    if (!data) return "free";

    const stillInWindow = data.status === "active" || (data.status === "canceled" && data.current_period_end && new Date(data.current_period_end) > new Date());
    return stillInWindow ? data.plan || "free" : "free";
  } catch (err) {
    console.error("[permission] planFromDb failed:", err);
    return "free";
  }
}

// The single source of truth every plan-gated page/component should use.
export async function getEffectivePlan() {
  const { userId, has } = await auth();
  const [clerkPlan, dbPlan] = await Promise.all([Promise.resolve(planFromHas(has)), planFromDb(userId)]);
  const effective = (PLAN_LEVELS[dbPlan] ?? 0) > (PLAN_LEVELS[clerkPlan] ?? 0) ? dbPlan : clerkPlan;
  console.log(`[permission] getEffectivePlan: userId=${userId} clerk=${clerkPlan} db=${dbPlan} → effective=${effective}`);
  return effective;
}

export async function isProOrHigher() {
  const result = (await getEffectivePlan()) !== "free";
  console.log(`[permission] isProOrHigher: ${result}`);
  return result;
}

export async function isElite() {
  const result = (await getEffectivePlan()) === "elite";
  console.log(`[permission] isElite: ${result}`);
  return result;
}

export async function isProOnly() {
  const result = (await getEffectivePlan()) === "pro";
  console.log(`[permission] isProOnly: ${result}`);
  return result;
}

export async function getPlanLabel() {
  return getEffectivePlan();
}

export async function hasPlan(userPlan, required) {
  console.log(`[permission] hasPlan: user=${userPlan} required=${required}`);
  return (PLAN_LEVELS[userPlan] ?? 0) >= (PLAN_LEVELS[required] ?? 0);
}