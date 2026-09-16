// app/platform/network/NetworkClient.jsx
"use client";

import { useState } from "react";
import { inviteMember, removeMember } from "@/lib/actions/settings.actions";

// ─── helpers ─────────────────────────────────────────────
const AVATAR_COLORS = ["#4ade80", "#7dd3fc", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c"];
function colorFor(str) {
  let h = 0;
  const s = str || "?";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(email) {
  if (!email) return "?";
  return email.split("@")[0].slice(0, 2).toUpperCase();
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Avatar ──────────────────────────────────────────────
function Avatar({ email, size = 40 }) {
  const color = colorFor(email);
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: color, color: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: "bold", fontSize: Math.round(size * 0.36),
      fontFamily: "monospace", flexShrink: 0, letterSpacing: -0.5,
    }}>
      {initials(email)}
    </div>
  );
}

// ─── Owner card ──────────────────────────────────────────
function OwnerCard({ member }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "22px 36px",
      background: "linear-gradient(180deg, #141414 0%, #0d0d0d 100%)",
      border: "1px solid #4ade80",
      borderRadius: 16,
      boxShadow: "0 0 0 4px rgba(74,222,128,0.06), 0 8px 40px rgba(74,222,128,0.14)",
      minWidth: 260,
    }}>
      <div style={{ fontSize: 20, marginBottom: 10, filter: "saturate(1.5)" }}>👑</div>
      <Avatar email={member.user_email} size={56} />
      <div style={{
        color: "#fff", fontSize: 13, fontWeight: "bold",
        marginTop: 14, fontFamily: "monospace",
        maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {member.user_email || "Owner"}
      </div>
      <div style={{
        marginTop: 10, fontSize: 10, padding: "3px 12px", borderRadius: 99,
        background: "#14532d", color: "#4ade80",
        fontFamily: "monospace", letterSpacing: 1, fontWeight: "bold",
      }}>
        OWNER
      </div>
    </div>
  );
}

// ─── Member / Pending / Declined card ────────────────────
function MemberCard({ member, isOwner, isYou, onRemove, busy }) {
  const isPending = member.status === "pending_invite";
  const isDeclined = member.status === "declined";
  const border = isDeclined
    ? "#151515"
    : isPending
    ? "1px dashed rgba(245,158,11,0.35)"
    : "1px solid #1a1a1a";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      background: isDeclined ? "#0a0a0a" : "#111",
      border,
      borderRadius: 10,
      opacity: isDeclined ? 0.45 : 1,
      transition: "border-color 0.15s",
    }}>
      <Avatar email={member.user_email} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: isDeclined ? "#666" : "#fff", fontSize: 12,
          fontFamily: "monospace",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {member.user_email || member.user_id}
          {isYou && <span style={{ color: "#4ade80", fontSize: 10, marginLeft: 6 }}>(you)</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 5, alignItems: "center" }}>
          <span style={{
            fontSize: 9, color: "#888", background: "#1a1a1a",
            padding: "2px 7px", borderRadius: 4, fontFamily: "monospace",
            letterSpacing: 0.5, textTransform: "uppercase",
          }}>
            {member.role}
          </span>
          {isPending && (
            <span style={{ fontSize: 9, color: "#f59e0b", fontFamily: "monospace", letterSpacing: 0.3 }}>
              ⏳ invited {fmtDate(member.created_at)}
            </span>
          )}
          {isDeclined && (
            <span style={{ fontSize: 9, color: "#666", fontFamily: "monospace" }}>
              declined
            </span>
          )}
          {!isPending && !isDeclined && member.created_at && (
            <span style={{ fontSize: 9, color: "#444", fontFamily: "monospace" }}>
              joined {fmtDate(member.created_at)}
            </span>
          )}
        </div>
      </div>

      {isOwner && !isYou && (
        <button
          onClick={() => onRemove(member)}
          disabled={busy === member.id}
          title="Remove"
          style={{
            background: "none", border: "none",
            color: busy === member.id ? "#333" : "#555",
            cursor: busy === member.id ? "not-allowed" : "pointer",
            fontSize: 18, lineHeight: 1, padding: 4,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────
function SectionLabel({ children, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      marginBottom: 10, marginTop: 4,
      fontSize: 10, color: "#555", fontFamily: "monospace",
      letterSpacing: 1.5, textTransform: "uppercase",
    }}>
      <span>{children}</span>
      {typeof count === "number" && (
        <span style={{
          color: "#888", background: "#151515", border: "1px solid #1a1a1a",
          padding: "1px 7px", borderRadius: 99, fontSize: 9, letterSpacing: 0,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────
export default function NetworkClient({ site, members, currentUserId, myInvites = [] }) {
  const [list, setList] = useState(members || []);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const owner = list.find((m) => m.role === "owner") || {
    user_id: site.user_id, user_email: "Owner", role: "owner", status: "active",
  };
  const active = list.filter((m) => m.role !== "owner" && m.status === "active");
  const pending = list.filter((m) => m.status === "pending_invite");
  const declined = list.filter((m) => m.status === "declined");
  const isOwner = owner.user_id === currentUserId;

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteBusy(true); setError(null); setSuccess(null);
    try {
      const res = await inviteMember(site.id, inviteEmail.trim());
      if (res.success) {
        const email = inviteEmail.trim().toLowerCase();
        setSuccess(`Invite sent to ${email}`);
        setInviteEmail("");
        setList((prev) => [...prev, {
          id: `temp-${Date.now()}`,
          user_id: `pending:${email}`,
          user_email: email,
          role: "member",
          status: "pending_invite",
          created_at: new Date().toISOString(),
        }]);
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRemove(member) {
    setBusy(member.id); setError(null);
    try {
      const res = await removeMember(site.id, member.id);
      if (res.success) setList((prev) => prev.filter((m) => m.id !== member.id));
      else setError(res.error);
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{
      fontFamily: "monospace", color: "#ddd",
      display: "flex", flexDirection: "column", gap: 24,
      maxWidth: 900,
    }}>

      {/* ── BANNER: your own pending invites to other sites ── */}
      {myInvites.length > 0 && (
        <a href="/platform/invite" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px",
            background: "linear-gradient(90deg, rgba(245,158,11,0.14), rgba(245,158,11,0.04))",
            border: "1px solid rgba(245,158,11,0.35)",
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 16 }}>✉️</span>
            <div style={{ flex: 1, color: "#fbbf24", fontSize: 12 }}>
              You have {myInvites.length} pending invite{myInvites.length > 1 ? "s" : ""} to other site{myInvites.length > 1 ? "s" : ""}
            </div>
            <span style={{ color: "#fbbf24", fontSize: 11 }}>Review →</span>
          </div>
        </a>
      )}

      {/* ── TITLE + STATS ─────────────────────────────────── */}
      <div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: "bold", marginBottom: 6 }}>
          Network
        </div>
        <div style={{ color: "#555", fontSize: 12, marginBottom: 16 }}>
          {owner.user_email && (
            <>Owner · <span style={{ color: "#888" }}>{owner.user_email}</span> · </>
          )}
          {active.length} member{active.length !== 1 ? "s" : ""}
          {pending.length > 0 && <> · {pending.length} pending</>}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Members",  value: active.length,  color: "#4ade80" },
            { label: "Pending",  value: pending.length, color: "#f59e0b" },
            { label: "Declined", value: declined.length, color: "#666" },
          ].map((s) => (
            <div key={s.label} style={{
              padding: "10px 16px",
              background: "#0d0d0d", border: "1px solid #1a1a1a",
              borderRadius: 8, minWidth: 90,
            }}>
              <div style={{ color: "#555", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>
                {s.label.toUpperCase()}
              </div>
              <div style={{ color: s.color, fontSize: 20, fontWeight: "bold" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TREE ──────────────────────────────────────────── */}
      <div>
        <SectionLabel>Hierarchy</SectionLabel>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <OwnerCard member={owner} />

          {(active.length > 0 || pending.length > 0) && (
            <>
              {/* vertical connector */}
              <div style={{ width: 1, height: 28, background: "rgba(74,222,128,0.35)" }} />
              <div style={{
                width: 10, height: 10, borderRight: "1px solid rgba(74,222,128,0.35)",
                borderBottom: "1px solid rgba(74,222,128,0.35)",
                transform: "rotate(45deg)", marginTop: -6, marginBottom: 18,
              }} />
            </>
          )}

          {active.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 10, width: "100%",
            }}>
              {active.map((m) => (
                <MemberCard
                  key={m.id} member={m} isOwner={isOwner}
                  isYou={m.user_id === currentUserId}
                  onRemove={handleRemove} busy={busy}
                />
              ))}
            </div>
          )}

          {active.length === 0 && pending.length === 0 && (
            <div style={{
              padding: 24, color: "#555", fontSize: 12, textAlign: "center",
              border: "1px dashed #1a1a1a", borderRadius: 10, width: "100%",
            }}>
              No one else has access yet. Invite a teammate below.
            </div>
          )}
        </div>
      </div>

      {/* ── PENDING ───────────────────────────────────────── */}
      {pending.length > 0 && (
        <div>
          <SectionLabel count={pending.length}>Pending Invites</SectionLabel>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}>
            {pending.map((m) => (
              <MemberCard
                key={m.id} member={m} isOwner={isOwner}
                isYou={false} onRemove={handleRemove} busy={busy}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── DECLINED (collapsed) ──────────────────────────── */}
      {declined.length > 0 && (
        <div>
          <SectionLabel count={declined.length}>Declined</SectionLabel>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 10,
          }}>
            {declined.map((m) => (
              <MemberCard
                key={m.id} member={m} isOwner={isOwner}
                isYou={false} onRemove={handleRemove} busy={busy}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── INVITE FORM ───────────────────────────────────── */}
      {isOwner && (
        <div style={{
          padding: 16, background: "#0d0d0d",
          border: "1px solid #1a1a1a", borderRadius: 10,
        }}>
          <SectionLabel>Invite a teammate</SectionLabel>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setError(null); setSuccess(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              placeholder="coworker@company.com"
              style={{
                flex: 1, background: "#0a0a0a", border: "1px solid #2a2a2a",
                borderRadius: 6, padding: "9px 12px", color: "#fff",
                fontSize: 12, fontFamily: "monospace", outline: "none",
              }}
            />
            <button
              onClick={handleInvite}
              disabled={inviteBusy || !inviteEmail.trim()}
              style={{
                padding: "9px 20px",
                background: "#4ade80", color: "#000",
                border: "none", borderRadius: 6,
                fontSize: 12, fontFamily: "monospace", fontWeight: "bold",
                cursor: inviteBusy || !inviteEmail.trim() ? "not-allowed" : "pointer",
                opacity: inviteBusy || !inviteEmail.trim() ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {inviteBusy ? "Sending…" : "Send Invite"}
            </button>
          </div>
          {error && <div style={{ color: "#f87171", fontSize: 11, marginTop: 8 }}>{error}</div>}
          {success && <div style={{ color: "#4ade80", fontSize: 11, marginTop: 8 }}>{success}</div>}
        </div>
      )}

      {!isOwner && (
        <div style={{ color: "#555", fontSize: 11 }}>
          Only the site owner can invite or remove members.
        </div>
      )}
    </div>
  );
}