// app/platform/network/NetworkClient.jsx
"use client";

import { useState } from "react";
import { inviteMember, removeMember } from "@/lib/actions/settings.actions";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crown, Mail, X } from "lucide-react";

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Member row — sidebar list item: avatar on the left, name on the
// right, email underneath. One row style for the owner and every member
// (and, dimmed, a declined invite) instead of a big standalone card each —
// the old cards (one owner "hero" card plus a grid of 260px-min member
// cards) spent most of their width on empty padding around one line of
// text. ──────────────────────────────────────────────────────────────────
function MemberRow({ member, isOwner, isYou, onRemove, busy }) {
  const isDeclined = member.status === "declined";
  const isMemberOwner = member.role === "owner";

  return (
    <div className={`flex items-center gap-3 py-2.5 ${isDeclined ? "opacity-50" : ""}`}>
      <InitialsAvatar label={member.user_email} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-sm font-medium text-foreground">
          {isMemberOwner && <Crown className="h-3 w-3 shrink-0 text-primary" />}
          <span className="truncate">{member.user_email || member.user_id}</span>
          {isYou && <span className="shrink-0 text-xs font-normal text-primary">(you)</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {isDeclined ? "Declined invite" : isMemberOwner ? "Owner" : member.created_at ? `Joined ${fmtDate(member.created_at)}` : "Member"}
        </div>
      </div>

      {isOwner && !isYou && !isMemberOwner && (
        <Button size="icon-sm" variant="ghost" onClick={() => onRemove(member)} disabled={busy === member.id} title="Remove">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ─── Pending invite row — deliberately NOT styled like a team-member
// card (no avatar, no "part of the team" framing): an invite someone
// hasn't accepted yet isn't a team member, just a sent email waiting on a
// response. Cancel is explicit, not a bare X, since that's the whole
// point of this row existing. ──────────────────────────────────────────
function PendingInviteRow({ invite, onCancel, busy }) {
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-border py-2.5 text-sm last:border-b-0">
      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-foreground">{invite.user_email || invite.user_id}</span>
      <span className="shrink-0 text-xs text-muted-foreground">sent {fmtDate(invite.created_at)}</span>
      <Button size="sm" variant="ghost" className="shrink-0 text-xs text-destructive hover:text-destructive" onClick={() => onCancel(invite)} disabled={busy === invite.id}>
        {busy === invite.id ? "Cancelling…" : "Cancel invite"}
      </Button>
    </div>
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
    <div className="flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-6">
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

        {/* ── TITLE ─────────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 text-lg font-semibold text-foreground">Network</div>
          <div className="text-sm text-muted-foreground">
            {owner.user_email && (
              <>
                Owner · <span className="text-foreground">{owner.user_email}</span> ·{" "}
              </>
            )}
            {active.length} member{active.length !== 1 ? "s" : ""}
          </div>
        </div>

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

              {pending.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <SectionLabel count={pending.length}>Sent invites, awaiting response</SectionLabel>
                  {pending.map((m) => (
                    <PendingInviteRow key={m.id} invite={m} onCancel={handleRemove} busy={busy} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isOwner && <div className="text-xs text-muted-foreground">Only the site owner can invite or remove members.</div>}
      </div>

      {/* ── SIDEBAR: members. Shown here for now — just who's on the team;
          avatar on the left, name + email on the right/below, one row
          each, instead of the old big owner-hero card + grid of
          part-empty member cards. Declined invites, if any, get their own
          small section below so they're visible without taking the same
          width-heavy treatment the old grid gave them. ────────────────── */}
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-72">
        <Card>
          <CardContent>
            <SectionLabel count={1 + active.length}>Members</SectionLabel>
            <div className="divide-y divide-border">
              <MemberRow member={owner} isOwner={isOwner} isYou={owner.user_id === currentUserId} onRemove={handleRemove} busy={busy} />
              {active.map((m) => (
                <MemberRow key={m.id} member={m} isOwner={isOwner} isYou={m.user_id === currentUserId} onRemove={handleRemove} busy={busy} />
              ))}
            </div>
            {active.length === 0 && <div className="pt-2.5 text-xs text-muted-foreground">No one else has access yet. Invite a teammate.</div>}
          </CardContent>
        </Card>

        {declined.length > 0 && (
          <Card>
            <CardContent>
              <SectionLabel count={declined.length}>Declined</SectionLabel>
              <div className="divide-y divide-border">
                {declined.map((m) => (
                  <MemberRow key={m.id} member={m} isOwner={isOwner} isYou={false} onRemove={handleRemove} busy={busy} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}
