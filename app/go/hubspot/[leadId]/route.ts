// app/go/hubspot/[leadId]/route.ts
// "Open in HubSpot" in a hook's Slack message. Resolved when clicked, not when the message was sent: a HubSpot form
// creates its contact a few seconds after the form, often after the hook fired, and the click is when it is needed.
// Signed link (lib/integrations/hubspot.ts hubspotLeadLink) -> the lead's email -> the contact with that email in the
// site's connected HubSpot -> its record. Anything else (no connection, no email, no contact yet, HubSpot slow or
// down, a bad link) opens the lead in Jellyhook, which needs sign-in. Never shows an error page.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { connectionOf, contactIdByEmail, contactUrl, leadLinkValid } from "@/lib/integrations/hubspot";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
/** The click waits at most this long for HubSpot before opening the lead in Jellyhook. */
const LOOKUP_MS = 4000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const inJellyhook = NextResponse.redirect(new URL("/platform/leads/" + encodeURIComponent(leadId), req.nextUrl.origin));
  if (!/^[0-9a-f-]{36}$/i.test(leadId) || !leadLinkValid(leadId, req.nextUrl.searchParams.get("k"))) return inJellyhook;
  try {
    const { data: lead } = await admin.from("form_submissions").select("site_id, email").eq("id", leadId).maybeSingle();
    const email = typeof lead?.email === "string" ? lead.email.trim() : "";
    if (!lead || !email.includes("@")) return inJellyhook;
    const conn = await connectionOf(lead.site_id as string, admin);
    if (!conn || conn.status !== "ok") return inJellyhook;
    const contactId = await contactIdByEmail(conn, email, LOOKUP_MS, admin);
    return contactId ? NextResponse.redirect(contactUrl(conn.ui_domain, conn.portal_id, contactId)) : inJellyhook;
  } catch (e) {
    console.error("[hubspot] open-in-HubSpot fell back to Jellyhook:", e instanceof Error ? e.message : String(e));
    return inJellyhook;
  }
}
