// app/platform/settings/page.jsx
// Server component — fetches site + members, passes to SettingsClient
// Uses getUserSite (not getSiteSettings) so site_members backfill runs on first load

import { getAuthUser } from "@/lib/actions/permission.actions";
import { getUserSite } from "@/lib/actions/site-management.actions";
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
        <div style={{ color: "#fff", fontSize: 16, fontFamily: "monospace", marginBottom: 8 }}>
          Site Settings
        </div>

        {!site ? (
          <div style={{
            padding: 24, background: "#111", border: "1px solid #1a1a1a",
            borderRadius: 8, fontFamily: "monospace",
          }}>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 12 }}>
              No site connected.
            </div>
            <a href="/platform/create-site" style={{
              display: "inline-block", padding: "8px 20px",
              background: "#4ade80", color: "#000",
              borderRadius: 6, fontSize: 12, fontWeight: "bold",
              textDecoration: "none",
            }}>
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