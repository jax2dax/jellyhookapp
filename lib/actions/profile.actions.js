// lib/actions/profile.actions.js
// Lets a signed-in person read/edit their own row in `public.users` — the
// display name and contact email shown across the app instead of whatever
// Clerk happens to say. The webhook seeds this row on signup, keeps pfp
// always in sync with Clerk (see components/app-sidebar.tsx — avatar
// changes go through Clerk directly), but never overwrites
// first_name/last_name/email once they've been set here.
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// getMyProfile — the current user's own `users` row
//
// Self-healing: rows created before the webhook was fixed (or before it
// existed at all) can be missing email/name/avatar entirely. Rather than
// requiring every such person to go edit their Clerk profile just to fire
// a user.updated event, this backfills straight from Clerk on read —
// once — the first time it notices email is missing. first_name/last_name
// are only backfilled if BOTH are still empty, so it never clobbers a name
// someone has already customized here.
//
// Returns: { id, email, first_name, last_name, phone, pfp, created_at } | null
export async function getMyProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", userId).maybeSingle();

  if (error) {
    console.error("[profile] getMyProfile error:", error.message);
    return null;
  }

  const needsBackfill = !data || !data.email;
  if (!needsBackfill) return data;

  const clerkUser = await currentUser();
  if (!clerkUser) return data;

  const primaryEmail = clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ?? clerkUser.emailAddresses?.[0]?.emailAddress ?? null;

  const patch = { id: userId, email: primaryEmail, pfp: clerkUser.imageUrl ?? null };
  // Only seed a name if the row has neither — never overwrite a custom one.
  if (!data?.first_name && !data?.last_name) {
    patch.first_name = clerkUser.firstName ?? null;
    patch.last_name = clerkUser.lastName ?? null;
  }

  const { data: patched, error: patchError } = await supabaseAdmin.from("users").upsert(patch, { onConflict: "id" }).select().maybeSingle();

  if (patchError) {
    console.error("[profile] getMyProfile backfill error:", patchError.message);
    return data;
  }

  console.log(`[profile] getMyProfile backfilled userId=${userId} from Clerk`);
  return patched;
}

// updateMyProfile — edits the current user's own display name / email / phone
//
// `email` here is this app's own contact field, not the visitor's sign-in
// email — like first_name/last_name, it's deliberately decoupled from Clerk
// once set. Editing it here does NOT change the address you sign in with,
// and — same as names — the webhook (app/api/webhooks/clerk/route.ts
// user.updated) will never overwrite it again once it's non-null, even
// though that same event fires for unrelated Clerk-side changes like a new
// profile picture (see components/app-sidebar.tsx, which edits the avatar
// straight through Clerk's own user.setProfileImage()).
//
// Returns: { success: true, data } | { success: false, error }
/**
 * @param {{ first_name?: string, last_name?: string, email?: string, phone?: string }} params
 */
export async function updateMyProfile({ first_name, last_name, email, phone } = {}) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };

  const updates = {};
  if (first_name !== undefined) updates.first_name = first_name?.trim() || null;
  if (last_name !== undefined) updates.last_name = last_name?.trim() || null;
  if (email !== undefined) updates.email = email?.trim() || null;
  if (phone !== undefined) {
    // `phone` is stored as bigint — strip everything but digits, drop a
    // leading country-code "+" style prefix isn't representable this way.
    // Empty input clears the field rather than sending an invalid number.
    const digits = (phone || "").replace(/\D/g, "");
    updates.phone = digits ? Number(digits) : null;
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: "Nothing to update" };
  }

  const { data, error } = await supabaseAdmin.from("users").update(updates).eq("id", userId).select().maybeSingle();

  if (error) {
    console.error("[profile] updateMyProfile error:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}
