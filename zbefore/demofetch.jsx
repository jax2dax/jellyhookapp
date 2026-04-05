// actions.js
"use server";
import { revalidatePath } from "next/cache";
import { auth } from '@clerk/nextjs/server'
import { createSupabaseClient } from "@/lib/supabase";

export async function addUserDemo(formData) {
    const { userId } = await auth();

  const supabase = createSupabaseClient();
        const firstName = formData.get("first_name");
        const lastName = formData.get("last_name");
        const email = formData.get("email");
        
 const { error, data } = await supabase.from("users").insert({
    first_name: firstName,
    last_name:lastName,
    email: email,
    id: userId
  });
    
  if (error) {
    console.error("Error inserting user:", error);
    return { success: false, message: error.message };
  }

  revalidatePath("/test");

  return { success: true };

}
export const loadinfo = async ()=>{
    
     const { userId } = await auth();
    const supabase =  createSupabaseClient();
    const { error, data } = await supabase
    .from("users")
    .select('*')
    .eq('id', userId)
    

    if (error) {
        console.error("Error fetching user data:", error);
        return null;
    }
    return data;
}

export const deleteUser = async ()=>{
    
     const { userId } = await auth();
    const supabase =  createSupabaseClient();
    const { error, data } = await supabase
    .from("users")
    .select('*')
    .eq('id', userId)
    

    if (error) {
        console.error("Error deleting user data:", error);
        return null;
    }
    console.log("user deleted succesfully")
}