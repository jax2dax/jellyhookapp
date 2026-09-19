// app/platform/test-selector/page.jsx
// Temporary test page — delete after confirming SiteSelector works
import { getAuthUser, getAllUserSites, getUserSite } from "@/lib/actions/permission.actions";
import SiteSelector from "@/components/SiteSelector";

export default async function TestSelectorPage() {
  const user = await getAuthUser();

  const [allSites, currentSite] = await Promise.all([
    getAllUserSites(user.id),
    getUserSite(user.id),
  ]);

  console.log("[test-selector] allSites:", allSites?.length, "currentSiteId:", currentSite?.id);

  return (
    <div className="min-h-screen bg-background p-10">
      <div className="mb-6 text-xs text-muted-foreground">
        DEBUG — allSites: {allSites?.length ?? 0} | currentSiteId: {currentSite?.id ?? "null"}
      </div>

      <SiteSelector
        sites={allSites ?? []}
        currentSiteId={currentSite?.id ?? null}
      />
    </div>
  );
}