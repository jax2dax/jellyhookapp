// app/platform/settings/SettingsClients.jsx
"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import {
  updateSiteDomain,
  updateSiteName,
  regenerateApiKey,
  toggleSiteActive,
  leaveSite,
  inviteMember,
  removeMember,
  setMemberRole,
  transferOwnership,
} from "@/lib/actions/settings.actions";
import { can, canManageMember, assignableRoles } from "@/lib/tracking/permissions";
import { rotationStatus } from "@/lib/tracking/keys";
import { KeyRotationNotice, TrackingStatusCard, AllowedHostsCard, TrackingHealthCard, FormModeCard } from "./TrackingCards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function SectionLabel({ children }) {
  return <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</div>;
}

// One value in the "Overview" flex row — sizes to its own content instead of
// a fixed grid track, and wraps onto a new line on narrow screens rather
// than the whole row getting squeezed. This is what replaces the old
// "one small fat Card per fact" layout (Site ID / Plan / Event Limit /
// Created each in their own full-width Card, stacked all the way down).
function Fact({ label, value, mono = false }) {
  return (
    <div className="min-w-[140px] flex-1 basis-40">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm break-all text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

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

  return (
    <Card>
      <CardContent className={editing ? "space-y-2.5" : ""}>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">{label}</div>
          {!editing && !readOnly && (
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
        )}
      </CardContent>
    </Card>
  );
}

// ─── TeamMembers ──────────────────────────────────────────
function TeamMembers({ siteId, initialMembers, currentUserId, siteOwnerId, role: roleProp }) {
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
  // The role the server resolved; falls back to the old owner check only if it was not passed.
  const role = roleProp || (isOwner ? "owner" : "member");
  const roleOptions = assignableRoles(role);
  const [inviteRole, setInviteRole] = useState("member");
  const [busyId, setBusyId] = useState(null);
  const [confirmTransfer, setConfirmTransfer] = useState(null);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const result = await inviteMember(siteId, inviteEmail.trim(), inviteRole);

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
            role: inviteRole,
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

  async function handleSetRole(member, newRole) {
    setBusyId(member.id);
    setInviteError(null);
    const result = await setMemberRole(siteId, member.id, newRole);
    if (result.success) setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: newRole } : m)));
    else setInviteError(result.error);
    setBusyId(null);
  }

  async function handleTransfer(member) {
    setBusyId(member.id);
    setInviteError(null);
    const result = await transferOwnership(siteId, member.id);
    if (result.success) window.location.reload();
    else {
      setInviteError(result.error);
      setBusyId(null);
      setConfirmTransfer(null);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        {/* Member list */}
        <div className="flex flex-col gap-2">
          {members.length === 0 && <div className="text-sm text-muted-foreground">No members in table yet. Your first save creates your row.</div>}
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

                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {!isPending && !isYou && member.role !== "owner" && can(role, "members.set_role") && canManageMember(role, member.role, "members.set_role") && roleOptions.length > 0 && (
                    <select
                      aria-label="Role"
                      className="h-7 rounded-md border bg-background px-1.5 text-xs text-foreground"
                      value={member.role}
                      disabled={busyId === member.id}
                      onChange={(e) => handleSetRole(member, e.target.value)}
                    >
                      {[...new Set([member.role, ...roleOptions])].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isPending && !isYou && member.role !== "owner" && can(role, "ownership.transfer") && (
                    <Button size="xs" variant="outline" disabled={busyId === member.id} onClick={() => setConfirmTransfer(member)}>
                      Make owner
                    </Button>
                  )}
                  {!isYou && can(role, "members.remove") && canManageMember(role, member.role, "members.remove") && (
                    <Button size="xs" variant="destructive" onClick={() => handleRemove(member)} disabled={removingId === member.id}>
                      {removingId === member.id ? "..." : "Remove"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Invite form — shown to owner */}
        {can(role, "members.invite") && (
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
              {roleOptions.length > 1 && (
                <select aria-label="Invite as" className="h-9 rounded-md border bg-background px-2 text-sm text-foreground" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
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

        {!can(role, "members.invite") && <div className="border-t pt-2.5 text-xs text-muted-foreground">Only the site owner or an admin can invite or remove members.</div>}

        {confirmTransfer && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed text-muted-foreground">
            Make <strong className="text-foreground">{confirmTransfer.user_email}</strong> the owner? You become an admin: you keep working access but can no longer delete the site, transfer ownership, or remove the new owner.
            <div className="mt-2 flex gap-2">
              <Button size="xs" variant="destructive" disabled={busyId === confirmTransfer.id} onClick={() => handleTransfer(confirmTransfer)}>
                {busyId === confirmTransfer.id ? "Transferring..." : "Transfer ownership"}
              </Button>
              <Button size="xs" variant="outline" onClick={() => setConfirmTransfer(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main SettingsClient ──────────────────────────────────
export default function SettingsClient({ site: initialSite, initialMembers, currentUserId, visitorCount = 0, role = null, ingestion = null }) {
  const [site, setSite] = useState(initialSite);
  const [rotation, setRotation] = useState(ingestion?.rotation || null);
  const leaveError = null; // errors show in the confirm dialog
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
  const trackerScript = `<script src="${trackerBase}/tracker.js" data-key="${site.api_key}"></script>`;

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
      {/* SITE NAME + DOMAIN — the two actually-editable fields, side by side rather than one below the other */}
      <section>
        <SectionLabel>Site information</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EditableRow label="Site Name" value={site.name ?? ""} placeholder="My Site" onSave={handleUpdateName} readOnly={!can(role, "site.rename")} />
          <EditableRow
            label="Domain"
            value={site.domain ?? ""}
            placeholder="yourdomain.com"
            onSave={handleUpdateDomain}
            readOnly={!can(role, "site.change_domain")}
            note="The tracker must report from this domain. After a change the site has to be verified again, and events from the old domain stop being recorded until then."
          />
        </div>
      </section>

      <section>
        <SectionLabel>Lead tracking</SectionLabel>
        <FormModeCard siteId={site.id} initial={site.specify_form === true} role={role} onChanged={setSite} />
      </section>

      {/* OVERVIEW — one flexible card whose facts wrap and size to their own
          content (flex-wrap, no fixed grid track), instead of five separate
          fat single-line Cards stacked all the way down the page. */}
      <section>
        <SectionLabel>Overview</SectionLabel>
        <Card>
          <CardContent className="flex flex-wrap gap-6">
            <Fact label="Site ID" value={site.id} mono />
            <Fact label="Plan" value={site.plan ?? "free"} />
            <Fact label="Created" value={new Date(site.created_at).toLocaleDateString()} />
            <Fact
              label="Teams involved"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  {visitorCount.toLocaleString()}
                </span>
              }
            />
            <div className="min-w-[140px] flex-1 basis-40">
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge active={site.is_active} />
                {can(role, "site.toggle_tracking") && (
                  <Button size="xs" variant={site.is_active ? "destructive" : "default"} onClick={handleToggleActive}>
                    {site.is_active ? "Pause" : "Resume"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* TRACKING — is the script on the right site, is data arriving, are the attributes placed correctly */}
      {ingestion && (
        <section>
          <SectionLabel>Tracking</SectionLabel>
          <div className="flex flex-col gap-4">
            <TrackingStatusCard siteId={site.id} status={ingestion} role={role} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AllowedHostsCard siteId={site.id} domain={site.domain} status={ingestion} role={role} />
              <TrackingHealthCard status={ingestion} />
            </div>
          </div>
        </section>
      )}

      {/* TEAM MEMBERS */}
      <section>
        <SectionLabel>Team members</SectionLabel>
        <TeamMembers siteId={site.id} initialMembers={initialMembers} currentUserId={currentUserId} siteOwnerId={site.user_id} role={role} />
      </section>

      {/* API KEY + TRACKER SCRIPT — side by side on wide screens instead of
          each hogging a full row underneath the other. */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardContent>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">API Key</div>
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
            <div className="mt-2 text-xs text-muted-foreground">Regenerating gives you a new key. The current one keeps working for 72 hours so your live site does not lose data while you update it.</div>
            <KeyRotationNotice rotation={rotation} />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Paste into your site&apos;s &lt;head&gt;</div>
              <CopyButton text={trackerScript} />
            </div>
            <div className="font-mono text-xs leading-relaxed break-all text-primary">{trackerScript}</div>
          </CardContent>
        </Card>
      </section>

      {/* LEAVE — anyone but the owner */}
      {role && role !== "owner" && (
        <section>
          <SectionLabel>Your access</SectionLabel>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1 text-sm text-foreground">Leave this site</div>
                <div className="text-xs text-muted-foreground">You lose access to its data. The owner can invite you again.</div>
                {leaveError && <div className="mt-1 text-xs text-destructive">{leaveError}</div>}
              </div>
              <Button size="sm" variant="destructive" onClick={() => setConfirm("leave")}>
                Leave site
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* CONFIRMATION MODAL */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <Card className="w-full max-w-sm">
            <CardContent>
              <div className="mb-3 text-sm font-medium text-foreground">{confirm === "regenerate" ? "Regenerate API Key?" : "Leave this site?"}</div>
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
