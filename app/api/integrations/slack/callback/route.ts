// app/api/integrations/slack/callback/route.ts
// Slack sends the person back here after they pick a channel. Checks the signed state (same person, same browser,
// under 10 minutes old, still owner/admin of that site), trades the code for the channel's incoming-webhook URL and
// stores it as a Slack channel of the site (sealed, like a pasted one). Then back to Notifications → Channels.
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { SLACK_STATE_COOKIE, exchangeCode, readState, slackOAuthConfigured, slackRedirectUri } from "@/lib/notifications/slackOAuth";
import { maskUrl, sealSecret } from "@/lib/notifications/secret";
import { isSlackUrl } from "@/lib/notifications/send";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const back = (req: NextRequest, result: string) => {
  const res = NextResponse.redirect(new URL("/platform/notifications?tab=channels&slack=" + result, req.nextUrl.origin));
  res.cookies.delete({ name: SLACK_STATE_COOKIE, path: "/api/integrations/slack" });
  return res;
};

export async function GET(req: NextRequest) {
  if (!slackOAuthConfigured()) return back(req, "not-configured");
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back(req, "cancelled"); // the person pressed Cancel on Slack's screen
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.nextUrl.origin));

  const state = readState(q.get("state"), req.cookies.get(SLACK_STATE_COOKIE)?.value, userId);
  const code = q.get("code");
  if (!state || !code) return back(req, "expired");

  // still allowed on that site?
  const { data: member } = await admin.from("site_members").select("role").eq("site_id", state.s).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) return back(req, "not-allowed");

  try {
    const install = await exchangeCode(code, slackRedirectUri(req.nextUrl.origin));
    if (!isSlackUrl(install.url)) return back(req, "error");
    const name = (install.channel.startsWith("#") ? install.channel : "#" + install.channel) + (install.team ? " · " + install.team : "");
    const { error } = await admin.from("notification_channels").insert({
      site_id: state.s,
      kind: "slack",
      name: name.slice(0, 60),
      secret: sealSecret(install.url),
      hint: maskUrl(install.url),
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return back(req, "connected");
  } catch (e) {
    console.error("[slack-oauth] connect failed", e instanceof Error ? e.message : String(e));
    return back(req, "error");
  }
}
