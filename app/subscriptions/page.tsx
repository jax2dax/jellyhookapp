import { PricingTable } from '@clerk/nextjs'
import type { Metadata } from 'next'

import React from 'react'

// Not a public marketing surface — /pricing is the real, indexable pricing
// page. This one is a bare Clerk billing widget with no unique content of
// its own, so it stays out of search results to avoid diluting /pricing
// with a near-duplicate.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

const page = () => {
  return (
    <div>
      <PricingTable fallback={<button className='flex items-center justify-center'>Loading</button>}>

      </PricingTable>
      sumui here
    </div>
  )
}

export default page
