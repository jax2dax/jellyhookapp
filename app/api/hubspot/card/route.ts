// app/api/hubspot/card/route.ts
// What the Jellyhook card on a HubSpot contact shows (hubspot/src/app/cards/JellyhookCard.jsx, called with
// hubspot.fetch). Trusts only what HubSpot signed: the account (portalId in the query) and the contact (contactId in the
// body). The contact's email is read from HubSpot by Jellyhook, so a request can never ask about an arbitrary email.
// Then: that email's Jellyhook leads on every site connected to this account (newest first, at most 5), each with its
// visit summary in three versions, its team marks (never a person's private ones), the hooks that caught it, where it came from and a 30-minute link to its
// visit chart (app/embed/visit). Never the form's answers. Design: mds/build/integrations/hubspot.md.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { connectionsOfPortal, contactEmail, hubspotSignatureValid, makeChartToken } from "@/lib/integrations/hubspot";
import { summariesWithin, type SummaryLead } from "@/lib/notifications/summary";
import { messageOptions } from "@/lib/notifications/message";
import { leadSources } from "@/lib/acquisition/leadSource";
import { formKeyLabel } from "@/lib/tracking/formKey";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://jellyhook.com").replace(/\/+$/, "");
const MAX_LEADS = 5;
const SUMMARY_MS = 4000;

export interface CardLead {
  id: string;
  site: string;
  submittedAt: string;
  page: string | null;
  /** the form it was sent with ("#contact"), when known */
  form: string | null;
  marks: string[];
  hooks: string[];
  cameFrom: string | null;
  summary: { short: string[]; moderate: string[]; long: string[] } | null;
  chartUrl: string;
  jellyhookUrl: string;
}
export type CardAnswer =
  | { state: "ok"; email: string; leads: CardLead[] }
  | { state: "not-connected" | "no-email" | "no-leads" | "reconnect"; email?: string };

const json = (body: CardAnswer | { error: string }, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The URL as HubSpot called it (behind Vercel's proxy, the public host and https). */
function publicUrls(req: NextRequest): string[] {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const own = host ? `${proto}://${host}${req.nextUrl.pathname}${req.nextUrl.search}` : null;
  return [...new Set([own, req.url].filter((u): u is string => !!u))];
}

/** "100%" and "_" in an email are literal in an ilike pattern. */
const literal = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  if (!publicUrls(req).some((url) => hubspotSignatureValid({ method: "POST", url, body: raw, signature, timestamp }))) return json({ error: "not signed by HubSpot" }, 401);

  const portalId = Number(req.nextUrl.searchParams.get("portalId"));
  let contactId = "";
  try {
    contactId = String((JSON.parse(raw) as { contactId?: unknown }).contactId ?? "");
  } catch {
    /* checked below */
  }
  if (!Number.isFinite(portalId) || portalId <= 0 || !/^\d{1,20}$/.test(contactId)) return json({ error: "bad request" }, 400);

  try {
    const all = await connectionsOfPortal(portalId, admin);
    if (!all.length) return json({ state: "not-connected" });
    const conns = all.filter((c) => c.status === "ok");
    if (!conns.length) return json({ state: "reconnect" });
    const email = await contactEmail(conns[0], contactId, 5000, admin);
    if (!email) return json({ state: "no-email" });

    const siteIds = conns.map((c) => c.site_id);
    const [leadsRes, sitesRes] = await Promise.all([
      admin.from("form_submissions").select("*").in("site_id", siteIds).ilike("email", literal(email)).order("submitted_at", { ascending: false }).limit(MAX_LEADS),
      admin.from("sites").select("id, domain, name").in("id", siteIds),
    ]);
    if (leadsRes.error) throw new Error(leadsRes.error.message);
    const leads = leadsRes.data ?? [];
    if (!leads.length) return json({ state: "no-leads", email });
    const ids = leads.map((l) => l.id as string);
    const siteName = new Map((sitesRes.data ?? []).map((s) => [s.id as string, ((s.domain as string) || (s.name as string) || "your site") as string]));

    const [marksRes, eventsRes] = await Promise.all([
      admin.from("lead_marks").select("lead_id, marks(name, visibility, active)").in("lead_id", ids),
      admin.from("notification_events").select("lead_id, notification_rules(name)").in("lead_id", ids),
    ]);
    const namesBy = (rows: Record<string, unknown>[] | null, rel: string) => {
      const m = new Map<string, string[]>();
      for (const r of rows ?? []) {
        const x = r[rel] as { name?: string; visibility?: string; active?: boolean } | null;
        const name = x?.name;
        // a mark is shown only when it is on and shared with the whole team: someone's private marks stay theirs
        if (!name || (rel === "marks" && (x?.visibility !== "team" || x?.active === false))) continue;
        const list = m.get(r.lead_id as string) ?? [];
        if (!list.includes(name)) list.push(name);
        m.set(r.lead_id as string, list);
      }
      return m;
    };
    const marks = namesBy(marksRes.data as Record<string, unknown>[] | null, "marks");
    const hooks = namesBy(eventsRes.data as Record<string, unknown>[] | null, "notification_rules");

    // per site: where each lead came from, and its visit summary in the three versions (one batch of reads per site)
    const cameFrom = new Map<string, string>();
    const summaries = new Map<string, CardLead["summary"]>();
    await Promise.all(
      siteIds.map(async (siteId) => {
        const mine: SummaryLead[] = leads
          .filter((l) => l.site_id === siteId)
          .map((l) => ({ id: l.id as string, visitor_id: (l.visitor_id as string) ?? null, session_id: (l.session_id as string) ?? null, submitted_at: l.submitted_at as string }));
        if (!mine.length) return;
        const versions = ["short", "moderate", "long"] as const;
        const [src, sums] = await Promise.all([
          leadSources(siteId, mine, siteName.get(siteId) ?? null).catch(() => new Map()),
          summariesWithin(SUMMARY_MS, siteId, mine, mine.flatMap((l) => versions.map((v) => ({ key: v + "|" + l.id, leadId: l.id, options: messageOptions({ summary: v }) })))),
        ]);
        for (const l of mine) {
          const s = src.get(l.id);
          if (s?.line) cameFrom.set(l.id, s.line);
          const get = (v: (typeof versions)[number]) => sums.get(v + "|" + l.id)?.summary?.lines ?? null;
          const short = get("short");
          const moderate = get("moderate");
          const long = get("long");
          if (short && moderate && long) summaries.set(l.id, { short, moderate, long });
        }
      }),
    );

    const out: CardLead[] = leads.map((l) => ({
      id: l.id as string,
      site: siteName.get(l.site_id as string) ?? "your site",
      submittedAt: l.submitted_at as string,
      page: (l.page_path as string) ?? null,
      form: typeof l.form_key === "string" && l.form_key ? formKeyLabel(l.form_key) : null,
      marks: marks.get(l.id as string) ?? [],
      hooks: hooks.get(l.id as string) ?? [],
      cameFrom: cameFrom.get(l.id as string) ?? null,
      summary: summaries.get(l.id as string) ?? null,
      // opens on the visit with the form
      chartUrl: l.visitor_id ? APP_URL + "/embed/visit?t=" + makeChartToken({ s: l.site_id as string, v: l.visitor_id as string, l: l.id as string }) + (l.session_id ? "&session=" + encodeURIComponent(l.session_id as string) : "") : "",
      jellyhookUrl: APP_URL + "/platform/leads/" + l.id,
    }));
    return json({ state: "ok", email, leads: out });
  } catch (e) {
    console.error("[hubspot] card failed:", e instanceof Error ? e.message : String(e));
    return json({ error: "Jellyhook could not load this contact" }, 500);
  }
}
