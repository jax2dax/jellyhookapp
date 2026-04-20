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
// ✅ ALL functions imported from ONE file: settings.actions.js
// No split imports across site-management.actions and settings.actions

// ─── StatusBadge ─────────────────────────────────────────
function StatusBadge({ active }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: "bold",
      background: active ? "#14532d" : "#450a0a",
      color: active ? "#4ade80" : "#f87171",
    }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ─── CopyButton ───────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={{
        padding: "4px 10px", fontSize: 10, borderRadius: 4,
        background: copied ? "#14532d" : "#1a1a1a",
        color: copied ? "#4ade80" : "#888",
        border: "1px solid #2a2a2a", cursor: "pointer", fontFamily: "monospace",
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ─── EditableRow ──────────────────────────────────────────
function EditableRow({ label, value, onSave, placeholder = "" }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (input.trim() === value) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    const result = await onSave(input.trim());
    setSaving(false);
    if (result.success) setEditing(false);
    else setError(result.error);
  }

  return (
    <div style={{ padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: editing ? 10 : 0 }}>
        <div style={{ color: "#555", fontSize: 11 }}>{label}</div>
        {!editing && (
          <button onClick={() => { setInput(value); setEditing(true); setError(null); }}
            style={{ fontSize: 10, color: "#555", background: "none", border: "1px solid #2a2a2a", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "monospace" }}>
            Edit
          </button>
        )}
      </div>
      {!editing ? (
        <div style={{ color: "#fff", fontSize: 13, marginTop: 4, wordBreak: "break-all" }}>{value}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder}
            style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 13, fontFamily: "monospace", outline: "none", width: "100%", boxSizing: "border-box" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
          {error && <div style={{ color: "#f87171", fontSize: 11 }}>Error: {error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "6px 16px", background: "#4ade80", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontFamily: "monospace", fontWeight: "bold", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setError(null); }}
              style={{ padding: "6px 16px", background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a", borderRadius: 6, fontSize: 12, fontFamily: "monospace", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
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

  // ✅ isOwner check: check site_members rows first, then fall back to site.user_id === currentUserId
  // This handles the case where members array has the owner row, AND the legacy case where it doesn't yet
  const isOwnerByMembership = members.some(
    (m) => m.user_id === currentUserId && m.role === "owner"
  );
  // siteOwnerId is site.user_id passed from parent — fallback for legacy sites
  const isOwner = isOwnerByMembership || siteOwnerId === currentUserId;

  console.log(`[TeamMembers] currentUserId=${currentUserId} siteOwnerId=${siteOwnerId} isOwnerByMembership=${isOwnerByMembership} isOwner=${isOwner} membersCount=${members.length}`);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      // ✅ inviteMember(siteId, email) — positional args matching settings.actions.js signature
      const result = await inviteMember(siteId, inviteEmail.trim());

      if (result.success) {
        const email = inviteEmail.trim().toLowerCase();
        setInviteSuccess(`✅ Invite sent to ${email}`);
        setInviteEmail("");
        // Optimistically add to list as pending
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
      // ✅ removeMember(siteId, memberRowId) — positional args matching settings.actions.js signature
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
    <div style={{ padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Debug line — remove after confirming it works */}
      <div style={{ color: "#333", fontSize: 10, fontFamily: "monospace" }}>
        debug: isOwner={String(isOwner)} membersInTable={members.length} yourId={currentUserId?.slice(-8)}
      </div>

      {/* Member list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.length === 0 && (
          <div style={{ color: "#555", fontSize: 12 }}>No members in table yet — save first action will create your row.</div>
        )}
        {members.map((member) => {
          const isPending = member.user_id?.startsWith("pending:");
          const isYou = member.user_id === currentUserId;
          return (
            <div key={member.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 10px", background: "#0d0d0d", borderRadius: 6, border: "1px solid #1a1a1a",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ color: "#fff", fontSize: 12, fontFamily: "monospace" }}>
                  {member.user_email || member.user_id}
                  {isYou && <span style={{ color: "#4ade80", fontSize: 10, marginLeft: 6 }}>(you)</span>}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#555", background: "#1a1a1a", padding: "1px 6px", borderRadius: 4, border: "1px solid #2a2a2a" }}>
                    {member.role}
                  </span>
                  {isPending && <span style={{ fontSize: 10, color: "#f59e0b" }}>pending invite</span>}
                </div>
              </div>

              {isOwner && !isYou && (
                <button onClick={() => handleRemove(member)} disabled={removingId === member.id}
                  style={{ padding: "3px 10px", fontSize: 10, background: "none", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: 4, cursor: removingId === member.id ? "not-allowed" : "pointer", fontFamily: "monospace", opacity: removingId === member.id ? 0.5 : 1 }}>
                  {removingId === member.id ? "..." : "Remove"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite form — shown to owner */}
      {isOwner && (
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 12 }}>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 8 }}>Invite a team member by email</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); setInviteSuccess(null); }}
              placeholder="coworker@company.com"
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              style={{ flex: 1, background: "#0a0a0a", border: "1px solid #333", borderRadius: 6, padding: "7px 10px", color: "#fff", fontSize: 12, fontFamily: "monospace", outline: "none" }}
            />
            <button onClick={handleInvite} disabled={inviteLoading || !inviteEmail.trim()}
              style={{ padding: "7px 16px", background: "#4ade80", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontFamily: "monospace", fontWeight: "bold", cursor: inviteLoading || !inviteEmail.trim() ? "not-allowed" : "pointer", opacity: inviteLoading || !inviteEmail.trim() ? 0.6 : 1, whiteSpace: "nowrap" }}>
              {inviteLoading ? "Sending..." : "Send Invite"}
            </button>
          </div>
          {inviteError && <div style={{ color: "#f87171", fontSize: 11, marginTop: 6 }}>{inviteError}</div>}
          {inviteSuccess && <div style={{ color: "#4ade80", fontSize: 11, marginTop: 6 }}>{inviteSuccess}</div>}
          <div style={{ color: "#333", fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
            They get access when they sign up with this email. If already signed up, access is granted on their next login.
          </div>
        </div>
      )}

      {!isOwner && (
        <div style={{ color: "#555", fontSize: 11, borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>
          Only the site owner can invite or remove members.
        </div>
      )}
    </div>
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
      if (result.success) { setSite(result.data); setConfirm(null); }
      else setConfirmError(result.error);
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
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* SITE INFO */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>SITE INFORMATION</div>
      <EditableRow label="Site Name" value={site.name ?? ""} placeholder="My Site" onSave={handleUpdateName} />
      <EditableRow label="Domain" value={site.domain ?? ""} placeholder="yourdomain.com" onSave={handleUpdateDomain} />

      {[
        { label: "Site ID",     value: site.id },
        { label: "Plan",        value: site.plan ?? "free" },
        { label: "Event Limit", value: site.monthly_event_limit?.toLocaleString() ?? "—" },
        { label: "Created",     value: new Date(site.created_at).toLocaleDateString() },
      ].map((row) => (
        <div key={row.label} style={{ padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 4 }}>{row.label}</div>
          <div style={{ color: "#aaa", fontSize: 13, wordBreak: "break-all" }}>{row.value}</div>
        </div>
      ))}

      {/* Status toggle */}
      <div style={{ padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 6 }}>Status</div>
          <StatusBadge active={site.is_active} />
        </div>
        <button onClick={handleToggleActive} style={{ padding: "6px 14px", borderRadius: 6, fontSize: 11, fontFamily: "monospace", cursor: "pointer", background: site.is_active ? "#450a0a" : "#14532d", color: site.is_active ? "#f87171" : "#4ade80", border: `1px solid ${site.is_active ? "#7f1d1d" : "#166534"}` }}>
          {site.is_active ? "Pause Tracking" : "Resume Tracking"}
        </button>
      </div>

      {/* TEAM MEMBERS */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>TEAM MEMBERS</div>
      <TeamMembers
        siteId={site.id}
        initialMembers={initialMembers}
        currentUserId={currentUserId}
        siteOwnerId={site.user_id}  // ✅ passed for legacy fallback isOwner check
      />

      {/* API KEY */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>API KEY</div>
      <div style={{ padding: "14px 16px", background: "#111", border: "1px solid #1a1a1a", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ color: "#555", fontSize: 11 }}>API Key</div>
          <div style={{ display: "flex", gap: 6 }}>
            <CopyButton text={site.api_key} />
            <button onClick={() => { setConfirm("regenerate"); setConfirmError(null); }}
              style={{ padding: "4px 10px", fontSize: 10, borderRadius: 4, background: "#1a1a1a", color: "#f87171", border: "1px solid #2a2a2a", cursor: "pointer", fontFamily: "monospace" }}>
              Regenerate
            </button>
          </div>
        </div>
        <div style={{ color: "#fff", fontSize: 12, wordBreak: "break-all", fontFamily: "monospace", letterSpacing: 0.5 }}>{site.api_key}</div>
        <div style={{ color: "#555", fontSize: 10, marginTop: 8 }}>⚠ Regenerating will break any live tracker scripts using the current key.</div>
      </div>

      {/* TRACKER SCRIPT */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>TRACKER SCRIPT</div>
      <div style={{ padding: "14px 16px", background: "#0d0d0d", border: "1px solid #222", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ color: "#555", fontSize: 11 }}>Paste into your site's &lt;head&gt;</div>
          <CopyButton text={trackerScript} />
        </div>
        <div style={{ color: "#4ade80", fontSize: 11, wordBreak: "break-all", fontFamily: "monospace", lineHeight: 1.6 }}>{trackerScript}</div>
      </div>

      {/* DANGER ZONE */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>DANGER ZONE</div>
      <div style={{ padding: "14px 16px", background: "#0d0d0d", border: "1px solid #7f1d1d", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#f87171", fontSize: 12, marginBottom: 4 }}>Deactivate Site</div>
          <div style={{ color: "#555", fontSize: 11 }}>Stops all tracking. Your data is preserved.</div>
        </div>
        <button onClick={() => { setConfirm("deactivate"); setConfirmError(null); }}
          style={{ padding: "6px 14px", background: "#450a0a", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: 6, fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>
          Deactivate
        </button>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, padding: 24, maxWidth: 400, width: "90%", fontFamily: "monospace" }}>
            <div style={{ color: "#fff", fontSize: 14, marginBottom: 12 }}>
              {confirm === "regenerate" ? "Regenerate API Key?" : "Deactivate Site?"}
            </div>
            <div style={{ color: "#888", fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
              {confirm === "regenerate"
                ? "Your current API key will stop working immediately. Any tracker scripts on your site will need to be updated with the new key."
                : "This will stop all tracking. Your existing data will not be deleted. You can create a new site at any time."}
            </div>
            {confirmError && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 12 }}>Error: {confirmError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleConfirmAction} disabled={confirmLoading}
                style={{ padding: "8px 20px", background: "#f87171", color: "#000", border: "none", borderRadius: 6, fontSize: 12, fontWeight: "bold", cursor: confirmLoading ? "not-allowed" : "pointer", opacity: confirmLoading ? 0.6 : 1 }}>
                {confirmLoading ? "Processing..." : "Confirm"}
              </button>
              <button onClick={() => { setConfirm(null); setConfirmError(null); }} disabled={confirmLoading}
                style={{ padding: "8px 20px", background: "#1a1a1a", color: "#888", border: "1px solid #2a2a2a", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}