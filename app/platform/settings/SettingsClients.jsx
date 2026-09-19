// app/platform/settings/SettingsClients.jsx
"use client";

import { useState } from "react";
import {
  updateSiteDomain,
  updateSiteName,
  regenerateApiKey,
  toggleSiteActive,
  deactivateSite,
  inviteMember,
  removeMember,
} from "@/lib/actions/settings.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// ─── StatusBadge ─────────────────────────────────────────
function StatusBadge({ active }) {
  return <Badge variant={active ? "default" : "destructive"}>{active ? "Active" : "Inactive"}</Badge>;
}

// ─── CopyButton ───────────────────────────────────────────
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
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

// ─── EditableRow ──────────────────────────────────────────
function EditableRow({ label, value, onSave, placeholder = "" }) {
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

  return (
    <Card>
      <CardContent className={editing ? "space-y-2.5" : ""}>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          {!editing && (
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
          )}
        </div>
        {!editing ? (
          <div className="mt-1 text-sm break-all text-foreground">{value}</div>
        ) : (
          <div className="flex flex-col gap-2">
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
        )}
      </CardContent>
    </Card>
  );
}

// ─── TeamMembers ──────────────────────────────────────────
function TeamMembers({ siteId, initialMembers, currentUserId, siteOwnerId }) {
  const [members, setMembers] = useState(initialMembers || []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  // isOwner check: check site_members rows first, then fall back to site.user_id === currentUserId
  // This handles the case where members array has the owner row, AND the legacy case where it doesn't yet
  const isOwnerByMembership = members.some((m) => m.user_id === currentUserId && m.role === "owner");
  const isOwner = isOwnerByMembership || siteOwnerId === currentUserId;

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const result = await inviteMember(siteId, inviteEmail.trim());

      if (result.success) {
        const email = inviteEmail.trim().toLowerCase();
        setInviteSuccess(`Invite sent to ${email}`);
        setInviteEmail("");
        setMembers((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            user_id: `pending:${email}`,
            user_email: email,
            role: "member",
            invited_by: currentUserId,
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        setInviteError(result.error);
      }
    } catch (err) {
      setInviteError(err.message || "Something went wrong");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemove(member) {
    if (member.user_id === currentUserId) {
      setInviteError("You cannot remove yourself.");
      return;
    }
    setRemovingId(member.id);
    setInviteError(null);
    try {
      const result = await removeMember(siteId, member.id);
      if (result.success) {
        setMembers((prev) => prev.filter((m) => m.id !== member.id));
      } else {
        setInviteError(result.error);
      }
    } catch (err) {
      setInviteError(err.message || "Something went wrong");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        {/* Member list */}
        <div className="flex flex-col gap-2">
          {members.length === 0 && <div className="text-sm text-muted-foreground">No members in table yet — save first action will create your row.</div>}
          {members.map((member) => {
            const isPending = member.user_id?.startsWith("pending:");
            const isYou = member.user_id === currentUserId;
            return (
              <div key={member.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="flex flex-col gap-1">
                  <div className="text-sm text-foreground">
                    {member.user_email || member.user_id}
                    {isYou && <span className="ml-1.5 text-xs text-primary">(you)</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline">{member.role}</Badge>
                    {isPending && <span className="text-xs text-warning">pending invite</span>}
                  </div>
                </div>

                {isOwner && !isYou && (
                  <Button size="xs" variant="destructive" onClick={() => handleRemove(member)} disabled={removingId === member.id}>
                    {removingId === member.id ? "..." : "Remove"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Invite form — shown to owner */}
        {isOwner && (
          <div className="border-t pt-3">
            <div className="mb-2 text-xs text-muted-foreground">Invite a team member by email</div>
            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                  setInviteSuccess(null);
                }}
                placeholder="coworker@company.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite();
                }}
                className="flex-1"
              />
              <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()} className="whitespace-nowrap">
                {inviteLoading ? "Sending..." : "Send Invite"}
              </Button>
            </div>
            {inviteError && <div className="mt-1.5 text-xs text-destructive">{inviteError}</div>}
            {inviteSuccess && <div className="mt-1.5 text-xs text-primary">{inviteSuccess}</div>}
            <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              They get access when they sign up with this email. If already signed up, access is granted on their next login.
            </div>
          </div>
        )}

        {!isOwner && <div className="border-t pt-2.5 text-xs text-muted-foreground">Only the site owner can invite or remove members.</div>}
      </CardContent>
    </Card>
  );
}

// ─── Main SettingsClient ──────────────────────────────────
export default function SettingsClient({ site: initialSite, initialMembers, currentUserId }) {
  const [site, setSite] = useState(initialSite);
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
        setConfirm(null);
      } else setConfirmError(result.error);
    }
    if (confirm === "deactivate") {
      const result = await deactivateSite(site.id);
      if (result.success) window.location.href = "/platform/create-site";
      else setConfirmError(result.error);
    }
    setConfirmLoading(false);
  }

  const trackerScript = `<script src="http://localhost:3000/tracker.js" data-key="${site.api_key}"></script>`; // 🚀 DEPLOY

  return (
    <div className="flex max-w-xl flex-col gap-3">
      {/* SITE INFO */}
      <div className="mb-1 text-xs tracking-wide text-muted-foreground">SITE INFORMATION</div>
      <EditableRow label="Site Name" value={site.name ?? ""} placeholder="My Site" onSave={handleUpdateName} />
      <EditableRow label="Domain" value={site.domain ?? ""} placeholder="yourdomain.com" onSave={handleUpdateDomain} />

      {[
        { label: "Site ID", value: site.id },
        { label: "Plan", value: site.plan ?? "free" },
        { label: "Event Limit", value: site.monthly_event_limit?.toLocaleString() ?? "—" },
        { label: "Created", value: new Date(site.created_at).toLocaleDateString() },
      ].map((row) => (
        <Card key={row.label}>
          <CardContent>
            <div className="mb-1 text-xs text-muted-foreground">{row.label}</div>
            <div className="text-sm break-all text-foreground">{row.value}</div>
          </CardContent>
        </Card>
      ))}

      {/* Status toggle */}
      <Card>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="mb-1.5 text-xs text-muted-foreground">Status</div>
            <StatusBadge active={site.is_active} />
          </div>
          <Button size="sm" variant={site.is_active ? "destructive" : "default"} onClick={handleToggleActive}>
            {site.is_active ? "Pause Tracking" : "Resume Tracking"}
          </Button>
        </CardContent>
      </Card>

      {/* TEAM MEMBERS */}
      <div className="mt-2 mb-1 text-xs tracking-wide text-muted-foreground">TEAM MEMBERS</div>
      <TeamMembers siteId={site.id} initialMembers={initialMembers} currentUserId={currentUserId} siteOwnerId={site.user_id} />

      {/* API KEY */}
      <div className="mt-2 mb-1 text-xs tracking-wide text-muted-foreground">API KEY</div>
      <Card>
        <CardContent>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">API Key</div>
            <div className="flex gap-1.5">
              <CopyButton text={site.api_key} />
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
            </div>
          </div>
          <div className="font-mono text-sm break-all tracking-wide text-foreground">{site.api_key}</div>
          <div className="mt-2 text-xs text-muted-foreground">⚠ Regenerating will break any live tracker scripts using the current key.</div>
        </CardContent>
      </Card>

      {/* TRACKER SCRIPT */}
      <div className="mt-2 mb-1 text-xs tracking-wide text-muted-foreground">TRACKER SCRIPT</div>
      <Card>
        <CardContent>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Paste into your site&apos;s &lt;head&gt;</div>
            <CopyButton text={trackerScript} />
          </div>
          <div className="font-mono text-xs leading-relaxed break-all text-primary">{trackerScript}</div>
        </CardContent>
      </Card>

      {/* DANGER ZONE */}
      <div className="mt-2 mb-1 text-xs tracking-wide text-muted-foreground">DANGER ZONE</div>
      <Card className="border-destructive/40">
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="mb-1 text-sm text-destructive">Deactivate Site</div>
            <div className="text-xs text-muted-foreground">Stops all tracking. Your data is preserved.</div>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setConfirm("deactivate");
              setConfirmError(null);
            }}
          >
            Deactivate
          </Button>
        </CardContent>
      </Card>

      {/* CONFIRMATION MODAL */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <Card className="w-full max-w-sm">
            <CardContent>
              <div className="mb-3 text-sm font-medium text-foreground">{confirm === "regenerate" ? "Regenerate API Key?" : "Deactivate Site?"}</div>
              <div className="mb-5 text-sm leading-relaxed text-muted-foreground">
                {confirm === "regenerate"
                  ? "Your current API key will stop working immediately. Any tracker scripts on your site will need to be updated with the new key."
                  : "This will stop all tracking. Your existing data will not be deleted. You can create a new site at any time."}
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
