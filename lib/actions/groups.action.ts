// lib/actions/groups.action.ts
// Lead groups: plain boxes of leads ("Deal done"). The site always comes from the server (siteOrThrow), and every action
// checks that the person is an active member and may see the group first; the writes then use the service role.
// Visibility: "team" (every member sees it and can add to it) or "private" (only its creator). Renaming, changing who
// sees it and deleting: its creator, or an owner or admin of the site. At most 30 groups per site.
// Design: mds/build/notifications/groups.md. Tables: mds/migrations/20-groups-and-notifications.sql.
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { isHookError } from "@/jh-hook/errors";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const GROUP_LIMIT = 30;
const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6", "#ef4444", "#64748b"];

export interface GroupView {
  id: string;
  name: string;
  color: string;
  visibility: "team" | "private";
  mine: boolean;
  canEdit: boolean;
  createdByEmail: string | null;
  leadIds: string[];
}

export type GroupsState = { ok: true; ready: boolean; groups: GroupView[]; limit: number } | { ok: false; error: string };
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

class GroupError extends Error {}

const missing = (msg?: string) => !!msg && /lead_groups|lead_group_members/.test(msg) && /does not exist|schema cache|relation/.test(msg);

async function who(): Promise<{ userId: string; siteId: string; role: string }> {
  const { userId } = await auth();
  if (!userId) throw new GroupError("You're signed out. Sign in again.");
  const siteId = await siteOrThrow();
  const { data } = await admin.from("site_members").select("role").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!data) throw new GroupError("You are not a member of this site.");
  return { userId, siteId, role: (data.role as string) ?? "member" };
}

const isAdmin = (role: string) => role === "owner" || role === "admin";

async function visibleGroup(siteId: string, userId: string, id: string) {
  const { data } = await admin.from("lead_groups").select("id, created_by, visibility").eq("site_id", siteId).eq("id", id).maybeSingle();
  if (!data || (data.visibility === "private" && data.created_by !== userId)) throw new GroupError("That group is not there anymore.");
  return data;
}

const fail = (e: unknown, what: string) => {
  if (e instanceof GroupError || isHookError(e)) return { ok: false as const, error: (e as Error).message };
  const msg = e instanceof Error ? e.message : String(e);
  if (missing(msg)) return { ok: false as const, error: "Groups are not set up on this database yet (migration 20)." };
  console.error("[groups] " + what + " failed", msg);
  return { ok: false as const, error: "That did not work. Try again." };
};

/** The groups this person can see, each with its lead ids. */
export async function loadGroups(): Promise<GroupsState> {
  try {
    const { userId, siteId, role } = await who();
    const { data, error } = await admin.from("lead_groups").select("id, name, color, visibility, created_by, created_by_email, created_at").eq("site_id", siteId).order("created_at");
    if (error) {
      if (missing(error.message)) return { ok: true, ready: false, groups: [], limit: GROUP_LIMIT };
      throw new Error(error.message);
    }
    const groups = (data ?? []).filter((g) => g.visibility === "team" || g.created_by === userId);
    const ids = groups.map((g) => g.id as string);
    const members = new Map<string, string[]>();
    for (let i = 0; i < ids.length; i += 1) members.set(ids[i], []);
    if (ids.length) {
      for (let offset = 0; ; offset += 1000) {
        const { data: rows } = await admin.from("lead_group_members").select("group_id, lead_id").in("group_id", ids).order("added_at", { ascending: false }).range(offset, offset + 999);
        for (const r of rows ?? []) members.get(r.group_id as string)?.push(r.lead_id as string);
        if (!rows || rows.length < 1000) break;
      }
    }
    return {
      ok: true,
      ready: true,
      limit: GROUP_LIMIT,
      groups: groups.map((g) => ({
        id: g.id as string,
        name: g.name as string,
        color: g.color as string,
        visibility: g.visibility as "team" | "private",
        mine: g.created_by === userId,
        canEdit: g.created_by === userId || isAdmin(role),
        createdByEmail: (g.created_by_email as string) ?? null,
        leadIds: members.get(g.id as string) ?? [],
      })),
    };
  } catch (e) {
    return fail(e, "load");
  }
}

/** Leads of this site only (anything else is dropped). */
async function ownLeads(siteId: string, leadIds: string[]): Promise<string[]> {
  const ids = [...new Set(leadIds)].slice(0, 1000);
  if (!ids.length) return [];
  const { data } = await admin.from("form_submissions").select("id").eq("site_id", siteId).in("id", ids);
  return (data ?? []).map((r) => r.id as string);
}

/** A new group, optionally with leads in it ("New group from selection"). */
export async function createGroup(name: string, visibility: "team" | "private", leadIds: string[] = []): Promise<Result<{ group: GroupView }>> {
  try {
    const { userId, siteId } = await who();
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!clean) return { ok: false, error: "Give the group a name." };
    const { count } = await admin.from("lead_groups").select("id", { count: "exact", head: true }).eq("site_id", siteId);
    if ((count ?? 0) >= GROUP_LIMIT) return { ok: false, error: `This site has ${GROUP_LIMIT} groups, the most there can be. Delete one to make another.` };
    const email = (await currentUser())?.primaryEmailAddress?.emailAddress ?? null;
    const color = COLORS[(count ?? 0) % COLORS.length];
    const { data, error } = await admin
      .from("lead_groups")
      .insert({ site_id: siteId, name: clean, color, visibility: visibility === "private" ? "private" : "team", created_by: userId, created_by_email: email })
      .select("id, name, color, visibility, created_by_email")
      .single();
    if (error) {
      if (/group_limit/.test(error.message)) return { ok: false, error: `This site has ${GROUP_LIMIT} groups, the most there can be.` };
      throw new Error(error.message);
    }
    const leads = await ownLeads(siteId, leadIds);
    if (leads.length) await admin.from("lead_group_members").upsert(leads.map((lead_id) => ({ group_id: data.id, lead_id, site_id: siteId, added_by: userId })), { onConflict: "group_id,lead_id", ignoreDuplicates: true });
    return { ok: true, group: { id: data.id as string, name: data.name as string, color: data.color as string, visibility: data.visibility as "team" | "private", mine: true, canEdit: true, createdByEmail: email, leadIds: leads } };
  } catch (e) {
    return fail(e, "create");
  }
}

export async function addToGroup(groupId: string, leadIds: string[]): Promise<Result<{ added: number }>> {
  try {
    const { userId, siteId } = await who();
    await visibleGroup(siteId, userId, groupId);
    const leads = await ownLeads(siteId, leadIds);
    if (!leads.length) return { ok: true, added: 0 };
    const { data, error } = await admin
      .from("lead_group_members")
      .upsert(leads.map((lead_id) => ({ group_id: groupId, lead_id, site_id: siteId, added_by: userId })), { onConflict: "group_id,lead_id", ignoreDuplicates: true })
      .select("lead_id");
    if (error) throw new Error(error.message);
    return { ok: true, added: data?.length ?? 0 };
  } catch (e) {
    return fail(e, "add");
  }
}

export async function removeFromGroup(groupId: string, leadIds: string[]): Promise<Result> {
  try {
    const { userId, siteId } = await who();
    await visibleGroup(siteId, userId, groupId);
    const { error } = await admin.from("lead_group_members").delete().eq("group_id", groupId).in("lead_id", leadIds.slice(0, 1000));
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e, "remove");
  }
}

export async function updateGroup(groupId: string, patch: { name?: string; visibility?: "team" | "private" }): Promise<Result> {
  try {
    const { userId, siteId, role } = await who();
    const g = await visibleGroup(siteId, userId, groupId);
    if (g.created_by !== userId && !isAdmin(role)) return { ok: false, error: "Only the group's creator or an admin can change it." };
    const row: Record<string, string> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) {
      const clean = patch.name.trim().replace(/\s+/g, " ").slice(0, 40);
      if (!clean) return { ok: false, error: "Give the group a name." };
      row.name = clean;
    }
    if (patch.visibility) row.visibility = patch.visibility === "private" ? "private" : "team";
    const { error } = await admin.from("lead_groups").update(row).eq("id", groupId).eq("site_id", siteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e, "update");
  }
}

/** Deletes the group (its list); the leads stay. Rules that added to it stop adding (their group becomes none). */
export async function deleteGroup(groupId: string): Promise<Result> {
  try {
    const { userId, siteId, role } = await who();
    const g = await visibleGroup(siteId, userId, groupId);
    if (g.created_by !== userId && !isAdmin(role)) return { ok: false, error: "Only the group's creator or an admin can delete it." };
    const { error } = await admin.from("lead_groups").delete().eq("id", groupId).eq("site_id", siteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e, "delete");
  }
}
