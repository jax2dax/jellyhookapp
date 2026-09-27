import { SignIn } from '@clerk/nextjs'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
}

export default function Page() {
  return (
  <main className='flex items-center justify-center mt-20'>
    <SignIn />
    </main>)
}