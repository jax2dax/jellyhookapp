"use client";
// components/showcase/v2/QuestionFlip.tsx
// The line over the hero's hook box: two questions that take turns every few seconds, the new one flipping in from below.
// Reduced motion: the first one stays.
import * as React from "react";

const LINES = ["Which new lead should you call first?", "Filter out the “just checking” visitors. Call the leads who are ready."];
const EVERY_MS = 5000;

export function QuestionFlip({ className = "" }: { className?: string }) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % LINES.length), EVERY_MS);
    return () => window.clearInterval(t);
  }, []);

  return (
    <p className={"relative [perspective:800px] " + className} aria-live="polite">
      {/* the longest line holds the height, so nothing below moves */}
      <span className="invisible block" aria-hidden>
        {LINES.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>
      <span key={i} className="v2-flip absolute inset-0 block origin-[50%_0%]">
        {LINES[i]}
      </span>
    </p>
  );
}
