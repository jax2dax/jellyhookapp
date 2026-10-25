// lib/actions/acquisition.action.ts
// The Acquisition page: reads the site's visits, leads and hooked leads for a range and builds the report
// (lib/acquisition/report.ts). Any active member of the site. Visits are read from LOOKBACK_DAYS before the range, so a
// lead sent on the first day can still be credited to the ad that brought them earlier.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { buildReport, LOOKBACK_DAYS, type AcquisitionReport, type LeadRow, type SessionRow } from "@/lib/acquisition/report";
import type { CreditModel } from "@/lib/acquisition/channel";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const PAGE = 1000;
const MAX_ROWS = 100_000;

async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { rows, error: error.message };
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return { rows, error: null };
}

export async function loadAcquisition(days: number, model: CreditModel): Promise<{ ok: true; report: AcquisitionReport; from: string; to: string; adFields: boolean } | { ok: false; error: string }> {
  try {
    const { userId } = await auth();
    if (!userId) return { ok: false, error: "You're signed out. Sign in again." };
    const siteId = await siteOrThrow();
    const { data: member } = await admin.from("site_members").select("user_id").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
    if (!member) return { ok: false, error: "You are not a member of this site." };

    const to = Date.now();
    const range = [7, 30, 90].includes(days) ? days : 0;
    const { data: site } = await admin.from("sites").select("domain, created_at").eq("id", siteId).maybeSingle();
    const from = range ? to - range * 86_400_000 : Date.parse((site?.created_at as string) ?? "2020-01-01");
    const readFrom = new Date(from - LOOKBACK_DAYS * 86_400_000).toISOString();

    const cols = "visitor_id, session_id, started_at, referrer, utm_source, utm_medium, utm_campaign";
    let adFields = true;
    const read = (c: string) => allRows<SessionRow>((a, b) => admin.from("sessions").select(c).eq("site_id", siteId).gte("started_at", readFrom).order("started_at").order("session_id").range(a, b));
    let sess = await read(cols + ", utm_content, utm_term, click_id, landing_path, ad_name, campaign_id");
    if (sess.error && /ad_name|campaign_id/.test(sess.error)) sess = await read(cols + ", utm_content, utm_term, click_id, landing_path"); // before 25-ads.sql
    if (sess.error && /utm_content|utm_term|click_id|landing_path/.test(sess.error)) {
      // before 24-acquisition.sql: no ad, keyword or click id yet
      adFields = false;
      sess = await allRows<SessionRow>((a, b) => admin.from("sessions").select(cols).eq("site_id", siteId).gte("started_at", readFrom).order("started_at").order("session_id").range(a, b));
    }
    if (sess.error) throw new Error(sess.error);
    const leads = await allRows<LeadRow>((a, b) => admin.from("form_submissions").select("id, visitor_id, session_id, submitted_at").eq("site_id", siteId).gte("submitted_at", new Date(from).toISOString()).order("submitted_at").order("id").range(a, b));
    if (leads.error) throw new Error(leads.error);
    const events = await allRows<{ lead_id: string }>((a, b) => admin.from("notification_events").select("lead_id").eq("site_id", siteId).gte("created_at", new Date(from).toISOString()).order("lead_id").range(a, b));
    const hooked = new Set(events.error ? [] : events.rows.map((e) => e.lead_id));

    const report = buildReport({ sessions: sess.rows, leads: leads.rows, hooked, from, to, model, siteHost: (site?.domain as string) ?? null });
    return { ok: true, report, from: new Date(from).toISOString(), to: new Date(to).toISOString(), adFields };
  } catch (e) {
    console.error("[acquisition] load failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Acquisition could not be loaded." };
  }
}
