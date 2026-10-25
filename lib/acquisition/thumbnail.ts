// lib/acquisition/thumbnail.ts
// An ad's thumbnail, stored in the site's own storage (bucket "ad-thumbnails", migration 25): the ad networks' image
// links expire after a few days, so a copy is kept. Resized to at most 640 px wide (JPEG, about 50 KB), under an
// unguessable name (Slack must be able to load it, so the bucket is public). Server only.
import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { isSafeWebhookUrl } from "@/lib/notifications/send";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BUCKET = "ad-thumbnails";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class ThumbnailError extends Error {}

/** Fetches an image from a public https address (redirects followed and re-checked, 5 MB at most, 10 s). */
export async function fetchImage(url: string): Promise<Buffer> {
  let current = url.trim();
  for (let hop = 0; hop < 4; hop++) {
    // a public https host only: never the server's own network (same rule as webhooks)
    if (!isSafeWebhookUrl(current)) throw new ThumbnailError("Use an https link to an image on a public website.");
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Jellyhook-Thumbnail/1" } });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    if (!res.ok) throw new ThumbnailError(`That link answered ${res.status}. If it is a Meta or Google image link, it may have expired: download the image and upload it instead.`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) throw new ThumbnailError("That link is not an image.");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_IMAGE_BYTES) throw new ThumbnailError("The image is larger than 5 MB.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw new ThumbnailError("The image is larger than 5 MB.");
    return buf;
  }
  throw new ThumbnailError("Too many redirects.");
}

/** Resizes and stores an image as the ad's thumbnail; removes the previous one. Returns the public address. */
export async function storeThumbnail(siteId: string, platform: string, adId: string, image: Buffer, userId: string): Promise<string> {
  let jpeg: Buffer;
  try {
    jpeg = await sharp(image, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  } catch {
    throw new ThumbnailError("That file could not be read as an image (JPEG, PNG or WebP).");
  }
  const { data: row } = await admin.from("ads").select("thumbnail_path").eq("site_id", siteId).eq("platform", platform).eq("ad_id", adId).maybeSingle();
  if (!row) throw new ThumbnailError("That ad is not in your Ads library.");
  const path = `${siteId}/${randomBytes(16).toString("hex")}.jpg`;
  const up = await admin.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new ThumbnailError(/bucket/i.test(up.error.message) ? "Ad thumbnails are not set up on this database yet (migration 25)." : "The image could not be stored.");
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await admin.from("ads").update({ thumbnail_path: path, thumbnail_url: url, updated_by: userId }).eq("site_id", siteId).eq("platform", platform).eq("ad_id", adId);
  if (error) throw new ThumbnailError("The ad could not be updated.");
  if (row.thumbnail_path) await admin.storage.from(BUCKET).remove([row.thumbnail_path as string]);
  return url;
}

export async function removeThumbnail(siteId: string, platform: string, adId: string): Promise<void> {
  const { data: row } = await admin.from("ads").select("thumbnail_path").eq("site_id", siteId).eq("platform", platform).eq("ad_id", adId).maybeSingle();
  await admin.from("ads").update({ thumbnail_path: null, thumbnail_url: null }).eq("site_id", siteId).eq("platform", platform).eq("ad_id", adId);
  if (row?.thumbnail_path) await admin.storage.from(BUCKET).remove([row.thumbnail_path as string]);
}
