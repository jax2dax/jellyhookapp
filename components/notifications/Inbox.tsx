"use client";
// components/notifications/Inbox.tsx
// The person's notifications on this site, newest first (mds/build/notifications/ui-ux.md). Opening one marks it read
// and opens the lead. Only this person's, and only while they are a member of the site (the database checks both).
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markRead, type InboxItem } from "@/lib/actions/notifications.action";
import { formatRelativeTime } from "@/lib/leadFormat";
import { NOTIFICATIONS_CHANGED } from "./UnreadBadge";

export function Inbox({ items: initial, ready }: { items: InboxItem[]; ready: boolean }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const unread = items.filter((i) => !i.readAt).length;

  const read = async (ids: string[] | "all") => {
    const now = new Date().toISOString();
    setItems((list) => list.map((i) => (ids === "all" || ids.includes(i.id) ? { ...i, readAt: i.readAt ?? now } : i)));
    await markRead(ids);
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
  };

  if (!ready) return <p className="text-sm text-muted-foreground">Notifications are not set up on this database yet (migration 20).</p>;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unread ? `${unread} unread` : "All read"}</p>
        {unread > 0 && (
          <button type="button" onClick={() => read("all")} className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <CheckCheck className="size-3.5" /> Mark all as read
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Bell className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-foreground">No notifications yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Make a hook in <Link href="/platform/hooks?tab=rules" className="text-primary hover:underline">Hooks</Link>: when a new lead has the marks you choose, it is hooked and you are told here.
          </p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.readAt) read([n.id]);
                  if (n.leadId) router.push(`/platform/leads/${n.leadId}`);
                }}
                className={"flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 " + (n.readAt ? "" : "bg-primary/[0.04]")}
              >
                <span className={"mt-1.5 size-2 shrink-0 rounded-full " + (n.readAt ? "bg-transparent" : "bg-primary")} aria-label={n.readAt ? undefined : "unread"} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={"truncate text-sm " + (n.readAt ? "font-medium text-foreground/80" : "font-semibold text-foreground")}>{n.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span>
                  {n.marks.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {n.marks.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-foreground">
                          <span className="size-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                          {m.name}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
