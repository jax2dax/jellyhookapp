// app/go/hubspot/[leadId]/route.ts
// "Open in HubSpot" in a hook's Slack message. Resolved when clicked, not when the message was sent: a HubSpot form
// creates its contact a few seconds after the form, often after the hook fired, and the click is when it is needed.
// Signed link (lib/integrations/hubspot.ts hubspotLeadLink) -> the lead's email -> the contact with that email in the
// site's connected HubSpot -> its record. Anything else (no connection, no email, no contact yet, HubSpot slow or
// down, a bad link) opens the lead in Jellyhook, which needs sign-in; "no contact yet" shows a short page that says so.
// Never shows an error page. Every outcome is named
// in the X-Jellyhook-Hubspot header and the log (see Reason), so a fallback is never silent.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { connectionOf, contactIdByEmail, contactUrl, leadLinkValid } from "@/lib/integrations/hubspot";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
/** The click waits at most this long for HubSpot before opening the lead in Jellyhook. */
const LOOKUP_MS = 4000;

/**
 * Why a click went where it did, for whoever has to find out why "Open in HubSpot" did not open HubSpot: sent as the
 * response header `X-Jellyhook-Hubspot` (visible with `curl -I <the button's address>`) and written to the server log.
 * Contains no personal data. opened-contact is the success; every other value opens the lead in Jellyhook instead.
 */
type Reason = "opened-contact" | "bad-link" | "no-lead" | "no-email" | "no-connection" | "connection-failing" | "no-contact" | "hubspot-error";

/**
 * "No HubSpot contact yet": the one fallback that is not a surprise to explain, so it is a short page instead of a silent
 * redirect (a salesperson who clicked Open in HubSpot and landed in Jellyhook, maybe signed out, could not tell why). It
 * names no one: no email, no name. Two ways on: look again (the contact may still be being created) or open the lead in
 * Jellyhook. The only values written into it are the origin of this request and the lead id, which was checked to be a uuid.
 */
function noContactPage(req: NextRequest, leadId: string): NextResponse {
  const here = req.nextUrl.pathname + req.nextUrl.search;
  const lead = "/platform/leads/" + encodeURIComponent(leadId);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>No HubSpot contact yet</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0a;color:#e8e6dc;font:15px/1.55 system-ui,sans-serif}main{max-width:30rem;padding:2rem}h1{font-size:1.2rem;margin:0 0 .75rem}p{color:#a9a79d;margin:0 0 1.25rem}a{display:inline-block;margin-right:.6rem;padding:.55rem 1rem;border-radius:.5rem;border:1px solid #3a3a35;color:#e8e6dc;text-decoration:none}a.p{background:#00c744;border-color:#00c744;color:#06210f;font-weight:600}</style></head>
<body><main><h1>No HubSpot contact yet</h1>
<p>HubSpot has no contact for this lead's email in the connected account. A contact can take a minute to appear after a form is sent, and a form that HubSpot treats as spam creates none.</p>
<a class="p" href="${here.replace(/"/g, "&quot;")}">Look again</a><a href="${lead}">Open in Jellyhook</a></main></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const go = (reason: Reason, to: NextResponse, detail?: string) => {
    to.headers.set("X-Jellyhook-Hubspot", reason);
    if (reason !== "opened-contact") console.error("[hubspot] open-in-HubSpot opened Jellyhook instead:", reason, detail ?? "", { lead: leadId.slice(0, 8) });
    return to;
  };
  const inJellyhook = (reason: Reason, detail?: string) => go(reason, NextResponse.redirect(new URL("/platform/leads/" + encodeURIComponent(leadId), req.nextUrl.origin)), detail);

  if (!/^[0-9a-f-]{36}$/i.test(leadId) || !leadLinkValid(leadId, req.nextUrl.searchParams.get("k"))) return inJellyhook("bad-link");
  try {
    const { data: lead } = await admin.from("form_submissions").select("site_id, email").eq("id", leadId).maybeSingle();
    if (!lead) return inJellyhook("no-lead");
    const email = typeof lead.email === "string" ? lead.email.trim() : "";
    if (!email.includes("@")) return inJellyhook("no-email");
    const conn = await connectionOf(lead.site_id as string, admin);
    if (!conn) return inJellyhook("no-connection");
    if (conn.status !== "ok") return inJellyhook("connection-failing");
    const contactId = await contactIdByEmail(conn, email, LOOKUP_MS, admin);
    if (!contactId) return go("no-contact", noContactPage(req, leadId), "portal " + conn.portal_id);
    return go("opened-contact", NextResponse.redirect(contactUrl(conn.ui_domain, conn.portal_id, contactId)));
  } catch (e) {
    return inJellyhook("hubspot-error", e instanceof Error ? e.message : String(e));
  }
}
