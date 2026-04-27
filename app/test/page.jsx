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
    <div style={{
      padding: 40,
      background: "#0a0a0a",
      minHeight: "100vh",
      fontFamily: "monospace",
    }}>
      <div style={{ color: "#555", fontSize: 11, marginBottom: 24 }}>
        DEBUG — allSites: {allSites?.length ?? 0} | currentSiteId: {currentSite?.id ?? "null"}
      </div>

      <SiteSelector
        sites={allSites ?? []}
        currentSiteId={currentSite?.id ?? null}
      />
    </div>
  );
}