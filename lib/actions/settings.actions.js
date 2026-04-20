// lib/actions/settings.actions.js
"use server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────────────────────
// verifyOwner — site_members first, falls back to sites.user_id for legacy sites
// ─────────────────────────────────────────────────────────────────────────────
async function verifyOwner(supabase, siteId, userId) {
  console.log(`[settings.verifyOwner] siteId=${siteId} userId=${userId}`);

  const { data: memberRow, error: memberError } = await supabase
    .from("site_members")
    .select("role")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) console.error("[settings.verifyOwner] site_members error:", memberError.message);

  if (memberRow) {
    const isOwner = memberRow.role === "owner";
    console.log(`[settings.verifyOwner] found in site_members role=${memberRow.role} isOwner=${isOwner}`);
    return isOwner;
  }

  // Fallback: direct sites.user_id for legacy sites not yet in site_members
  const { data: siteRow, error: siteError } = await supabase
    .from("sites").select("user_id").eq("id", siteId).maybeSingle();

  if (siteError) console.error("[settings.verifyOwner] sites fallback error:", siteError.message);

  const isOwner = siteRow?.user_id === userId;
  console.log(`[settings.verifyOwner] fallback via sites.user_id isOwner=${isOwner}`);

  if (isOwner) {
    // Backfill so future calls hit the fast path
    const { error: backfillErr } = await supabase.from("site_members").insert({
      site_id: siteId, user_id: userId, user_email: "", role: "owner", status: "active",
    });
    if (!backfillErr) console.log("[settings.verifyOwner] ✅ backfilled owner row");
  }

  return isOwner;
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSiteDomain
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSiteDomain(siteId, domain) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };
  if (!domain?.trim()) return { success: false, error: "Domain cannot be empty" };

  const supabase = await createSupabaseClient(); // ✅ await — was missing before

  const isOwner = await verifyOwner(supabase, siteId, userId);
  if (!isOwner) return { success: false, error: "Only site owners can change the domain" };

  const cleanDomain = domain.trim()
    .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "").toLowerCase();

  const { data, error } = await supabase
    .from("sites").update({ domain: cleanDomain }).eq("id", siteId).select().single();

  if (error) { console.error("[settings.updateSiteDomain] error:", error.message); return { success: false, error: error.message }; }

  console.log(`[settings.updateSiteDomain] ✅ siteId=${siteId} newDomain=${cleanDomain}`);
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSiteName
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSiteName(siteId, name) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };
  if (!name?.trim()) return { success: false, error: "Name cannot be empty" };

  const supabase = await createSupabaseClient(); // ✅ await

  const isOwner = await verifyOwner(supabase, siteId, userId);
  if (!isOwner) return { success: false, error: "Only site owners can change the name" };

  const { data, error } = await supabase
    .from("sites").update({ name: name.trim() }).eq("id", siteId).select().single();

  if (error) { console.error("[settings.updateSiteName] error:", error.message); return { success: false, error: error.message }; }

  console.log(`[settings.updateSiteName] ✅ siteId=${siteId}`);
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// regenerateApiKey
// ─────────────────────────────────────────────────────────────────────────────
export async function regenerateApiKey(siteId) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const supabase = await createSupabaseClient(); // ✅ await

  const isOwner = await verifyOwner(supabase, siteId, userId);
  if (!isOwner) return { success: false, error: "Only site owners can regenerate the API key" };

  const newKey = crypto.randomUUID();

  const { data, error } = await supabase
    .from("sites").update({ api_key: newKey }).eq("id", siteId).select().single();

  if (error) { console.error("[settings.regenerateApiKey] error:", error.message); return { success: false, error: error.message }; }

  console.log(`[settings.regenerateApiKey] ✅ siteId=${siteId}`);
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// toggleSiteActive
// ─────────────────────────────────────────────────────────────────────────────
export async function toggleSiteActive(siteId, currentState) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const supabase = await createSupabaseClient(); // ✅ await

  const isOwner = await verifyOwner(supabase, siteId, userId);
  if (!isOwner) return { success: false, error: "Only site owners can toggle tracking" };

  const newState = !currentState;

  const { data, error } = await supabase
    .from("sites").update({ is_active: newState }).eq("id", siteId).select().single();

  if (error) { console.error("[settings.toggleSiteActive] error:", error.message); return { success: false, error: error.message }; }

  console.log(`[settings.toggleSiteActive] ✅ siteId=${siteId} is_active=${newState}`);
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// deactivateSite — soft delete
// ─────────────────────────────────────────────────────────────────────────────
export async function deactivateSite(siteId) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const supabase = await createSupabaseClient(); // ✅ await

  const isOwner = await verifyOwner(supabase, siteId, userId);
  if (!isOwner) return { success: false, error: "Only site owners can deactivate the site" };

  const { error } = await supabase
    .from("sites").update({ is_active: false, deleted_at: new Date().toISOString() }).eq("id", siteId);

  if (error) { console.error("[settings.deactivateSite] error:", error.message); return { success: false, error: error.message }; }

  console.log(`[settings.deactivateSite] ✅ siteId=${siteId}`);
  revalidatePath("/platform/settings");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// getMembers — returns all members for display in settings
// ─────────────────────────────────────────────────────────────────────────────
export async function getMembers(siteId) {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = await createSupabaseClient(); // ✅ await

  console.log(`[settings.getMembers] siteId=${siteId}`);

  const { data, error } = await supabase
    .from("site_members")
    .select("id, user_id, user_email, role, status, invited_by, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });

  if (error) { console.error("[settings.getMembers] error:", error.message); return []; }

  console.log(`[settings.getMembers] ✅ found ${data?.length ?? 0} members`);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// inviteMember — owner invites by email
//
// ✅ CRITICAL FIX: status MUST be 'pending_invite'
// The site_members table defaults status to 'active'.
// Without explicitly setting 'pending_invite', the person is silently added as
// an active member — getUserSite finds them on Path 1 and gives them the site
// immediately, the /platform/invite page finds no pending rows and redirects
// to /platform, and the entire accept/decline flow is completely bypassed.
// ─────────────────────────────────────────────────────────────────────────────
export async function inviteMember(siteId, inviteeEmail) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };
  if (!inviteeEmail?.includes("@")) return { success: false, error: "Invalid email address" };

  const supabase = await createSupabaseClient(); // ✅ await

  const isOwner = await verifyOwner(supabase, siteId, userId);
  if (!isOwner) return { success: false, error: "Only owners can invite members" };

  const email = inviteeEmail.toLowerCase().trim();
  console.log(`[settings.inviteMember] siteId=${siteId} inviting=${email}`);

  // Check existing row for this email on this site
  const { data: existing } = await supabase
    .from("site_members")
    .select("id, status")
    .eq("site_id", siteId)
    .eq("user_email", email)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") {
      return { success: false, error: "This person is already an active member" };
    }
    if (existing.status === "pending_invite") {
      return { success: false, error: "An invite has already been sent to this email" };
    }
    if (existing.status === "declined") {
      // Allow re-inviting someone who previously declined
      const { error: updateErr } = await supabase
        .from("site_members")
        .update({ status: "pending_invite", invited_by: userId })
        .eq("id", existing.id);
      if (updateErr) return { success: false, error: "Failed to re-send invite" };
      console.log(`[settings.inviteMember] ✅ re-invited ${email}`);
      revalidatePath("/platform/settings");
      return { success: true };
    }
  }

  // New invite — status MUST be 'pending_invite' explicitly
  const { error } = await supabase.from("site_members").insert({
    site_id: siteId,
    user_id: `pending:${email}`,
    user_email: email,
    role: "member",
    status: "pending_invite", // ← THE ENTIRE FIX IS THIS ONE LINE
    invited_by: userId,
  });

  if (error) {
    console.error("[settings.inviteMember] insert error:", error.message);
    return { success: false, error: "Failed to invite member" };
  }

  console.log(`[settings.inviteMember] ✅ pending_invite created for ${email}`);
  revalidatePath("/platform/settings");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// removeMember — owner removes a member by row id
//
// ✅ CRITICAL FIX: await createSupabaseClient() was missing
// Without await, supabase is a Promise not a client.
// All queries silently fail, delete never runs, member stays in the table.
// ─────────────────────────────────────────────────────────────────────────────
export async function removeMember(siteId, memberRowId) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  const supabase = await createSupabaseClient(); // ✅ await — THIS was why remove didn't work

  const isOwner = await verifyOwner(supabase, siteId, userId);
  if (!isOwner) return { success: false, error: "Only owners can remove members" };

  // Find the target member first to prevent self-removal
  const { data: targetMember, error: findErr } = await supabase
    .from("site_members")
    .select("user_id, role")
    .eq("id", memberRowId)
    .maybeSingle();

  if (findErr) { console.error("[settings.removeMember] find error:", findErr.message); return { success: false, error: findErr.message }; }
  if (!targetMember) return { success: false, error: "Member not found" };
  if (targetMember.user_id === userId) return { success: false, error: "You cannot remove yourself" };

  console.log(`[settings.removeMember] siteId=${siteId} removing memberRowId=${memberRowId}`);

  const { error } = await supabase
    .from("site_members")
    .delete()
    .eq("id", memberRowId)
    .eq("site_id", siteId); // safety: scoped to this site only

  if (error) {
    console.error("[settings.removeMember] delete error:", error.message);
    return { success: false, error: error.message };
  }

  console.log("[settings.removeMember] ✅ removed successfully");
  revalidatePath("/platform/settings");
  return { success: true };
}