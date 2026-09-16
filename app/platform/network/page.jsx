// app/platform/network/page.jsx
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getMembers } from "@/lib/actions/settings.actions";
import { getMyPendingInvites } from "@/lib/actions/site-management.actions";
import NetworkClient from "./NetworkClient";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

export default async function NetworkPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const members = await getMembers(site.id);
  const myInvites = await getMyPendingInvites();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Network</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <NetworkClient
          site={site}
          members={members}
          currentUserId={user.id}
          myInvites={myInvites}
        />
      </div>
    </>
  );
}