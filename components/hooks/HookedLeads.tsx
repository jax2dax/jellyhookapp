"use client";
// components/hooks/HookedLeads.tsx
// Hooks → Hooked leads: every lead a hook caught, newest first, with the hooks that caught it. Click a row to open the
// lead. `compact` is the dashboard's short version. Data: lib/actions/hooks.action.ts.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FishingHook } from "lucide-react";
import type { HookedLead } from "@/lib/actions/hooks.action";
import { markRead } from "@/lib/actions/notifications.action";
import { NOTIFICATIONS_CHANGED } from "@/components/notifications/UnreadBadge";
import { formatRelativeTime } from "@/lib/leadFormat";

export function HookedLeads({ leads, ready, compact = false, markSeen = false }: { leads: HookedLead[]; ready: boolean; compact?: boolean; markSeen?: boolean }) {
  const router = useRouter();
  // on the Hooks page, looking at the hooked leads clears the yellow count on the sidebar
  React.useEffect(() => {
    if (!markSeen) return;
    markRead("all").then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)));
  }, [markSeen]);
  if (!ready) return <p className="text-sm text-muted-foreground">Hooks are not set up on this database yet (migration 20).</p>;
  if (!leads.length)
    return (
      <div className={"rounded-lg border border-dashed text-center " + (compact ? "p-6" : "p-10")}>
        <FishingHook className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-foreground">No hooked leads yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Make a hook in <Link href="/platform/hooks?tab=rules" className="text-primary hover:underline">Hooks</Link>: every new lead that has its marks lands here.
        </p>
      </div>
    );
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {leads.map((l) => (
        <li key={l.leadId}>
          <button type="button" onClick={() => router.push(`/platform/leads/${l.leadId}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50">
            {l.ad?.thumbnailUrl ? (
              // the ad that brought them (Ads library), when it has a thumbnail
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.ad.thumbnailUrl} alt={l.ad.title} title={l.ad.title} className="h-9 w-16 shrink-0 rounded-md border object-cover" />
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-600 dark:text-amber-400">
                <FishingHook className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{l.name || l.email || "A lead without a name"}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {l.name && l.email ? l.email + " · " : ""}sent on {l.page ?? "a page"}
                {l.source && (
                  <>
                    {" · came from "}
                    <span className="text-foreground/80">{l.source}</span>
                  </>
                )}
              </span>
              {!compact && (
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.hooks.map((h) => (
                    <span key={h.id} className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-400/10 px-2 py-0.5 text-[11px] text-foreground">
                      {h.name}
                    </span>
                  ))}
                </span>
              )}
            </span>
            {compact && <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:block">{l.hooks.map((h) => h.name).join(", ")}</span>}
            <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(l.hookedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
