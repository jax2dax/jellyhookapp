// ❌ DO NOT ADD 'use client' HERE

import { auth } from '@clerk/nextjs/server'
import { requireSite } from '@/lib/actions/site-management.actions'
import { getIntentFailureAnalysis } from '@/lib/actions/intentFailure.action'
import IntentFailurePanel from './intentFailurePanel'

export default async function IntentPage() {
  const { userId } = await auth()
  const site = await requireSite(userId)

  const data = await getIntentFailureAnalysis((site as { id: string }).id)

  console.log("🔥 SERVER DATA:", data) // ← YOU SHOULD SEE THIS

  return (
    <div className="p-6">
      <IntentFailurePanel data={data} />
    </div>
  )
}