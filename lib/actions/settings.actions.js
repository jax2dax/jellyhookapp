// lib/actions/settings.actions.js
// All settings mutations for the sites table
// These are server actions — called directly from client components
// Import: import { updateSiteDomain, updateSiteName, deactivateSite } from "@/lib/actions/settings.actions"

"use server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

// updateSiteDomain — updates the domain field for the user's active site
// Returns: { success: true, data } | { success: false, error: string }
// Params: siteId (string), domain (string)
export async function updateSiteDomain(siteId, domain) {
  const { userId } = await auth();
  if (!userId) {
    console.error("[settings] updateSiteDomain: unauthorized");
    return { success: false, error: "Unauthorized" };
  }

  if (!domain || domain.trim() === "") {
    return { success: false, error: "Domain cannot be empty" };
  }

  // Strip protocol if user pasted full URL — store just the domain
  const cleanDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

  console.log(`[settings] updateSiteDomain: siteId=${siteId} domain=${cleanDomain}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .update({ domain: cleanDomain })
    .eq("id", siteId)
    .eq("user_id", userId) // ownership check — user can only update their own site
    .select()
    .single();

  if (error) {
    console.error("[settings] updateSiteDomain error:", error.message);
    return { success: false, error: error.message };
  }

  console.log(`[settings] updateSiteDomain: success siteId=${siteId}`);
  revalidatePath("/platform/settings"); // bust Next.js cache so page reflects new value
  return { success: true, data };
}

// updateSiteName — updates the display name field for the site
// Returns: { success: true, data } | { success: false, error: string }
// Params: siteId (string), name (string)
export async function updateSiteName(siteId, name) {
  const { userId } = await auth();
  if (!userId) {
    console.error("[settings] updateSiteName: unauthorized");
    return { success: false, error: "Unauthorized" };
  }

  if (!name || name.trim() === "") {
    return { success: false, error: "Name cannot be empty" };
  }

  console.log(`[settings] updateSiteName: siteId=${siteId} name=${name.trim()}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .update({ name: name.trim() })
    .eq("id", siteId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[settings] updateSiteName error:", error.message);
    return { success: false, error: error.message };
  }

  console.log(`[settings] updateSiteName: success siteId=${siteId}`);
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// regenerateApiKey — generates a new api_key for the site
// WARNING: this will break any tracker scripts using the old key
// Returns: { success: true, data } | { success: false, error: string }
// Params: siteId (string)
export async function regenerateApiKey(siteId) {
  const { userId } = await auth();
  if (!userId) {
    console.error("[settings] regenerateApiKey: unauthorized");
    return { success: false, error: "Unauthorized" };
  }

  const newKey = crypto.randomUUID();
  console.log(`[settings] regenerateApiKey: siteId=${siteId} newKey=${newKey}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .update({ api_key: newKey })
    .eq("id", siteId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[settings] regenerateApiKey error:", error.message);
    return { success: false, error: error.message };
  }

  console.log(`[settings] regenerateApiKey: success siteId=${siteId}`);
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// toggleSiteActive — flips is_active between true/false
// Returns: { success: true, data } | { success: false, error: string }
// Params: siteId (string), currentState (boolean)
export async function toggleSiteActive(siteId, currentState) {
  const { userId } = await auth();
  if (!userId) {
    console.error("[settings] toggleSiteActive: unauthorized");
    return { success: false, error: "Unauthorized" };
  }

  const newState = !currentState;
  console.log(`[settings] toggleSiteActive: siteId=${siteId} ${currentState} → ${newState}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .update({ is_active: newState })
    .eq("id", siteId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[settings] toggleSiteActive error:", error.message);
    return { success: false, error: error.message };
  }

  console.log(`[settings] toggleSiteActive: success is_active=${newState}`);
  revalidatePath("/platform/settings");
  return { success: true, data };
}

// deactivateSite — soft delete: sets is_active=false and deleted_at=now
// Does NOT delete the row — data is preserved
// Returns: { success: true } | { success: false, error: string }
// Params: siteId (string)
export async function deactivateSite(siteId) {
  const { userId } = await auth();
  if (!userId) {
    console.error("[settings] deactivateSite: unauthorized");
    return { success: false, error: "Unauthorized" };
  }

  console.log(`[settings] deactivateSite: siteId=${siteId}`);
  const supabase = createSupabaseClient();

  const { error } = await supabase
    .from("sites")
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq("id", siteId)
    .eq("user_id", userId);

  if (error) {
    console.error("[settings] deactivateSite error:", error.message);
    return { success: false, error: error.message };
  }

  console.log(`[settings] deactivateSite: success siteId=${siteId}`);
  revalidatePath("/platform/settings");
  return { success: true };
}