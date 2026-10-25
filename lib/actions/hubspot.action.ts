// lib/actions/hubspot.action.ts
// The HubSpot card in Integrations: whether the site is connected, to which HubSpot account, and Disconnect. Connecting
// is a redirect (app/api/integrations/hubspot/start). Owners and admins manage it, as with Slack.
// Design: mds/build/integrations/hubspot.md.
"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { siteOrThrow } from "@/lib/hook/site";
import { hubspotConfigured } from "@/lib/integrations/hubspot";

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export interface HubSpotStatus {
  /** the server has a HubSpot app (HUBSPOT_CLIENT_ID / HUBSPOT_CLIENT_SECRET) */
  configured: boolean;
  /** migration 27 has run */
  ready: boolean;
  canManage: boolean;
  connection: { portalId: number; uiDomain: string; status: "ok" | "failing"; lastError: string | null; connectedByEmail: string | null; connectedAt: string } | null;
}

async function who(): Promise<{ siteId: string; canManage: boolean }> {
  const { userId } = await auth();
  if (!userId) throw new Error("You're signed out. Sign in again.");
  const siteId = await siteOrThrow();
  const { data } = await admin.from("site_members").select("role").eq("site_id", siteId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!data) throw new Error("You are not a member of this site.");
  return { siteId, canManage: data.role === "owner" || data.role === "admin" };
}

export async function getHubSpotStatus(): Promise<{ ok: true; status: HubSpotStatus } | { ok: false; error: string }> {
  try {
    const { siteId, canManage } = await who();
    const { data, error } = await admin.from("hubspot_connections").select("portal_id, ui_domain, status, last_error, connected_by_email, created_at").eq("site_id", siteId).maybeSingle();
    if (error && /hubspot_connections/.test(error.message)) return { ok: true, status: { configured: hubspotConfigured(), ready: false, canManage, connection: null } };
    if (error) throw new Error(error.message);
    return {
      ok: true,
      status: {
        configured: hubspotConfigured(),
        ready: true,
        canManage,
        connection: data
          ? { portalId: Number(data.portal_id), uiDomain: data.ui_domain as string, status: data.status as "ok" | "failing", lastError: (data.last_error as string) ?? null, connectedByEmail: (data.connected_by_email as string) ?? null, connectedAt: data.created_at as string }
          : null,
      },
    };
  } catch (e) {
    console.error("[hubspot] status failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: e instanceof Error ? e.message : "That did not work. Try again." };
  }
}

/** Removes the connection: Slack buttons open leads in Jellyhook again and the card says HubSpot is not connected. */
export async function disconnectHubSpot(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { siteId, canManage } = await who();
    if (!canManage) return { ok: false, error: "Only an owner or admin can disconnect HubSpot." };
    const { error } = await admin.from("hubspot_connections").delete().eq("site_id", siteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (e) {
    console.error("[hubspot] disconnect failed", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "That did not work. Try again." };
  }
}
