import { currentUser } from "@clerk/nextjs/server";
import { createSupabaseClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
//////////////////////////////////////////latest claude

// lib/actions/permission.actions.js
// Auth guards + plan checks for all platform pages and sections
// Import: import { getAuthUser, requireSite, isProOrHigher, isElite, isProOnly } from "@/lib/actions/permission.actions"


// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────

// getAuthUser — returns Clerk user object or redirects to /sign-in
// Use on every platform page at the top
// Returns: Clerk User object
// Params: none
export async function getAuthUser() {
  const user = await currentUser();
  console.log(`[permission] getAuthUser: userId=${user?.id ?? "none"}`);
  if (!user) {
    console.log("[permission] getAuthUser: no user — redirecting to /sign-in");
    redirect("/sign-in");
  }
  return user;
}

// ─────────────────────────────────────────
// SITE GUARD
// ─────────────────────────────────────────

// getUserSite — returns first active site for userId, or null
// NEVER throws — uses .limit(1) not .single()
// Returns: site object | null
// Params: userId (string) — Clerk userId
export async function getUserSite(userId) {
  console.log(`[permission] getUserSite: userId=${userId}`);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("sites")
    .select("id, plan, domain, api_key, is_active, monthly_event_limit, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false }) // newest site first — prevents random ordering
    .limit(1);

  if (error) {
    console.error("[permission] getUserSite DB error:", error.message);
    return null;
  }

  const site = data?.[0] ?? null;
  console.log(`[permission] getUserSite: ${site ? `found siteId=${site.id} plan=${site.plan}` : "no active site found"}`);
  return site;
}

// requireSite — use on pages that are useless without a site
// Redirects to /platform/create-site if no active site found
// Returns: site object (never null — redirects instead)
// Params: userId (string) — Clerk userId
export async function requireSite(userId) {
  const site = await getUserSite(userId);
  if (!site) {
    console.log("[permission] requireSite: no active site — redirecting to /platform/create-site");
    redirect("/platform/create-site");
  }
  return site;
}

// ─────────────────────────────────────────
// PLAN CHECKS — use these in server components and actions
// All use Clerk's has() from auth() — source of truth is Clerk, not Supabase
// Returns: boolean
// Params: none (reads from Clerk session internally)
// ─────────────────────────────────────────

// isProOrHigher — true for pro AND elite plans
// Use for: Leads, Conversions, Acquisition, Visitor Journeys
// Returns: boolean
// Params: none
export async function isProOrHigher() {
  const { has } = await auth();
  const result = has({ plan: "pro" }) || has({ plan: "elite" });
  console.log(`[permission] isProOrHigher: ${result}`);
  return result;
}

// isElite — true ONLY for elite plan
// Use for: Intent Signals, Lead Timeline
// Returns: boolean
// Params: none
export async function isElite() {
  const { has } = await auth();
  const result = has({ plan: "elite" });
  console.log(`[permission] isElite: ${result}`);
  return result;
}

// isProOnly — true ONLY for pro, NOT elite
// Use for: sections that are pro-exclusive and should not show for elite
// Returns: boolean
// Params: none
export async function isProOnly() {
  const { has } = await auth();
  const result = has({ plan: "pro" }) && !has({ plan: "elite" });
  console.log(`[permission] isProOnly: ${result}`);
  return result;
}

// getPlanLabel — returns the current plan as a string
// Use for: displaying plan badge in sidebar/settings
// Returns: "elite" | "pro" | "free"
// Params: none
export async function getPlanLabel() {
  const { has } = await auth();
  if (has({ plan: "elite" })) return "elite";
  if (has({ plan: "pro" })) return "pro";
  return "free";
}
////////////////////////////////////////////////////////////
const PLAN_LEVELS = { free: 0, pro: 1, elite: 2 };

// hasPlan — boolean plan check, use for PlanGate and inline checks
export function hasPlan(userPlan, required) {
  console.log(`[permission] hasPlan: user=${userPlan} required=${required}`);
  return (PLAN_LEVELS[userPlan] ?? 0) >= (PLAN_LEVELS[required] ?? 0);
}

// getAuthUser — returns Clerk user or redirects to /sign-in


// getUserSite — returns first active site for user, or null
// Uses .limit(1) NOT .single() — .single() throws on empty result


// requireSite — use on pages that need a site to function
// Redirects to create-site if none found



/////////////////////////////////////////////////////////////////////////////