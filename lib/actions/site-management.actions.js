// lib/actions/site-management.actions.js
"use server";
import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

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
      return { site: existingSite, joined: true };
    }

    // ── No access path matched ────────────────────────────────────────────
    console.log(`[createSite] Domain exists, ${userEmail} has no access to ${cleanDomain}`);
    return { site: existingSite, alreadyExists: true };
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