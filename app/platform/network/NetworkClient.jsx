// app/platform/network/NetworkClient.jsx
"use client";

import { useState } from "react";
import { inviteMember, removeMember } from "@/lib/actions/settings.actions";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { StatTile } from "@/components/StatTile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Mail, UserCheck, UserMinus, UserX, X } from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Owner card ──────────────────────────────────────────
function OwnerCard({ member }) {
  return (
    <Card className="items-center border-primary/40 px-9 py-5">
      <CardContent className="flex flex-col items-center px-0">
        <Crown className="mb-2.5 h-5 w-5 text-primary" />
        <InitialsAvatar label={member.user_email} size="lg" className="h-14 w-14" />
        <div className="mt-3.5 max-w-55 truncate text-sm font-bold text-foreground">{member.user_email || "Owner"}</div>
        <Badge className="mt-2.5">OWNER</Badge>
      </CardContent>
    </Card>
  );
}

// ─── Member / Pending / Declined card ────────────────────
function MemberCard({ member, isOwner, isYou, onRemove, busy }) {
  const isPending = member.status === "pending_invite";
  const isDeclined = member.status === "declined";

  return (
    <Card className={`flex-row items-center gap-3 px-3.5 py-3 ${isDeclined ? "opacity-45" : ""} ${isPending ? "border-dashed border-warning/40" : ""}`}>
      <InitialsAvatar label={member.user_email} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${isDeclined ? "text-muted-foreground" : "text-foreground"}`}>
          {member.user_email || member.user_id}
          {isYou && <span className="ml-1.5 text-xs text-primary">(you)</span>}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge variant="outline">{member.role}</Badge>
          {isPending && <span className="text-xs text-warning">⏳ invited {fmtDate(member.created_at)}</span>}
          {isDeclined && <span className="text-xs text-muted-foreground">declined</span>}
          {!isPending && !isDeclined && member.created_at && <span className="text-xs text-muted-foreground">joined {fmtDate(member.created_at)}</span>}
        </div>
      </div>

      {isOwner && !isYou && (
        <Button size="icon-sm" variant="ghost" onClick={() => onRemove(member)} disabled={busy === member.id} title="Remove">
          <X className="h-4 w-4" />
        </Button>
      )}
    </Card>
  );
}

// ─── Section heading ─────────────────────────────────────
function SectionLabel({ children, count }) {
  return (
    <div className="mt-1 mb-2.5 flex items-center gap-2 text-xs tracking-wide text-muted-foreground uppercase">
      <span>{children}</span>
      {typeof count === "number" && <Badge variant="outline">{count}</Badge>}
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
    user_id: site.user_id,
    user_email: "Owner",
    role: "owner",
    status: "active",
  };
  const active = list.filter((m) => m.role !== "owner" && m.status === "active");
  const pending = list.filter((m) => m.status === "pending_invite");
  const declined = list.filter((m) => m.status === "declined");
  const isOwner = owner.user_id === currentUserId;

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await inviteMember(site.id, inviteEmail.trim());
      if (res.success) {
        const email = inviteEmail.trim().toLowerCase();
        setSuccess(`Invite sent to ${email}`);
        setInviteEmail("");
        setList((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            user_id: `pending:${email}`,
            user_email: email,
            role: "member",
            status: "pending_invite",
            created_at: new Date().toISOString(),
          },
        ]);
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
    setBusy(member.id);
    setError(null);
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
    <div className="flex max-w-4xl flex-col gap-6">
      {/* ── BANNER: your own pending invites to other sites ── */}
      {myInvites.length > 0 && (
        <a href="/platform/invite">
          <Card className="flex-row items-center gap-3 border-warning/40 bg-warning/10 px-4 py-3">
            <Mail className="h-4 w-4 text-warning" />
            <div className="flex-1 text-sm text-warning">
              You have {myInvites.length} pending invite{myInvites.length > 1 ? "s" : ""} to other site{myInvites.length > 1 ? "s" : ""}
            </div>
            <span className="text-xs text-warning">Review →</span>
          </Card>
        </a>
      )}

      {/* ── TITLE + STATS ─────────────────────────────────── */}
      <div>
        <div className="mb-1.5 text-lg font-semibold text-foreground">Network</div>
        <div className="mb-4 text-sm text-muted-foreground">
          {owner.user_email && (
            <>
              Owner · <span className="text-foreground">{owner.user_email}</span> ·{" "}
            </>
          )}
          {active.length} member{active.length !== 1 ? "s" : ""}
          {pending.length > 0 && <> · {pending.length} pending</>}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <StatTile icon={UserCheck} label="Members" value={active.length} />
          <StatTile icon={UserMinus} label="Pending" value={pending.length} />
          <StatTile icon={UserX} label="Declined" value={declined.length} />
        </div>
      </div>

      {/* ── TREE ──────────────────────────────────────────── */}
      <div>
        <SectionLabel>Hierarchy</SectionLabel>

        <div className="flex flex-col items-center gap-4">
          <OwnerCard member={owner} />

          {active.length > 0 && (
            <div className="grid w-full gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
              {active.map((m) => (
                <MemberCard key={m.id} member={m} isOwner={isOwner} isYou={m.user_id === currentUserId} onRemove={handleRemove} busy={busy} />
              ))}
            </div>
          )}

          {active.length === 0 && pending.length === 0 && (
            <div className="w-full rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No one else has access yet. Invite a teammate below.
            </div>
          )}
        </div>
      </div>

      {/* ── PENDING ───────────────────────────────────────── */}
      {pending.length > 0 && (
        <div>
          <SectionLabel count={pending.length}>Pending Invites</SectionLabel>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {pending.map((m) => (
              <MemberCard key={m.id} member={m} isOwner={isOwner} isYou={false} onRemove={handleRemove} busy={busy} />
            ))}
          </div>
        </div>
      )}

      {/* ── DECLINED (collapsed) ──────────────────────────── */}
      {declined.length > 0 && (
        <div>
          <SectionLabel count={declined.length}>Declined</SectionLabel>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {declined.map((m) => (
              <MemberCard key={m.id} member={m} isOwner={isOwner} isYou={false} onRemove={handleRemove} busy={busy} />
            ))}
          </div>
        </div>
      )}

      {/* ── INVITE FORM ───────────────────────────────────── */}
      {isOwner && (
        <Card>
          <CardContent>
            <SectionLabel>Invite a teammate</SectionLabel>
            <div className="flex gap-2">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setError(null);
                  setSuccess(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleInvite();
                }}
                placeholder="coworker@company.com"
                className="flex-1"
              />
              <Button onClick={handleInvite} disabled={inviteBusy || !inviteEmail.trim()} className="whitespace-nowrap">
                {inviteBusy ? "Sending…" : "Send Invite"}
              </Button>
            </div>
            {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
            {success && <div className="mt-2 text-xs text-primary">{success}</div>}
          </CardContent>
        </Card>
      )}

      {!isOwner && <div className="text-xs text-muted-foreground">Only the site owner can invite or remove members.</div>}
    </div>
  );
}
