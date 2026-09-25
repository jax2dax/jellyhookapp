// app/platform/user/page.tsx
// Personal account page — the user's own name/email/phone/avatar and
// account-level facts (plan, how many sites, billing, member since). Never
// anything site-specific (domain, API key, tracker) — that stays on
// /platform/settings. Reached from the sidebar's account popover.
import { getAuthUser, getAllUserSites } from "@/lib/actions/permission.actions";
import { getMyProfile } from "@/lib/actions/profile.actions";
import { getCurrentSubscription } from "@/lib/actions/billing.actions";
import UserPageClient from "./UserPageClient";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

export default async function UserPage() {
  const authUser = await getAuthUser();
  const [profile, sites, subscription] = await Promise.all([getMyProfile(), getAllUserSites(authUser.id), getCurrentSubscription()]);

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Account</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
        <UserPageClient
          profile={
            profile ?? {
              id: authUser.id,
              email: null,
              first_name: null,
              last_name: null,
              phone: null,
              pfp: null,
              created_at: null,
            }
          }
          siteCount={sites?.length ?? 0}
          subscription={subscription}
        />
      </div>
    </>
  );
}
