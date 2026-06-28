// app/platform/intent/page.tsx
// Server component — fetches data, passes to client panel
import { auth } from '@clerk/nextjs/server'
import { requireSite } from '@/lib/actions/site-management.actions'
import { getIntentFailureAnalysis } from '@/lib/actions/intentFailure.action'
import type { IntentFailureResult } from '@/lib/actions/intentFailure.action'
import IntentPageClient from './IntentPageClient'

export default async function IntentPage() {
  const { userId } = await auth()
  const site = await requireSite(userId)
  const siteId = (site as { id: string }).id

  const data: IntentFailureResult | null = await getIntentFailureAnalysis(siteId)

  return <IntentPageClient initialData={data} siteId={siteId} />
}