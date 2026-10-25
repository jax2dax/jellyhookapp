// app/platform/hooks/page.tsx
// Hooks: Hooked leads (every lead a hook caught; opening it clears the yellow count on the sidebar) and Hooks (the
// rules: which marks, who is told, where; Live / Paused). The tab is ?tab= (components/nav/navRegistry.ts).
// Notifications (the inbox) and Integrations (Slack, webhooks) are their own pages. Design: mds/build/notifications/.
import { redirect } from "next/navigation";
import { Rules } from "@/components/notifications/Rules";
import { HookedLeads } from "@/components/hooks/HookedLeads";
import { navFor, resolveTab } from "@/components/nav/navRegistry";
import { loadRules } from "@/lib/actions/notifications.action";
import { loadHookedLeads } from "@/lib/actions/hooks.action";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";

export const dynamic = "force-dynamic";

export default async function HooksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthUser();
  await requireSite(user.id);
  const sp = (await searchParams) ?? {};
  if (sp.tab === "integrations") redirect("/platform/integrations");
  const tab = resolveTab(navFor("/platform/hooks")!, typeof sp.tab === "string" ? sp.tab : null, {});

  if (tab === "hooked") {
    const r = await loadHookedLeads(100);
    return (
      <div className="p-6 pt-4">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          <p className="text-sm text-muted-foreground">Every lead one of your hooks caught, newest first. Open one to see what they did before sending the form.</p>
          {r.ok ? <HookedLeads leads={r.leads} ready={r.ready} markSeen /> : <p className="text-sm text-red-600">{r.error}</p>}
        </div>
      </div>
    );
  }
  const r = await loadRules();
  return (
    <div className="p-6 pt-4">
      {!r.ok ? (
        <p className="text-sm text-red-600">{r.error}</p>
      ) : (
        <Rules state={r.state} />
      )}
    </div>
  );
}
