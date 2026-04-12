// app/platform/settings/page.jsx
// Server component — fetches site, passes to client for editing
// Auth: kicks to /sign-in if not logged in
// No site: shows create-site prompt instead of erroring

import { getAuthUser } from "@/lib/actions/permission.actions";
import { getSiteSettings } from "@/lib/actions/supabase.actions";
import SettingsClient from "./SettingsClients"; // client component with forms to edit settings
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default async function SettingsPage() {
  const user = await getAuthUser(); // redirects to /sign-in if not authed
  const site = await getSiteSettings(user.id); // null if no active site

  return (
    <>
      {/* Header */}
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

      {/* Content */}
      <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
        <div style={{ color: "#fff", fontSize: 16, fontFamily: "monospace", marginBottom: 8 }}>
          Site Settings
        </div>

        {!site ? (
          // No site connected — show prompt
          <div style={{
            padding: 24, background: "#111", border: "1px solid #1a1a1a",
            borderRadius: 8, fontFamily: "monospace",
          }}>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 12 }}>
              No site connected.
            </div>
            
              <a href="/platform/create-site"
              style={{
                display: "inline-block", padding: "8px 20px",
                background: "#4ade80", color: "#000",
                borderRadius: 6, fontSize: 12, fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              Create a site →
            </a>
          </div>
        ) : (
          // Site found — render editable settings
          <SettingsClient site={site} />
        )}
      </div>
    </>
  );
}