import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
//SUPA bAse connect 
export const createSupabaseClient = () => {
    // const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    // const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            async accessToken() {
                return ((await auth()).getToken());
            }
        }

    );
}