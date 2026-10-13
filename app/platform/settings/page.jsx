// app/platform/settings/page.jsx
// Server component — fetches site + members, passes to SettingsClient
// Uses getUserSite (not getSiteSettings) so site_members backfill runs on first load

import { getAuthUser } from "@/lib/actions/permission.actions";
// import { getUserSite } from "@/lib/actions/site-management.actions";
import { getUserSite } from "@/lib/actions/permission.actions";
import { getMySiteRole, getIngestionStatus } from "@/lib/actions/settings.actions";
import { getVisitorCount } from "@/lib/actions/supabase.actions";
import SettingsClient from "./SettingsClients";
import { navFor, resolveTab } from "@/components/nav/navRegistry";

export default async function SettingsPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const user = await getAuthUser(); // redirects to /sign-in if not authed

  // ✅ Use getUserSite NOT getSiteSettings
  // getUserSite checks site_members first, then falls back to sites.user_id
  // and BACKFILLS site_members on the fallback path
  // This means after the first load, site_members always has the owner row
  const site = await getUserSite(user.id);

  const mcpEnabled = process.env.MCP_ENABLED === "1";
  const tab = resolveTab(navFor("/platform/settings"), typeof sp.tab === "string" ? sp.tab : null, { mcp: mcpEnabled });

  console.log(`[settings/page] userId=${user.id} siteId=${site?.id ?? "none"}`);

  // Fetch members — will find the owner row that getUserSite just backfilled
  const visitorCount = site ? await getVisitorCount(site.id) : 0;
  const role = site ? await getMySiteRole(site.id) : null;
  const ingestion = site ? await getIngestionStatus(site.id) : null;


  return (
    <>
      {/* the page title and tabs live in the platform's top bar (components/nav/SecondaryNav.tsx) */}

      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
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
            visitorCount={visitorCount}
            role={role}
            ingestion={ingestion}
            mcpEnabled={mcpEnabled}
            tab={tab}
          />
        )}
      </div>
    </>
  );
}