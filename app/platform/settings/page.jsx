// app/platform/settings/page.jsx
// Settings: a grouped sidebar (Workspace / Tracking / Forms / Integrations, lib/settings/sections.js) and ONE section at a
// time, chosen by ?section= (old ?tab= addresses still work). Server component: fetches the site and what the chosen
// section needs. Uses getUserSite (not getSiteSettings) so the site_members backfill runs on first load.

import { getAuthUser } from "@/lib/actions/permission.actions";
import { getUserSite } from "@/lib/actions/permission.actions";
import { getMySiteRole, getIngestionStatus } from "@/lib/actions/settings.actions";
import { getVisitorCount } from "@/lib/actions/supabase.actions";
import SettingsClient from "./SettingsClients";
import { SettingsShell } from "./SettingsShell";
import { FormFieldsSettings } from "@/components/forms/FormFieldsSettings";
import { loadFormFields } from "@/lib/actions/formFields.action";
import { resolveSection, sectionById, sectionHref, visibleGroups } from "@/lib/settings/sections";

export default async function SettingsPage({ searchParams }) {
  const sp = (await searchParams) ?? {};
  const user = await getAuthUser(); // redirects to /sign-in if not authed

  // getUserSite checks site_members first, then falls back to sites.user_id and BACKFILLS site_members on the fallback
  // path, so after the first load site_members always has the owner row
  const site = await getUserSite(user.id);

  const flags = { mcp: process.env.MCP_ENABLED === "1" };
  const id = resolveSection(typeof sp.section === "string" ? sp.section : typeof sp.tab === "string" ? sp.tab : null, flags);
  const section = sectionById(id);
  const groups = visibleGroups(flags).map((g) => ({ ...g, items: g.items.map((i) => ({ id: i.id, label: i.label, href: sectionHref(i.id) })) }));

  if (!site) {
    return (
      <div className="flex flex-1 flex-col p-6">
        <div className="rounded-lg border bg-card p-6">
          <div className="mb-3 text-sm text-muted-foreground">No site connected.</div>
          <a href="/platform/create-site" className="inline-block rounded-md bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90">
            Create a site →
          </a>
        </div>
      </div>
    );
  }

  // only what the chosen section shows is fetched
  const role = await getMySiteRole(site.id);
  const visitorCount = id === "general" ? await getVisitorCount(site.id) : 0;
  const ingestion = id === "installation" || id === "connection" || id === "attributes" || id === "privacy" ? await getIngestionStatus(site.id) : null;

  return (
    <SettingsShell siteName={site.name || site.domain} groups={groups} active={id} section={section}>
      {id === "fields" ? (
        <FieldsTab focusKey={typeof sp.field === "string" ? sp.field : null} />
      ) : (
        <SettingsClient site={site} visitorCount={visitorCount} role={role} ingestion={ingestion} section={id} />
      )}
    </SettingsShell>
  );
}

// Settings → Form fields (components/forms/FormFieldsSettings.tsx)
async function FieldsTab({ focusKey }) {
  const r = await loadFormFields();
  if (!r.ok) return <p className="text-sm text-red-600">{r.error}</p>;
  return <FormFieldsSettings fields={r.fields} namesReady={r.namesReady} focusKey={focusKey} />;
}
