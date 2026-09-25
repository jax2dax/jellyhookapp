// app/platform/user/UserPageClient.tsx
"use client";

import * as React from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Camera, CalendarDays, LogOut, Phone as PhoneIcon, Mail, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</div>;
}

// ─── ProfileRow ───────────────────────────────────────────
// One row inside a shared card (see PERSONAL INFORMATION below) rather than
// its own separate bordered Card per field — a whole Card just to hold one
// label+value pair reads as an oversized empty box once there are three or
// four of them stacked vertically. Editing expands the SAME row in place.
function ProfileRow({
  icon: Icon,
  label,
  value,
  placeholder,
  type = "text",
  onSave,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex w-36 shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>

      {!editing ? (
        <div className="flex flex-1 items-center justify-between gap-3">
          <span className="text-sm text-foreground">{value || <span className="text-muted-foreground">Not set</span>}</span>
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
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
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
            className="sm:flex-1"
          />
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
      {error && <div className="text-xs text-destructive sm:pl-40">Error: {error}</div>}
    </div>
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
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative rounded-full ring-4 ring-background"
        aria-label="Change profile picture"
      >
        <Avatar className="h-24 w-24 sm:h-28 sm:w-28">
          <AvatarImage src={src} alt={name} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-5 w-5 text-white" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {error && <div className="text-xs text-destructive">{error}</div>}
      {uploading && <div className="text-xs text-muted-foreground">Uploading...</div>}
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
    <div className="w-full max-w-5xl">
      {/* PROFILE HEADER — banner + overlapping avatar, name/plan/stats laid
          out like a social profile rather than a form field. */}
      <Card className="overflow-hidden py-0">
        <div className="h-20 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent sm:h-24" />
        <CardContent className="relative -mt-12 flex flex-col gap-4 pb-6 sm:-mt-14 sm:flex-row sm:items-end">
          <AvatarEditor fallbackSrc={current.pfp} name={fullName} />

          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
                <Badge variant="outline">{planLabel(subscription?.plan)}</Badge>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {current.email || "No email set"}
              </div>

              {/* profile-style stat row, not separate stat cards */}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
                <div className="flex items-baseline gap-1.5 text-sm">
                  <span className="font-semibold text-foreground">{siteCount}</span>
                  <span className="text-muted-foreground">{siteCount === 1 ? "site" : "sites"}</span>
                </div>
                <div className="flex items-baseline gap-1.5 text-sm">
                  <CalendarDays className="h-3.5 w-3.5 self-center text-muted-foreground" />
                  <span className="text-muted-foreground">Member since {current.created_at ? formatDate(current.created_at) : "—"}</span>
                </div>
              </div>
            </div>

            <Button variant="destructive" size="sm" onClick={() => signOut({ redirectUrl: "/" })} className="self-start sm:self-end">
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PERSONAL INFO + BILLING — side by side, full width, instead of one
          long column of fat single-field cards. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionLabel>Personal information</SectionLabel>
          <Card className="py-0">
            <CardContent className="divide-y p-0">
              <ProfileRow icon={UserIcon} label="First name" value={current.first_name ?? ""} placeholder="Jane" onSave={(v) => save({ first_name: v })} />
              <ProfileRow icon={UserIcon} label="Last name" value={current.last_name ?? ""} placeholder="Doe" onSave={(v) => save({ last_name: v })} />
              <ProfileRow icon={Mail} label="Email" value={current.email ?? ""} placeholder="you@example.com" type="email" onSave={(v) => save({ email: v })} />
              <ProfileRow icon={PhoneIcon} label="Phone" value={current.phone != null ? String(current.phone) : ""} placeholder="+1 555 123 4567" type="tel" onSave={(v) => save({ phone: v })} />
            </CardContent>
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">This is your personal account info — never anything about a site. Site name, domain, and API key live in Settings.</p>
        </div>

        <div className="lg:col-span-2">
          <SectionLabel>Billing</SectionLabel>
          <Card>
            <CardContent>
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
              <Button asChild size="sm" variant="outline" className="mt-4 w-full">
                <a href="/platform/billing">{isFree ? "Upgrade plan" : "Manage billing"}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
