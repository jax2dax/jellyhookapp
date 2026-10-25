// lib/notifications/check.ts
// What happens on the server after a form is submitted (mds/build/notifications/data-flow.md):
//   1. the new lead joins its site's lane (check_jobs);
//   2. whoever holds the site's lease checks the lane's leads in batches of up to 50: their marks (lib/marks/evaluate.ts),
//      then the notification rules (lib/notifications/decide.ts): events, in-app notifications, group adds, deliveries;
//   3. pending deliveries are sent (Slack, webhooks).
// One lease per site (jh_take_site_lease): a flood on one site waits in that site's lane only, and other sites never
// wait for it. A lease ends by itself after 60 seconds, so a crash cannot block a site. Leads left in a lane are picked up
// by the next submission on that site or by the drainer (app/api/jobs/drain, every few seconds with Supabase Cron).
// Before 20-groups-and-notifications.sql has run, the lane does not exist and the marks are checked directly, as before.
import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { evaluateLeads } from "@/lib/marks/evaluate";
import { decide, type LeadIn, type RuleIn } from "./decide";
import { openSecret } from "./secret";
import { post, type DeliveryPayload } from "./send";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const BATCH = 50;
const LEASE_SECONDS = 60;
const COOLDOWN_MS = 24 * 3600_000;
// once per visitor per hook per 24 h (switched off 2026-10-23 for load testing, back on for production 2026-10-24)
const COOLDOWN_ON = true;
const DAILY_EXTERNAL_CAP = 500;
const MAX_ATTEMPTS = 5;
const RETRY_MS = [10_000, 60_000, 5 * 60_000, 30 * 60_000];
const DELIVERY_RETRY_MS = [30_000, 2 * 60_000, 10 * 60_000, 3600_000, 3 * 3600_000];
const FAILING_AFTER = 10;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://jellyhook.com").replace(/\/+$/, "");

const log = (msg: string, extra: Record<string, unknown> = {}) => console.error("[notifications] " + msg, extra);

/** After a form is stored: put the lead in its site's lane and, if nobody is checking that site, check it now. */
export async function checkNewLeads(siteId: string, leadIds: string[]): Promise<void> {
  if (!leadIds.length) return;
  const { error } = await admin.from("check_jobs").upsert(
    leadIds.map((lead_id) => ({ lead_id, site_id: siteId })),
    { onConflict: "lead_id", ignoreDuplicates: true },
  );
  if (error) {
    // the lane is not set up yet (migration 20 not run): the old behaviour, marks only
    if (!/check_jobs/.test(error.message)) log("lane insert failed", { site: siteId.slice(0, 8), error: error.message });
    await evaluateLeads(siteId, leadIds);
    return;
  }
  await runSiteLane(siteId, 8_000);
}

/**
 * Check the site's waiting leads while holding its lease, batch after batch, for at most `budgetMs`. Returns false when
 * another run holds the site (it will pick these leads up).
 */
export async function runSiteLane(siteId: string, budgetMs: number): Promise<boolean> {
  const holder = randomUUID();
  const take = () => admin.rpc("jh_take_site_lease", { p_site: siteId, p_holder: holder, p_seconds: LEASE_SECONDS });
  const first = await take();
  if (first.error || first.data !== true) return false;
  const started = Date.now();
  const deliveries: string[] = [];
  try {
    while (Date.now() - started < budgetMs) {
      const { data: jobs, error } = await admin.from("check_jobs").select("lead_id, attempts, created_at").eq("site_id", siteId).lte("run_after", new Date().toISOString()).order("created_at").limit(BATCH);
      if (error || !jobs?.length) break;
      const ids = jobs.map((j) => j.lead_id as string);
      try {
        const t0 = Date.now();
        const waited = Math.max(...jobs.map((j) => t0 - Date.parse(j.created_at as string)));
        await evaluateLeads(siteId, ids);
        const t1 = Date.now();
        deliveries.push(...(await fireRules(siteId, ids)));
        const t2 = Date.now();
        await admin.from("check_jobs").delete().in("lead_id", ids);
        // timing, for finding what is slow: queue wait (oldest lead), marks, rules + notifications, cleanup
        console.log(`[notifications] batch leads=${ids.length} waited=${waited}ms marks=${t1 - t0}ms rules=${t2 - t1}ms cleanup=${Date.now() - t2}ms`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log("check failed", { site: siteId.slice(0, 8), leads: ids.length, error: msg });
        for (const j of jobs) {
          const attempts = (j.attempts as number) + 1;
          // after the last try the job stays, parked far in the future, for a look by hand
          const wait = attempts >= MAX_ATTEMPTS ? 3650 * 86_400_000 : RETRY_MS[Math.min(attempts - 1, RETRY_MS.length - 1)];
          await admin.from("check_jobs").update({ attempts, last_error: msg.slice(0, 300), run_after: new Date(Date.now() + wait).toISOString() }).eq("lead_id", j.lead_id);
        }
        break;
      }
      await take(); // still checking: keep the lease
    }
  } finally {
    await admin.rpc("jh_release_site_lease", { p_site: siteId, p_holder: holder });
  }
  if (deliveries.length) await sendDeliveries(deliveries);
  return true;
}

/** The notification rules for these (just checked) leads. Returns the ids of the deliveries to send. */
export async function fireRules(siteId: string, leadIds: string[]): Promise<string[]> {
  const { data: ruleRows, error: rulesError } = await admin
    .from("notification_rules")
    .select("id, name, title, body, mark_ids, recipients, channel_ids, add_to_group_id")
    .eq("site_id", siteId)
    .eq("active", true);
  if (rulesError) throw new Error("rules: " + rulesError.message);
  if (!ruleRows?.length) return [];
  const rules: RuleIn[] = ruleRows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    markIds: (r.mark_ids as string[]) ?? [],
    recipients: (r.recipients as string[]) ?? [],
    channelIds: (r.channel_ids as string[]) ?? [],
    addToGroupId: (r.add_to_group_id as string) ?? null,
  }));
  const ruleName = new Map(ruleRows.map((r) => [r.id as string, r.name as string]));
  const allMarkIds = [...new Set(rules.flatMap((r) => r.markIds))];

  const [leadsRes, lmRes, marksRes, membersRes, siteRes] = await Promise.all([
    admin.from("form_submissions").select("id, visitor_id, name, email, submitted_at").eq("site_id", siteId).in("id", leadIds),
    admin.from("lead_marks").select("lead_id, mark_id").eq("site_id", siteId).in("lead_id", leadIds),
    admin.from("marks").select("id, name, active").eq("site_id", siteId).in("id", allMarkIds),
    admin.from("site_members").select("user_id").eq("site_id", siteId).eq("status", "active"),
    admin.from("sites").select("domain").eq("id", siteId).maybeSingle(),
  ]);
  for (const r of [leadsRes, lmRes, marksRes, membersRes]) if (r.error) throw new Error(r.error.message);
  const leads: LeadIn[] = (leadsRes.data ?? []).map((l) => ({ id: l.id as string, visitorId: (l.visitor_id as string) ?? null, name: (l.name as string) ?? null, email: (l.email as string) ?? null }));
  const submittedAt = new Map((leadsRes.data ?? []).map((l) => [l.id as string, (l.submitted_at as string) ?? null]));
  const leadMarks = new Map<string, Set<string>>();
  for (const r of lmRes.data ?? []) {
    const s = leadMarks.get(r.lead_id as string) ?? new Set<string>();
    s.add(r.mark_id as string);
    leadMarks.set(r.lead_id as string, s);
  }
  const marks = new Map((marksRes.data ?? []).map((m) => [m.id as string, { name: m.name as string, active: !!m.active }]));
  const members = (membersRes.data ?? []).map((m) => m.user_id as string).filter((u) => !u.startsWith("pending:"));

  // the cooldown: which of these visitors fired which rule in the last 24 hours
  const visitors = [...new Set(leads.map((l) => l.visitorId).filter((v): v is string => !!v))];
  const recent = new Set<string>();
  if (COOLDOWN_ON && visitors.length) {
    const { data } = await admin
      .from("notification_events")
      .select("rule_id, visitor_id")
      .eq("site_id", siteId)
      .in("rule_id", rules.map((r) => r.id))
      .in("visitor_id", visitors)
      .gte("created_at", new Date(Date.now() - COOLDOWN_MS).toISOString());
    for (const e of data ?? []) recent.add(e.rule_id + "|" + e.visitor_id);
  }

  const { fires, paused } = decide({ rules, leads, leadMarks, marks, recent, members });
  if (paused.length) log("rules paused (a mark is off or gone)", { site: siteId.slice(0, 8), rules: paused.map((p) => p.ruleId.slice(0, 8)) });

  // the bonus: put the lead into the rule's group (also when the cooldown held the notification back)
  const groupAdds = fires.filter((f) => f.addToGroupId).map((f) => ({ group_id: f.addToGroupId, lead_id: f.leadId, site_id: siteId, added_by: null, added_by_rule: f.ruleId }));
  if (groupAdds.length) {
    const { error } = await admin.from("lead_group_members").upsert(groupAdds, { onConflict: "group_id,lead_id", ignoreDuplicates: true });
    if (error) log("group add failed", { site: siteId.slice(0, 8), error: error.message });
  }

  const toNotify = fires.filter((f) => f.notify);
  if (!toNotify.length) return [];
  // one event per rule and lead: a retried check finds it already there and notifies nobody twice
  const { data: events, error: eventsError } = await admin
    .from("notification_events")
    .upsert(toNotify.map((f) => ({ site_id: siteId, rule_id: f.ruleId, lead_id: f.leadId, visitor_id: f.visitorId })), { onConflict: "rule_id,lead_id", ignoreDuplicates: true })
    .select("id, rule_id, lead_id, created_at");
  if (eventsError) throw new Error("events: " + eventsError.message);
  const eventOf = new Map((events ?? []).map((e) => [e.rule_id + "|" + e.lead_id, e]));
  const fresh = toNotify.filter((f) => eventOf.has(f.ruleId + "|" + f.leadId));
  if (!fresh.length) return [];

  const inApp = fresh.flatMap((f) =>
    f.recipients.map((user_id) => ({ site_id: siteId, event_id: eventOf.get(f.ruleId + "|" + f.leadId)!.id, rule_id: f.ruleId, user_id, title: f.title, body: f.body, lead_id: f.leadId, mark_ids: f.markIds })),
  );
  if (inApp.length) {
    const { error } = await admin.from("notifications").insert(inApp);
    if (error) throw new Error("notifications: " + error.message);
    await pingInboxes([...new Set(inApp.map((n) => n.user_id))]);
  }

  // outside Jellyhook: at most DAILY_EXTERNAL_CAP messages per site per day
  const external = fresh.filter((f) => f.channelIds.length);
  if (!external.length) return [];
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count: today } = await admin.from("notification_deliveries").select("id", { count: "exact", head: true }).eq("site_id", siteId).gte("created_at", dayStart.toISOString());
  let room = Math.max(0, DAILY_EXTERNAL_CAP - (today ?? 0));
  const rows = [];
  for (const f of external) {
    const ev = eventOf.get(f.ruleId + "|" + f.leadId)!;
    for (const channel_id of f.channelIds) {
      if (room <= 0) break;
      room--;
      const payload: Omit<DeliveryPayload, "deliveryId"> = {
        eventId: ev.id as string,
        createdAt: ev.created_at as string,
        site: { id: siteId, domain: (siteRes.data?.domain as string) ?? null },
        rule: { id: f.ruleId, name: ruleName.get(f.ruleId) ?? f.title },
        title: f.title,
        body: f.externalBody,
        marks: f.markIds.map((id, i) => ({ id, name: f.markNames[i] })),
        lead: { id: f.leadId, url: `${APP_URL}/platform/leads/${f.leadId}`, submittedAt: submittedAt.get(f.leadId) ?? null },
      };
      rows.push({ site_id: siteId, event_id: ev.id, channel_id, payload });
    }
  }
  if (room <= 0) log("daily cap of outside messages reached", { site: siteId.slice(0, 8) });
  if (!rows.length) return [];
  const { data: made, error } = await admin.from("notification_deliveries").insert(rows).select("id");
  if (error) throw new Error("deliveries: " + error.message);
  return (made ?? []).map((d) => d.id as string);
}

/** Send deliveries (the given ones, or every pending one that is due). Retries with backoff; a channel failing 10 times
 *  in a row is marked failing and its creator is told in Jellyhook. */
export async function sendDeliveries(ids?: string[]): Promise<number> {
  let q = admin.from("notification_deliveries").select("id, site_id, channel_id, attempts, payload").eq("status", "pending").lte("next_attempt_at", new Date().toISOString()).order("created_at").limit(50);
  if (ids?.length) q = q.in("id", ids);
  const { data: list, error } = await q;
  if (error || !list?.length) return 0;
  const channelIds = [...new Set(list.map((d) => d.channel_id as string))];
  const { data: chans } = await admin.from("notification_channels").select("id, site_id, kind, name, secret, signing_secret, consecutive_failures, created_by").in("id", channelIds);
  const channel = new Map((chans ?? []).map((c) => [c.id as string, c]));
  let sent = 0;
  const lastSentAt = new Map<string, number>();
  for (const d of list) {
    const c = channel.get(d.channel_id as string);
    if (!c) continue;
    // at most one message per second per channel (Slack's own limit for a webhook)
    const wait = 1000 - (Date.now() - (lastSentAt.get(c.id as string) ?? 0));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    let url: string;
    try {
      url = openSecret(c.secret as string);
    } catch (e) {
      await admin.from("notification_deliveries").update({ status: "failed", last_error: e instanceof Error ? e.message : "secret" }).eq("id", d.id);
      continue;
    }
    const payload = { ...(d.payload as Omit<DeliveryPayload, "deliveryId">), deliveryId: d.id as string };
    const res = await post(c.kind as "slack" | "webhook", url, payload, (c.signing_secret as string) ?? null);
    lastSentAt.set(c.id as string, Date.now());
    const attempts = (d.attempts as number) + 1;
    if (res.ok) {
      sent++;
      await admin.from("notification_deliveries").update({ status: "sent", attempts, response_code: res.status, sent_at: new Date().toISOString(), last_error: null }).eq("id", d.id);
      if ((c.consecutive_failures as number) > 0) await admin.from("notification_channels").update({ consecutive_failures: 0, status: "ok", last_error: null }).eq("id", c.id);
      continue;
    }
    const last = attempts >= DELIVERY_RETRY_MS.length;
    await admin
      .from("notification_deliveries")
      .update({ status: last ? "failed" : "pending", attempts, response_code: res.status, last_error: res.error, next_attempt_at: new Date(Date.now() + DELIVERY_RETRY_MS[Math.min(attempts - 1, DELIVERY_RETRY_MS.length - 1)]).toISOString() })
      .eq("id", d.id);
    const failures = (c.consecutive_failures as number) + 1;
    c.consecutive_failures = failures;
    await admin.from("notification_channels").update({ consecutive_failures: failures, last_error: res.error, ...(failures >= FAILING_AFTER ? { status: "failing" } : {}) }).eq("id", c.id);
    if (failures === FAILING_AFTER) {
      await admin.from("notifications").insert({ site_id: c.site_id, user_id: c.created_by, title: "A channel is failing", body: `${c.name} has failed ${FAILING_AFTER} times in a row (${res.error}). Check it in Hooks, Integrations.` });
    }
  }
  return sent;
}

/** The drainer: sites with waiting leads, a few at a time, then the due deliveries. */
export async function drain(maxSites = 4): Promise<{ sites: number; sent: number }> {
  const { data } = await admin.from("check_jobs").select("site_id").lte("run_after", new Date().toISOString()).order("created_at").limit(500);
  const sites = [...new Set((data ?? []).map((r) => r.site_id as string))].slice(0, maxSites);
  await Promise.all(sites.map((s) => runSiteLane(s, 20_000)));
  const sent = await sendDeliveries();
  return { sites: sites.length, sent };
}

/** The channel a person's bell listens on (components/notifications/UnreadBadge.tsx). */
export function inboxChannel(userId: string): string {
  return "jh-inbox:" + userId;
}

/**
 * Tells each person's open tabs "you have something new" through Realtime Broadcast (one small REST call each, no
 * database work). The ping carries nothing: the tab then asks the server for its unread count, which checks who is asking.
 * Never fails the check: a missed ping only means the bell updates on its next poll (within a minute).
 */
async function pingInboxes(userIds: string[]): Promise<void> {
  await Promise.allSettled(
    userIds.map(async (u) => {
      const ch = admin.channel(inboxChannel(u));
      try {
        await ch.httpSend("new", {}, { timeout: 3000 });
      } finally {
        admin.removeChannel(ch);
      }
    }),
  );
}
