import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createSupabaseClient();

    // get user's sites
    const { data: sites, error: sitesError } = await supabase
      .from("sites")
      .select("id")
      .eq("user_id", userId);

    if (sitesError) {
      return NextResponse.json({ error: sitesError.message }, { status: 500 });
    }

    const siteIds = sites.map((s) => s.id);

    // get visitors
  const { data: pageViews, error } = await supabase
  .from("page_views")
  .select("*")
  .in("site_id", siteIds)
  .order("entered_at", { ascending: false });

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}

return NextResponse.json({ pageViews });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  
}