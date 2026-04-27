import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
  <main className='flex items-center justify-center mt-20'>
    <SignIn />
    </main>)
}