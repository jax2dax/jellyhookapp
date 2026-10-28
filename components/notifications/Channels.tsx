"use client";
// components/notifications/Channels.tsx
// Delivery integrations a site's rules can send to: Slack (incoming webhook) and generic signed webhooks (Zapier, Make,
// a CRM...). One card per integration, so more (for example a CRM) slot in later. Nothing personal is ever sent: the
// rule's subject, the message with "a new lead" in place of the name, the mark names, the site and a members-only link.
// Formats: mds/build/notifications/webhooks.md.
import * as React from "react";
import { Check, Copy, Loader2, Trash2, X } from "lucide-react";
import { addChannel, deleteChannel, testChannel, type ChannelView } from "@/lib/actions/notifications.action";
import { KindLogo } from "./Brand";

const INTEGRATIONS: { kind: "slack" | "webhook"; name: string; text: string }[] = [
  { kind: "slack", name: "Slack", text: "Post notifications to a Slack channel." },
  { kind: "webhook", name: "Webhook", text: "Send a signed JSON request to any https endpoint." },
];

const SLACK_RESULT: Record<string, { tone: "ok" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Slack connected. Pick it under Notification method in a hook." },
  cancelled: { tone: "error", text: "Slack connection cancelled." },
  expired: { tone: "error", text: "The Slack connection was started more than an hour ago. Press Connect again." },
  "other-user": { tone: "error", text: "You came back from Slack signed in as a different Jellyhook user than the one who started. Sign in as that user and press Connect again." },
  "other-browser": { tone: "error", text: "The Slack connection was started in another browser or window. Press Connect again in this one." },
  missing: { tone: "error", text: "Slack sent you back without the connection details. Press Connect again." },
  tampered: { tone: "error", text: "The connection details from Slack could not be verified. Press Connect again." },
  "not-allowed": { tone: "error", text: "Only an owner or admin of the site can connect Slack." },
  "not-configured": { tone: "error", text: "Slack sign-in is not set up on this server yet. Connect with a webhook URL instead." },
  "no-site": { tone: "error", text: "Create or select a site first." },
  error: { tone: "error", text: "Slack did not complete the connection. Try again." },
};

export function Channels({ channels: initial, canManage, slackOAuth = false, slackResult = null }: { channels: ChannelView[]; canManage: boolean; slackOAuth?: boolean; slackResult?: string | null }) {
  const [channels, setChannels] = React.useState(initial);
  const [adding, setAdding] = React.useState<"slack" | "webhook" | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const result = slackResult ? SLACK_RESULT[slackResult] ?? null : null;
  // One button per card. Slack opens a panel: "Add to Slack" (Slack's own install screen, when the server has a Slack app)
  // and, under it, pasting an incoming webhook URL.
  const connect = (kind: "slack" | "webhook") => setAdding(kind);

  const remove = async (c: ChannelView) => {
    if (!window.confirm(`Disconnect ${c.name}? Rules stop sending there.`)) return;
    const r = await deleteChannel(c.id);
    if (r.ok) setChannels((list) => list.filter((x) => x.id !== c.id));
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {result && <p className={"rounded-md border px-3 py-2 text-sm " + (result.tone === "ok" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400")}>{result.text}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {INTEGRATIONS.map((it) => {
          const count = channels.filter((c) => c.kind === it.kind).length;
          return (
            <div
              key={it.kind}
              role={canManage ? "button" : undefined}
              tabIndex={canManage ? 0 : undefined}
              onClick={canManage && !adding ? () => connect(it.kind) : undefined}
              onKeyDown={canManage ? (e) => e.key === "Enter" && !adding && connect(it.kind) : undefined}
              className={"flex items-start gap-3 rounded-xl border bg-card p-4" + (canManage ? " cursor-pointer transition-colors hover:border-foreground/30" : "")}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background">
                <KindLogo kind={it.kind} className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">{it.name}</span>
                  {count > 0 && <span className="whitespace-nowrap rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium leading-none text-emerald-700 dark:text-emerald-400">{count} connected</span>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.text}</p>
              </div>
              {canManage && <span className="flex h-7 shrink-0 items-center rounded-md border px-2.5 text-xs font-medium">{count ? "Add" : "Connect"}</span>}
            </div>
          );
        })}
      </div>
      {adding && (
        <AddChannel
          kind={adding}
          slackOAuth={slackOAuth}
          onCancel={() => setAdding(null)}
          onAdded={(c, s) => {
            setChannels((list) => [...list, c]);
            setAdding(null);
            if (s) setSecret(s);
          }}
        />
      )}
      {secret && <SecretOnce secret={secret} onDone={() => setSecret(null)} />}
      {channels.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Connected</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                  <KindLogo kind={c.kind} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{c.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">{c.hint}</span>
                  {c.status === "failing" && <span className="mt-0.5 block text-[11px] text-red-600 dark:text-red-400">{c.lastError ?? "Deliveries are failing"}</span>}
                </span>
                <span className={"rounded-full px-2 py-0.5 text-[11px] " + (c.status === "ok" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400")}>{c.status === "ok" ? "Active" : "Failing"}</span>
                {canManage && (
                  <button type="button" onClick={() => remove(c)} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600" aria-label={"Disconnect " + c.name}>
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AddChannel({ kind, slackOAuth, onCancel, onAdded }: { kind: "slack" | "webhook"; slackOAuth: boolean; onCancel: () => void; onAdded: (c: ChannelView, secret?: string) => void }) {
  const [name, setName] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState<"test" | "save" | null>(null);
  const [msg, setMsg] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const test = async () => {
    setBusy("test");
    const r = await testChannel(kind, url);
    setBusy(null);
    setMsg(r.ok ? { tone: "ok", text: "Test message sent." } : { tone: "error", text: r.error });
  };
  const save = async () => {
    setBusy("save");
    const r = await addChannel(kind, name, url);
    setBusy(null);
    if (!r.ok) return setMsg({ tone: "error", text: r.error });
    onAdded(r.channel, r.signingSecret);
  };
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm" style={{ animation: "jh-card-in 220ms ease-out both" }}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <KindLogo kind={kind} className="size-4" /> {kind === "slack" ? "Connect Slack" : "Connect a webhook"}
        </h2>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      {kind === "slack" && slackOAuth && (
        <>
          <a href="/api/integrations/slack/start" className="flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            <KindLogo kind="slack" className="size-4" /> Add to Slack
          </a>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or paste an incoming webhook URL
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}
      {kind === "slack" ? (
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            Go to <span className="font-mono text-foreground">api.slack.com/apps</span>, create an app in your workspace and enable Incoming Webhooks.
          </li>
          <li>Select Add New Webhook to Workspace and choose a channel.</li>
          <li>Paste the webhook URL below.</li>
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">Each notification is sent as a JSON POST, signed with a secret shown once after you connect. See the Notifications docs for the payload and signature.</p>
      )}
      <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={kind === "slack" ? "Channel name" : "Name"} className="h-8 w-full rounded-md border bg-background px-2.5 text-sm" aria-label="Name" />
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={kind === "slack" ? "https://hooks.slack.com/services/..." : "https://"} className="h-8 w-full rounded-md border bg-background px-2.5 font-mono text-xs" aria-label="URL" />
      {msg && <p className={"text-xs " + (msg.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{msg.text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={!url || !!busy} onClick={test} className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-40">
          {busy === "test" && <Loader2 className="size-3.5 animate-spin" />} Send test
        </button>
        <button type="button" disabled={!url || !!busy} onClick={save} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-40">
          {busy === "save" && <Loader2 className="size-3.5 animate-spin" />} Connect
        </button>
      </div>
    </div>
  );
}

function SecretOnce({ secret, onDone }: { secret: string; onDone: () => void }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
      <p className="font-medium text-foreground">Signing secret. Copy it now: it will not be shown again.</p>
      <p className="mt-1 text-xs text-muted-foreground">Use it to verify the X-Jellyhook-Signature header on each request.</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 font-mono text-xs">{secret}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(secret).then(() => setCopied(true));
          }}
          className="flex h-7 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={onDone} className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted">
          Done
        </button>
      </div>
    </div>
  );
}
