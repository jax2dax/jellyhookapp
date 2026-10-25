// app/api/ads/thumbnail/route.ts
// Uploads an ad's thumbnail from a file (multipart: platform, adId, file). A route, not a server action, because server
// actions accept only 1 MB. Signed-in member of the site only. Resized and stored by lib/acquisition/thumbnail.ts.
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { MAX_IMAGE_BYTES, storeThumbnail, ThumbnailError } from "@/lib/acquisition/thumbnail";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false, error: "You're signed out. Sign in again." }, { status: 401 });
  let siteId: string;
  try {
    siteId = await siteOrThrow();
  } catch {
    return NextResponse.json({ ok: false, error: "No site is available." }, { status: 400 });
  }
  const { data: member } = await admin.from("site_members").select("user_id").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!member) return NextResponse.json({ ok: false, error: "You are not a member of this site." }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const platform = String(form?.get("platform") ?? "").slice(0, 60);
  const adId = String(form?.get("adId") ?? "").slice(0, 200);
  if (!(file instanceof File) || !platform || !adId) return NextResponse.json({ ok: false, error: "Pick an image." }, { status: 400 });
  if (!TYPES.has(file.type)) return NextResponse.json({ ok: false, error: "Use a JPEG, PNG or WebP image." }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ ok: false, error: "The image is larger than 5 MB." }, { status: 400 });
  try {
    const url = await storeThumbnail(siteId, platform, adId, Buffer.from(await file.arrayBuffer()), userId);
    return NextResponse.json({ ok: true, thumbnailUrl: url });
  } catch (e) {
    if (e instanceof ThumbnailError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    console.error("[ads] thumbnail upload failed", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: "The image could not be stored." }, { status: 500 });
  }
}
