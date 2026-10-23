// app/platform/notifications/page.tsx
// Notifications: Inbox (what reached me), Rules (when to notify, whom, where) and Channels (Slack, webhooks). The tab is
// ?tab= (components/nav/navRegistry.ts); the tabs themselves are in the top bar. Design: mds/build/notifications/.
import { Inbox } from "@/components/notifications/Inbox";
import { Rules } from "@/components/notifications/Rules";
import { Channels } from "@/components/notifications/Channels";
import { navFor, resolveTab } from "@/components/nav/navRegistry";
import { loadInbox, loadRules } from "@/lib/actions/notifications.action";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { slackOAuthConfigured } from "@/lib/notifications/slackOAuth";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthUser();
  await requireSite(user.id);
  const sp = (await searchParams) ?? {};
  const tab = resolveTab(navFor("/platform/notifications")!, typeof sp.tab === "string" ? sp.tab : null, {});

  if (tab === "inbox") {
    const r = await loadInbox();
    return (
      <div className="p-6 pt-4">
        {r.ok ? <Inbox items={r.items} ready={r.ready} /> : <p className="text-sm text-red-600">{r.error}</p>}
      </div>
    );
  }
  const r = await loadRules();
  return (
    <div className="p-6 pt-4">
      {!r.ok ? (
        <p className="text-sm text-red-600">{r.error}</p>
      ) : tab === "rules" ? (
        <Rules state={r.state} />
      ) : r.state.ready ? (
        <Channels channels={r.state.channels} canManage={r.state.canManageChannels} slackOAuth={slackOAuthConfigured()} slackResult={typeof sp.slack === "string" ? sp.slack : null} />
      ) : (
        <p className="text-sm text-muted-foreground">Notifications are not set up on this database yet (migration 20).</p>
      )}
    </div>
  );
}
