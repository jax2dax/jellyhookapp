"use client";
// components/notifications/UnreadBadge.tsx
// The unread count next to "Notifications" in the sidebar (the bell). Live: new notifications for this person arrive
// through Supabase Realtime (the database lets each member see only their own rows), with a slow poll as a fallback
// and a refresh whenever the inbox marks something read (the "jh:notifications-changed" event).
import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { unreadCount } from "@/lib/actions/notifications.action";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export const NOTIFICATIONS_CHANGED = "jh:notifications-changed";

export function UnreadBadge() {
  const [n, setN] = React.useState(0);
  const { userId, getToken } = useAuth();
  const tokenRef = React.useRef(getToken);
  React.useEffect(() => {
    tokenRef.current = getToken;
  }, [getToken]);

  React.useEffect(() => {
    let live = true;
    const refresh = () => unreadCount().then((c) => live && setN(c));
    refresh();
    const t = setInterval(refresh, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    let channel: ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null = null;
    if (userId) {
      try {
        const supabase = createBrowserSupabaseClient(() => tokenRef.current());
        channel = supabase
          .channel("jh-notifications-" + userId)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => refresh())
          .subscribe();
      } catch {
        /* the poll still runs */
      }
    }
    return () => {
      live = false;
      clearInterval(t);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      channel?.unsubscribe();
    };
  }, [userId]);

  if (!n) return null;
  return (
    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold tabular-nums text-white" aria-label={`${n} unread notifications`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}
