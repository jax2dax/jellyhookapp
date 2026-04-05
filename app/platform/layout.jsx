// platform/layout.jsx
import { getAuthUser, getUserSite } from "@/lib/actions/permission.actions";
import { redirect } from "next/navigation";
import PlatformSidebar from "@/components/PlatformSidebar";

export default async function PlatformLayout({ children }) {
  // Auth check — redirects to /sign-in if not logged in
  const user = await getAuthUser();

  // Get their site — null if none created yet
  const site = await getUserSite(user.id);

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <PlatformSidebar userPlan={site?.plan || "free"} />
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}