// app/api/integrations/hubspot/callback/route.ts
// HubSpot sends the person back here after they approve. Checks the signed state (same person, same browser, under an
// hour old, still owner/admin of that site), trades the code for tokens and stores the connection (sealed, one per
// site: connecting again replaces it). An install started from HubSpot itself has no state: the person is asked to
// connect from Jellyhook, so the account is always tied to the right site.
import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { HUBSPOT_STATE_COOKIE, exchangeCode, hubspotConfigured, hubspotRedirectUri, readState, saveConnection } from "@/lib/integrations/hubspot";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const back = (req: NextRequest, result: string) => {
  const res = NextResponse.redirect(new URL("/platform/integrations?hubspot=" + result, req.nextUrl.origin));
  res.cookies.delete({ name: HUBSPOT_STATE_COOKIE, path: "/api/integrations/hubspot" });
  return res;
};

export async function GET(req: NextRequest) {
  if (!hubspotConfigured()) return back(req, "not-configured");
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back(req, "cancelled");
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  if (!q.get("state")) return back(req, "start-in-jellyhook");

  const check = readState(q.get("state"), req.cookies.get(HUBSPOT_STATE_COOKIE)?.value, userId);
  const code = q.get("code");
  if (!check.ok) {
    console.error("[hubspot-oauth] state rejected:", check.reason);
    return back(req, check.reason);
  }
  if (!code) return back(req, "missing");

  const { data: member } = await admin.from("site_members").select("role").eq("site_id", check.state.s).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) return back(req, "not-allowed");

  try {
    const install = await exchangeCode(code, hubspotRedirectUri(req.nextUrl.origin));
    const email = (await currentUser())?.primaryEmailAddress?.emailAddress ?? null;
    await saveConnection(check.state.s, install, userId, email, admin);
    return back(req, "connected");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[hubspot-oauth] connect failed", msg);
    return back(req, /hubspot_connections/.test(msg) ? "not-ready" : "error");
  }
}
