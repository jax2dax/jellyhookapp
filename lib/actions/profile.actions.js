// lib/actions/profile.actions.js
// Lets a signed-in person read/edit their own row in `public.users` — the
// display name shown across the app (leads, network members, etc.) instead
// of whatever Clerk/their email happens to say. The webhook seeds this row
// on signup and keeps email/avatar in sync, but never touches
// first_name/last_name once set here.
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

// updateMyProfile — edits the current user's own display name / phone
// Returns: { success: true, data } | { success: false, error }
// Params: { first_name?, last_name?, phone? }
export async function updateMyProfile({ first_name, last_name, phone }) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };

  const updates = {};
  if (first_name !== undefined) updates.first_name = first_name?.trim() || null;
  if (last_name !== undefined) updates.last_name = last_name?.trim() || null;
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
