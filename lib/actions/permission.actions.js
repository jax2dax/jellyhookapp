import { currentUser } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

const PLAN_LEVELS = { free: 0, pro: 1, elite: 2 };

// hasPlan — boolean plan check, use for PlanGate and inline checks
export function hasPlan(userPlan, required) {
  console.log(`[permission] hasPlan: user=${userPlan} required=${required}`);
  return (PLAN_LEVELS[userPlan] ?? 0) >= (PLAN_LEVELS[required] ?? 0);
}

// getAuthUser — returns Clerk user or redirects to /sign-in
export async function getAuthUser() {
  const user = await currentUser();
  console.log(`[permission] getAuthUser: userId=${user?.id ?? "none"}`);
  if (!user) {
    console.log("[permission] no user — redirecting to /sign-in");
    redirect("/sign-in");
  }
  return user;
}

// getUserSite — returns first active site for user, or null
// Uses .limit(1) NOT .single() — .single() throws on empty result
export async function getUserSite(userId) {
  console.log(`[permission] getUserSite: userId=${userId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .select("id, plan, domain, api_key, is_active, monthly_event_limit, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1);

  if (error) {
    console.error("[permission] getUserSite DB error:", error.message);
    return null;
  }

  const site = data?.[0] ?? null;
  console.log(`[permission] getUserSite: ${site ? `found siteId=${site.id} plan=${site.plan}` : "no active site found"}`);
  return site;
}

// requireSite — use on pages that need a site to function
// Redirects to create-site if none found
export async function requireSite(userId) {
  const site = await getUserSite(userId);
  if (!site) {
    console.log("[permission] requireSite — no active site, redirecting to /platform/create-site");
    redirect("/platform/create-site");
  }
  return site;
}