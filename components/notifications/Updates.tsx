"use client";
// components/notifications/Updates.tsx
// "From Jellyhook": updates the founder posts to every user (lib/actions/announcements.action.ts). Opening
// Notifications marks them seen, which clears the red dot on the sidebar. For the founder (JELLYHOOK_ADMIN_USER_IDS),
// a small box to post one. In-app only.
import * as React from "react";
import { Loader2, Megaphone } from "lucide-react";
import { markAnnouncementsRead, sendAnnouncement, type Announcement } from "@/lib/actions/announcements.action";
import { formatRelativeTime } from "@/lib/leadFormat";
import { NOTIFICATIONS_CHANGED } from "./UnreadBadge";

export function Updates({ items: initial, canSend }: { items: Announcement[]; canSend: boolean }) {
  const [items, setItems] = React.useState(initial);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: "ok" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    if (!initial.some((a) => !a.read)) return;
    markAnnouncementsRead().then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)));
  }, [initial]);

  const send = async () => {
    setBusy(true);
    const r = await sendAnnouncement(title, body);
    setBusy(false);
    if (!r.ok) return setNote({ tone: "error", text: r.error });
    setItems((list) => [{ id: "new-" + Date.now(), title, body, createdAt: new Date().toISOString(), read: true }, ...list]);
    setTitle("");
    setBody("");
    setNote({ tone: "ok", text: "Posted to every user." });
  };

  if (!items.length && !canSend) return null;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Megaphone className="size-3.5" /> From Jellyhook
      </div>
      {canSend && (
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Title of the update" className="h-8 w-full rounded-md border bg-background px-2.5 text-sm" aria-label="Update title" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={3} placeholder="What's new, for every user (in the app only)" className="w-full resize-none rounded-md border bg-background p-2.5 text-sm" aria-label="Update message" />
          <div className="flex items-center justify-end gap-2">
            {note && <span className={"text-xs " + (note.tone === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>{note.text}</span>}
            <button type="button" disabled={busy || !title.trim() || !body.trim()} onClick={send} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40">
              {busy && <Loader2 className="size-3.5 animate-spin" />} Post to everyone
            </button>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-lg border bg-card">
          {items.map((a) => (
            <li key={a.id} className={"flex items-start gap-3 px-4 py-3 " + (a.read ? "" : "bg-red-500/[0.04]")}>
              <span className={"mt-1.5 size-2 shrink-0 rounded-full " + (a.read ? "bg-transparent" : "bg-red-500")} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{a.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{formatRelativeTime(a.createdAt)}</span>
                </span>
                <span className="mt-0.5 block whitespace-pre-line text-sm text-muted-foreground">{a.body}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
