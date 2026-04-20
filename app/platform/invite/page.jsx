// app/platform/invite/page.jsx
// Server component — fetches pending invite details, renders InviteClient
// Redirects to /platform if user has no pending invite

import { getAuthUser } from "@/lib/actions/permission.actions";
import { getPendingInviteDetails } from "@/lib/actions/site-management.actions";
import InviteClient from "./InviteClient";
import { redirect } from "next/navigation";

export default async function InvitePage() {
  const user = await getAuthUser(); // redirects to /sign-in if not authed

  const invite = await getPendingInviteDetails();

  if (!invite) {
    // No pending invite — already accepted, declined, or never existed
    // Redirect to platform (getUserSite will pick up their site normally)
    redirect("/platform");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-background">
      <InviteClient invite={invite} />
    </div>
  );
}