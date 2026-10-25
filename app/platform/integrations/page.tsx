// app/platform/integrations/page.tsx
// Integrations (its own sidebar item since 2026-10-24): where hooks can send outside Jellyhook. Slack (OAuth, or a
// pasted webhook URL) and signed webhooks today; HubSpot next. Slack's sign-in comes back here (?slack=<result>).
import { Channels } from "@/components/notifications/Channels";
import { loadRules } from "@/lib/actions/notifications.action";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { slackOAuthConfigured } from "@/lib/notifications/slackOAuth";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthUser();
  await requireSite(user.id);
  const sp = (await searchParams) ?? {};
  const r = await loadRules();
  return (
    <div className="space-y-4 p-6">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-lg font-semibold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">Where your hooks can send a hooked lead outside Jellyhook. Pick them per hook, under Notification method.</p>
      </div>
      {!r.ok ? (
        <p className="text-sm text-red-600">{r.error}</p>
      ) : r.state.ready ? (
        <Channels channels={r.state.channels} canManage={r.state.canManageChannels} slackOAuth={slackOAuthConfigured()} slackResult={typeof sp.slack === "string" ? sp.slack : null} />
      ) : (
        <p className="text-sm text-muted-foreground">Integrations are not set up on this database yet (migration 20).</p>
      )}
    </div>
  );
}
