// app/platform/team/page.jsx
// Team (was "Network", renamed 2026-10-24): invite a teammate on top, the site's team listed under it.
// The page body is app/platform/network/NetworkClient.jsx; /platform/network redirects here.
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getMembers } from "@/lib/actions/settings.actions";
import { getMyPendingInvites } from "@/lib/actions/site-management.actions";
import NetworkClient from "../network/NetworkClient";

export default async function TeamPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const [members, myInvites] = await Promise.all([getMembers(site.id), getMyPendingInvites()]);
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <NetworkClient site={site} members={members} currentUserId={user.id} myInvites={myInvites} />
    </div>
  );
}
