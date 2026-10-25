// app/platform/layout.jsx
import { getAuthUser, getUserSite, getAllUserSites, getPlanLabel } from "@/lib/actions/permission.actions";
import { getMyProfile } from "@/lib/actions/profile.actions";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { FeedbackAutoPrompt } from "@/components/feedback/FeedbackAutoPrompt";
import { Suspense } from "react";
import { TopBar } from "@/components/nav/TopBar";

// Every page under here requires a signed-in session (getAuthUser() below
// redirects to /sign-in otherwise), so Google could never render the real
// content anyway; noindex is still set explicitly as a second layer beyond
// robots.txt's disallow, in case a URL ever leaks into search results some
// other way (e.g. a link from an external site).
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function PlatformLayout({ children }) {
  const user = await getAuthUser();
  let site, userPlan, allSites, profile;
  try {
    site = await getUserSite(user.id);
    userPlan = await getPlanLabel();
    allSites = await getAllUserSites(user.id);
    profile = await getMyProfile();
  } catch (e) {
    // The database did not answer (or a lookup failed). An error thrown in a layout cannot be caught by
    // app/platform/error.tsx, so show a plain message here instead of the bare "Application error" page.
    console.error("[platform layout] could not load the shell:", e instanceof Error ? e.message : String(e));
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-foreground">Jellyhook could not load</h1>
          <p className="mt-2 text-sm text-muted-foreground">The database did not respond. Your data is safe. Reload the page in a moment.</p>
          <a href="" className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Reload
          </a>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar
        userPlan={userPlan}
        sites={allSites ?? []}
        currentSiteId={site?.id ?? null}
        userProfile={profile}
      />
      <SidebarInset>
        {/* only pages with secondary tabs get a bar; the rest start at the top (components/nav/TopBar.tsx) */}
        <Suspense fallback={null}>
          <TopBar flags={{ mcp: process.env.MCP_ENABLED === "1" }} />
        </Suspense>
        {/* min-w-0: this is a flex column, and flex items don't shrink below
            their content's intrinsic width by default — a page that renders
            something wide (e.g. FramePlateChart's session strip) would grow
            THIS box to match instead of letting that content scroll inside
            its own bounded card, dragging the whole platform shell into
            horizontal scroll. min-w-0 removes that floor. */}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
      {/* Invisible until its own returning-user heuristic decides to show
          itself — see the component for the exact rule. Mounted once here
          so it watches activity across every /platform/* page. */}
      <FeedbackAutoPrompt />
    </SidebarProvider>
  );
}