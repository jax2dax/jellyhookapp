import { PricingTable } from '@clerk/nextjs'

import React from 'react'

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
