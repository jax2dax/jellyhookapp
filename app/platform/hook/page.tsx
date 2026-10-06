// app/platform/hook/page.tsx
// Hook, the product page. Signed-in users only (getAuthUser redirects),
// with a site (requireSite redirects to create-site / invite otherwise).
// Every run is checked again on the server against the same site
// (lib/actions/hook.action.ts), so nothing here is trusted from the browser.
import type { Metadata } from "next";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { HookWorkspace } from "@/components/hook/HookWorkspace";

export const metadata: Metadata = { title: "Hook" };

export default async function HookPage() {
  const user = await getAuthUser();
  await requireSite(user.id);
  return <HookWorkspace mode="product" />;
}
