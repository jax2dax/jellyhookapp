import React from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import {currentUser} from "@clerk/nextjs/server";
import {createSupabaseClient} from "@/lib/supabase";
import { addUserDemo } from '@/lib/actions/supabase.actions';
import { loadinfo } from '@/lib/actions/supabase.actions';




const userData = await loadinfo();



const page = async () => {
    const { userId } = await auth();
  const user = await currentUser();
  if (!userId) { redirect('/sign-in')}
  return (
    <div>
      test page
      <div>{userId}</div>
      
      <div>{user?.id}</div>
      <form action={addUserDemo} >
        <input type="text" name="first_name" placeholder="Name" />
         <input type="text" name="last_name" placeholder="Last Name" />
        <input type="email" name="email" placeholder="Email" />
        <button type="submit">Submit</button>
      </form>
      fetched 
      <div>{userData?.first_name}</div>
        <div>{userData?.last_name}</div>
        <div>{userData?.email}</div>
    </div>
  )
}

export default page
