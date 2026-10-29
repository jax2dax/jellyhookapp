// lib/notifications/check.ts
// What happens on the server after a form is submitted (mds/build/notifications/data-flow.md):
//   1. the new lead joins its site's lane (check_jobs);
//   2. whoever holds the site's lease checks the lane's leads in batches of up to 50: the marks live hooks use
//      (lib/marks/evaluate.ts, all v2 marks in one read of the leads' history), then the notification rules
//      (lib/notifications/decide.ts): events, in-app notifications, group adds, deliveries;
//   3. that batch's deliveries are sent at once (Slack, webhooks);
//   4. after the lease is released, the site's other marks (the ones no live hook uses) are checked for those leads.
// Steps 2 to 4 were reordered in v2 of the crowd tests (mds/crowd-test/roadmap.md): before, every mark was checked
// first, one by one, and messages were sent only when the lane was empty.
// One lease per site (jh_take_site_lease): a flood on one site waits in that site's lane only, and other sites never
// wait for it. A lease ends by itself after 60 seconds, so a crash cannot block a site. Leads left in a lane are picked up
// by the next submission on that site or by the drainer (app/api/jobs/drain, every few seconds with Supabase Cron).
// Before 20-groups-and-notifications.sql has run, the lane does not exist and the marks are checked directly, as before.
import "server-only";
import { randomUUID } from "node:crypto";
import { meteredAdmin } from "@/lib/db/admin";
import { evaluateLeads } from "@/lib/marks/evaluate";
import { continueBackfills } from "@/lib/marks/backfill";
import { continueMarkQueues, enqueueMarks, runMarkQueue } from "@/lib/marks/queue";
import { takeMarkWork } from "@/lib/marks/work";
import { continueRetention } from "@/lib/privacy/retention";
import { decide, type LeadIn, type RuleIn } from "./decide";
import { openSecret } from "./secret";
import { messageOptions, post, type DeliveryPayload } from "./send";
import { leadSources } from "@/lib/acquisition/leadSource";
import { summariesWithin } from "./summary";
import { metered, newMeter } from "@/lib/metrics/meter";
import { recordRun } from "@/lib/metrics/runs";
import { connectionOf, hubspotLeadLink } from "@/lib/integrations/hubspot";
import { formKeyLabel } from "@/lib/tracking/formKey";

const admin = meteredAdmin();

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
// the visit and page summaries may hold the outside messages this long at most; past it they go without them
const SUMMARY_BUDGET_MS = 2500;
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
/**
 * The marks that live hooks use. They are checked first, so a hook never waits for marks no hook uses. Null when the
 * hooks cannot be read: then every mark is checked first, as before v2.
 */
async function liveHookMarks(siteId: string): Promise<string[] | null> {
  const { data, error } = await admin.from("notification_rules").select("mark_ids").eq("site_id", siteId).eq("active", true);
  if (error) return null;
  return [...new Set((data ?? []).flatMap((r) => (r.mark_ids as string[] | null) ?? []))];
}

export async function runSiteLane(siteId: string, budgetMs: number): Promise<boolean> {
  const holder = randomUUID();
  const take = () => admin.rpc("jh_take_site_lease", { p_site: siteId, p_holder: holder, p_seconds: LEASE_SECONDS });
  const first = await take();
  if (first.error || first.data !== true) return false;
  const started = Date.now();
  // leads whose other marks (the ones no live hook uses) are checked after the lane is released
  const rest: string[] = [];
  let hookMarks: string[] | null = null;
  try {
    hookMarks = await liveHookMarks(siteId);
    while (Date.now() - started < budgetMs) {
      const { data: jobs, error } = await admin.from("check_jobs").select("lead_id, attempts, created_at").eq("site_id", siteId).lte("run_after", new Date().toISOString()).order("created_at").limit(BATCH);
      if (error || !jobs?.length) break;
      const ids = jobs.map((j) => j.lead_id as string);
      // the batch's work is measured (lib/metrics/meter.ts) and recorded for the control room (pipeline_runs)
      const meter = newMeter();
      const stats = { marks: 0, rules: 0, fires: 0 };
      const t0 = Date.now();
      const waited = Math.max(...jobs.map((j) => t0 - Date.parse(j.created_at as string)));
      let t1 = t0;
      let t2 = t0;
      let made: string[] = [];
      try {
        await metered(meter, async () => {
          // v2: first only the marks live hooks use (all marks when the hooks could not be read), strictly: a mark that
          // cannot be checked fails the batch, which is tried again later, so a hook is delayed, never skipped
          stats.marks = await evaluateLeads(siteId, ids, hookMarks ? { only: hookMarks, strict: true } : { strict: true });
          // never held back by the mark budget, but counted: the background gets less this minute (lib/marks/work.ts)
          if (stats.marks) await takeMarkWork(siteId, ids.length * stats.marks, true);
          t1 = Date.now();
          made = await fireRules(siteId, ids, stats);
          t2 = Date.now();
        });
        await admin.from("check_jobs").delete().in("lead_id", ids);
        if (hookMarks) rest.push(...ids);
        // timing, for finding what is slow: queue wait (oldest lead), marks, rules + notifications, cleanup
        console.log(`[notifications] batch leads=${ids.length} waited=${waited}ms marks=${t1 - t0}ms rules=${t2 - t1}ms cleanup=${Date.now() - t2}ms db=${meter.calls} calls`);
        await recordRun({ site_id: siteId, kind: "leads", leads: ids.length, marks: stats.marks, hooks: stats.rules, fires: stats.fires, deliveries: made.length, wait_ms: waited, marks_ms: t1 - t0, hooks_ms: t2 - t1, total_ms: Date.now() - t0 }, meter);
        // v2: this batch's messages go now, not after the whole lane is empty (an early message no longer waits for
        // later batches)
        if (made.length) await sendDeliveries(made).catch((e) => log("send failed", { site: siteId.slice(0, 8), error: e instanceof Error ? e.message : String(e) }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await recordRun({ site_id: siteId, kind: "leads", leads: ids.length, marks: stats.marks, hooks: stats.rules, wait_ms: waited, total_ms: Date.now() - t0, error: msg }, meter);
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
  // A lead that joined the lane after this run's last read found the lease taken and left its lead to this run. Look
  // once more after releasing, before the other marks, so its hook does not wait for the drainer or the site's next form.
  const left = budgetMs - (Date.now() - started);
  if (left > 1000) {
    const { data: late } = await admin.from("check_jobs").select("lead_id").eq("site_id", siteId).lte("run_after", new Date().toISOString()).limit(1);
    if (late?.length) await runSiteLane(siteId, left);
  }
  // The marks no live hook uses, for the leads just checked. Since migration 34: into the background queue
  // (lib/marks/queue.ts), which gives way to the hook lane and to the minute's mark budget, and is run right here with
  // what is left of the time. Before it (v2): checked right here, after the lease, not strictly.
  if (rest.length && (await enqueueMarks(siteId, rest))) {
    await runMarkQueue(siteId, Math.max(5_000, budgetMs - (Date.now() - started)));
  } else if (rest.length) {
    const meter = newMeter();
    const t0 = Date.now();
    const n = await metered(meter, () => evaluateLeads(siteId, rest, { except: hookMarks ?? [] }));
    console.log(`[notifications] other marks leads=${rest.length} marks=${n} ms=${Date.now() - t0} db=${meter.calls} calls`);
    if (n) await recordRun({ site_id: siteId, kind: "other_marks", leads: rest.length, marks: n, total_ms: Date.now() - t0 }, meter);
  }
  return true;
}

/** The notification rules for these (just checked) leads. Returns the ids of the deliveries to send. */
/** `stats` (optional) is filled with how many live hooks were compared and how many notifications were made. */
export async function fireRules(siteId: string, leadIds: string[], stats?: { rules: number; fires: number }): Promise<string[]> {
  const cols = "id, name, title, body, mark_ids, recipients, channel_ids, add_to_group_id";
  let { data: ruleRows, error: rulesError } = (await admin.from("notification_rules").select(cols + ", message_options").eq("site_id", siteId).eq("active", true)) as { data: Record<string, unknown>[] | null; error: { message: string } | null };
  // before 26-hook-message-options.sql: every part of the message is shown
  if (rulesError && /message_options/.test(rulesError.message)) ({ data: ruleRows, error: rulesError } = (await admin.from("notification_rules").select(cols).eq("site_id", siteId).eq("active", true)) as { data: Record<string, unknown>[] | null; error: { message: string } | null });
  if (rulesError) throw new Error("rules: " + rulesError.message);
  if (stats) stats.rules = ruleRows?.length ?? 0;
  if (!ruleRows?.length) return [];
  const rules: RuleIn[] = ruleRows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    body: r.body as string,
    markIds: (r.mark_ids as string[]) ?? [],
    recipients: (r.recipients as string[]) ?? [],
    channelIds: (r.channel_ids as string[]) ?? [],
    addToGroupId: (r.add_to_group_id as string) ?? null,
    repeat: messageOptions(r.message_options).repeat,
  }));
  const ruleName = new Map(ruleRows.map((r) => [r.id as string, r.name as string]));
  const ruleOptions = new Map(ruleRows.map((r) => [r.id as string, messageOptions(r.message_options)]));
  const allMarkIds = [...new Set(rules.flatMap((r) => r.markIds))];

  const [leadsRes, lmRes, marksRes, membersRes, siteRes] = await Promise.all([
    admin.from("form_submissions").select("*").eq("site_id", siteId).in("id", leadIds),
    admin.from("lead_marks").select("lead_id, mark_id").eq("site_id", siteId).in("lead_id", leadIds),
    admin.from("marks").select("id, name, active").eq("site_id", siteId).in("id", allMarkIds),
    admin.from("site_members").select("user_id").eq("site_id", siteId).eq("status", "active"),
    admin.from("sites").select("domain").eq("id", siteId).maybeSingle(),
  ]);
  for (const r of [leadsRes, lmRes, marksRes, membersRes]) if (r.error) throw new Error(r.error.message);
  const leads: LeadIn[] = (leadsRes.data ?? []).map((l) => ({ id: l.id as string, visitorId: (l.visitor_id as string) ?? null, name: (l.name as string) ?? null, email: (l.email as string) ?? null }));
  const submittedAt = new Map((leadsRes.data ?? []).map((l) => [l.id as string, (l.submitted_at as string) ?? null]));
  // the form each lead sent (form_key, migration 28; absent before it)
  const formOf = new Map((leadsRes.data ?? []).filter((l) => typeof l.form_key === "string" && l.form_key).map((l) => [l.id as string, { key: l.form_key as string, label: formKeyLabel(l.form_key as string) }]));
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
  if (stats) stats.fires = fresh.length;
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
  // where each lead came from (the ad, its tag, thumbnail and video from the Ads library) and, when the hook asks, what
  // they did before sending the form (lib/notifications/summary.ts): read together, in parallel. The summaries have a
  // time budget and never fail the run; the in-app notifications above never wait for either.
  const externalIds = new Set(external.map((f) => f.leadId));
  const externalLeads = (leadsRes.data ?? [])
    .filter((l) => externalIds.has(l.id as string))
    .map((l) => ({ id: l.id as string, visitor_id: (l.visitor_id as string) ?? null, session_id: (l.session_id as string) ?? null, submitted_at: l.submitted_at as string }));
  // with HubSpot connected (and healthy), the lead's button opens its HubSpot contact: a signed Jellyhook link resolved
  // at the click (app/go/hubspot), so nothing waits on HubSpot here
  const [sources, summaries, hubspot] = await Promise.all([
    leadSources(siteId, externalLeads, (siteRes.data?.domain as string) ?? null).catch(() => new Map()),
    summariesWithin(SUMMARY_BUDGET_MS, siteId, externalLeads, external.map((f) => ({ key: f.ruleId + "|" + f.leadId, leadId: f.leadId, options: ruleOptions.get(f.ruleId) ?? messageOptions(null) }))),
    connectionOf(siteId).catch(() => null),
  ]);
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
        lead: { id: f.leadId, url: `${APP_URL}/platform/leads/${f.leadId}`, submittedAt: submittedAt.get(f.leadId) ?? null, hubspotUrl: hubspot?.status === "ok" ? hubspotLeadLink(APP_URL, f.leadId) : null },
        source: sources.get(f.leadId) ? { line: sources.get(f.leadId)!.line, ad: sources.get(f.leadId)!.ad } : null,
        options: ruleOptions.get(f.ruleId) ?? null,
        form: formOf.get(f.leadId) ?? null,
        summary: summaries.get(f.ruleId + "|" + f.leadId)?.summary ?? null,
        pages: summaries.get(f.ruleId + "|" + f.leadId)?.pages ?? null,
        previous: summaries.get(f.ruleId + "|" + f.leadId)?.previous ?? null,
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
      await admin.from("notifications").insert({ site_id: c.site_id, user_id: c.created_by, title: "A channel is failing", body: `${c.name} has failed ${FAILING_AFTER} times in a row (${res.error}). Check it in Integrations.` });
    }
  }
  return sent;
}

/** The drainer: sites with waiting leads, a few at a time, then the due deliveries, then the queue of other marks
 *  (lib/marks/queue.ts), then (v3) checks of past leads that nobody is running (lib/marks/backfill.ts), with what is left
 *  of the time. Both background parts give way to the hook lane and stop at the minute's mark budget. */
export async function drain(maxSites = 4): Promise<{ sites: number; sent: number; queued: number; backfills: number; purged: number }> {
  const t0 = Date.now();
  const { data } = await admin.from("check_jobs").select("site_id").lte("run_after", new Date().toISOString()).order("created_at").limit(500);
  const sites = [...new Set((data ?? []).map((r) => r.site_id as string))].slice(0, maxSites);
  await Promise.all(sites.map((s) => runSiteLane(s, 20_000)));
  const sent = await sendDeliveries();
  const queued = await continueMarkQueues(Math.min(20_000, 40_000 - (Date.now() - t0))).catch(() => 0);
  const backfills = await continueBackfills(Math.min(30_000, 50_000 - (Date.now() - t0))).catch(() => 0);
  // last, with what is left: data older than each site's retention (lib/privacy/retention.ts, migration 35)
  const purged = await continueRetention(Math.min(8_000, 55_000 - (Date.now() - t0))).catch(() => 0);
  return { sites: sites.length, sent, queued, backfills, purged };
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
