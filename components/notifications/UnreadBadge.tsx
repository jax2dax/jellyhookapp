"use client";
// components/notifications/UnreadBadge.tsx
// The unread count next to "Notifications" in the sidebar. Live: the server sends an empty "new" ping to this person's
// Realtime Broadcast channel right after it stores their notifications (lib/notifications/check.ts, pingInboxes); the
// tab then asks the server for the count. Broadcast costs no database work, unlike postgres_changes, which decodes the
// whole write log and starved the small Supabase instance (mds/issues/prod-issues.md, 2026-10-23).
// Backup: a poll once a minute while the tab is visible, a refresh when the tab comes back, and when the inbox marks
// something read (the "jh:notifications-changed" event).
import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { unreadCount } from "@/lib/actions/notifications.action";
import { hasUnreadAnnouncement } from "@/lib/actions/announcements.action";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export const NOTIFICATIONS_CHANGED = "jh:notifications-changed";

export function UnreadBadge() {
  const [n, setN] = React.useState(0);
  const [update, setUpdate] = React.useState(false);
  const { userId, getToken } = useAuth();
  const tokenRef = React.useRef(getToken);
  React.useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  React.useEffect(() => {
    let live = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      unreadCount()
        .then((c) => live && setN(c))
        .catch(() => {});
      hasUnreadAnnouncement()
        .then((u) => live && setUpdate(u))
        .catch(() => {});
    };
    refresh();
    const t = setInterval(refresh, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    document.addEventListener("visibilitychange", refresh);

    // the channel name matches inboxChannel() in lib/notifications/check.ts
    let cleanup: (() => void) | null = null;
    if (userId) {
      try {
        const supabase = createBrowserSupabaseClient(() => tokenRef.current());
        const channel = supabase
          .channel("jh-inbox:" + userId)
          .on("broadcast", { event: "new" }, () => refresh())
          .subscribe();
        cleanup = () => {
          supabase.removeChannel(channel);
        };
      } catch {
        /* the poll still runs */
      }
    }
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      document.removeEventListener("visibilitychange", refresh);
      cleanup?.();
    };
  }, [userId]);

  if (!n && !update) return null;
  // yellow with a number: leads your hooks caught that you have not opened. Red dot, no number: an update from Jellyhook.
  return (
    <span className="ml-auto flex items-center gap-1">
      {n > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold tabular-nums text-black" aria-label={`${n} hooked leads not opened`}>
          {n > 99 ? "99+" : n}
        </span>
      )}
      {update && <span className="size-2.5 rounded-full bg-red-500" aria-label="An update from Jellyhook" title="An update from Jellyhook" />}
    </span>
  );
}
