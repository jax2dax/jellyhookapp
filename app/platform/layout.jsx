// app/platform/layout.jsx
import { getAuthUser, getUserSite, getAllUserSites, getPlanLabel } from "@/lib/actions/permission.actions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function PlatformLayout({ children }) {
  const user = await getAuthUser();
  const site = await getUserSite(user.id);
  const userPlan = await getPlanLabel();
  const allSites = await getAllUserSites(user.id);

  return (
    <SidebarProvider>
      <AppSidebar
        userPlan={userPlan}
        sites={allSites ?? []}
        currentSiteId={site?.id ?? null}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}