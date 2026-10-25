// components/leads/StoryText.tsx
// A story from lib/leadSessions/story.ts with the parts that matter picked out, so it reads at a glance:
//   pages            /pricing, /blogs, "/" (the home page)       monospace on a quiet chip
//   dates, times     Oct 12, 6 days, 8m 24s                      medium weight, full contrast
//   headings         "Pricing", "Hi, I'm Beny"                   medium weight, in the accent blue
// Plain text elsewhere, a step quieter. (Until 2026-10-25 each kind had its own coloured chip: four colours in one
// sentence read as noise.) Pure presentation: the story text itself is unchanged (copy and paste reads naturally).
import * as React from "react";
import { splitStory } from "@/lib/leadSessions/storyParts";
import type { StoryVersion } from "@/lib/leadSessions/story";
import { InfoTip } from "@/components/InfoTip";

/** One part of a story: a page, a heading, a date or a time, or plain words. */
function Part({ p }: { p: ReturnType<typeof splitStory>[number] }) {
  if (p.kind === "page") return <code className="rounded bg-muted px-1 py-px font-mono text-[0.9em] text-foreground ring-1 ring-inset ring-border">{p.text}</code>;
  if (p.kind === "heading") return <span className="font-medium text-sky-700 dark:text-sky-300">{p.text}</span>;
  if (p.kind === "date" || p.kind === "when") return <span className="font-medium text-foreground tabular-nums">{p.text}</span>;
  return <>{p.text}</>;
}

export function StoryText({ text, className, children }: { text: string; className?: string; children?: React.ReactNode }) {
  return (
    <p className={className}>
      {splitStory(text).map((p, i) => (
        <Part key={i} p={p} />
      ))}
      {children}
    </p>
  );
}

// ── a story as sentences: one paragraph, or one sentence per line (the format toggle), with details on demand ──

const LINES_KEY = "jh:story-lines";
const LINES_EVENT = "jh:story-lines";

/** Paragraph or one sentence per line, remembered in this browser and shared by every story on the page. */
export function useStoryLines(): [boolean, (v: boolean) => void] {
  const [lines, setLines] = React.useState(false);
  React.useEffect(() => {
    const read = () => {
      try {
        setLines(window.localStorage.getItem(LINES_KEY) === "1");
      } catch {
        /* paragraph */
      }
    };
    read();
    window.addEventListener(LINES_EVENT, read);
    return () => window.removeEventListener(LINES_EVENT, read);
  }, []);
  const set = (v: boolean) => {
    try {
      window.localStorage.setItem(LINES_KEY, v ? "1" : "0");
    } catch {
      /* fine */
    }
    setLines(v);
    window.dispatchEvent(new Event(LINES_EVENT));
  };
  return [lines, set];
}

/** The format toggle: three stripes, like a text editor's alignment button. Pressed = one sentence per line. */
export function StoryFormatToggle({ lines, onChange }: { lines: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!lines)}
      aria-pressed={lines}
      title={lines ? "Show as one paragraph" : "Show one sentence per line"}
      className={"flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors " + (lines ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {splitStory(text).map((p, i) => (
        <Part key={i} p={p} />
      ))}
    </>
  );
}

/** The opened detail of a sentence, fading in. Clicking it closes it again. */
function MoreText({ text, onClose }: { text: string; onClose: () => void }) {
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // closing fades it out first, then removes it
  const close = () => {
    setShown(false);
    window.setTimeout(onClose, 260);
  };
  return (
    <span role="button" tabIndex={0} onClick={close} onKeyDown={(e) => e.key === "Enter" && close()} title="Hide" className={"cursor-pointer transition-opacity duration-300 " + (shown ? "opacity-100" : "opacity-0")}>
      {" ("}
      <Highlighted text={text} />
      {")"}
    </span>
  );
}

/** A story given as sentences (lib/leadSessions/story.ts StorySentence): a paragraph, or one sentence per line. */
export function StorySentences({ sentences, lines, className }: { sentences: { text: string; more?: string }[]; lines: boolean; className?: string }) {
  const [open, setOpen] = React.useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  return (
    <div className={className}>
      {sentences.map((s, i) => (
        <span key={i} className={lines ? "block" : undefined}>
          <Highlighted text={s.text} />
          {s.more !== undefined &&
            (open.has(i) ? (
              <MoreText text={s.more} onClose={() => toggle(i)} />
            ) : (
              <button type="button" onClick={() => toggle(i)} title="Show the time on its smaller headings" className="ml-1 rounded bg-muted px-1.5 align-middle text-xs font-semibold leading-5 text-muted-foreground transition-colors hover:text-foreground">
                …
              </button>
            ))}
          {s.more !== undefined && "."}
          {!lines && i < sentences.length - 1 && " "}
        </span>
      ))}
    </div>
  );
}

// ── the summary's version: Long, Moderate or Short (lib/leadSessions/story.ts sessionStoryVersion) ──

const VERSION_KEY = "jh:story-version";
const VERSION_EVENT = "jh:story-version";
const VERSION_ROWS: { value: StoryVersion; label: string; tip: string }[] = [
  { value: "long", label: "Long", tip: "Everything about this visit: its pages, what they read, the headings they spent time on, the time away and where they sent the form." },
  { value: "moderate", label: "Moderate", tip: "The key points, one per line: the pages in order with their times, where most of the time went, the headings with the most and the least time, and how often they left and came back." },
  { value: "short", label: "Short", tip: "Which visit this was and the pages in order, with the time on each and the time away." },
];

/** The chosen version, remembered in this browser (Long by default) and shared by every summary on the page. */
export function useStoryVersion(): [StoryVersion, (v: StoryVersion) => void] {
  const [version, setVersion] = React.useState<StoryVersion>("long");
  React.useEffect(() => {
    const read = () => {
      try {
        const v = window.localStorage.getItem(VERSION_KEY);
        if (v === "long" || v === "moderate" || v === "short") setVersion(v);
      } catch {
        /* long */
      }
    };
    read();
    window.addEventListener(VERSION_EVENT, read);
    return () => window.removeEventListener(VERSION_EVENT, read);
  }, []);
  const set = (v: StoryVersion) => {
    try {
      window.localStorage.setItem(VERSION_KEY, v);
    } catch {
      /* fine */
    }
    setVersion(v);
    window.dispatchEvent(new Event(VERSION_EVENT));
  };
  return [version, set];
}

/** Long / Moderate / Short, each with an (i) saying what it keeps. */
export function StoryVersionSwitch({ value, onChange }: { value: StoryVersion; onChange: (v: StoryVersion) => void }) {
  return (
    <div role="radiogroup" aria-label="Summary length" className="flex h-7 shrink-0 items-center rounded-md border p-0.5">
      {VERSION_ROWS.map((r) => (
        <span key={r.value} className={"flex h-full items-center gap-1 rounded px-1.5 text-xs transition-colors " + (value === r.value ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:text-foreground")}>
          <button type="button" role="radio" aria-checked={value === r.value} onClick={() => onChange(r.value)} className="font-medium">
            {r.label}
          </button>
          <InfoTip label={"About " + r.label}>{r.tip}</InfoTip>
        </span>
      ))}
    </div>
  );
}
