// lib/actions/site-management.actions.js
"use server";
import { auth, clerkClient  } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { setPreferredSiteId, clearPreferredSiteId, getPreferredSiteId } from "@/lib/actions/site-cookie";
// ─────────────────────────────────────────────────────────────────────────────
// HELPER — get Clerk user email
// NEVER use supabase.auth.getUser() — throws when accessToken option is set
// ─────────────────────────────────────────────────────────────────────────────
async function getClerkUserEmail() {
  const user = await currentUser();
  if (!user) return "";
  const primary = user.emailAddresses?.find(
    (e) => e.id === user.primaryEmailAddressId
  );
  return primary?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// createSite
//
// Returns one of:
//   { site, joined: false }          — new site created, user is owner
//   { site, joined: true }           — existing site, email domain auto-joined
//   { site, alreadyMember: true }    — user is already owner/member
//   { site, reclaimed: true }        — user owns an unverified site (never installed script)
//   { site, alreadyExists: true }    — domain taken, email doesn't match
// ─────────────────────────────────────────────────────────────────────────────
export async function createSite({ name, domain, specify_form = false }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const supabase = await createSupabaseClient();
  const userEmail = await getClerkUserEmail();

  const cleanDomain = domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase()
    .trim();

  console.log(`[createSite] userId=${userId} email=${userEmail} domain=${cleanDomain}`);

  // ── Check if domain already registered ───────────────────────────────────
  const { data: existingSite } = await supabase
    .from("sites")
    .select("id, domain, user_id, api_key, plan, is_active, specify_form, name, monthly_event_limit, created_at, verified")
    .ilike("domain", cleanDomain)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (existingSite) {

    // ── Already a member or owner in site_members ─────────────────────────
    const { data: existingMember } = await supabase
      .from("site_members")
      .select("id, role")
      .eq("site_id", existingSite.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existingMember) {
      console.log(`[createSite] userId=${userId} already member of siteId=${existingSite.id} role=${existingMember.role}`);
      return { site: existingSite, joined: false, alreadyMember: true };
    }

    // ── Legacy owner check — site registered before site_members existed ──
    if (existingSite.user_id === userId) {
      // Same person who originally created it — they're the owner
      // Backfill site_members while we're here
      const { error: backfillErr } = await supabase.from("site_members").insert({
        site_id: existingSite.id,
        user_id: userId,
        user_email: userEmail,
        role: "owner",
        status: "active",
      });
      if (backfillErr && !backfillErr.message.includes("duplicate") && !backfillErr.message.includes("unique")) {
        console.warn("[createSite] Legacy owner backfill error:", backfillErr.message);
      }

      // ── Issue 3: unverified site reclaim ──────────────────────────────
      // If the script was never installed (verified=false), return their existing
      // site+key with the reclaimed flag so UI shows the script again
      if (!existingSite.verified) {
        console.log(`[createSite] Unverified site reclaimed by original owner — siteId=${existingSite.id}`);
        return { site: existingSite, reclaimed: true };
      }

      // Verified + same owner → already member
      return { site: existingSite, joined: false, alreadyMember: true };
    }

    // ── Pending invite exists for this email ──────────────────────────────
    if (userEmail) {
      const { data: pendingInvite } = await supabase
        .from("site_members")
        .select("id, role")
        .eq("site_id", existingSite.id)
        .eq("user_id", `pending:${userEmail.toLowerCase()}`)
        .eq("status", "pending_invite")
        .maybeSingle();

      if (pendingInvite) {
        // ✅ Issue 1: DO NOT auto-resolve here
        // Redirect to the invite acceptance page instead
        // permission.actions.js getUserSite also checks this and redirects
        console.log(`[createSite] Pending invite found for ${userEmail} — redirecting to invite page`);
        redirect(`/platform/invite`);
      }
    }

    // ── Email domain auto-join (business emails only) ─────────────────────
    const userEmailDomain = userEmail.split("@")[1]?.toLowerCase() || "";
    const siteBaseDomain = cleanDomain.split(".").slice(-2).join(".");
    const FREE_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
    const isPersonalEmail = FREE_EMAIL_DOMAINS.includes(userEmailDomain);

    const emailMatchesDomain =
      !isPersonalEmail &&
      userEmailDomain.length > 0 &&
      (
        userEmailDomain === cleanDomain ||
        userEmailDomain === siteBaseDomain ||
        cleanDomain.endsWith("." + userEmailDomain) ||
        cleanDomain === userEmailDomain
      );

    if (emailMatchesDomain) {
      const { error: autoJoinError } = await supabase.from("site_members").insert({
        site_id: existingSite.id,
        user_id: userId,
        user_email: userEmail,
        role: "member",
        status: "active",
        invited_by: null,
      });
      if (autoJoinError) {
        console.error("[createSite] Auto-join error:", autoJoinError.message);
      } else {
       console.log(`[createSite] ✅ Auto-joined ${userEmail} to siteId=${existingSite.id}`);
      }
      await setPreferredSiteId(existingSite.id);
      return { site: existingSite, joined: true };
    }

    // ── No access path matched ────────────────────────────────────────────
    console.log(`[createSite] Domain exists, ${userEmail} has no access to ${cleanDomain}`);
    return { site: existingSite, alreadyExists: true };
  }
  ///---Check if user is elite for him to add another site ""
  // ── Elite plan gate — non-elite users can only have 1 site ───────────────
  // Check if user already owns or is a member of any non-deleted site
  // ── Plan gate — only exclusive subscribers can have multiple sites ─────────
  // We use TWO methods for reliability:
  // 1. has({ plan: "user:exclusive" }) — reads from JWT session claims (fast)
  // 2. clerkClient().billing.getUserBillingSubscription — reads directly from
  //    Clerk backend API (always accurate, catches stale JWT edge cases)
  //
  // If EITHER confirms exclusive → allow multiple sites.
  // This means a user who just upgraded won't get blocked by a stale JWT.
  // ─────────────────────────────────────────────────────────────────────────
let userIsExclusive = false;

  try {
    const { has } = await auth();
    userIsExclusive = has({ plan: "user:exclusive" });
    console.log(`[createSite] has({ plan: "user:exclusive" }) = ${userIsExclusive}`);
  } catch (planCheckErr) {
    console.warn("[createSite] has() plan check failed:", planCheckErr?.message);
  }

  if (!userIsExclusive) {
    try {
      const clerk = await clerkClient();
      const subscription = await clerk.billing.getUserBillingSubscription(userId);
      console.log("[createSite] RAW subscription:", JSON.stringify(subscription, null, 2));
      const items = subscription?.subscriptionItems ?? subscription?.items ?? [];
      console.log("[createSite] subscription items:", JSON.stringify(items, null, 2));
      userIsExclusive = items.some(
        (item) =>
          item?.plan?.slug === "exclusive" &&
          (item?.status === "active" || item?.status === "trialing")
      );
      console.log(`[createSite] after billing check userIsExclusive=${userIsExclusive}`);
    } catch (billingErr) {
      console.log("[createSite] billing API error:", billingErr?.message, billingErr);
      userIsExclusive = false;
    }
  }

  console.log(`[createSite] FINAL userIsExclusive=${userIsExclusive}`);

  if (!userIsExclusive) {
    // ── Fixed query: don't filter on joined table column ──────────────────
    // Get all active memberships, then filter deleted_at in JS
    const { data: existingMemberships, error: memberCountErr } = await supabase
      .from("site_members")
      .select(`
        id,
        sites (
          id,
          deleted_at
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active");

    if (memberCountErr) {
      console.error("[createSite] existingMemberships count error:", memberCountErr.message);
    }

    console.log("[createSite] RAW existingMemberships:", JSON.stringify(existingMemberships, null, 2));

    // Filter in JS — Supabase join column filtering is unreliable
    const existingCount = (existingMemberships || []).filter(
      (m) => m.sites && m.sites.deleted_at === null
    ).length;

    console.log(`[createSite] existingCount after JS filter=${existingCount}`);

    if (existingCount >= 1) {
      console.log(`[createSite] plan limit reached for userId=${userId}`);
      return { planLimitReached: true };
    }
  }
  // ── Fresh domain — create new site ───────────────────────────────────────
  const api_key = crypto.randomUUID();

  const { data: newSite, error: createError } = await supabase
    .from("sites")
    .insert({
      name: name || cleanDomain,
      domain: cleanDomain,
      api_key,
      user_id: userId,
      plan: "free",
      monthly_event_limit: 10000,
      specify_form: specify_form ?? false,
      is_active: true,
      verified: false, // ← Issue 3: not verified until tracker sends first hit
    })
    .select()
    .single();

  if (createError) {
    console.error("[createSite] Insert error:", createError.message);
    throw createError;
  }

  const { error: memberInsertError } = await supabase.from("site_members").insert({
    site_id: newSite.id,
    user_id: userId,
    user_email: userEmail,
    role: "owner",
    status: "active",
    invited_by: null,
  });
  if (memberInsertError) {
    console.error("[createSite] Owner member insert error:", memberInsertError.message);
  } else {
    console.log("[createSite] ✅ Owner row inserted into site_members");
  }

  console.log(`[createSite] ✅ Created siteId=${newSite.id} domain=${cleanDomain} verified=false`);
  
  // Set cookie so new site is immediately the selected site
  await setPreferredSiteId(newSite.id);
  
  return { site: newSite, joined: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserSite
// Path 1: site_members with status=active
// Path 2: pending invite — redirect to /platform/invite (NOT auto-resolve)
// Path 3: legacy sites.user_id fallback with backfill
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserSite(userId) {
  console.log(`[getUserSite] userId=${userId}`);
  const supabase = await createSupabaseClient();

  // ── Path 1: active membership ─────────────────────────────────────────────
  const { data: membership, error: memberError } = await supabase
    .from("site_members")
    .select(`
      role, status,
      sites (
        id, plan, domain, api_key, is_active, monthly_event_limit,
        created_at, specify_form, name, user_id, verified
      )
    `)
    .eq("user_id", userId)
    .eq("status", "active") // ← only active memberships
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memberError) console.error("[getUserSite] Member lookup error:", memberError.message);

  if (membership?.sites && membership.sites.is_active) {
    console.log(`[getUserSite] ✅ Found via site_members: siteId=${membership.sites.id} role=${membership.role}`);
    return membership.sites;
  }

  // ── Path 2: pending invite — DO NOT auto-resolve, let invite page handle it
  const userEmail = await getClerkUserEmail();
  if (userEmail) {
    const { data: pendingInvite } = await supabase
      .from("site_members")
      .select("id")
      .eq("user_id", `pending:${userEmail.toLowerCase()}`)
      .eq("status", "pending_invite")
      .limit(1)
      .maybeSingle();

    if (pendingInvite) {
      console.log(`[getUserSite] Pending invite found for ${userEmail} — will redirect to /platform/invite`);
      // Return a special signal — the caller (requireSite or page) will redirect
      // We don't redirect here because getUserSite is also called from non-page contexts
      return { __pendingInvite: true };
    }
  }

  // ── Path 3: legacy sites.user_id (backfill) ───────────────────────────────
  const { data: legacySite, error: legacyError } = await supabase
    .from("sites")
    .select("id, plan, domain, api_key, is_active, monthly_event_limit, created_at, specify_form, name, user_id, verified")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacyError) {
    console.error("[getUserSite] Legacy fallback error:", legacyError.message);
    return null;
  }

  if (legacySite) {
    console.log(`[getUserSite] Found via legacy sites.user_id siteId=${legacySite.id} — backfilling`);
    const { error: backfillError } = await supabase.from("site_members").insert({
      site_id: legacySite.id,
      user_id: userId,
      user_email: userEmail || "",
      role: "owner",
      status: "active",
    });
    if (backfillError && !backfillError.message.includes("duplicate") && !backfillError.message.includes("unique")) {
      console.warn("[getUserSite] Backfill error:", backfillError.message);
    } else if (!backfillError) {
      console.log("[getUserSite] ✅ Backfilled owner row");
    }
    return legacySite;
  }

  console.log(`[getUserSite] No site found for userId=${userId}`);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// requireSite — redirects to invite page if pending, create-site if none
// ─────────────────────────────────────────────────────────────────────────────
export async function requireSite(userId) {
  const site = await getUserSite(userId);
  if (!site) {
    redirect("/platform/create-site");
  }
  if (site.__pendingInvite) {
    redirect("/platform/invite");
  }
  return site;
}

// ─────────────────────────────────────────────────────────────────────────────
// getSiteMembers
// ─────────────────────────────────────────────────────────────────────────────
export async function getSiteMembers(siteId) {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("site_members")
    .select("id, user_id, user_email, role, status, invited_by, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getSiteMembers] Error:", error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// acceptInvite — called from /platform/invite page when user clicks Accept
// Resolves pending:{email} row to real userId, sets status=active
// ─────────────────────────────────────────────────────────────────────────────
export async function acceptInvite() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const supabase = await createSupabaseClient();
  const userEmail = await getClerkUserEmail();
  if (!userEmail) throw new Error("Could not determine your email");

  const pendingKey = `pending:${userEmail.toLowerCase()}`;
  console.log(`[acceptInvite] userId=${userId} resolving ${pendingKey}`);

  const { data: pendingRow } = await supabase
    .from("site_members")
    .select("id, site_id, role")
    .eq("user_id", pendingKey)
    .eq("status", "pending_invite")
    .maybeSingle();

  if (!pendingRow) {
    return { success: false, error: "No pending invite found for your email" };
  }

  const { error: updateError } = await supabase
    .from("site_members")
    .update({
      user_id: userId,
      user_email: userEmail,
      status: "active",
    })
    .eq("id", pendingRow.id);

  if (updateError) {
    console.error("[acceptInvite] Update error:", updateError.message);
    return { success: false, error: updateError.message };
  }

  // Set cookie so the accepted site is immediately the selected site
  await setPreferredSiteId(pendingRow.site_id);
  console.log(`[acceptInvite] ✅ Accepted — userId=${userId} now active member of siteId=${pendingRow.site_id}`);
  return { success: true, siteId: pendingRow.site_id };
}

// ─────────────────────────────────────────────────────────────────────────────
// declineInvite — called from /platform/invite page when user clicks Decline
// Sets status=declined — does NOT delete so owner can see it was declined
// ─────────────────────────────────────────────────────────────────────────────
export async function declineInvite() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const supabase = await createSupabaseClient();
  const userEmail = await getClerkUserEmail();
  if (!userEmail) throw new Error("Could not determine your email");

  const pendingKey = `pending:${userEmail.toLowerCase()}`;
  console.log(`[declineInvite] userId=${userId} declining ${pendingKey}`);

  const { error: updateError } = await supabase
    .from("site_members")
    .update({ status: "declined" })
    .eq("user_id", pendingKey)
    .eq("status", "pending_invite");

  if (updateError) {
    console.error("[declineInvite] Update error:", updateError.message);
    return { success: false, error: updateError.message };
  }

  console.log(`[declineInvite] ✅ Declined invite for ${userEmail}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// getPendingInviteDetails — called from /platform/invite page to show who invited you
// ─────────────────────────────────────────────────────────────────────────────
export async function getPendingInviteDetails() {
  const { userId } = await auth();
  if (!userId) return null;

  const supabase = await createSupabaseClient();
  const userEmail = await getClerkUserEmail();
  if (!userEmail) return null;

  const pendingKey = `pending:${userEmail.toLowerCase()}`;

  const { data, error } = await supabase
    .from("site_members")
    .select(`
      id, role, invited_by, created_at,
      sites (
        id, domain, name
      )
    `)
    .eq("user_id", pendingKey)
    .eq("status", "pending_invite")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getPendingInviteDetails] Error:", error.message);
    return null;
  }

  if (!data) return null;

  // Get inviter's email from site_members (they'll have a real user_id)
  let inviterEmail = null;
  if (data.invited_by) {
    const { data: inviterRow } = await supabase
      .from("site_members")
      .select("user_email")
      .eq("user_id", data.invited_by)
      .maybeSingle();
    inviterEmail = inviterRow?.user_email || null;
  }

  return {
    memberRowId: data.id,
    role: data.role,
    inviterEmail,
    siteDomain: data.sites?.domain,
    siteName: data.sites?.name,
    invitedAt: data.created_at,
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// cancelVerification (soft delete)
// Called from create-site pending state when user cancels.
// Sets deleted_at on the site, clears the cookie.
// Only the owner of the site (user_id match) can cancel their own unverified site.
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelVerification(siteId) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = await createSupabaseClient();

  // Only allow if user is owner AND site is unverified
  const { data: site, error: fetchError } = await supabase
    .from("sites")
    .select("id, user_id, verified, deleted_at")
    .eq("id", siteId)
    .maybeSingle();

  if (fetchError || !site) {
    console.error("[cancelVerification] fetch error:", fetchError?.message);
    return { success: false, error: "Site not found" };
  }

  if (site.user_id !== userId) {
    return { success: false, error: "Only the site owner can cancel verification" };
  }

  if (site.verified) {
    return { success: false, error: "Cannot cancel a verified site this way" };
  }

  if (site.deleted_at) {
    return { success: false, error: "Site already deleted" };
  }

  const { error: deleteError } = await supabase
    .from("sites")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", siteId);

  if (deleteError) {
    console.error("[cancelVerification] delete error:", deleteError.message);
    return { success: false, error: deleteError.message };
  }

  // Clear cookie — user has no site now (or needs to pick another)
  await clearPreferredSiteId();

  console.log(`[cancelVerification] ✅ siteId=${siteId} soft-deleted by userId=${userId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// switchSite
// Called from the site switcher UI in settings.
// Validates user has access to the target site, then writes the cookie.
// ─────────────────────────────────────────────────────────────────────────────
export async function switchSite(siteId) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = await createSupabaseClient();

  // Verify user is an active member of this site and it's not deleted
  const { data: membership, error: memberError } = await supabase
    .from("site_members")
    .select("id, sites!inner(id, deleted_at, is_active)")
    .eq("user_id", userId)
    .eq("site_id", siteId)
    .eq("status", "active")
    .maybeSingle();

  if (memberError) {
    console.error("[switchSite] memberError:", memberError.message);
    return { success: false, error: memberError.message };
  }

  if (!membership || membership.sites?.deleted_at !== null) {
    return { success: false, error: "You do not have access to this site or it has been deleted" };
  }

  await setPreferredSiteId(siteId);
  console.log(`[switchSite] ✅ userId=${userId} switched to siteId=${siteId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// softDeleteSite
// Owner-only. Sets deleted_at, clears cookie if it was pointing to this site.
// ─────────────────────────────────────────────────────────────────────────────
export async function softDeleteSite(siteId) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };

  const supabase = await createSupabaseClient();

  // Verify owner
  const { data: memberRow } = await supabase
    .from("site_members")
    .select("role")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  // Fallback legacy check
  if (!memberRow) {
    const { data: siteRow } = await supabase
      .from("sites")
      .select("user_id")
      .eq("id", siteId)
      .maybeSingle();
    if (siteRow?.user_id !== userId) {
      return { success: false, error: "Only site owners can delete a site" };
    }
  } else if (memberRow.role !== "owner") {
    return { success: false, error: "Only site owners can delete a site" };
  }

  const { error: deleteError } = await supabase
    .from("sites")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", siteId);

  if (deleteError) {
    console.error("[softDeleteSite] error:", deleteError.message);
    return { success: false, error: deleteError.message };
  }

  // If cookie was pointing to this site, clear it
  const currentCookie = await getPreferredSiteId();
  if (currentCookie === siteId) {
    await clearPreferredSiteId();
  }

  console.log(`[softDeleteSite] ✅ siteId=${siteId} soft-deleted`);
  return { success: true };
}