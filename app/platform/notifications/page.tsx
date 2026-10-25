// app/platform/notifications/page.tsx
// Notifications: what reached me. Updates from Jellyhook first (red dot in the sidebar while unread), then my inbox:
// one entry for every lead a hook caught (yellow count in the sidebar). Hooks themselves (the rules) and Integrations
// live on /platform/hooks; old links to ?tab=rules / ?tab=channels are sent there.
import { redirect } from "next/navigation";
import { Inbox } from "@/components/notifications/Inbox";
import { Updates } from "@/components/notifications/Updates";
import { loadInbox } from "@/lib/actions/notifications.action";
import { loadAnnouncements } from "@/lib/actions/announcements.action";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) ?? {};
  if (sp.tab === "rules") redirect("/platform/hooks?tab=rules");
  if (sp.tab === "channels") redirect("/platform/hooks?tab=integrations" + (typeof sp.slack === "string" ? "&slack=" + encodeURIComponent(sp.slack) : ""));
  const user = await getAuthUser();
  await requireSite(user.id);
  const [r, updates] = await Promise.all([loadInbox(), loadAnnouncements()]);
  return (
    <div className="space-y-6 p-6 pt-4">
      <Updates items={updates.items} canSend={updates.canSend} />
      {r.ok ? <Inbox items={r.items} ready={r.ready} /> : <p className="text-sm text-red-600">{r.error}</p>}
    </div>
  );
}
