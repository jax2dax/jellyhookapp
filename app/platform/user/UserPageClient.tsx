// app/platform/user/UserPageClient.tsx
"use client";

import * as React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Camera, CreditCard, Globe, CalendarDays, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/StatTile";
import { formatDate } from "@/lib/leadFormat";
import { updateMyProfile } from "@/lib/actions/profile.actions";

interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: number | string | null;
  pfp: string | null;
  created_at: string | null;
}

interface Subscription {
  plan: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

function planLabel(plan: string | null | undefined) {
  if (!plan || plan === "unknown") return "Free";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function statusBadgeVariant(status: string | null | undefined): "default" | "destructive" | "outline" {
  if (status === "active" || status === "trialing") return "default";
  if (status === "canceled") return "destructive";
  return "outline";
}

// ─── EditableField ────────────────────────────────────────
// Same interaction shape as SettingsClients.jsx's EditableRow (edit → save/
// cancel inline) — kept as its own small copy here rather than shared, since
// this page edits the PERSON (name/email/phone) while that one edits the
// SITE, and the two are deliberately never supposed to reach into each
// other's forms.
function EditableField({
  label,
  value,
  placeholder,
  type = "text",
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onSave: (value: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [input, setInput] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    if (input.trim() === (value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(input.trim());
    setSaving(false);
    if (result.success) setEditing(false);
    else setError(result.error ?? "Failed to save");
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
                setInput(value ?? "");
                setEditing(true);
                setError(null);
              }}
            >
              Edit
            </Button>
          )}
        </div>
        {!editing ? (
          <div className="mt-1 text-sm break-all text-foreground">{value || <span className="text-muted-foreground">Not set</span>}</div>
        ) : (
          <div className="flex flex-col gap-2">
            <Input
              type={type}
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
              <Button size="sm" variant="outline" disabled={saving} onClick={() => { setEditing(false); setError(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── AvatarEditor ─────────────────────────────────────────
// Goes straight through Clerk's own user.setProfileImage() rather than a
// custom upload — this codebase has no object-storage/file-upload feature
// at all (see SAAS_PRODUCT_AUDIT.md §17), and Clerk already hosts and
// serves avatars for every account here. The result then reaches
// public.users.pfp automatically via the user.updated webhook.
function AvatarEditor({ fallbackSrc, name }: { fallbackSrc: string | null; name: string }) {
  const { user } = useUser();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const src = user?.imageUrl || fallbackSrc || undefined;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      await user.setProfileImage({ file });
    } catch (err) {
      console.error("[UserPageClient] avatar upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative"
        aria-label="Change profile picture"
      >
        <Avatar className="h-20 w-20">
          <AvatarImage src={src} alt={name} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-5 w-5 text-white" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="text-xs text-primary hover:underline disabled:opacity-50">
        {uploading ? "Uploading..." : "Change photo"}
      </button>
      {error && <div className="text-xs text-destructive">{error}</div>}
    </div>
  );
}

export default function UserPageClient({ profile, siteCount, subscription }: { profile: Profile; siteCount: number; subscription: Subscription | null }) {
  const { signOut } = useClerk();
  const [current, setCurrent] = React.useState(profile);

  const fullName = [current.first_name, current.last_name].filter(Boolean).join(" ") || "Unnamed user";

  async function save(patch: Partial<{ first_name: string; last_name: string; email: string; phone: string }>) {
    const result = await updateMyProfile(patch);
    if (result.success) setCurrent((prev) => ({ ...prev, ...result.data }));
    return result;
  }

  const isFree = !subscription || subscription.status === "canceled" || subscription.plan === "free";

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {/* PROFILE PICTURE + NAME HEADER */}
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-6 sm:flex-row sm:items-start">
          <AvatarEditor fallbackSrc={current.pfp} name={fullName} />
          <div className="flex-1 text-center sm:text-left">
            <div className="text-lg font-semibold text-foreground">{fullName}</div>
            <div className="text-sm text-muted-foreground">{current.email || "No email set"}</div>
          </div>
        </CardContent>
      </Card>

      {/* ACCOUNT FACTS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile icon={CreditCard} label="Plan" value={planLabel(subscription?.plan)} sub={isFree ? "Free tier" : subscription?.status} />
        <StatTile icon={Globe} label="Sites" value={siteCount} sub={siteCount === 1 ? "site" : "sites"} />
        <StatTile icon={CalendarDays} label="Member since" value={current.created_at ? formatDate(current.created_at) : "—"} />
      </div>

      {/* EDITABLE PERSONAL INFO — never anything site-related, see /platform/settings for that */}
      <div className="mt-2 mb-1 text-xs tracking-wide text-muted-foreground">PERSONAL INFORMATION</div>
      <EditableField label="First name" value={current.first_name ?? ""} placeholder="Jane" onSave={(v) => save({ first_name: v })} />
      <EditableField label="Last name" value={current.last_name ?? ""} placeholder="Doe" onSave={(v) => save({ last_name: v })} />
      <EditableField label="Email" value={current.email ?? ""} placeholder="you@example.com" type="email" onSave={(v) => save({ email: v })} />
      <EditableField label="Phone" value={current.phone != null ? String(current.phone) : ""} placeholder="+1 555 123 4567" type="tel" onSave={(v) => save({ phone: v })} />

      {/* BILLING */}
      <div className="mt-2 mb-1 text-xs tracking-wide text-muted-foreground">BILLING</div>
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{planLabel(subscription?.plan)} plan</span>
              {subscription?.status && <Badge variant={statusBadgeVariant(subscription.status)}>{subscription.status.toUpperCase()}</Badge>}
            </div>
            {subscription?.current_period_end && (
              <div className="mt-1 text-xs text-muted-foreground">
                {subscription.cancel_at_period_end ? `Cancels on ${formatDate(subscription.current_period_end)}` : `Renews ${formatDate(subscription.current_period_end)}`}
              </div>
            )}
            {isFree && <div className="mt-1 text-xs text-muted-foreground">Upgrade to unlock more features.</div>}
          </div>
          <Button asChild size="sm" variant="outline">
            <a href="/platform/billing">{isFree ? "Upgrade plan" : "Manage billing"}</a>
          </Button>
        </CardContent>
      </Card>

      {/* SIGN OUT */}
      <div className="mt-4">
        <Button variant="destructive" onClick={() => signOut({ redirectUrl: "/" })}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}
