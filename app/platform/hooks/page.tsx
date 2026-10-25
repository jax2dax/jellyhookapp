// app/platform/hooks/page.tsx
// Hooks: Hooked leads (every lead a hook caught), Hooks (the rules: which marks, who is told, where; switched on and
// off), Integrations (Slack, webhooks). The tab is ?tab= (components/nav/navRegistry.ts). Notifications (the inbox) is
// its own page. Design: mds/build/notifications/.
import { Rules } from "@/components/notifications/Rules";
import { Channels } from "@/components/notifications/Channels";
import { HookedLeads } from "@/components/hooks/HookedLeads";
import { navFor, resolveTab } from "@/components/nav/navRegistry";
import { loadRules } from "@/lib/actions/notifications.action";
import { loadHookedLeads } from "@/lib/actions/hooks.action";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { slackOAuthConfigured } from "@/lib/notifications/slackOAuth";

export const dynamic = "force-dynamic";

export default async function HooksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthUser();
  await requireSite(user.id);
  const sp = (await searchParams) ?? {};
  const tab = resolveTab(navFor("/platform/hooks")!, typeof sp.tab === "string" ? sp.tab : null, {});

  if (tab === "hooked") {
    const r = await loadHookedLeads(100);
    return (
      <div className="p-6 pt-4">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          <p className="text-sm text-muted-foreground">Every lead one of your hooks caught, newest first. Open one to see what they did before sending the form.</p>
          {r.ok ? <HookedLeads leads={r.leads} ready={r.ready} /> : <p className="text-sm text-red-600">{r.error}</p>}
        </div>
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
        <p className="text-sm text-muted-foreground">Hooks are not set up on this database yet (migration 20).</p>
      )}
    </div>
  );
}
