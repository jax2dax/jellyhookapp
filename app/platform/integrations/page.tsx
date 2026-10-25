// app/platform/integrations/page.tsx
// Integrations (its own sidebar item since 2026-10-24): where hooks can send outside Jellyhook. Slack (OAuth, or a
// pasted webhook URL), signed webhooks, and HubSpot (contact links and the Jellyhook card, mds/build/integrations/hubspot.md).
// Slack's and HubSpot's sign-ins come back here (?slack=<result>, ?hubspot=<result>).
import { Channels } from "@/components/notifications/Channels";
import { loadRules } from "@/lib/actions/notifications.action";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { slackOAuthConfigured } from "@/lib/notifications/slackOAuth";
import { HubSpotConnect } from "@/components/notifications/HubSpotConnect";
import { getHubSpotStatus } from "@/lib/actions/hubspot.action";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthUser();
  await requireSite(user.id);
  const sp = (await searchParams) ?? {};
  const [r, hs] = await Promise.all([loadRules(), getHubSpotStatus()]);
  return (
    <div className="space-y-4 p-6">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">Where your hooks can send a hooked lead outside Jellyhook. Pick them per hook, under Notification method.</p>
      </div>
      {!r.ok ? (
        <p className="text-sm text-red-600">{r.error}</p>
      ) : r.state.ready ? (
        <Channels channels={r.state.channels} canManage={r.state.canManageChannels} slackOAuth={slackOAuthConfigured()} slackResult={typeof sp.slack === "string" ? sp.slack : null} />
      ) : (
        <p className="text-sm text-muted-foreground">Integrations are not set up on this database yet (migration 20).</p>
      )}
      <div className="mx-auto w-full max-w-3xl pt-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CRM</h2>
      </div>
      {hs.ok ? <HubSpotConnect status={hs.status} result={typeof sp.hubspot === "string" ? sp.hubspot : null} /> : <p className="mx-auto w-full max-w-3xl text-sm text-red-600">{hs.error}</p>}
    </div>
  );
}
