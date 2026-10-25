// lib/actions/ads.action.ts
// The Ads library (migration 25): every ad a click came from, with what the team adds to it (tag, video link,
// thumbnail). Any active member of the site can edit. File uploads go through app/api/ads/thumbnail (server actions
// accept only 1 MB). Plan: mds/build/acquisition/plan.md.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { fetchImage, removeThumbnail, storeThumbnail, ThumbnailError } from "@/lib/acquisition/thumbnail";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface AdView {
  platform: string;
  adId: string;
  adName: string | null;
  campaign: string | null;
  tag: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  clicks: number;
  firstSeen: string;
  lastSeen: string;
}

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function member(): Promise<{ userId: string; siteId: string }> {
  const { userId } = await auth();
  if (!userId) throw new ThumbnailError("You're signed out. Sign in again.");
  const siteId = await siteOrThrow();
  const { data } = await admin.from("site_members").select("user_id").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!data) throw new ThumbnailError("You are not a member of this site.");
  return { userId, siteId };
}

const fail = (e: unknown, what: string) => {
  if (e instanceof ThumbnailError) return { ok: false as const, error: e.message };
  const msg = e instanceof Error ? e.message : String(e);
  if (/relation .*ads|ads.*does not exist|schema cache/.test(msg)) return { ok: false as const, error: "The Ads library is not set up on this database yet (migration 25)." };
  console.error("[ads] " + what + " failed", msg);
  return { ok: false as const, error: "That did not work. Try again." };
};

export async function listAds(): Promise<R<{ ready: boolean; ads: AdView[] }>> {
  try {
    const { siteId } = await member();
    const { data, error } = await admin.from("ads").select("platform, ad_id, ad_name, campaign, tag, video_url, thumbnail_url, clicks, first_seen, last_seen").eq("site_id", siteId).order("last_seen", { ascending: false }).limit(500);
    if (error) {
      if (/ads/.test(error.message)) return { ok: true, ready: false, ads: [] };
      throw new Error(error.message);
    }
    return {
      ok: true,
      ready: true,
      ads: (data ?? []).map((a) => ({
        platform: a.platform as string,
        adId: a.ad_id as string,
        adName: (a.ad_name as string) ?? null,
        campaign: (a.campaign as string) ?? null,
        tag: (a.tag as string) ?? null,
        videoUrl: (a.video_url as string) ?? null,
        thumbnailUrl: (a.thumbnail_url as string) ?? null,
        clicks: (a.clicks as number) ?? 0,
        firstSeen: a.first_seen as string,
        lastSeen: a.last_seen as string,
      })),
    };
  } catch (e) {
    return fail(e, "list");
  }
}

const okLink = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
};

/** Sets the ad's internal tag and video link (empty clears them). */
export async function updateAd(platform: string, adId: string, patch: { tag?: string; videoUrl?: string }): Promise<R> {
  try {
    const { userId, siteId } = await member();
    const row: Record<string, string | null> = { updated_by: userId };
    if (patch.tag !== undefined) row.tag = patch.tag.replace(/\s+/g, " ").trim().slice(0, 80) || null;
    if (patch.videoUrl !== undefined) {
      const v = patch.videoUrl.trim();
      if (v && !okLink(v)) return { ok: false, error: "The video link must start with https://" };
      row.video_url = v.slice(0, 1000) || null;
    }
    const { error } = await admin.from("ads").update(row).eq("site_id", siteId).eq("platform", platform).eq("ad_id", adId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e, "update");
  }
}

/** Copies an image from a link into the ad's thumbnail (the ad networks' own links expire). */
export async function thumbnailFromLink(platform: string, adId: string, url: string): Promise<R<{ thumbnailUrl: string }>> {
  try {
    const { userId, siteId } = await member();
    const image = await fetchImage(url);
    return { ok: true, thumbnailUrl: await storeThumbnail(siteId, platform, adId, image, userId) };
  } catch (e) {
    return fail(e, "thumbnail link");
  }
}

export async function clearThumbnail(platform: string, adId: string): Promise<R> {
  try {
    const { siteId } = await member();
    await removeThumbnail(siteId, platform, adId);
    return { ok: true };
  } catch (e) {
    return fail(e, "thumbnail remove");
  }
}
