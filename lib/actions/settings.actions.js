// lib/actions/settings.actions.js
"use server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { clearPreferredSiteId, getPreferredSiteId } from "@/lib/actions/site-cookie";
import { can, canManageMember, assignableRoles } from "@/lib/tracking/permissions";
import { validateAllowedHost } from "@/lib/tracking/hosts";
import { cleanDomainInput } from "@/lib/tracking/claims";
import { KEY_GRACE_MS, rotationStatus } from "@/lib/tracking/keys";
import { CLAIM_TTL_MS, claimExpiresAt, isClaimExpired } from "@/lib/tracking/verification";
import { summarizeHealth } from "@/lib/tracking/health";

// Service role — sites/site_members grant anon/authenticated nothing in
// RLS (see mds/progress_timeline.md). authorize() below is the real
// authorization for every function in this file; this just lets that
// check's query, and the writes it allows, actually execute.
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MAX_ALLOWED_HOSTS = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Roles and permissions.
//
// The table of who may do what is ONE place: lib/tracking/permissions.js
// (owner / admin / member). Every action below asks it, so a new role or a
// custom per-role permission is added there and nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

/** The caller's role on a site: their active membership, else the legacy owner column (which gets backfilled). */
async function roleOf(supabase, siteId, userId) {
  const { data: memberRow, error } = await supabase
    .from("site_members")
    .select("role")
    .eq("site_id", siteId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (error) console.error("[settings.roleOf] site_members error:", error.message);
  if (memberRow) return memberRow.role;

  // Legacy sites created before site_members existed.
  const { data: siteRow } = await supabase.from("sites").select("user_id").eq("id", siteId).maybeSingle();
  if (siteRow?.user_id === userId) {
    await supabase.from("site_members").insert({ site_id: siteId, user_id: userId, user_email: "", role: "owner", status: "active" });
    return "owner";
  }
  return null;
}

/** Signed in, and allowed to do `permission` on this site. */
async function authorize(siteId, permission) {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized" };
  const supabase = supabaseAdmin;
  const role = await roleOf(supabase, siteId, userId);
  if (!role) return { ok: false, error: "You do not have access to this site" };
  if (!can(role, permission)) return { ok: false, error: "Your role does not allow this. Ask the site owner." };
  return { ok: true, userId, role, supabase };
}

/** The caller's role on a site, for the UI to decide what to show. null when they have none. */
export async function getMySiteRole(siteId) {
  const { userId } = await auth();
  if (!userId || !siteId) return null;
  return roleOf(supabaseAdmin, siteId, userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSiteDomain
//
// A site's domain is what its tracker must report from (host matching). So a
// changed domain has to be PROVEN again: verified goes back to false and a
// fresh 3-day claim starts. Until the tracker reports from the new domain its
// events are not recorded.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSiteDomain(siteId, domain) {
  const a = await authorize(siteId, "site.change_domain");
  if (!a.ok) return { success: false, error: a.error };

  const cleanDomain = cleanDomainInput(domain);
  if (!cleanDomain) return { success: false, error: "Enter a domain like example.com. For local testing use Allowed hosts instead." };

  const { data: current } = await a.supabase.from("sites").select("domain").eq("id", siteId).maybeSingle();
  if (current && current.domain?.toLowerCase() === cleanDomain) {
    const { data } = await a.supabase.from("sites").select("*").eq("id", siteId).single();
    return { success: true, data };
  }

  const { data, error } = await a.supabase
    .from("sites")
    .update({ domain: cleanDomain, verified: false, claim_started_at: new Date().toISOString(), last_unmatched_host: null, last_unmatched_at: null, unmatched_count: 0 })
    .eq("id", siteId)
    .select()
    .single();

  if (error) {
    console.error("[settings.updateSiteDomain] error:", error.message);
    return { success: false, error: "Could not change the domain" };
  }
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// updateSiteName
// ─────────────────────────────────────────────────────────────────────────────
export async function updateSiteName(siteId, name) {
  if (!name?.trim()) return { success: false, error: "Name cannot be empty" };
  const a = await authorize(siteId, "site.rename");
  if (!a.ok) return { success: false, error: a.error };

  const { data, error } = await a.supabase.from("sites").update({ name: name.trim().slice(0, 120) }).eq("id", siteId).select().single();
  if (error) {
    console.error("[settings.updateSiteName] error:", error.message);
    return { success: false, error: "Could not rename the site" };
  }
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// regenerateApiKey
//
// The old key keeps working for 72 hours (KEY_GRACE_MS), so a live site does
// not lose data between "regenerate" and "redeploy". It stops sooner if the
// new key is seen first (lib/tracking/keys.js: retired 10 minutes after the
// first hit with the new key). Regenerating again while a rotation is still
// running replaces the old key: only the key being retired stays valid.
// ─────────────────────────────────────────────────────────────────────────────
export async function regenerateApiKey(siteId) {
  const a = await authorize(siteId, "site.regenerate_key");
  if (!a.ok) return { success: false, error: a.error };

  const { data: site } = await a.supabase.from("sites").select("api_key").eq("id", siteId).maybeSingle();
  if (!site?.api_key) return { success: false, error: "Site not found" };

  const now = Date.now();
  const { data, error } = await a.supabase
    .from("sites")
    .update({
      api_key: crypto.randomUUID(),
      previous_api_key: site.api_key,
      previous_key_expires_at: new Date(now + KEY_GRACE_MS).toISOString(),
      key_rotated_at: new Date(now).toISOString(),
      new_key_first_hit_at: null,
    })
    .eq("id", siteId)
    .eq("api_key", site.api_key) // lost the race with another regenerate: do nothing rather than overwrite
    .select()
    .single();

  if (error) {
    console.error("[settings.regenerateApiKey] error:", error.message);
    return { success: false, error: "Could not regenerate the key. Try again." };
  }
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// toggleSiteActive
// ─────────────────────────────────────────────────────────────────────────────
export async function toggleSiteActive(siteId, currentState) {
  const a = await authorize(siteId, "site.toggle_tracking");
  if (!a.ok) return { success: false, error: a.error };

  const { data, error } = await a.supabase.from("sites").update({ is_active: !currentState }).eq("id", siteId).select().single();
  if (error) {
    console.error("[settings.toggleSiteActive] error:", error.message);
    return { success: false, error: "Could not change tracking" };
  }
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// deactivateSite — soft delete (owner only)
// ─────────────────────────────────────────────────────────────────────────────
export async function deactivateSite(siteId) {
  const a = await authorize(siteId, "site.delete");
  if (!a.ok) return { success: false, error: a.error };

  const { error } = await a.supabase.from("sites").update({ is_active: false, deleted_at: new Date().toISOString() }).eq("id", siteId);
  if (error) {
    console.error("[settings.deactivateSite] error:", error.message);
    return { success: false, error: "Could not deactivate the site" };
  }
  revalidatePath("/platform/settings");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Allowed hosts — extra websites (a staging site, localhost while testing, a
// separate checkout domain) whose tracker events are accepted for this site
// besides its own domain. Without this, events from any other host are
// dropped and only counted (see lib/tracking/verification.js).
// ─────────────────────────────────────────────────────────────────────────────
export async function addAllowedHost(siteId, host) {
  const a = await authorize(siteId, "site.manage_hosts");
  if (!a.ok) return { success: false, error: a.error };

  const clean = validateAllowedHost(host);
  if (!clean) return { success: false, error: "Enter a host like staging.example.com or localhost" };

  const { data: site } = await a.supabase.from("sites").select("allowed_hosts, last_unmatched_host").eq("id", siteId).maybeSingle();
  const current = Array.isArray(site?.allowed_hosts) ? site.allowed_hosts : [];
  if (current.includes(clean)) return { success: true, data: { allowed_hosts: current } };
  if (current.length >= MAX_ALLOWED_HOSTS) return { success: false, error: `At most ${MAX_ALLOWED_HOSTS} allowed hosts` };

  const patch = { allowed_hosts: [...current, clean] };
  // Allowing the host we had been counting as "unmatched" resolves that notice.
  if (site?.last_unmatched_host === clean) Object.assign(patch, { last_unmatched_host: null, last_unmatched_at: null, unmatched_count: 0 });

  const { data, error } = await a.supabase.from("sites").update(patch).eq("id", siteId).select("allowed_hosts").single();
  if (error) {
    console.error("[settings.addAllowedHost] error:", error.message);
    return { success: false, error: "Could not add the host" };
  }
  revalidatePath("/platform/settings");
  return { success: true, data };
}

export async function removeAllowedHost(siteId, host) {
  const a = await authorize(siteId, "site.manage_hosts");
  if (!a.ok) return { success: false, error: a.error };

  const { data: site } = await a.supabase.from("sites").select("allowed_hosts").eq("id", siteId).maybeSingle();
  const current = Array.isArray(site?.allowed_hosts) ? site.allowed_hosts : [];
  const { data, error } = await a.supabase.from("sites").update({ allowed_hosts: current.filter((h) => h !== host) }).eq("id", siteId).select("allowed_hosts").single();
  if (error) {
    console.error("[settings.removeAllowedHost] error:", error.message);
    return { success: false, error: "Could not remove the host" };
  }
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// getIngestionStatus — everything the "Tracking" cards in Settings show:
// verification/claim, the last event, hosts, key rotation, tracking health.
// Any active member may read it.
// ─────────────────────────────────────────────────────────────────────────────
export async function getIngestionStatus(siteId) {
  const a = await authorize(siteId, "site.view");
  if (!a.ok) return null;

  const [{ data: site }, { data: healthRows }] = await Promise.all([
    a.supabase
      .from("sites")
      .select("verified, specify_form, claim_started_at, created_at, last_event_at, allowed_hosts, last_unmatched_host, last_unmatched_at, unmatched_count, previous_api_key, previous_key_expires_at, key_rotated_at, new_key_first_hit_at")
      .eq("id", siteId)
      .maybeSingle(),
    a.supabase.from("tracking_health").select("page_path, check_key, details, last_event_at, last_seen_at").eq("site_id", siteId),
  ]);
  if (!site) return null;

  const now = Date.now();
  const rotation = rotationStatus(site, now);
  return {
    role: a.role,
    verified: !!site.verified,
    claim: site.verified ? null : { startedAt: site.claim_started_at, expiresAt: new Date(claimExpiresAt(site)).toISOString(), expired: isClaimExpired(site, now), ttlDays: CLAIM_TTL_MS / 86_400_000 },
    lastEventAt: site.last_event_at,
    allowedHosts: Array.isArray(site.allowed_hosts) ? site.allowed_hosts : [],
    unmatched: site.last_unmatched_host ? { host: site.last_unmatched_host, at: site.last_unmatched_at, count: site.unmatched_count || 0 } : null,
    rotation: { ...rotation, rotatedAt: site.key_rotated_at, deadlineIso: rotation.active ? new Date(rotation.deadline).toISOString() : null },
    health: summarizeHealth(healthRows || [], { specifyForm: !!site.specify_form }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getMembers — returns all members for display in settings
//
// Security note (fixed 2026-09-30): this returned every member's email for
// ANY siteId passed in. Now requires the caller to be a member of that site.
// ─────────────────────────────────────────────────────────────────────────────
export async function getMembers(siteId) {
  const a = await authorize(siteId, "site.view");
  if (!a.ok) return [];

  const { data, error } = await a.supabase
    .from("site_members")
    .select("id, user_id, user_email, role, status, invited_by, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[settings.getMembers] error:", error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// inviteMember — by email, as a member (owners may also invite an admin)
//
// status MUST be 'pending_invite'. The table defaults status to 'active'; left
// out, the person would be added as an active member immediately and the whole
// accept/decline flow would be bypassed.
// ─────────────────────────────────────────────────────────────────────────────
export async function inviteMember(siteId, inviteeEmail, role = "member") {
  if (!inviteeEmail?.includes("@")) return { success: false, error: "Invalid email address" };
  const a = await authorize(siteId, "members.invite");
  if (!a.ok) return { success: false, error: a.error };
  if (!assignableRoles(a.role).includes(role)) return { success: false, error: "You cannot invite someone with that role" };

  const email = inviteeEmail.toLowerCase().trim();

  const { data: existing } = await a.supabase.from("site_members").select("id, status").eq("site_id", siteId).eq("user_email", email).maybeSingle();
  if (existing) {
    if (existing.status === "active") return { success: false, error: "This person is already an active member" };
    if (existing.status === "pending_invite") return { success: false, error: "An invite has already been sent to this email" };
    if (existing.status === "declined") {
      const { error: updateErr } = await a.supabase.from("site_members").update({ status: "pending_invite", role, invited_by: a.userId }).eq("id", existing.id);
      if (updateErr) return { success: false, error: "Failed to re-send invite" };
      revalidatePath("/platform/settings");
      return { success: true };
    }
  }

  const { error } = await a.supabase.from("site_members").insert({
    site_id: siteId,
    user_id: `pending:${email}`,
    user_email: email,
    role,
    status: "pending_invite",
    invited_by: a.userId,
  });
  if (error) {
    console.error("[settings.inviteMember] insert error:", error.message);
    return { success: false, error: "Failed to invite member" };
  }
  revalidatePath("/platform/settings");
  return { success: true };
}

/** The member row this action targets, scoped to the site. */
async function targetMember(supabase, siteId, memberRowId) {
  const { data } = await supabase.from("site_members").select("id, user_id, role, status").eq("id", memberRowId).eq("site_id", siteId).maybeSingle();
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// removeMember — owners remove anyone but themselves; admins remove members and
// other admins; nobody removes the owner (ownership is transferred instead)
// ─────────────────────────────────────────────────────────────────────────────
export async function removeMember(siteId, memberRowId) {
  const a = await authorize(siteId, "members.remove");
  if (!a.ok) return { success: false, error: a.error };

  const target = await targetMember(a.supabase, siteId, memberRowId);
  if (!target) return { success: false, error: "Member not found" };
  if (target.user_id === a.userId) return { success: false, error: "You cannot remove yourself" };
  if (!canManageMember(a.role, target.role, "members.remove")) return { success: false, error: "The owner cannot be removed. Transfer ownership first." };

  const { error } = await a.supabase.from("site_members").delete().eq("id", memberRowId).eq("site_id", siteId);
  if (error) {
    console.error("[settings.removeMember] delete error:", error.message);
    return { success: false, error: "Could not remove the member" };
  }
  revalidatePath("/platform/settings");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// setMemberRole — owner: member <-> admin. Admin: can only make members
// (an admin cannot promote to admin or demote another admin).
// ─────────────────────────────────────────────────────────────────────────────
export async function setMemberRole(siteId, memberRowId, newRole) {
  const a = await authorize(siteId, "members.set_role");
  if (!a.ok) return { success: false, error: a.error };

  const target = await targetMember(a.supabase, siteId, memberRowId);
  if (!target) return { success: false, error: "Member not found" };
  if (target.user_id === a.userId) return { success: false, error: "You cannot change your own role" };
  if (!canManageMember(a.role, target.role, "members.set_role")) return { success: false, error: "You cannot change this person's role" };
  if (!assignableRoles(a.role).includes(newRole)) return { success: false, error: "You cannot give that role" };

  const { error } = await a.supabase.from("site_members").update({ role: newRole }).eq("id", memberRowId).eq("site_id", siteId);
  if (error) {
    console.error("[settings.setMemberRole] error:", error.message);
    return { success: false, error: "Could not change the role" };
  }
  revalidatePath("/platform/settings");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// transferOwnership — owner only. The person must already be an active member.
// The previous owner becomes an admin (keeps working access, loses the
// owner-only rights). Written new-owner first, so a failure part-way leaves
// two owners rather than none.
// ─────────────────────────────────────────────────────────────────────────────
export async function transferOwnership(siteId, memberRowId) {
  const a = await authorize(siteId, "ownership.transfer");
  if (!a.ok) return { success: false, error: a.error };

  const target = await targetMember(a.supabase, siteId, memberRowId);
  if (!target || target.status !== "active" || target.user_id.startsWith("pending:")) return { success: false, error: "Ownership can only go to an active member" };
  if (target.user_id === a.userId) return { success: false, error: "You already own this site" };

  const { error: promoteErr } = await a.supabase.from("site_members").update({ role: "owner" }).eq("id", memberRowId).eq("site_id", siteId);
  if (promoteErr) {
    console.error("[settings.transferOwnership] promote error:", promoteErr.message);
    return { success: false, error: "Could not transfer ownership" };
  }
  const { error: demoteErr } = await a.supabase.from("site_members").update({ role: "admin" }).eq("site_id", siteId).eq("user_id", a.userId);
  if (demoteErr) {
    console.error("[settings.transferOwnership] demote error:", demoteErr.message);
    await a.supabase.from("site_members").update({ role: target.role }).eq("id", memberRowId).eq("site_id", siteId); // put the target back
    return { success: false, error: "Could not transfer ownership" };
  }
  // sites.user_id is the legacy owner column some code still reads.
  await a.supabase.from("sites").update({ user_id: target.user_id }).eq("id", siteId);

  revalidatePath("/platform/settings");
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// setFormMode — which forms count as leads: only forms marked
// data-conversion="true" (specify_form = true, recommended) or every form.
// The tracker reads this from /api/site-config (cached up to 60 s), and the
// server enforces it on every lead, so a change applies within about a minute.
// Leads already recorded are never changed.
// ─────────────────────────────────────────────────────────────────────────────
export async function setFormMode(siteId, specifyForm) {
  const a = await authorize(siteId, "site.change_form_mode");
  if (!a.ok) return { success: false, error: a.error };

  const { data, error } = await a.supabase.from("sites").update({ specify_form: specifyForm === true }).eq("id", siteId).select().single();
  if (error) {
    console.error("[settings.setFormMode] error:", error.message);
    return { success: false, error: "Could not change the form setting" };
  }
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// ─────────────────────────────────────────────────────────────────────────────
// leaveSite — a member or admin removes their own access. The owner cannot
// leave: transfer ownership first, so a site is never left without one.
// ─────────────────────────────────────────────────────────────────────────────
export async function leaveSite(siteId) {
  const a = await authorize(siteId, "site.view");
  if (!a.ok) return { success: false, error: a.error };
  if (a.role === "owner") return { success: false, error: "The owner cannot leave. Transfer ownership to someone else first." };

  const { error } = await a.supabase.from("site_members").delete().eq("site_id", siteId).eq("user_id", a.userId);
  if (error) {
    console.error("[settings.leaveSite] error:", error.message);
    return { success: false, error: "Could not leave the site" };
  }
  if ((await getPreferredSiteId()) === siteId) await clearPreferredSiteId();
  return { success: true };
}
