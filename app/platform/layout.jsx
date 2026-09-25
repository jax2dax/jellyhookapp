// app/platform/layout.jsx
import { getAuthUser, getUserSite, getAllUserSites, getPlanLabel } from "@/lib/actions/permission.actions";
import { getMyProfile } from "@/lib/actions/profile.actions";
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/app-sidebar";

export default async function PlatformLayout({ children }) {
  const user = await getAuthUser();
  const site = await getUserSite(user.id);
  const userPlan = await getPlanLabel();
  const allSites = await getAllUserSites(user.id);
  const profile = await getMyProfile();

  return (
    <SidebarProvider>
      <AppSidebar
        userPlan={userPlan}
        sites={allSites ?? []}
        currentSiteId={site?.id ?? null}
        userProfile={profile}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            {/* optional breadcrumb slot */}
          </div>
        </header>
        {/* min-w-0: this is a flex column, and flex items don't shrink below
            their content's intrinsic width by default — a page that renders
            something wide (e.g. FramePlateChart's session strip) would grow
            THIS box to match instead of letting that content scroll inside
            its own bounded card, dragging the whole platform shell into
            horizontal scroll. min-w-0 removes that floor. */}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}