// components/feedback/FeedbackAutoPrompt.tsx
// Mounted once in app/platform/layout.jsx, invisible until it decides to
// show itself. Watches, via localStorage, for: 10+ minutes active in the
// app on one calendar day, then coming back on a LATER calendar day and
// hitting another 10+ minutes — at which point it asks once for feedback
// and never again (jh_fb_prompted). The exact thresholds are deliberately
// easy to change here; the user said this qualifying rule will likely be
// tuned or replaced.
//
// "Active" is tracked via a 15-second heartbeat that only counts while the
// tab is actually visible, accumulated per calendar day (reset whenever the
// stored date no longer matches today) — not wall-clock time since a
// session started, which would also count a backgrounded/idle tab.
"use client";

import * as React from "react";
import { FeedbackDialog } from "./FeedbackDialog";

const QUALIFYING_SECONDS = 600; // 10 minutes
const HEARTBEAT_MS = 15_000;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function FeedbackAutoPrompt() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (localStorage.getItem("jh_fb_prompted") === "1") return;

      const today = todayStr();
      let activityDate = localStorage.getItem("jh_fb_activity_date");
      let activitySeconds = Number(localStorage.getItem("jh_fb_activity_seconds") || "0");

      if (activityDate !== today) {
        activityDate = today;
        activitySeconds = 0;
      }
      activitySeconds += HEARTBEAT_MS / 1000;
      localStorage.setItem("jh_fb_activity_date", activityDate);
      localStorage.setItem("jh_fb_activity_seconds", String(activitySeconds));

      const qualifiedDay = localStorage.getItem("jh_fb_qualified_day");

      if (!qualifiedDay) {
        // Day 1: mark it once today's accumulated time crosses the threshold.
        if (activitySeconds >= QUALIFYING_SECONDS) {
          localStorage.setItem("jh_fb_qualified_day", today);
        }
        return;
      }

      // Day 2+: a genuinely later calendar day crossing the threshold again.
      if (qualifiedDay !== today && activitySeconds >= QUALIFYING_SECONDS) {
        localStorage.setItem("jh_fb_prompted", "1");
        setOpen(true);
      }
    };

    const id = window.setInterval(tick, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, []);

  return <FeedbackDialog open={open} onOpenChange={setOpen} source="auto" />;
}
