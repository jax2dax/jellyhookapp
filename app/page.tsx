import React from 'react'
import { SignInButton, SignUpButton, Show , UserButton, SignOutButton, UserProfile } from '@clerk/nextjs'
import Link from 'next/link'

const page = () => {
  return (
    <div>
      <div className='flex items-center gap-8 '>
          <Show when="signed-out">
            <SignInButton />
          </Show>

          <Show when="signed-in">
            <SignOutButton redirectUrl="/">
              <button>Sign out</button>
            </SignOutButton>
            <UserButton />
            <Link href="/test" className='p-4 rounded-2xl border-green-500 border-2 border-solid'>test-</Link>
          </Show>
      </div>
    </div>
  )
}

export default page
