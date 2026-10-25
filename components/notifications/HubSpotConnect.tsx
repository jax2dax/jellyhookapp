"use client";
// components/notifications/HubSpotConnect.tsx
// The HubSpot card in Integrations: Connect (HubSpot's own approval screen, app/api/integrations/hubspot/start), the
// connected account, and Disconnect. Once connected, hooks' Slack messages open the lead's HubSpot contact and the
// Jellyhook card can be added to contact records. Design: mds/build/integrations/hubspot.md.
import * as React from "react";
import { Loader2 } from "lucide-react";
import { HubSpotLogo } from "./Brand";
import { disconnectHubSpot, type HubSpotStatus } from "@/lib/actions/hubspot.action";

const RESULT: Record<string, { tone: "ok" | "error"; text: string }> = {
  connected: { tone: "ok", text: "HubSpot is connected. Hooks now open leads in HubSpot, and you can add the Jellyhook card to contact records." },
  cancelled: { tone: "error", text: "HubSpot was not connected: the approval was cancelled." },
  "not-configured": { tone: "error", text: "HubSpot is not set up on this server yet (HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET)." },
  "not-ready": { tone: "error", text: "HubSpot is not set up on this database yet (migration 27)." },
  "not-allowed": { tone: "error", text: "Only an owner or admin of the site can connect HubSpot." },
  "no-site": { tone: "error", text: "Pick a site first." },
  "start-in-jellyhook": { tone: "error", text: "Connect HubSpot from here (Integrations → HubSpot → Connect), so it is tied to the right site." },
  expired: { tone: "error", text: "That took too long. Connect again." },
  error: { tone: "error", text: "HubSpot could not be connected. Try again." },
};

export function HubSpotConnect({ status, result }: { status: HubSpotStatus; result: string | null }) {
  const [conn, setConn] = React.useState(status.connection);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const shown = result ? RESULT[result] ?? RESULT.error : null;
  const canConnect = status.canManage && status.configured && status.ready;

  const disconnect = async () => {
    if (!window.confirm("Disconnect HubSpot? Slack buttons will open leads in Jellyhook again, and the Jellyhook card in HubSpot stops showing data.")) return;
    setBusy(true);
    setError(null);
    const r = await disconnectHubSpot();
    setBusy(false);
    if (r.ok) setConn(null);
    else setError(r.error);
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      {shown && <p className={"rounded-md border px-3 py-2 text-sm " + (shown.tone === "ok" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400")}>{shown.text}</p>}
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background">
          <HubSpotLogo className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">HubSpot</span>
            {conn && (
              <span className={"rounded-full px-1.5 py-0.5 text-[10px] font-medium " + (conn.status === "ok" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")}>
                {conn.status === "ok" ? "Connected" : "Needs reconnecting"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Hooked leads in Slack open their HubSpot contact record, and a Jellyhook card on each contact shows their visits, summary and visit chart. Jellyhook only reads which contact has the lead&apos;s email; it never writes to HubSpot.
          </p>
          {conn && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Account {conn.portalId} · {conn.uiDomain}
              {conn.connectedByEmail ? " · connected by " + conn.connectedByEmail : ""}
            </p>
          )}
          {conn?.status === "failing" && conn.lastError && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{conn.lastError}</p>}
          {!status.ready && <p className="mt-1 text-[11px] text-muted-foreground">Not set up on this database yet (migration 27).</p>}
          {status.ready && !status.configured && <p className="mt-1 text-[11px] text-muted-foreground">Not set up on this server yet (HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET).</p>}
          {!status.canManage && <p className="mt-1 text-[11px] text-muted-foreground">An owner or admin of the site connects HubSpot.</p>}
          {error && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        </div>
        {canConnect && (!conn || conn.status === "failing") && (
          <a href="/api/integrations/hubspot/start" className="flex h-8 shrink-0 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted">
            {conn ? "Reconnect" : "Connect"}
          </a>
        )}
        {status.canManage && conn && (
          <button type="button" disabled={busy} onClick={disconnect} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-40">
            {busy && <Loader2 className="size-3 animate-spin" />} Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
