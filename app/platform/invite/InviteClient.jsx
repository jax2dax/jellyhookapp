// app/platform/invite/InviteClient.jsx
"use client";

import { useState } from "react";
import { acceptInvite, declineInvite } from "@/lib/actions/site-management.actions";

export default function InviteClient({ invite }) {
  const [loading, setLoading] = useState(null); // "accept" | "decline" | null
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // "accepted" | "declined"

  async function handleAccept() {
    setLoading("accept");
    setError(null);
    try {
      const result = await acceptInvite();
      if (result.success) {
        setDone("accepted");
        // Redirect to platform after short delay so user sees the confirmation
        setTimeout(() => {
          window.location.href = "/platform";
        }, 1500);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleDecline() {
    setLoading("decline");
    setError(null);
    try {
      const result = await declineInvite();
      if (result.success) {
        setDone("declined");
        setTimeout(() => {
          window.location.href = "/platform/create-site";
        }, 1500);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  // ── Confirmation states ──────────────────────────────────────────────────
  if (done === "accepted") {
    return (
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
        <div style={{ color: "#4ade80", fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
          Invite accepted!
        </div>
        <div style={{ color: "#555", fontSize: 12 }}>
          Redirecting to your dashboard...
        </div>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👋</div>
        <div style={{ color: "#aaa", fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
          Invite declined
        </div>
        <div style={{ color: "#555", fontSize: 12 }}>
          Redirecting to site setup...
        </div>
      </div>
    );
  }

  // ── Main invite card ─────────────────────────────────────────────────────
  return (
    <div style={card}>
      <div style={{ color: "#555", fontSize: 11, letterSpacing: 1, marginBottom: 16 }}>
        YOU HAVE BEEN INVITED
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "#fff", fontSize: 20, fontWeight: "bold", marginBottom: 4 }}>
          {invite.siteName || invite.siteDomain}
        </div>
        {invite.siteName && (
          <div style={{ color: "#555", fontSize: 13, fontFamily: "monospace" }}>
            {invite.siteDomain}
          </div>
        )}
      </div>

      <div style={{
        background: "#0a0a0a", border: "1px solid #1a1a1a",
        borderRadius: 8, padding: "12px 14px", marginBottom: 20,
      }}>
        <div style={{ color: "#555", fontSize: 11, marginBottom: 6 }}>Invited by</div>
        <div style={{ color: "#aaa", fontSize: 13, fontFamily: "monospace" }}>
          {invite.inviterEmail || "Site owner"}
        </div>

        <div style={{ color: "#555", fontSize: 11, marginTop: 10, marginBottom: 6 }}>Your role</div>
        <div style={{
          display: "inline-block",
          color: "#4ade80", fontSize: 11,
          background: "#14532d", padding: "2px 8px",
          borderRadius: 4, fontFamily: "monospace",
        }}>
          {invite.role}
        </div>

        <div style={{ color: "#555", fontSize: 11, marginTop: 10, marginBottom: 4 }}>Invited</div>
        <div style={{ color: "#555", fontSize: 12 }}>
          {new Date(invite.invitedAt).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })}
        </div>
      </div>

      <div style={{ color: "#555", fontSize: 11, marginBottom: 16, lineHeight: 1.6 }}>
        Accepting gives you access to all tracking data, leads, and analytics for this site.
        You can leave at any time from Settings.
      </div>

      {error && (
        <div style={{ color: "#f87171", fontSize: 11, marginBottom: 12 }}>
          Error: {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={handleAccept}
          disabled={loading !== null}
          style={{
            flex: 1, padding: "10px 0",
            background: loading === "accept" ? "#14532d" : "#4ade80",
            color: "#000", border: "none", borderRadius: 6,
            fontSize: 13, fontFamily: "monospace", fontWeight: "bold",
            cursor: loading !== null ? "not-allowed" : "pointer",
            opacity: loading !== null && loading !== "accept" ? 0.5 : 1,
          }}
        >
          {loading === "accept" ? "Accepting..." : "Accept Invite"}
        </button>
        <button
          onClick={handleDecline}
          disabled={loading !== null}
          style={{
            flex: 1, padding: "10px 0",
            background: "#0a0a0a", color: "#f87171",
            border: "1px solid #7f1d1d", borderRadius: 6,
            fontSize: 13, fontFamily: "monospace",
            cursor: loading !== null ? "not-allowed" : "pointer",
            opacity: loading !== null && loading !== "decline" ? 0.5 : 1,
          }}
        >
          {loading === "decline" ? "Declining..." : "Decline"}
        </button>
      </div>
    </div>
  );
}

const card = {
  background: "#111",
  border: "1px solid #1a1a1a",
  borderRadius: 12,
  padding: 28,
  maxWidth: 380,
  width: "100%",
  fontFamily: "monospace",
};