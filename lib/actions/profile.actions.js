// lib/actions/profile.actions.js
// Lets a signed-in person read/edit their own row in `public.users` — the
// display name, contact email, and avatar shown across the app instead of
// whatever Clerk happens to say. The webhook seeds first_name/last_name/email
// from Clerk on signup, but never touches pfp at all — pfp is written ONLY
// by uploadMyAvatar below, into this app's own Supabase Storage bucket, never
// from Clerk's imageUrl (which always returns something, even an
// auto-generated default, for every account — see uploadMyAvatar's header).
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

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

  // Deliberately never backfills pfp from Clerk — see this file's header
  // comment. A missing pfp here just stays null, which correctly means
  // "show the default icon," not "borrow Clerk's."
  const patch = { id: userId, email: primaryEmail };
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
// user.updated) will never overwrite it, and never touches pfp at all
// (see uploadMyAvatar below, the only writer of pfp).
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

// uploadMyAvatar — the ONLY way `users.pfp` is ever written.
//
// Uploads straight into this app's own Supabase Storage bucket (`avatars`)
// and stores the resulting public URL — a file this app hosts and controls,
// never a Clerk-hosted one. Clerk's own imageUrl/setProfileImage are never
// used anywhere in this flow: Clerk's imageUrl always returns SOMETHING
// (an auto-generated default) even for an account that never uploaded a
// real photo, so it can never be trusted as a "did they actually upload
// something" signal, not even as a fallback. A user who hasn't uploaded
// here has pfp === null, and the UI shows this app's own default icon.
//
// Requires the `avatars` bucket to exist in Supabase Storage (public read,
// 5MB limit) — see mds/documentation for the exact setup steps if it's
// missing; this action does not create it.
//
// Returns: { success: true, url } | { success: false, error }
/**
 * @param {File} file
 */
export async function uploadMyAvatar(file) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Not signed in" };
  if (!file || typeof file.arrayBuffer !== "function") {
    return { success: false, error: "No file provided" };
  }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { success: false, error: "Unsupported image type" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, error: "Image is too large (max 5MB)" };
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  // Fixed filename per user (not a timestamped one) — upsert overwrites the
  // previous upload in place instead of leaving orphaned files behind in
  // the bucket, and the cache-busting query param is what makes the browser
  // pick up the new image immediately despite the URL otherwise staying the
  // same on every re-upload.
  const path = `${userId}/avatar.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) {
    console.error("[profile] uploadMyAvatar storage error:", uploadError.message);
    return { success: false, error: uploadError.message };
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const url = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: dbError } = await supabaseAdmin.from("users").update({ pfp: url }).eq("id", userId);

  if (dbError) {
    console.error("[profile] uploadMyAvatar db error:", dbError.message);
    return { success: false, error: dbError.message };
  }

  return { success: true, url };
}
