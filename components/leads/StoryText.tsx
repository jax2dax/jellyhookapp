// components/leads/StoryText.tsx
// A story from lib/leadSessions/story.ts with the parts that matter picked out, so it reads at a glance:
//   pages            /pricing, /blogs, "/" (the home page)       a green-tinted code chip
//   dates and times  Oct 12, 8m 24s, 1h 54m, 6 days             an amber chip
// Plain text elsewhere. Pure presentation: the story text itself is unchanged (copy and paste still reads naturally).
import * as React from "react";
import { splitStory } from "@/lib/leadSessions/storyParts";

export function StoryText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={className}>
      {splitStory(text).map((p, i) =>
        p.kind === "page" ? (
          <code key={i} className="rounded bg-primary/15 px-1 py-px font-mono text-[0.92em] text-foreground">
            {p.text}
          </code>
        ) : p.kind === "when" ? (
          <span key={i} className="rounded bg-amber-500/20 px-1 py-px font-medium text-amber-900 dark:text-amber-200">
            {p.text}
          </span>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
    </p>
  );
}
