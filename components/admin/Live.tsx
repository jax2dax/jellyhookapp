"use client";
// components/admin/Live.tsx
// The control room's "Live" switch: while on, the page reloads its numbers from the server every 10 seconds (a server
// refresh, not a full reload), so a traffic simulation can be watched as it happens. Off by default when the tab is
// hidden. Remembered in this browser.
import * as React from "react";
import { useRouter } from "next/navigation";

const KEY = "jh:admin-live";
const EVERY_MS = 10_000;

export function Live() {
  const router = useRouter();
  const [on, setOn] = React.useState(false);
  const [at, setAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a browser setting read once
      setOn(window.localStorage.getItem(KEY) === "1");
    } catch {
      /* off */
    }
    setAt(new Date());
  }, []);

  React.useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setAt(new Date());
    }, EVERY_MS);
    return () => window.clearInterval(id);
  }, [on, router]);

  const toggle = () => {
    const v = !on;
    setOn(v);
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* fine */
    }
    if (v) {
      router.refresh();
      setAt(new Date());
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <button type="button" onClick={toggle} aria-pressed={on} className={"inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-medium " + (on ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "hover:bg-muted")}>
        <span className={"size-1.5 rounded-full " + (on ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50")} />
        {on ? "Live: every 10 s" : "Live off"}
      </button>
      {at && <span>Updated {at.toLocaleTimeString()}</span>}
    </div>
  );
}
