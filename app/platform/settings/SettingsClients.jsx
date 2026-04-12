// app/platform/settings/SettingsClient.jsx
// Client component — handles all form state, edits, confirmations
// Receives site as prop from the server page — no client-side fetching
// "use client" required because it uses useState and event handlers

"use client";

import { useState } from "react";
import {
  updateSiteDomain,
  updateSiteName,
  regenerateApiKey,
  toggleSiteActive,
  deactivateSite,
} from "@/lib/actions/settings.actions";

// ─── small reusable inline components ────────────────────

// StatusBadge — green Active / red Inactive pill
function StatusBadge({ active }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: "bold",
      background: active ? "#14532d" : "#450a0a",
      color: active ? "#4ade80" : "#f87171",
    }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// CopyButton — copies text to clipboard, shows "Copied!" for 2s
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

// EditableRow — a settings row with inline edit mode
// Shows label + value, clicking Edit reveals an input + Save/Cancel
function EditableRow({ label, value, onSave, loading, placeholder = "" }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (input.trim() === value) { setEditing(false); return; } // no change
    setSaving(true);
    setError(null);
    const result = await onSave(input.trim());
    setSaving(false);
    if (result.success) {
      setEditing(false);
    } else {
      setError(result.error);
    }
  }

  return (
    <div style={{
      padding: "14px 16px",
      background: "#111",
      border: "1px solid #1a1a1a",
      borderRadius: 8,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: editing ? 10 : 0,
      }}>
        <div style={{ color: "#555", fontSize: 11 }}>{label}</div>
        {!editing && (
          <button
            onClick={() => { setInput(value); setEditing(true); setError(null); }}
            style={{
              fontSize: 10, color: "#555", background: "none",
              border: "1px solid #2a2a2a", borderRadius: 4,
              padding: "2px 8px", cursor: "pointer", fontFamily: "monospace",
            }}
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        <div style={{ color: "#fff", fontSize: 13, marginTop: 4, wordBreak: "break-all" }}>
          {value}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            style={{
              background: "#0a0a0a", border: "1px solid #333",
              borderRadius: 6, padding: "8px 10px",
              color: "#fff", fontSize: 13, fontFamily: "monospace",
              outline: "none", width: "100%", boxSizing: "border-box",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
            autoFocus
          />
          {error && (
            <div style={{ color: "#f87171", fontSize: 11 }}>Error: {error}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 16px", background: "#4ade80", color: "#000",
                border: "none", borderRadius: 6, fontSize: 12,
                fontFamily: "monospace", fontWeight: "bold",
                cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null); }}
              style={{
                padding: "6px 16px", background: "#1a1a1a", color: "#888",
                border: "1px solid #2a2a2a", borderRadius: 6, fontSize: 12,
                fontFamily: "monospace", cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main settings client ─────────────────────────────────

export default function SettingsClient({ site: initialSite }) {
  // site state — updated locally after each successful mutation
  // so UI reflects changes instantly without a full page reload
  const [site, setSite] = useState(initialSite);

  // confirmation modal state — for destructive actions
  const [confirm, setConfirm] = useState(null); // null | "regenerate" | "deactivate"
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState(null);

  // ── mutation handlers ──────────────────────────────────

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
      } else {
        setConfirmError(result.error);
      }
    }

    if (confirm === "deactivate") {
      const result = await deactivateSite(site.id);
      if (result.success) {
        // Redirect to create-site since site is now gone
        window.location.href = "/platform/create-site";
      } else {
        setConfirmError(result.error);
      }
    }

    setConfirmLoading(false);
  }

  // tracker script — updates live when domain or api_key changes
  const trackerScript = `<script src="http://localhost:3000/tracker.js" data-key="${site.api_key}"></script>`;
  // 🚀 DEPLOY: replace localhost:3000 above with production domain

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── SITE INFO ─────────────────────────────── */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>
        SITE INFORMATION
      </div>

      <EditableRow
        label="Site Name"
        value={site.name ?? ""}
        placeholder="My Site"
        onSave={handleUpdateName}
      />

      <EditableRow
        label="Domain"
        value={site.domain ?? ""}
        placeholder="yourdomain.com"
        onSave={handleUpdateDomain}
      />

      {/* Read-only rows */}
      {[
        { label: "Site ID",    value: site.id },
        { label: "Plan",       value: site.plan ?? "free" },
        { label: "Event Limit", value: site.monthly_event_limit?.toLocaleString() ?? "—" },
        { label: "Created",    value: new Date(site.created_at).toLocaleDateString() },
      ].map((row) => (
        <div key={row.label} style={{
          padding: "14px 16px", background: "#111",
          border: "1px solid #1a1a1a", borderRadius: 8,
        }}>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 4 }}>{row.label}</div>
          <div style={{ color: "#aaa", fontSize: 13, wordBreak: "break-all" }}>{row.value}</div>
        </div>
      ))}

      {/* Status row with toggle */}
      <div style={{
        padding: "14px 16px", background: "#111",
        border: "1px solid #1a1a1a", borderRadius: 8,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ color: "#555", fontSize: 11, marginBottom: 6 }}>Status</div>
          <StatusBadge active={site.is_active} />
        </div>
        <button
          onClick={handleToggleActive}
          style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 11,
            fontFamily: "monospace", cursor: "pointer",
            background: site.is_active ? "#450a0a" : "#14532d",
            color: site.is_active ? "#f87171" : "#4ade80",
            border: `1px solid ${site.is_active ? "#7f1d1d" : "#166534"}`,
          }}
        >
          {site.is_active ? "Pause Tracking" : "Resume Tracking"}
        </button>
      </div>

      {/* ── API KEY ───────────────────────────────── */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>
        API KEY
      </div>

      <div style={{
        padding: "14px 16px", background: "#111",
        border: "1px solid #1a1a1a", borderRadius: 8,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 8,
        }}>
          <div style={{ color: "#555", fontSize: 11 }}>API Key</div>
          <div style={{ display: "flex", gap: 6 }}>
            <CopyButton text={site.api_key} />
            <button
              onClick={() => { setConfirm("regenerate"); setConfirmError(null); }}
              style={{
                padding: "4px 10px", fontSize: 10, borderRadius: 4,
                background: "#1a1a1a", color: "#f87171",
                border: "1px solid #2a2a2a", cursor: "pointer", fontFamily: "monospace",
              }}
            >
              Regenerate
            </button>
          </div>
        </div>
        <div style={{
          color: "#fff", fontSize: 12, wordBreak: "break-all",
          fontFamily: "monospace", letterSpacing: 0.5,
        }}>
          {site.api_key}
        </div>
        <div style={{ color: "#555", fontSize: 10, marginTop: 8 }}>
          ⚠ Regenerating will break any live tracker scripts using the current key.
        </div>
      </div>

      {/* ── TRACKER SCRIPT ───────────────────────── */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>
        TRACKER SCRIPT
      </div>

      <div style={{
        padding: "14px 16px", background: "#0d0d0d",
        border: "1px solid #222", borderRadius: 8,
      }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 8,
        }}>
          <div style={{ color: "#555", fontSize: 11 }}>
            Paste this into your site's &lt;head&gt;
          </div>
          <CopyButton text={trackerScript} />
        </div>
        <div style={{
          color: "#4ade80", fontSize: 11,
          wordBreak: "break-all", fontFamily: "monospace", lineHeight: 1.6,
        }}>
          {trackerScript}
        </div>
      </div>

      {/* ── DANGER ZONE ──────────────────────────── */}
      <div style={{ color: "#555", fontSize: 10, letterSpacing: 1, marginTop: 8, marginBottom: 4 }}>
        DANGER ZONE
      </div>

      <div style={{
        padding: "14px 16px", background: "#0d0d0d",
        border: "1px solid #7f1d1d", borderRadius: 8,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ color: "#f87171", fontSize: 12, marginBottom: 4 }}>
            Deactivate Site
          </div>
          <div style={{ color: "#555", fontSize: 11 }}>
            Stops all tracking. Your data is preserved.
          </div>
        </div>
        <button
          onClick={() => { setConfirm("deactivate"); setConfirmError(null); }}
          style={{
            padding: "6px 14px", background: "#450a0a", color: "#f87171",
            border: "1px solid #7f1d1d", borderRadius: 6,
            fontSize: 11, fontFamily: "monospace", cursor: "pointer",
          }}
        >
          Deactivate
        </button>
      </div>

      {/* ── CONFIRMATION MODAL ───────────────────── */}
      {confirm && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }}>
          <div style={{
            background: "#111", border: "1px solid #2a2a2a",
            borderRadius: 10, padding: 24, maxWidth: 400, width: "90%",
            fontFamily: "monospace",
          }}>
            <div style={{ color: "#fff", fontSize: 14, marginBottom: 12 }}>
              {confirm === "regenerate" ? "Regenerate API Key?" : "Deactivate Site?"}
            </div>
            <div style={{ color: "#888", fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
              {confirm === "regenerate"
                ? "Your current API key will stop working immediately. Any tracker scripts on your site will need to be updated with the new key."
                : "This will stop all tracking. Your existing data will not be deleted. You can create a new site at any time."
              }
            </div>
            {confirmError && (
              <div style={{ color: "#f87171", fontSize: 11, marginBottom: 12 }}>
                Error: {confirmError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleConfirmAction}
                disabled={confirmLoading}
                style={{
                  padding: "8px 20px", background: "#f87171", color: "#000",
                  border: "none", borderRadius: 6, fontSize: 12,
                  fontWeight: "bold", cursor: confirmLoading ? "not-allowed" : "pointer",
                  opacity: confirmLoading ? 0.6 : 1,
                }}
              >
                {confirmLoading ? "Processing..." : "Confirm"}
              </button>
              <button
                onClick={() => { setConfirm(null); setConfirmError(null); }}
                disabled={confirmLoading}
                style={{
                  padding: "8px 20px", background: "#1a1a1a", color: "#888",
                  border: "1px solid #2a2a2a", borderRadius: 6,
                  fontSize: 12, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}