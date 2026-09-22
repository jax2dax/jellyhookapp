// components/ProfileSettings.jsx
// Lets a person set their own display name for this site — independent of
// whatever their Clerk account/email says. Saved once here, never
// overwritten by future Clerk profile edits (see app/api/webhooks/clerk).
"use client";

import { useState } from "react";
import { updateMyProfile } from "@/lib/actions/profile.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InitialsAvatar } from "@/components/InitialsAvatar";

export default function ProfileSettings({ profile }) {
  const [firstName, setFirstName] = useState(profile?.first_name || "");
  const [lastName, setLastName] = useState(profile?.last_name || "");
  const [phone, setPhone] = useState(profile?.phone != null ? String(profile.phone) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    const result = await updateMyProfile({ first_name: firstName, last_name: lastName, phone });
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result.error);
    }
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || profile?.email || "You";

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <InitialsAvatar label={displayName} size="lg" />
          <div>
            <div className="text-sm font-medium text-foreground">{displayName}</div>
            <div className="text-xs text-muted-foreground">{profile?.email}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">First name</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Last name</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
          </div>
        </div>

        {error && <div className="text-xs text-destructive">{error}</div>}

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {saved && <span className="text-xs text-primary">Saved</span>}
        </div>
      </CardContent>
    </Card>
  );
}
