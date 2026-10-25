// app/api/integrations/hubspot/start/route.ts
// "Connect" on the HubSpot card in Integrations: sends the signed-in person to HubSpot's install screen. Same permission
// as connecting Slack: owner or admin. Flow and setup: mds/build/integrations/hubspot.md.
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSite } from "@/lib/actions/permission.actions";
import { HUBSPOT_STATE_COOKIE, authorizeUrl, hubspotConfigured, hubspotRedirectUri, makeState } from "@/lib/integrations/hubspot";

const back = (req: NextRequest, result: string) => NextResponse.redirect(new URL("/platform/integrations?hubspot=" + result, req.nextUrl.origin));

export async function GET(req: NextRequest) {
  if (!hubspotConfigured()) return back(req, "not-configured");
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  const site = (await getUserSite(userId)) as { id?: string; role?: string } | null;
  if (!site?.id) return back(req, "no-site");
  if (site.role !== "owner" && site.role !== "admin") return back(req, "not-allowed");

  const { state, nonce } = makeState(site.id, userId);
  const res = NextResponse.redirect(authorizeUrl(state, hubspotRedirectUri(req.nextUrl.origin)));
  res.cookies.set(HUBSPOT_STATE_COOKIE, nonce, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/integrations/hubspot", maxAge: 3600 });
  return res;
}
