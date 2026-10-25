// app/platform/hook/page.tsx
// Hook, the product page. Signed-in users only (getAuthUser redirects),
// with a site (requireSite redirects to create-site / invite otherwise).
// Every run is checked again on the server against the same site
// (lib/actions/hook.action.ts), so nothing here is trusted from the browser.
import type { Metadata } from "next";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { HookWorkspace } from "@/components/hook/HookWorkspace";

// renamed 2026-10-24: what was "Hook" is the Query builder; "Hooks" (/platform/hooks) are now the lead-catching rules. Hidden from the sidebar for now.
export const metadata: Metadata = { title: "Query builder" };

export default async function HookPage() {
  const user = await getAuthUser();
  await requireSite(user.id);
  return <HookWorkspace mode="product" />;
}
