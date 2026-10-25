// app/api/integrations/slack/start/route.ts
// "Connect" on the Slack card: sends the signed-in person to Slack's install screen (pick a workspace and a channel).
// Same permission as adding a channel by hand (lib/actions/notifications.action.ts addChannel): owner or admin.
// Flow and setup: mds/build/notifications/slack-oauth.md.
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserSite } from "@/lib/actions/permission.actions";
import { SLACK_STATE_COOKIE, authorizeUrl, makeState, slackOAuthConfigured, slackRedirectUri } from "@/lib/notifications/slackOAuth";

const back = (req: NextRequest, result: string) => NextResponse.redirect(new URL("/platform/notifications?tab=channels&slack=" + result, req.nextUrl.origin));

export async function GET(req: NextRequest) {
  if (!slackOAuthConfigured()) return back(req, "not-configured");
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));
  const site = (await getUserSite(userId)) as { id?: string; role?: string } | null;
  if (!site?.id) return back(req, "no-site");
  if (site.role !== "owner" && site.role !== "admin") return back(req, "not-allowed");

  const { state, nonce } = makeState(site.id, userId);
  const res = NextResponse.redirect(authorizeUrl(state, slackRedirectUri(req.nextUrl.origin)));
  res.cookies.set(SLACK_STATE_COOKIE, nonce, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/integrations/slack", maxAge: 3600 });
  return res;
}
