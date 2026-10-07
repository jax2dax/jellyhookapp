// lib/actions/site-management.actions.js
"use server";
import { auth, clerkClient  } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { setPreferredSiteId, clearPreferredSiteId, getPreferredSiteId } from "@/lib/actions/site-cookie";
import { cleanDomainInput, decideCreateSite } from "@/lib/tracking/claims";
import { claimExpiresAt, isClaimExpired } from "@/lib/tracking/verification";
import { can } from "@/lib/tracking/permissions";

// Service role — sites/site_members grant anon/authenticated nothing in
// RLS (see mds/progress_timeline.md). Every function below already does
// its own auth()/ownership check before querying — that's the real
// authorization, unchanged; this just lets it reach tables RLS alone
// can't safely express (pending invites are keyed by `pending:<email>`,
// which has no relationship to a real Clerk user id an RLS policy could
// check, and createSite's duplicate-domain check is intentionally
// cross-tenant by nature).
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
// createSite — adding a domain is a CLAIM, not ownership.
//
// The rules live in lib/tracking/claims.js (pure, tested) and are written up in
// mds/developers/site-claims.md. In short: several people can hold a claim on
// one domain; the first to install the tracker on the real site (events from
// the domain's own host) is verified and owns it; a claim never verified
// expires after 3 days and no longer blocks its owner from adding another.
//
// Returns one of:
//   { invalidDomain: true }                    — not a domain
//   { site, joined: false, alreadyMember }     — already has access to the verified site
//   { site, reclaimed: true, renewed }         — resumed their own unverified claim
//   { site, joined: true }                     — verified site, work-email domain auto-joined
//   { site: { domain }, alreadyExists: true }  — verified by someone else; NEVER includes their key
//   { planLimitReached: true }
//   { site, joined: false, competing: n }      — new claim; n other unexpired claims race for it
// ─────────────────────────────────────────────────────────────────────────────
const SITE_COLUMNS = "id, domain, user_id, api_key, plan, is_active, specify_form, name, monthly_event_limit, created_at, verified, claim_started_at";

/** Soft-deletes this user's own claims that expired unverified, so they start fresh and are not blocked by them. */
async function archiveExpiredAttempts(supabase, userId) {
  const { data: rows } = await supabase
    .from("site_members")
    .select("sites ( id, verified, deleted_at, claim_started_at, created_at )")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active");
  const now = Date.now();
  const expired = (rows || []).map((r) => r.sites).filter((s) => s && !s.deleted_at && isClaimExpired(s, now));
  for (const s of expired) {
    await supabase.from("sites").update({ deleted_at: new Date(now).toISOString(), is_active: false }).eq("id", s.id).eq("verified", false);
  }
  return expired.length;
}

export async function createSite({ name, domain, specify_form = false }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");

  const supabase = supabaseAdmin;
  const userEmail = await getClerkUserEmail();

  const cleanDomain = cleanDomainInput(domain);
  if (!cleanDomain) return { invalidDomain: true };

  // ── Everything registered for this domain ────────────────────────────────
  const { data: domainSites } = await supabase.from("sites").select(SITE_COLUMNS).ilike("domain", cleanDomain).eq("is_active", true).is("deleted_at", null);
  const ids = (domainSites || []).map((s) => s.id);

  let memberOf = new Set();
  let hasPendingInvite = false;
  if (ids.length > 0) {
    const { data: memberRows } = await supabase.from("site_members").select("site_id, user_id, status").in("site_id", ids).eq("user_id", userId).eq("status", "active");
    memberOf = new Set((memberRows || []).map((m) => m.site_id));
    if (userEmail) {
      const { data: invites } = await supabase.from("site_members").select("site_id").in("site_id", ids).eq("user_id", `pending:${userEmail.toLowerCase()}`).eq("status", "pending_invite");
      hasPendingInvite = (invites || []).length > 0;
    }
    // Legacy: sites created before site_members existed.
    for (const s of domainSites || []) {
      if (s.user_id === userId && !memberOf.has(s.id)) {
        memberOf.add(s.id);
        await supabase.from("site_members").insert({ site_id: s.id, user_id: userId, user_email: userEmail, role: "owner", status: "active" });
      }
    }
  }

  const decision = decideCreateSite({
    userEmail,
    hasPendingInvite,
    sites: (domainSites || []).map((s) => ({ ...s, mine: memberOf.has(s.id) })),
  });
  console.log(`[createSite] userId=${userId} domain=${cleanDomain} decision=${decision.kind}`);

  if (decision.kind === "already_member") return { site: decision.site, joined: false, alreadyMember: true };

  if (decision.kind === "resume") {
    let site = decision.site;
    if (decision.renew) {
      const { data: renewed } = await supabase.from("sites").update({ claim_started_at: new Date().toISOString() }).eq("id", site.id).select(SITE_COLUMNS).single();
      if (renewed) site = renewed;
    }
    await setPreferredSiteId(site.id);
    return { site, reclaimed: true, renewed: decision.renew };
  }

  if (decision.kind === "pending_invite") redirect(`/platform/invite`);

  if (decision.kind === "auto_join") {
    const { error: autoJoinError } = await supabase.from("site_members").insert({
      site_id: decision.site.id,
      user_id: userId,
      user_email: userEmail,
      role: "member",
      status: "active",
      invited_by: null,
    });
    if (autoJoinError) console.error("[createSite] Auto-join error:", autoJoinError.message);
    await setPreferredSiteId(decision.site.id);
    return { site: decision.site, joined: true };
  }

  // The caller must never learn another account's API key, only that the domain is taken.
  if (decision.kind === "taken") return { site: { domain: decision.site.domain }, alreadyExists: true };

  // ── decision.kind === "create" ───────────────────────────────────────────
  // Start fresh: this person's own claims that expired unverified no longer count.
  await archiveExpiredAttempts(supabase, userId);

  // Elite plan gate — non-elite USERS can only have 1 site. Checks the person's
  // own Clerk subscription, never the site's plan: a user should not have to
  // upgrade a specific site to add another one. Two methods for reliability:
  // has({ plan: "elite" }) from the JWT (fast), and the Clerk backend API
  // (always accurate, catches a stale JWT right after an upgrade).
  let userIsElite = false;
  try {
    const { has } = await auth();
    userIsElite = has({ plan: "elite" });
  } catch (planCheckErr) {
    console.warn("[createSite] has() plan check failed:", planCheckErr?.message);
  }
  if (!userIsElite) {
    try {
      const clerk = await clerkClient();
      const subscription = await clerk.billing.getUserBillingSubscription(userId);
      const items = subscription?.subscriptionItems ?? subscription?.items ?? [];
      userIsElite = items.some((item) => item?.plan?.slug === "elite" && (item?.status === "active" || item?.status === "trialing"));
    } catch (billingErr) {
      console.warn("[createSite] billing API error:", billingErr?.message);
    }
  }

  if (!userIsElite) {
    // Get all active memberships, then filter deleted_at in JS (join-column filtering is unreliable).
    const { data: existingMemberships, error: memberCountErr } = await supabase.from("site_members").select("id, sites ( id, deleted_at )").eq("user_id", userId).eq("status", "active");
    if (memberCountErr) console.error("[createSite] existingMemberships count error:", memberCountErr.message);
    const existingCount = (existingMemberships || []).filter((m) => m.sites && m.sites.deleted_at === null).length;
    if (existingCount >= 1) return { planLimitReached: true };
  }

  const { data: newSite, error: createError } = await supabase
    .from("sites")
    .insert({
      name: name?.trim() || cleanDomain,
      domain: cleanDomain,
      api_key: crypto.randomUUID(),
      user_id: userId,
      plan: "free",
      monthly_event_limit: 10000,
      specify_form: specify_form ?? false,
      is_active: true,
      verified: false, // verified only when the tracker reports from the domain's own host
      claim_started_at: new Date().toISOString(),
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
  if (memberInsertError) console.error("[createSite] Owner member insert error:", memberInsertError.message);

  await setPreferredSiteId(newSite.id);
  return { site: newSite, joined: false, competing: decision.competing };
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserSite
// Path 1: site_members with status=active
// Path 2: pending invite — redirect to /platform/invite (NOT auto-resolve)
// Path 3: legacy sites.user_id fallback with backfill
// ─────────────────────────────────────────────────────────────────────────────
export async function getUserSite(userId) {
  console.log(`[getUserSite] userId=${userId}`);
  const supabase = supabaseAdmin;

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
  const supabase = supabaseAdmin;
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

  const supabase = supabaseAdmin;
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

  const accepted = { user_id: userId, user_email: userEmail, status: "active" };
  // joined_at = the real moment they joined. created_at on this row is when
  // the invite was SENT (this update keeps the same row), which is what the
  // main chart's "team joined" lines would otherwise show.
  let { error: updateError } = await supabase
    .from("site_members")
    .update({ ...accepted, joined_at: new Date().toISOString() })
    .eq("id", pendingRow.id);
  if (updateError && (updateError.code === "PGRST204" || updateError.code === "42703" || /joined_at/.test(updateError.message))) {
    // joined_at column not added yet (SQL in mds/database.md). Accepting an
    // invite must never fail over it: accept without it.
    ({ error: updateError } = await supabase.from("site_members").update(accepted).eq("id", pendingRow.id));
  }

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

  const supabase = supabaseAdmin;
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

  const supabase = supabaseAdmin;
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

  const supabase = supabaseAdmin;

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

  const supabase = supabaseAdmin;

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

  const supabase = supabaseAdmin;

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

// getSiteVerificationStatus — polled by the "waiting for the first tracker hit"
// screen. Only an active member of the site may ask. Reports whether the
// tracker has proven the domain, how long the claim has left, and — the case
// that catches "pasted the script on the wrong website" — the last host that
// sent data this site would not accept.
export async function getSiteVerificationStatus(siteId) {
  const { userId } = await auth();
  if (!userId || !siteId) return null;
  const supabase = supabaseAdmin;

  const { data: member } = await supabase.from("site_members").select("id").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!member) return null;

  const { data: site } = await supabase
    .from("sites")
    .select("verified, claim_started_at, created_at, last_event_at, last_unmatched_host, last_unmatched_at, unmatched_count, domain")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) return null;
  return {
    verified: site.verified === true,
    expired: isClaimExpired(site),
    expiresAt: new Date(claimExpiresAt(site)).toISOString(),
    domain: site.domain,
    unmatchedHost: site.last_unmatched_host || null,
    unmatchedCount: site.unmatched_count || 0,
  };
}

// renewClaim — restarts the 3-day clock on an unverified claim (owner/admin).
export async function renewClaim(siteId) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not authenticated" };
  const supabase = supabaseAdmin;
  const { data: member } = await supabase.from("site_members").select("role").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!member || !can(member.role, "site.change_domain")) return { success: false, error: "Only the owner or an admin can renew this" };

  const { data, error } = await supabase.from("sites").update({ claim_started_at: new Date().toISOString() }).eq("id", siteId).eq("verified", false).select("claim_started_at").maybeSingle();
  if (error || !data) return { success: false, error: "Nothing to renew" };
  return { success: true, claimStartedAt: data.claim_started_at };
}
/**network page */
// ─────────────────────────────────────────────────────────────────────────────
// getMyPendingInvites — all pending invites TO the current user (any site)
// Used by /network to show a banner if they haven't accepted yet
// ─────────────────────────────────────────────────────────────────────────────
export async function getMyPendingInvites() {
  const { userId } = await auth();
  if (!userId) return [];

  const userEmail = await getClerkUserEmail();
  if (!userEmail) return [];

  const supabase = supabaseAdmin;
  const pendingKey = `pending:${userEmail.toLowerCase()}`;

  const { data, error } = await supabase
    .from("site_members")
    .select(`
      id, site_id, role, created_at,
      sites ( id, domain, name )
    `)
    .eq("user_id", pendingKey)
    .eq("status", "pending_invite");

  if (error) {
    console.error("[getMyPendingInvites] error:", error.message);
    return [];
  }
  return data || [];
}