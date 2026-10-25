// app/platform/settings/SettingsClients.jsx
// The body of ONE Settings section (chosen by the page from the sidebar, lib/settings/sections.js). Each section is a
// single column of cards; nothing is hidden and nothing sits in a grid. Sections here: general, installation, connection,
// attributes, forms, ai. (Form fields is a server tab in page.jsx.) The page title, group and description are the page's.
"use client";

import { useState } from "react";
import {
  updateSiteDomain,
  updateSiteName,
  regenerateApiKey,
  toggleSiteActive,
  leaveSite,
} from "@/lib/actions/settings.actions";
import { can } from "@/lib/tracking/permissions";
import { rotationStatus } from "@/lib/tracking/keys";
import { McpCard } from "./McpCard";
import { KeyRotationNotice, TrackingStatusCard, AllowedHostsCard, TrackingHealthCard } from "./TrackingCards";
import { FormSwitchesCard } from "./FormSwitchesCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** A card whose rows are separated by lines: label and value on the left, the action on the right. */
function RowCard({ children }) {
  return <Card className="gap-0 divide-y py-0">{children}</Card>;
}

function Row({ label, hint, children, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-6 py-4">
      <div className="min-w-0 flex-1 basis-56">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm break-all text-foreground">{children}</div>
        {hint && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</div>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="xs"
      variant={copied ? "default" : "outline"}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

// One editable value (site name, domain): shows the value with an Edit button, becomes an input with Save and Cancel.
function EditableRow({ label, value, onSave, placeholder = "", readOnly = false, note = null }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (input.trim() === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(input.trim());
    setSaving(false);
    if (result.success) setEditing(false);
    else setError(result.error);
  }

  if (!editing) {
    return (
      <Row
        label={label}
        action={
          !readOnly && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => {
                setInput(value);
                setEditing(true);
                setError(null);
              }}
            >
              Edit
            </Button>
          )
        }
      >
        {value || <span className="text-muted-foreground">{placeholder}</span>}
      </Row>
    );
  }

  return (
    <div className="space-y-2.5 px-6 py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
      />
      {note && <div className="text-xs leading-relaxed text-muted-foreground">{note}</div>}
      {error && <div className="text-xs text-destructive">Error: {error}</div>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** `demoForms` (demo pages only): the Lead forms list as given, instead of loading it. */
export default function SettingsClient({ site: initialSite, visitorCount = 0, role = null, ingestion = null, section = "general", demoForms = null }) {
  const [site, setSite] = useState(initialSite);
  const [rotation, setRotation] = useState(ingestion?.rotation || null);
  const [confirm, setConfirm] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  async function handleUpdateName(name) {
    const result = await updateSiteName(site.id, name);
    if (result.success) setSite(result.data);
    return result;
  }

  async function handleUpdateDomain(domain) {
    const result = await updateSiteDomain(site.id, domain);
    if (result.success) setSite(result.data);
    return result;
  }

  async function handleToggleActive() {
    const result = await toggleSiteActive(site.id, site.is_active);
    if (result.success) setSite(result.data);
    return result;
  }

  async function handleConfirmAction() {
    setConfirmLoading(true);
    setConfirmError(null);
    if (confirm === "regenerate") {
      const result = await regenerateApiKey(site.id);
      if (result.success) {
        setSite(result.data);
        const r = rotationStatus(result.data);
        setRotation({ ...r, rotatedAt: result.data.key_rotated_at, deadlineIso: r.active ? new Date(r.deadline).toISOString() : null });
        setConfirm(null);
      } else setConfirmError(result.error);
    }
    if (confirm === "leave") {
      const result = await leaveSite(site.id);
      if (result.success) window.location.href = "/platform";
      else setConfirmError(result.error);
    }
    setConfirmLoading(false);
  }

  const trackerBase = process.env.NEXT_PUBLIC_TRACKER_URL || "http://localhost:3000";
  const trackerScript = `<script defer src="${trackerBase}/tracker.js" data-key="${site.api_key}"></script>`;

  return (
    <div className="flex flex-col gap-4">
      {/* GENERAL: the site, its status, and (for everyone but the owner) leaving it */}
      {section === "general" && (
        <>
          <RowCard>
            <EditableRow label="Site name" value={site.name ?? ""} placeholder="My Site" onSave={handleUpdateName} readOnly={!can(role, "site.rename")} />
            <EditableRow
              label="Domain"
              value={site.domain ?? ""}
              placeholder="yourdomain.com"
              onSave={handleUpdateDomain}
              readOnly={!can(role, "site.change_domain")}
              note="The tracker must report from this domain. After a change the site has to be verified again, and events from the old domain stop being recorded until then."
            />
          </RowCard>

          <RowCard>
            <Row
              label="Status"
              hint={site.is_active ? "Recording visits and forms." : "Paused: nothing is recorded until you resume."}
              action={
                can(role, "site.toggle_tracking") && (
                  <Button size="xs" variant={site.is_active ? "destructive" : "default"} onClick={handleToggleActive}>
                    {site.is_active ? "Pause" : "Resume"}
                  </Button>
                )
              }
            >
              <Badge variant={site.is_active ? "default" : "destructive"}>{site.is_active ? "Active" : "Inactive"}</Badge>
            </Row>
            <Row label="Visitors recorded">{visitorCount.toLocaleString()}</Row>
            <Row label="Created">{new Date(site.created_at).toLocaleDateString()}</Row>
            <Row label="Site ID">
              <span className="font-mono text-xs">{site.id}</span>
            </Row>
          </RowCard>

          {role && role !== "owner" && (
            <RowCard>
              <Row
                label="Your access"
                hint="You lose access to its data. The owner can invite you again."
                action={
                  <Button size="sm" variant="destructive" onClick={() => setConfirm("leave")}>
                    Leave site
                  </Button>
                }
              >
                Leave this site
              </Row>
            </RowCard>
          )}
        </>
      )}

      {/* INSTALLATION: the script and the key */}
      {section === "installation" && (
        <>
          <Card>
            <CardContent>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">Tracker script</div>
                <CopyButton text={trackerScript} />
              </div>
              <div className="mb-2 text-xs text-muted-foreground">Paste it once in the &lt;head&gt; of every page you want tracked.</div>
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed break-all text-primary">{trackerScript}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">API key</div>
                <div className="flex gap-1.5">
                  <CopyButton text={site.api_key} />
                  {can(role, "site.regenerate_key") && (
                    <Button
                      size="xs"
                      variant="destructive"
                      onClick={() => {
                        setConfirm("regenerate");
                        setConfirmError(null);
                      }}
                    >
                      Regenerate
                    </Button>
                  )}
                </div>
              </div>
              <div className="font-mono text-sm break-all tracking-wide text-foreground">{site.api_key}</div>
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground">Regenerating gives you a new key. The current one keeps working for 72 hours so your live site does not lose data while you update it.</div>
              <KeyRotationNotice rotation={rotation} />
            </CardContent>
          </Card>
        </>
      )}

      {/* CONNECTION: is data arriving, and which websites may send it */}
      {section === "connection" &&
        (ingestion ? (
          <>
            <TrackingStatusCard siteId={site.id} status={ingestion} role={role} />
            <AllowedHostsCard siteId={site.id} domain={site.domain} status={ingestion} role={role} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">The connection status could not be loaded. Reload the page.</p>
        ))}

      {/* ATTRIBUTE CHECK: found on the page versus proven by a real event */}
      {section === "attributes" && (ingestion ? <TrackingHealthCard status={ingestion} /> : <p className="text-sm text-muted-foreground">The attribute check could not be loaded. Reload the page.</p>)}

      {/* LEAD FORMS: which submissions count as leads */}
      {section === "forms" && <FormSwitchesCard siteId={site.id} onChanged={setSite} initialState={demoForms} />}

      {/* AI ACCESS (MCP): behind MCP_ENABLED=1 until the whole feature is built and tested (the page hides the section) */}
      {section === "ai" && <McpCard siteId={site.id} role={role} />}

      {/* CONFIRMATION MODAL */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <Card className="w-full max-w-sm">
            <CardContent>
              <div className="mb-3 text-sm font-medium text-foreground">{confirm === "regenerate" ? "Regenerate API key?" : "Leave this site?"}</div>
              <div className="mb-5 text-sm leading-relaxed text-muted-foreground">
                {confirm === "regenerate"
                  ? "A new key is created. The current key keeps working for 72 hours, or until your site sends data with the new key, so there is no gap in tracking. Paste the new script on your site within that time."
                  : "You will lose access to this site's data. The owner can invite you again."}
              </div>
              {confirmError && <div className="mb-3 text-xs text-destructive">Error: {confirmError}</div>}
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleConfirmAction} disabled={confirmLoading}>
                  {confirmLoading ? "Processing..." : "Confirm"}
                </Button>
                <Button
                  variant="outline"
                  disabled={confirmLoading}
                  onClick={() => {
                    setConfirm(null);
                    setConfirmError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
