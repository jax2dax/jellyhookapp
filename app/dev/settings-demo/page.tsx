// app/dev/settings-demo/page.tsx
// DEMO with FAKE data: Settings (app/platform/settings) with its grouped sidebar, one section at a time (?section=).
// The same shell, nav and section components as the real page; actions that save need a signed-in site, so they show
// their errors here. Sections: lib/settings/sections.js.
import { SettingsShell } from "@/app/platform/settings/SettingsShell";
import SettingsClientJs from "@/app/platform/settings/SettingsClients";
import type { ComponentType } from "react";
import { FormFieldsSettings } from "@/components/forms/FormFieldsSettings";
import { buildCatalog } from "@/lib/forms/catalog";
import { summarizeHealth } from "@/lib/tracking/health";
import { resolveSection, sectionById, visibleGroups } from "@/lib/settings/sections";

// the real component is plain JS: its props are typed loosely here
const SettingsClient = SettingsClientJs as unknown as ComponentType<Record<string, unknown>>;

const site = {
  id: "3f62d8b1-7817-4556-a475-472de5e14712",
  name: "Jember Techs",
  domain: "jember-techs.vercel.app",
  api_key: "6063080e-4049-4a27-b2e5-e66f272171f4",
  is_active: true,
  specify_form: true,
  created_at: "2026-10-02T09:00:00Z",
};
const healthRows = [
  { page_path: "/", check_key: "conversion_form", details: { forms: 1, marked: 1, wrong_value: 0, wrong_element: 0 }, last_event_at: new Date(Date.now() - 13 * 3600_000).toISOString() },
  { page_path: "/", check_key: "iframe_forms", details: { event_tracked: 0, untracked: 0, providers: [] }, last_event_at: null },
];
const ingestion = {
  role: "owner",
  verified: true,
  claim: null,
  lastEventAt: new Date(Date.now() - 3600_000).toISOString(),
  allowedHosts: ["checkout.jember-techs.com"],
  unmatched: { host: "localhost:3001", at: new Date(Date.now() - 20 * 60_000).toISOString(), count: 36 },
  rotation: { active: false },
  health: summarizeHealth(healthRows, { specifyForm: true }),
};
const demoForms = {
  success: true,
  ready: true,
  canEdit: true,
  specifyForm: true,
  forms: [
    { key: "id:contact", label: "#contact", switch: true, counts: true, mark: null, leads: 29, skipped: 0, page: "/contact", lastSeenAt: new Date().toISOString(), lastSkippedAt: null },
    { key: "hubspot:29478cf5-7fa5-4065-b80d-c8347ee65073", label: "HubSpot form …ee65073", switch: null, counts: false, mark: null, leads: 0, skipped: 3, page: "/contact1", lastSeenAt: new Date().toISOString(), lastSkippedAt: new Date(Date.now() - 20 * 60_000).toISOString() },
    { key: "id:newsletter", label: "#newsletter", switch: false, counts: false, mark: null, leads: 0, skipped: 41, page: "/", lastSeenAt: new Date().toISOString(), lastSkippedAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
    { key: "id:demo", label: "#demo", switch: null, counts: true, mark: "true", leads: 6, skipped: 0, page: "/demo", lastSeenAt: new Date().toISOString(), lastSkippedAt: null },
  ],
};
const fields = buildCatalog(
  [{ form_key: "id:contact", page_path: "/contact", form_fields: [{ key: "email", type: "email", label: "Work email" }, { key: "custom:field_4", type: "text", label: "Monthly budget" }] }],
  [],
  [{ field_4: "$3,000" }],
);

export default async function SettingsDemo({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) ?? {};
  const flags = { mcp: true };
  const id = resolveSection(typeof sp.section === "string" ? sp.section : null, flags);
  const section = sectionById(id)!;
  const groups = visibleGroups(flags).map((g) => ({ ...g, items: g.items.map((i) => ({ id: i.id, label: i.label, href: "/dev/settings-demo" + (i.id === "general" ? "" : "?section=" + i.id) })) }));
  return (
    <SettingsShell siteName={site.name} groups={groups} active={id} section={section}>
      {id === "fields" ? <FormFieldsSettings fields={fields} namesReady focusKey={null} /> : <SettingsClient site={site} visitorCount={1284} role="owner" ingestion={ingestion} section={id} demoForms={demoForms} />}
    </SettingsShell>
  );
}
