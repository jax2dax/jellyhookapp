// app/platform/settings/TrackingCards.jsx
"use client";

import { useState } from "react";
import { addAllowedHost, removeAllowedHost, setFormMode } from "@/lib/actions/settings.actions";
import { renewClaim } from "@/lib/actions/site-management.actions";
import { can } from "@/lib/tracking/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function ago(iso) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h ago`;
  return `${Math.round(ms / 86_400_000)} days ago`;
}

function hoursLeft(iso) {
  const h = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));
  return h >= 48 ? `${Math.round(h / 24)} days` : `${h} hours`;
}

// Shown under the API key while the previous key is still accepted.
export function KeyRotationNotice({ rotation }) {
  if (!rotation?.active) return null;
  return (
    <div className="mt-3 rounded-md border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
      <div className="mb-1 font-medium text-foreground">Key changed {ago(rotation.rotatedAt)}</div>
      The previous key still works for another {hoursLeft(rotation.deadlineIso)}, so your live site keeps recording while you update it.{" "}
      {rotation.newKeySeen ? "The new key has been seen, so the old one is about to be retired." : "The new key has not been seen yet. Paste the new script on your site."}
    </div>
  );
}

function StateBadge({ state }) {
  if (state === "working") return <Badge>Working</Badge>;
  if (state === "waiting") return <Badge variant="outline">Found, waiting for activity</Badge>;
  if (state === "misplaced") return <Badge variant="destructive">Misplaced</Badge>;
  return <Badge variant="secondary">Not found</Badge>;
}

// Is the tracker installed on the right site, and is data arriving?
export function TrackingStatusCard({ siteId, status, role }) {
  const [renewedUntil, setRenewedUntil] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!status) return null;
  const canRenew = can(role, "site.change_domain");

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {status.verified ? <Badge>Verified</Badge> : status.claim?.expired && !renewedUntil ? <Badge variant="destructive">Setup expired</Badge> : <Badge variant="outline">Waiting for the first data</Badge>}
          <span className="text-xs text-muted-foreground">Last event received: {ago(status.lastEventAt)}</span>
        </div>

        {status.verified ? (
          <p className="text-xs leading-relaxed text-muted-foreground">The tracker has reported from your own domain, so this site is verified.</p>
        ) : (
          <div className="text-xs leading-relaxed text-muted-foreground">
            {status.claim?.expired && !renewedUntil ? (
              <>
                This setup expired because the script was not installed within {status.claim.ttlDays} days. Nothing is recorded until it is renewed.
                {canRenew && (
                  <div className="mt-2">
                    <Button
                      size="xs"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const res = await renewClaim(siteId);
                        if (res.success) setRenewedUntil(new Date(Date.now() + status.claim.ttlDays * 86_400_000).toISOString());
                        setBusy(false);
                      }}
                    >
                      Renew for {status.claim.ttlDays} more days
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>This site becomes verified when the tracker reports from your own domain. Install the script before {new Date(renewedUntil || status.claim.expiresAt).toLocaleString()}.</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Extra hosts whose events are accepted, and the one we turned away.
export function AllowedHostsCard({ siteId, domain, status, role }) {
  const [hosts, setHosts] = useState(status?.allowedHosts || []);
  const [unmatched, setUnmatched] = useState(status?.unmatched || null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const canManage = can(role, "site.manage_hosts");

  async function add(host) {
    setBusy(true);
    setError(null);
    const res = await addAllowedHost(siteId, host);
    if (res.success) {
      setHosts(res.data.allowed_hosts || []);
      if (unmatched && unmatched.host === host.trim().toLowerCase()) setUnmatched(null);
      setInput("");
    } else setError(res.error);
    setBusy(false);
  }

  async function remove(host) {
    setBusy(true);
    setError(null);
    const res = await removeAllowedHost(siteId, host);
    if (res.success) setHosts(res.data.allowed_hosts || []);
    else setError(res.error);
    setBusy(false);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground">Allowed hosts</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Events are only recorded from <strong className="text-foreground">{domain}</strong> and its subdomains. Add another website here only if it really is part of this site (for example a separate checkout domain). Everything from an allowed host is recorded into this site&apos;s real analytics, so do not add test or local copies.
          </p>
        </div>

        {unmatched && (
          <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
            {unmatched.count.toLocaleString()} event{unmatched.count === 1 ? "" : "s"} from <strong className="text-foreground">{unmatched.host}</strong> were not recorded (last {ago(unmatched.at)}).
            {canManage && (
              <div className="mt-2">
                <Button size="xs" variant="outline" disabled={busy} onClick={() => add(unmatched.host)}>
                  Allow {unmatched.host}
                </Button>
              </div>
            )}
          </div>
        )}

        {hosts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {hosts.map((h) => (
              <div key={h} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-1.5">
                <span className="font-mono text-xs text-foreground">{h}</span>
                {canManage && (
                  <Button size="xs" variant="outline" disabled={busy} onClick={() => remove(h)}>
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <div className="flex gap-2">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="staging.example.com" onKeyDown={(e) => e.key === "Enter" && input.trim() && add(input)} className="flex-1" />
            <Button disabled={busy || !input.trim()} onClick={() => add(input)}>
              Add
            </Button>
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
      </CardContent>
    </Card>
  );
}

// data-conversion / data-track-field / data-track-click: found on the page vs proven by a real event.
export function TrackingHealthCard({ status }) {
  const [open, setOpen] = useState(null);
  if (!status) return null;
  const checks = status.health || [];

  return (
    <Card>
      <CardContent className="space-y-3">
        <div>
          <div className="text-xs text-muted-foreground">Attribute check</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The tracker reports what it finds on each page. <strong className="text-foreground">Working</strong> means a real event came from it, not just that the attribute exists.
          </p>
        </div>

        {checks.map((c) => (
          <div key={c.key} className="rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">{c.label}</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{c.attribute}</code>
              </div>
              <StateBadge state={c.state} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{c.summary}</div>
            {(c.state === "misplaced" || c.state === "none" || c.state === "waiting") && <div className="mt-1 text-xs text-muted-foreground">{c.hint}</div>}

            {c.pages.length > 0 && (
              <div className="mt-2">
                <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setOpen(open === c.key ? null : c.key)}>
                  {open === c.key ? "Hide pages" : `Show ${c.pages.length} page${c.pages.length === 1 ? "" : "s"}`}
                </button>
                {open === c.key && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {c.pages.map((p) => (
                      <div key={p.path} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                        <div>
                          <span className="font-mono text-foreground">{p.path}</span>
                          {p.problems.map((m) => (
                            <div key={m} className="text-destructive">
                              {m}
                            </div>
                          ))}
                        </div>
                        <div className="text-muted-foreground">{p.state === "working" ? `last event ${ago(p.lastEventAt)}` : p.state === "waiting" ? "found, no event yet" : p.state === "misplaced" ? "misplaced" : "not found"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ModeOption({ selected, disabled, onSelect, title, badge, text }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${selected ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary" : "border-muted-foreground/50"}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {title}
          {badge && <Badge variant="outline" className="border-primary/40 text-primary">{badge}</Badge>}
        </span>
        <span className="text-xs leading-relaxed text-muted-foreground">{text}</span>
      </span>
    </button>
  );
}

// Which forms count as leads. Changeable any time; applies within about a minute.
export function FormModeCard({ siteId, initial, role, onChanged }) {
  const [specify, setSpecify] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const canEdit = can(role, "site.change_form_mode");

  async function choose(value) {
    if (value === specify || !canEdit) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await setFormMode(siteId, value);
    if (res.success) {
      setSpecify(value);
      setSaved(true);
      onChanged?.(res.data);
    } else setError(res.error);
    setBusy(false);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">Which forms count as leads?</div>
        <div role="radiogroup" className="flex flex-col gap-2">
          <ModeOption
            selected={specify}
            disabled={busy || !canEdit}
            onSelect={() => choose(true)}
            title="Only the form I label"
            badge="Recommended"
            text={'Add data-conversion="true" to your contact or demo form. Newsletter and search boxes are never counted as leads.'}
          />
          <ModeOption selected={!specify} disabled={busy || !canEdit} onSelect={() => choose(false)} title="Every form on my site" text="Nothing to label. Any form with an email counts, newsletter boxes included." />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          You can switch any time. It applies within about a minute, and leads already recorded are not changed. After switching to labelled forms, the Attribute check below shows whether your form is marked correctly.
        </p>
        {!canEdit && <p className="text-xs text-muted-foreground">Only the owner or an admin can change this.</p>}
        {saved && <p className="text-xs text-primary">Saved.</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
