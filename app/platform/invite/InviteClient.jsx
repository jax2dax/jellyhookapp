// app/platform/invite/InviteClient.jsx
"use client";

import { useState } from "react";
import { acceptInvite, declineInvite } from "@/lib/actions/site-management.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      <Card className="w-full max-w-sm">
        <CardContent className="py-2">
          <div className="mb-3 text-3xl">✅</div>
          <div className="mb-2 text-base font-bold text-primary">Invite accepted!</div>
          <div className="text-sm text-muted-foreground">Redirecting to your dashboard...</div>
        </CardContent>
      </Card>
    );
  }

  if (done === "declined") {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="py-2">
          <div className="mb-3 text-3xl">👋</div>
          <div className="mb-2 text-base font-bold text-foreground">Invite declined</div>
          <div className="text-sm text-muted-foreground">Redirecting to site setup...</div>
        </CardContent>
      </Card>
    );
  }

  // ── Main invite card ─────────────────────────────────────────────────────
  return (
    <Card className="w-full max-w-sm">
      <CardContent>
        <div className="mb-4 text-xs tracking-wide text-muted-foreground">YOU HAVE BEEN INVITED</div>

        <div className="mb-5">
          <div className="mb-1 text-xl font-bold text-foreground">{invite.siteName || invite.siteDomain}</div>
          {invite.siteName && <div className="text-sm text-muted-foreground">{invite.siteDomain}</div>}
        </div>

        <div className="mb-5 rounded-lg border bg-muted/30 p-3.5">
          <div className="mb-1.5 text-xs text-muted-foreground">Invited by</div>
          <div className="text-sm text-foreground">{invite.inviterEmail || "Site owner"}</div>

          <div className="mt-2.5 mb-1.5 text-xs text-muted-foreground">Your role</div>
          <Badge>{invite.role}</Badge>

          <div className="mt-2.5 mb-1 text-xs text-muted-foreground">Invited</div>
          <div className="text-sm text-muted-foreground">
            {new Date(invite.invitedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </div>

        <div className="mb-4 text-xs leading-relaxed text-muted-foreground">
          Accepting gives you access to all tracking data, leads, and analytics for this site. You can leave at any time from Settings.
        </div>

        {error && <div className="mb-3 text-xs text-destructive">Error: {error}</div>}

        <div className="flex gap-2.5">
          <Button className="flex-1" onClick={handleAccept} disabled={loading !== null}>
            {loading === "accept" ? "Accepting..." : "Accept Invite"}
          </Button>
          <Button className="flex-1" variant="destructive" onClick={handleDecline} disabled={loading !== null}>
            {loading === "decline" ? "Declining..." : "Decline"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
