// lib/actions/notifications.action.ts
// Notification rules, the in-app inbox and the outside channels (Slack, webhooks). Rules are assets of the SITE: they
// keep running when their creator leaves; their creator or an owner/admin can change them. A person's notifications are
// theirs only while they are an active member of the site. The site always comes from the server (siteOrThrow).
// Design: mds/build/notifications/. Tables: mds/migrations/20-groups-and-notifications.sql. Firing: lib/notifications/check.ts.
"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { isHookError } from "@/jh-hook/errors";
import { maskUrl, openSecret, sealSecret } from "@/lib/notifications/secret";
import { isSafeWebhookUrl, isSlackUrl, messageOptions, post, type MessageOptions } from "@/lib/notifications/send";
import { fillTemplate } from "@/lib/notifications/decide";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const RULE_LIMIT = 10;
const DEFAULT_BODY = "{lead} matched {marks}";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
class NotifyError extends Error {}

const missing = (msg?: string) => !!msg && /notification|lead_groups/.test(msg) && /does not exist|schema cache|relation/.test(msg);
const isAdmin = (role: string) => role === "owner" || role === "admin";

async function who(): Promise<{ userId: string; siteId: string; role: string }> {
  const { userId } = await auth();
  if (!userId) throw new NotifyError("You're signed out. Sign in again.");
  const siteId = await siteOrThrow();
  const { data } = await admin.from("site_members").select("role").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!data) throw new NotifyError("You are not a member of this site.");
  return { userId, siteId, role: (data.role as string) ?? "member" };
}

const fail = (e: unknown, what: string) => {
  if (e instanceof NotifyError || isHookError(e)) return { ok: false as const, error: (e as Error).message };
  const msg = e instanceof Error ? e.message : String(e);
  if (missing(msg)) return { ok: false as const, error: "Notifications are not set up on this database yet (migration 20)." };
  console.error("[notifications] " + what + " failed", msg);
  return { ok: false as const, error: "That did not work. Try again." };
};

// ── inbox ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  leadId: string | null;
  ruleId: string | null;
  marks: { id: string; name: string; color: string }[];
  createdAt: string;
  readAt: string | null;
}

export async function loadInbox(limit = 100): Promise<Result<{ ready: boolean; items: InboxItem[]; unread: number }>> {
  try {
    const { userId, siteId } = await who();
    const { data, error } = await admin.from("notifications").select("id, title, body, lead_id, rule_id, mark_ids, created_at, read_at").eq("site_id", siteId).eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
    if (error) {
      if (missing(error.message)) return { ok: true, ready: false, items: [], unread: 0 };
      throw new Error(error.message);
    }
    const markIds = [...new Set((data ?? []).flatMap((n) => (n.mark_ids as string[]) ?? []))];
    const marks = new Map<string, { name: string; color: string }>();
    if (markIds.length) {
      const { data: m } = await admin.from("marks").select("id, name, color").eq("site_id", siteId).in("id", markIds);
      for (const r of m ?? []) marks.set(r.id as string, { name: r.name as string, color: r.color as string });
    }
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("site_id", siteId).eq("user_id", userId).is("read_at", null);
    return {
      ok: true,
      ready: true,
      unread: count ?? 0,
      items: (data ?? []).map((n) => ({
        id: n.id as string,
        title: n.title as string,
        body: n.body as string,
        leadId: (n.lead_id as string) ?? null,
        ruleId: (n.rule_id as string) ?? null,
        marks: ((n.mark_ids as string[]) ?? []).filter((id) => marks.has(id)).map((id) => ({ id, ...marks.get(id)! })),
        createdAt: n.created_at as string,
        readAt: (n.read_at as string) ?? null,
      })),
    };
  } catch (e) {
    return fail(e, "inbox");
  }
}

/** The bell's number. 0 when anything is off (never an error on every page). */
export async function unreadCount(): Promise<number> {
  try {
    const { userId, siteId } = await who();
    const { count } = await admin.from("notifications").select("id", { count: "exact", head: true }).eq("site_id", siteId).eq("user_id", userId).is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Mark some (or "all") of the person's notifications as read. */
export async function markRead(ids: string[] | "all"): Promise<Result> {
  try {
    const { userId, siteId } = await who();
    let q = admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("site_id", siteId).eq("user_id", userId).is("read_at", null);
    if (ids !== "all") q = q.in("id", ids.slice(0, 500));
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e, "read");
  }
}

// ── rules ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface RuleView {
  id: string;
  name: string;
  title: string;
  body: string;
  markIds: string[];
  recipients: string[];
  channelIds: string[];
  addToGroupId: string | null;
  active: boolean;
  mine: boolean;
  canEdit: boolean;
  createdByEmail: string | null;
  firedThisWeek: number;
  /** what its Slack message shows (migration 26); every part by default */
  messageOptions: MessageOptions;
}

export interface ChannelView {
  id: string;
  kind: "slack" | "webhook";
  name: string;
  hint: string | null;
  status: "ok" | "failing";
  lastError: string | null;
}

export interface RulesState {
  ready: boolean;
  me: string;
  canManageChannels: boolean;
  rules: RuleView[];
  /** marks the person may put in a rule: their own, switched on (others are listed so the editor can say why not) */
  marks: { id: string; name: string; color: string; active: boolean; mine: boolean; source: string }[];
  members: { userId: string; email: string | null }[];
  groups: { id: string; name: string; color: string }[];
  channels: ChannelView[];
  limit: number;
  /** the most recent ad in the Ads library that has a thumbnail, to preview hook messages with; null when none */
  sampleAd: { title: string; thumbnailUrl: string; videoUrl: string | null; line: string } | null;
}

export async function loadRules(): Promise<Result<{ state: RulesState }>> {
  try {
    const { userId, siteId, role } = await who();
    const [rulesRes, marksRes, membersRes, groupsRes, channelsRes] = await Promise.all([
      ruleRows(siteId),
      admin.from("marks").select("id, name, color, active, created_by, visibility, shared_with, source").eq("site_id", siteId).eq("kind", "lead"),
      admin.from("site_members").select("user_id, user_email").eq("site_id", siteId).eq("status", "active"),
      admin.from("lead_groups").select("id, name, color, visibility, created_by").eq("site_id", siteId).order("created_at"),
      admin.from("notification_channels").select("id, kind, name, hint, status, last_error").eq("site_id", siteId).order("created_at"),
    ]);
    if (rulesRes.error && missing(rulesRes.error.message)) {
      return { ok: true, state: { ready: false, me: userId, canManageChannels: false, rules: [], marks: [], members: [], groups: [], channels: [], limit: RULE_LIMIT, sampleAd: null } };
    }
    for (const r of [rulesRes, membersRes, groupsRes, channelsRes]) if (r.error) throw new Error(r.error.message);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: recent } = await admin.from("notification_events").select("rule_id").eq("site_id", siteId).gte("created_at", weekAgo).limit(5000);
    const fired = new Map<string, number>();
    for (const e of recent ?? []) fired.set(e.rule_id as string, (fired.get(e.rule_id as string) ?? 0) + 1);
    // marks the person can see (theirs, the team's, shared with them)
    const visible = (marksRes.data ?? []).filter((m) => m.created_by === userId || m.visibility === "team" || (m.visibility === "members" && ((m.shared_with as string[]) ?? []).includes(userId)));
    return {
      ok: true,
      state: {
        ready: true,
        me: userId,
        canManageChannels: isAdmin(role),
        limit: RULE_LIMIT,
        rules: (rulesRes.data ?? []).map((r) => ({
          id: r.id as string,
          name: r.name as string,
          title: r.title as string,
          body: r.body as string,
          markIds: (r.mark_ids as string[]) ?? [],
          recipients: (r.recipients as string[]) ?? [],
          channelIds: (r.channel_ids as string[]) ?? [],
          addToGroupId: (r.add_to_group_id as string) ?? null,
          active: !!r.active,
          mine: r.created_by === userId,
          canEdit: r.created_by === userId || isAdmin(role),
          createdByEmail: (r.created_by_email as string) ?? null,
          firedThisWeek: fired.get(r.id as string) ?? 0,
          messageOptions: messageOptions(r.message_options),
        })),
        marks: visible.map((m) => ({ id: m.id as string, name: m.name as string, color: m.color as string, active: !!m.active, mine: m.created_by === userId, source: (m.source as string) ?? "own" })),
        members: (membersRes.data ?? []).filter((m) => !String(m.user_id).startsWith("pending:")).map((m) => ({ userId: m.user_id as string, email: (m.user_email as string) ?? null })),
        groups: (groupsRes.data ?? []).filter((g) => g.visibility === "team" || g.created_by === userId).map((g) => ({ id: g.id as string, name: g.name as string, color: g.color as string })),
        channels: (channelsRes.data ?? []).map((c) => ({ id: c.id as string, kind: c.kind as "slack" | "webhook", name: c.name as string, hint: (c.hint as string) ?? null, status: c.status as "ok" | "failing", lastError: (c.last_error as string) ?? null })),
        sampleAd: await latestAd(siteId),
      },
    };
  } catch (e) {
    return fail(e, "rules");
  }
}

export interface SaveRuleInput {
  id?: string;
  name: string;
  title: string;
  body: string;
  markIds: string[];
  recipients: string[];
  channelIds: string[];
  addToGroupId: string | null;
  messageOptions?: Partial<MessageOptions>;
}

const RULE_COLS = "id, name, title, body, mark_ids, recipients, channel_ids, add_to_group_id, active, created_by, created_by_email, created_at";

/** The site's rules, with their message options when the database has them (migration 26). */
async function ruleRows(siteId: string) {
  const r = await admin.from("notification_rules").select(RULE_COLS + ", message_options").eq("site_id", siteId).order("created_at");
  if (!r.error || !/message_options/.test(r.error.message)) return r as { data: Record<string, unknown>[] | null; error: { message: string } | null };
  return (await admin.from("notification_rules").select(RULE_COLS).eq("site_id", siteId).order("created_at")) as { data: Record<string, unknown>[] | null; error: { message: string } | null };
}

/** The newest ad with a thumbnail (Ads library, migration 25), to preview and test hook messages with. */
async function latestAd(siteId: string): Promise<RulesState["sampleAd"]> {
  const { data, error } = await admin.from("ads").select("platform, ad_id, ad_name, tag, campaign, thumbnail_url, video_url").eq("site_id", siteId).not("thumbnail_url", "is", null).order("last_seen", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  const title = (data.tag as string) || (data.ad_name as string) || (data.ad_id as string);
  return { title, thumbnailUrl: data.thumbnail_url as string, videoUrl: (data.video_url as string) ?? null, line: [data.platform + " · Ads", data.campaign, title].filter(Boolean).join(" · ") };
}

/** Create or change a rule. Marks: the person's own (built or copied), switched on; marks already in the rule may stay. */
export async function saveRule(input: SaveRuleInput): Promise<Result<{ id: string }>> {
  try {
    const { userId, siteId, role } = await who();
    let existing: { created_by: string; mark_ids: string[] } | null = null;
    if (input.id) {
      const { data } = await admin.from("notification_rules").select("created_by, mark_ids").eq("id", input.id).eq("site_id", siteId).maybeSingle();
      if (!data) return { ok: false, error: "That rule is not there anymore." };
      if (data.created_by !== userId && !isAdmin(role)) return { ok: false, error: "Only the rule's creator or an admin can change it." };
      existing = { created_by: data.created_by as string, mark_ids: (data.mark_ids as string[]) ?? [] };
    }
    const name = input.name.trim().slice(0, 60);
    const title = (input.title.trim() || name).slice(0, 80);
    const body = (input.body.trim() || DEFAULT_BODY).slice(0, 300);
    const markIds = [...new Set(input.markIds)].slice(0, 10);
    if (!name) return { ok: false, error: "Give the rule a name." };
    if (!markIds.length) return { ok: false, error: "Pick at least one mark." };

    const { data: marks } = await admin.from("marks").select("id, name, active, created_by, source").eq("site_id", siteId).in("id", markIds);
    const byId = new Map((marks ?? []).map((m) => [m.id as string, m]));
    for (const id of markIds) {
      const m = byId.get(id);
      const keptFromBefore = existing?.mark_ids.includes(id);
      if (!m) return { ok: false, error: "One of the marks is not there anymore." };
      if (!keptFromBefore && m.created_by !== userId) return { ok: false, error: `"${m.name}" is not your mark. Copy it to your marks first.` };
      if (!keptFromBefore && m.source === "connected") return { ok: false, error: `"${m.name}" is connected to a published mark; only your own marks can be used.` };
      if (!m.active) return { ok: false, error: `"${m.name}" is switched off. Turn it on first.` };
    }
    const { data: members } = await admin.from("site_members").select("user_id").eq("site_id", siteId).eq("status", "active");
    const memberSet = new Set((members ?? []).map((m) => m.user_id as string));
    const recipients = [...new Set(input.recipients)].filter((u) => memberSet.has(u));
    const { data: chans } = await admin.from("notification_channels").select("id").eq("site_id", siteId);
    const chanSet = new Set((chans ?? []).map((c) => c.id as string));
    const channelIds = [...new Set(input.channelIds)].filter((c) => chanSet.has(c));
    let addToGroupId: string | null = null;
    if (input.addToGroupId) {
      const { data: g } = await admin.from("lead_groups").select("id, visibility, created_by").eq("id", input.addToGroupId).eq("site_id", siteId).maybeSingle();
      if (!g || (g.visibility === "private" && g.created_by !== userId)) return { ok: false, error: "That group is not there anymore." };
      addToGroupId = g.id as string;
    }
    const base = { name, title, body, mark_ids: markIds, recipients, channel_ids: channelIds, add_to_group_id: addToGroupId, updated_at: new Date().toISOString() };
    // the Slack message's options (migration 26); before it, the rule is saved without them (every part shown)
    let row: Record<string, unknown> = input.messageOptions ? { ...base, message_options: messageOptions(input.messageOptions) } : base;
    const withoutOptions = (e: { message: string } | null) => !!e && /message_options/.test(e.message) && "message_options" in row;
    if (input.id) {
      let { error } = await admin.from("notification_rules").update(row).eq("id", input.id).eq("site_id", siteId);
      if (withoutOptions(error)) ({ error } = await admin.from("notification_rules").update((row = base)).eq("id", input.id).eq("site_id", siteId));
      if (error) throw new Error(error.message);
      return { ok: true, id: input.id };
    }
    const email = (await currentUser())?.primaryEmailAddress?.emailAddress ?? null;
    let { data, error } = await admin.from("notification_rules").insert({ ...row, site_id: siteId, created_by: userId, created_by_email: email, active: true }).select("id").single();
    if (withoutOptions(error)) ({ data, error } = await admin.from("notification_rules").insert({ ...(row = base), site_id: siteId, created_by: userId, created_by_email: email, active: true }).select("id").single());
    if (error) {
      if (/rule_limit/.test(error.message)) return { ok: false, error: `You have ${RULE_LIMIT} rules, the most there can be. Delete one to make another.` };
      throw new Error(error.message);
    }
    return { ok: true, id: data!.id as string };
  } catch (e) {
    return fail(e, "save rule");
  }
}

/**
 * Sends a sample hooked-lead message, exactly as this hook (not yet saved, or saved) would send it, to the Slack
 * channels picked in it: its subject, its message with "a new lead", its options, and where a lead came from (the newest
 * ad with a thumbnail in the Ads library, or an example line). Nothing personal: there is no real lead.
 */
export async function testHookMessage(input: { name: string; title: string; body: string; markIds: string[]; channelIds: string[]; messageOptions?: Partial<MessageOptions> }): Promise<Result<{ sent: number; failed: string[] }>> {
  try {
    const { siteId } = await who();
    const ids = (input.channelIds ?? []).slice(0, 10);
    if (!ids.length) return { ok: false, error: "Pick a Slack channel under Notification method first." };
    const [chans, marks, site, ad] = await Promise.all([
      admin.from("notification_channels").select("id, kind, name, secret, signing_secret").eq("site_id", siteId).in("id", ids),
      admin.from("marks").select("id, name").eq("site_id", siteId).in("id", (input.markIds ?? []).slice(0, 10)),
      admin.from("sites").select("domain").eq("id", siteId).maybeSingle(),
      latestAd(siteId),
    ]);
    const names = (marks.data ?? []).map((m) => m.name as string);
    const now = new Date().toISOString();
    const name = (input.name ?? "").trim() || "New hook";
    const payload = {
      deliveryId: "test_" + randomBytes(6).toString("hex"),
      eventId: "evt_test",
      createdAt: now,
      site: { id: siteId, domain: (site.data?.domain as string) ?? null },
      rule: { id: "test", name: name + " (test)" },
      title: ((input.title ?? "").trim() || name).slice(0, 80),
      body: fillTemplate(input.body ?? "", "a new lead", names.length ? names : ["your marks"]),
      marks: (marks.data ?? []).map((m) => ({ id: m.id as string, name: m.name as string })),
      lead: { id: "test", url: (process.env.NEXT_PUBLIC_APP_URL || "https://jellyhook.com").replace(/\/+$/, "") + "/platform/hooks", submittedAt: now },
      source: ad ? { line: ad.line, ad: { platform: "", adId: "", title: ad.title, thumbnailUrl: ad.thumbnailUrl, videoUrl: ad.videoUrl } } : { line: "Meta · Ads · Spring sale · Example ad (add ads in Acquisition → Ads to see yours)", ad: null },
      options: messageOptions(input.messageOptions),
    };
    let sent = 0;
    const failed: string[] = [];
    for (const c of chans.data ?? []) {
      if (c.kind !== "slack") continue; // webhooks are tested from Integrations
      const r = await post("slack", openSecret(c.secret as string), payload, null);
      if (r.ok) sent++;
      else failed.push(`${c.name}: ${r.error}`);
    }
    if (!sent && !failed.length) return { ok: false, error: "Pick a Slack channel under Notification method first." };
    return { ok: true, sent, failed };
  } catch (e) {
    return fail(e, "test hook message");
  }
}

async function editableRule(siteId: string, userId: string, role: string, id: string) {
  const { data } = await admin.from("notification_rules").select("created_by").eq("id", id).eq("site_id", siteId).maybeSingle();
  if (!data) throw new NotifyError("That rule is not there anymore.");
  if (data.created_by !== userId && !isAdmin(role)) throw new NotifyError("Only the rule's creator or an admin can change it.");
}

export async function setRuleActive(id: string, active: boolean): Promise<Result> {
  try {
    const { userId, siteId, role } = await who();
    await editableRule(siteId, userId, role, id);
    const { error } = await admin.from("notification_rules").update({ active, updated_at: new Date().toISOString() }).eq("id", id).eq("site_id", siteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e, "switch rule");
  }
}

export async function deleteRule(id: string): Promise<Result> {
  try {
    const { userId, siteId, role } = await who();
    await editableRule(siteId, userId, role, id);
    const { error } = await admin.from("notification_rules").delete().eq("id", id).eq("site_id", siteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    return fail(e, "delete rule");
  }
}

// ── outside channels (owners and admins) ────────────────────────────────────────────────────────────────────────────

/** Adds a Slack incoming webhook or a generic webhook. A webhook gets a signing secret, returned once. */
export async function addChannel(kind: "slack" | "webhook", name: string, url: string): Promise<Result<{ channel: ChannelView; signingSecret?: string }>> {
  try {
    const { userId, siteId, role } = await who();
    if (!isAdmin(role)) return { ok: false, error: "Only an owner or admin can add channels." };
    const address = url.trim();
    if (kind === "slack" ? !isSlackUrl(address) : !isSafeWebhookUrl(address)) {
      return { ok: false, error: kind === "slack" ? "That is not a Slack incoming-webhook address (https://hooks.slack.com/services/...)." : "Use an https address with a public host name." };
    }
    const clean = (name.trim() || (kind === "slack" ? "Slack" : "Webhook")).slice(0, 60);
    const signingSecret = kind === "webhook" ? "jhs_" + randomBytes(24).toString("hex") : undefined;
    const { data, error } = await admin
      .from("notification_channels")
      .insert({ site_id: siteId, kind, name: clean, secret: sealSecret(address), hint: maskUrl(address), signing_secret: signingSecret ?? null, created_by: userId })
      .select("id, kind, name, hint, status, last_error")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, signingSecret, channel: { id: data.id as string, kind: data.kind as "slack" | "webhook", name: data.name as string, hint: (data.hint as string) ?? null, status: "ok", lastError: null } };
  } catch (e) {
    return fail(e, "add channel");
  }
}

/** Sends a test message to an address before it is saved, so the person sees it arrive. */
export async function testChannel(kind: "slack" | "webhook", url: string): Promise<Result> {
  try {
    const { siteId, role } = await who();
    if (!isAdmin(role)) return { ok: false, error: "Only an owner or admin can add channels." };
    const { data: site } = await admin.from("sites").select("domain").eq("id", siteId).maybeSingle();
    const now = new Date().toISOString();
    const res = await post(kind, url.trim(), {
      deliveryId: "test_" + randomBytes(6).toString("hex"),
      eventId: "evt_test",
      createdAt: now,
      site: { id: siteId, domain: (site?.domain as string) ?? null },
      rule: { id: "test", name: "Test" },
      title: "Jellyhook test",
      body: "A test from Jellyhook: this channel will get your notifications.",
      marks: [],
      lead: { id: "test", url: (process.env.NEXT_PUBLIC_APP_URL || "https://jellyhook.com") + "/platform/notifications", submittedAt: now },
    }, null);
    return res.ok ? { ok: true } : { ok: false, error: "The test did not arrive: " + res.error + "." };
  } catch (e) {
    return fail(e, "test channel");
  }
}

export async function deleteChannel(id: string): Promise<Result> {
  try {
    const { siteId, role } = await who();
    if (!isAdmin(role)) return { ok: false, error: "Only an owner or admin can remove channels." };
    const { error } = await admin.from("notification_channels").delete().eq("id", id).eq("site_id", siteId);
    if (error) throw new Error(error.message);
    // rules stop sending there
    const { data: rules } = await admin.from("notification_rules").select("id, channel_ids").eq("site_id", siteId).contains("channel_ids", [id]);
    for (const r of rules ?? []) await admin.from("notification_rules").update({ channel_ids: ((r.channel_ids as string[]) ?? []).filter((c) => c !== id) }).eq("id", r.id);
    return { ok: true };
  } catch (e) {
    return fail(e, "delete channel");
  }
}
