// app/platform/billing/page.tsx
import { getAuthUser } from '@/lib/actions/permission.actions'
import { getCurrentSubscription, getBillingHistory, getUserProfile } from '@/lib/actions/billing.actions'
import BillingClient from './BillingClient'
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'

export default async function BillingPage() {
  const user       = await getAuthUser()
  const [subscription, history, profile] = await Promise.all([
    getCurrentSubscription(),
    getBillingHistory(50),
    getUserProfile(),
  ])

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Billing</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
        <BillingClient
          subscription={subscription}
          history={history}
          profile={profile}
          clerkUserId={user.id}
        />
      </div>
    </>
  )
}