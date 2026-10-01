// components/feedback/SupportFeedbackButton.tsx
// Replaces the old plain NavSecondary("Support") row with one split button:
// left half is still Support (unchanged, still a "#" placeholder — no
// support flow was asked for), right half opens FeedbackDialog.
//
// The right half also gets a periodic "nudge": a green sweep crosses left
// to right and back to idle over ~1.3s, up to twice per day with at least a
// 10-minute gap between them (see GLOW_INTERVAL_MS/GLOW_MAX_PER_DAY) — a
// quiet attention-getter, not the same thing as the auto feedback popup in
// FeedbackAutoPrompt.tsx. jh_glow_last_at is seeded on mount specifically so
// the FIRST nudge of the day also waits the full interval instead of firing
// the moment someone opens the sidebar.
"use client";

import * as React from "react";
import { LifeBuoy, MessageSquareHeart } from "lucide-react";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { FeedbackDialog } from "./FeedbackDialog";
import { cn } from "@/lib/utils";

const GLOW_INTERVAL_MS = 10 * 60 * 1000;
const GLOW_MAX_PER_DAY = 2;
const GLOW_DURATION_MS = 1300;
const GLOW_CHECK_MS = 30_000;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function SupportFeedbackButton() {
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [glowing, setGlowing] = React.useState(false);

  React.useEffect(() => {
    if (!localStorage.getItem("jh_glow_last_at")) {
      localStorage.setItem("jh_glow_last_at", String(Date.now()));
    }

    const tick = () => {
      if (document.visibilityState !== "visible") return;

      const today = todayStr();
      const date = localStorage.getItem("jh_glow_date");
      let count = Number(localStorage.getItem("jh_glow_count") || "0");
      if (date !== today) {
        localStorage.setItem("jh_glow_date", today);
        count = 0;
        localStorage.setItem("jh_glow_count", "0");
      }
      if (count >= GLOW_MAX_PER_DAY) return;

      const lastAt = Number(localStorage.getItem("jh_glow_last_at") || "0");
      if (Date.now() - lastAt < GLOW_INTERVAL_MS) return;

      localStorage.setItem("jh_glow_count", String(count + 1));
      localStorage.setItem("jh_glow_last_at", String(Date.now()));
      setGlowing(true);
      window.setTimeout(() => setGlowing(false), GLOW_DURATION_MS);
    };

    const id = window.setInterval(tick, GLOW_CHECK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="flex h-8 overflow-hidden rounded-md border border-sidebar-border">
            <a
              href="#"
              className="flex flex-1 items-center justify-center gap-1.5 border-r border-sidebar-border text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LifeBuoy className="size-3.5" />
              Support
            </a>
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              className="relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <span
                aria-hidden="true"
                className={cn("pointer-events-none absolute inset-0 -translate-x-full bg-primary", glowing && "jh-feedback-sweep")}
              />
              <MessageSquareHeart className={cn("relative z-10 size-3.5 transition-colors", glowing && "text-primary-foreground")} />
              <span className={cn("relative z-10 transition-colors", glowing && "text-primary-foreground")}>Feedback</span>
            </button>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} source="manual" />
    </>
  );
}
