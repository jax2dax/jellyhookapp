// app/go/hubspot/[leadId]/route.ts
// "Open in HubSpot" in a hook's Slack message. Resolved when clicked, not when the message was sent: a HubSpot form
// creates its contact a few seconds after the form, often after the hook fired, and the click is when it is needed.
// Signed link (lib/integrations/hubspot.ts hubspotLeadLink) -> the lead's email -> the contact with that email in the
// site's connected HubSpot -> its record. Anything else (no connection, no email, no contact yet, HubSpot slow or
// down, a bad link) opens the lead in Jellyhook, which needs sign-in. Never shows an error page. Every outcome is named
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
    if (!contactId) return inJellyhook("no-contact", "portal " + conn.portal_id);
    return go("opened-contact", NextResponse.redirect(contactUrl(conn.ui_domain, conn.portal_id, contactId)));
  } catch (e) {
    return inJellyhook("hubspot-error", e instanceof Error ? e.message : String(e));
  }
}
