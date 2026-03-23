import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("page_views")
    .select("*")
    .order("entered_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}