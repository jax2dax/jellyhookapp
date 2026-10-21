// components/leads/StoryText.tsx
// A story from lib/leadSessions/story.ts with the parts that matter picked out, so it reads at a glance:
//   pages            /pricing, /blogs, "/" (the home page)       a green-tinted code chip
//   dates            Oct 12, 6 days                              an orange chip
//   times            8m 24s, 1h 54m                              an amber (yellow) chip, close to the date's
//   headings         "Pricing", "Hi, I'm Beny"                   a blue chip
// Plain text elsewhere. Pure presentation: the story text itself is unchanged (copy and paste still reads naturally).
import * as React from "react";
import { splitStory } from "@/lib/leadSessions/storyParts";

export function StoryText({ text, className, children }: { text: string; className?: string; children?: React.ReactNode }) {
  return (
    <p className={className}>
      {splitStory(text).map((p, i) =>
        p.kind === "page" ? (
          <code key={i} className="rounded bg-primary/15 px-1 py-px font-mono text-[0.92em] text-foreground">
            {p.text}
          </code>
        ) : p.kind === "heading" ? (
          <span key={i} className="rounded bg-sky-500/15 px-1 py-px font-medium text-sky-900 dark:text-sky-200">
            {p.text}
          </span>
        ) : p.kind === "date" ? (
          <span key={i} className="rounded bg-orange-500/25 px-1 py-px font-medium text-orange-900 dark:text-orange-200">
            {p.text}
          </span>
        ) : p.kind === "when" ? (
          <span key={i} className="rounded bg-amber-500/20 px-1 py-px font-medium text-amber-900 dark:text-amber-200">
            {p.text}
          </span>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
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
      {splitStory(text).map((p, i) =>
        p.kind === "page" ? (
          <code key={i} className="rounded bg-primary/15 px-1 py-px font-mono text-[0.92em] text-foreground">
            {p.text}
          </code>
        ) : p.kind === "heading" ? (
          <span key={i} className="rounded bg-sky-500/15 px-1 py-px font-medium text-sky-900 dark:text-sky-200">
            {p.text}
          </span>
        ) : p.kind === "date" ? (
          <span key={i} className="rounded bg-orange-500/25 px-1 py-px font-medium text-orange-900 dark:text-orange-200">
            {p.text}
          </span>
        ) : p.kind === "when" ? (
          <span key={i} className="rounded bg-amber-500/20 px-1 py-px font-medium text-amber-900 dark:text-amber-200">
            {p.text}
          </span>
        ) : (
          <React.Fragment key={i}>{p.text}</React.Fragment>
        ),
      )}
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
