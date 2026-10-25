// lib/actions/announcements.action.ts
// Updates from Jellyhook to every user (migration 23): shown at the top of Notifications, a red dot (no number) on the
// sidebar item while one is unread. In-app only, never Slack or webhooks. Only the user ids listed in the environment
// variable JELLYHOOK_ADMIN_USER_IDS (comma separated Clerk ids) can send one.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

const isAnnouncer = (userId: string) =>
  (process.env.JELLYHOOK_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);

/** The latest updates, newest first, with whether this person has seen each. `canSend`: this person may post one. */
export async function loadAnnouncements(): Promise<{ ready: boolean; items: Announcement[]; canSend: boolean }> {
  const { userId } = await auth();
  if (!userId) return { ready: false, items: [], canSend: false };
  const [list, reads] = await Promise.all([
    admin.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(20),
    admin.from("announcement_reads").select("announcement_id").eq("user_id", userId),
  ]);
  if (list.error) return { ready: false, items: [], canSend: isAnnouncer(userId) };
  const seen = new Set((reads.data ?? []).map((r) => r.announcement_id as string));
  return {
    ready: true,
    canSend: isAnnouncer(userId),
    items: (list.data ?? []).map((a) => ({ id: a.id as string, title: a.title as string, body: a.body as string, createdAt: a.created_at as string, read: seen.has(a.id as string) })),
  };
}

/** True when this person has an update they have not seen (the red dot). Never throws. */
export async function hasUnreadAnnouncement(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const { data: latest } = await admin.from("announcements").select("id").order("created_at", { ascending: false }).limit(20);
    if (!latest?.length) return false;
    const { data: reads } = await admin.from("announcement_reads").select("announcement_id").eq("user_id", userId).in("announcement_id", latest.map((a) => a.id as string));
    return (reads?.length ?? 0) < latest.length;
  } catch {
    return false;
  }
}

/** Marks every current update as seen by this person. */
export async function markAnnouncementsRead(): Promise<void> {
  try {
    const { userId } = await auth();
    if (!userId) return;
    const { data: latest } = await admin.from("announcements").select("id").order("created_at", { ascending: false }).limit(20);
    if (!latest?.length) return;
    await admin.from("announcement_reads").upsert(latest.map((a) => ({ user_id: userId, announcement_id: a.id as string })), { onConflict: "user_id,announcement_id", ignoreDuplicates: true });
  } catch {
    /* the dot stays until the next try */
  }
}

/** Posts an update to every user (only for the ids in JELLYHOOK_ADMIN_USER_IDS). */
export async function sendAnnouncement(title: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId || !isAnnouncer(userId)) return { ok: false, error: "Only Jellyhook can post updates." };
  const t = String(title ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const b = String(body ?? "").trim().slice(0, 2000);
  if (!t || !b) return { ok: false, error: "Write a title and a message." };
  const { error } = await admin.from("announcements").insert({ title: t, body: b, created_by: userId });
  if (error) return { ok: false, error: /announcements/.test(error.message) ? "Updates are not set up on this database yet (migration 23)." : "The update could not be posted." };
  return { ok: true };
}
