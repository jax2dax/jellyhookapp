// app/platform/settings/page.jsx
// Server component — fetches site + members, passes to SettingsClient
// Uses getUserSite (not getSiteSettings) so site_members backfill runs on first load

import { getAuthUser } from "@/lib/actions/permission.actions";
// import { getUserSite } from "@/lib/actions/site-management.actions";
import { getUserSite } from "@/lib/actions/permission.actions";
import { getMembers } from "@/lib/actions/settings.actions";
import SettingsClient from "./SettingsClients";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  const user = await getAuthUser(); // redirects to /sign-in if not authed

  // ✅ Use getUserSite NOT getSiteSettings
  // getUserSite checks site_members first, then falls back to sites.user_id
  // and BACKFILLS site_members on the fallback path
  // This means after the first load, site_members always has the owner row
  const site = await getUserSite(user.id);

  console.log(`[settings/page] userId=${user.id} siteId=${site?.id ?? "none"}`);

  // Fetch members — will find the owner row that getUserSite just backfilled
  const members = site ? await getMembers(site.id) : [];

  console.log(`[settings/page] members count=${members.length}`, members.map(m => ({ email: m.user_email, role: m.role })));

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <div className="mb-2 text-base font-semibold text-foreground">Site Settings</div>

        {!site ? (
          <div className="rounded-lg border bg-card p-6">
            <div className="mb-3 text-sm text-muted-foreground">No site connected.</div>
            <a
              href="/platform/create-site"
              className="inline-block rounded-md bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              Create a site →
            </a>
          </div>
        ) : (
          <SettingsClient
            site={site}
            initialMembers={members}
            currentUserId={user.id}
          />
        )}
      </div>
    </>
  );
}