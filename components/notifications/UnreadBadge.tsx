"use client";
// components/notifications/UnreadBadge.tsx
// The sidebar's two signals (founder 2026-10-24):
//   HooksBadge         on "Hooks": a yellow circle with the number of newly hooked leads you have not looked at
//                      (your unread hook notifications). Opening Hooks → Hooked leads clears it.
//   NotificationsDot   on "Notifications": a red dot, never a number, while anything there is unread (an update from
//                      Jellyhook, or a hook notification).
// Live: the server sends an empty "new" ping to this person's Realtime Broadcast channel after storing their
// notifications (lib/notifications/check.ts, pingInboxes); no database work, unlike postgres_changes, which starved the
// small Supabase instance (mds/issues/prod-issues.md, 2026-10-23). Backup: a poll once a minute while the tab is
// visible, a refresh when the tab comes back, and the "jh:notifications-changed" event (something was marked read).
import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { unreadCount } from "@/lib/actions/notifications.action";
import { hasUnreadAnnouncement } from "@/lib/actions/announcements.action";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export const NOTIFICATIONS_CHANGED = "jh:notifications-changed";

/** Re-runs `refresh` every minute while visible, when the tab comes back, and on NOTIFICATIONS_CHANGED. */
function useRefresh(refresh: () => void) {
  React.useEffect(() => {
    const run = () => document.visibilityState === "visible" && refresh();
    run();
    const t = setInterval(run, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, run);
    document.addEventListener("visibilitychange", run);
    return () => {
      clearInterval(t);
      window.removeEventListener(NOTIFICATIONS_CHANGED, run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [refresh]);
}

export function HooksBadge() {
  const [n, setN] = React.useState(0);
  const { userId, getToken } = useAuth();
  const tokenRef = React.useRef(getToken);
  React.useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);
  const refresh = React.useCallback(() => {
    unreadCount()
      .then(setN)
      .catch(() => {});
  }, []);
  useRefresh(refresh);

  // the live ping: refresh both signals (the dot listens to the same event)
  React.useEffect(() => {
    if (!userId) return;
    try {
      const supabase = createBrowserSupabaseClient(() => tokenRef.current());
      const channel = supabase
        .channel("jh-inbox:" + userId) // matches inboxChannel() in lib/notifications/check.ts
        .on("broadcast", { event: "new" }, () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)))
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return undefined; // the poll still runs
    }
  }, [userId]);

  if (!n) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold tabular-nums text-black" aria-label={`${n} newly hooked leads`} title={`${n} newly hooked lead${n === 1 ? "" : "s"}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export function NotificationsDot() {
  const [on, setOn] = React.useState(false);
  const refresh = React.useCallback(() => {
    Promise.all([hasUnreadAnnouncement(), unreadCount()])
      .then(([update, n]) => setOn(update || n > 0))
      .catch(() => {});
  }, []);
  useRefresh(refresh);
  if (!on) return null;
  return <span className="ml-auto size-2.5 rounded-full bg-red-500" aria-label="Unread notifications" title="Unread notifications" />;
}
