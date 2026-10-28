"use client";
// components/showcase/v2/IssueHookBox.tsx
// The hero's "write a hook" box in the magazine look (/v2 preview): set as an interview question, with the same typed
// examples and sign-up link as components/showcase/HeroHookBox.tsx.
import * as React from "react";
import { ArrowRight } from "lucide-react";
import { PREFIXES, useTypewriter } from "@/components/showcase/HeroHookBox";

export function IssueHookBox() {
  const [value, setValue] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const { index, shown, typing } = useTypewriter(focused || value.length > 0);
  const prefix = PREFIXES[index % PREFIXES.length];
  const href = "/sign-up" + (value.trim() ? "?hook=" + encodeURIComponent(value.trim().slice(0, 300)) : "");
  const go = () => (window.location.href = href);

  return (
    <form
      action={href}
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <div className="border-t-4 border-[var(--ink)] pt-4">
        <label htmlFor="v2-hook" className="v2-caps text-[12px] text-[var(--spot)]">
          <span key={prefix} className="jh-hero-prefix">{prefix}...</span>
        </label>
      </div>
      <div className={"relative mt-4 border-2 bg-[var(--paper)] transition-[border-color,box-shadow] duration-300 " + (focused ? "border-[var(--spot)] shadow-[0_10px_30px_-12px_rgba(15,122,61,0.4)]" : "border-[var(--ink)]")}>
        <div className="relative px-5 pb-4 pt-4">
          <textarea
            id="v2-hook"
            rows={3}
            value={value}
            maxLength={300}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                go();
              }
            }}
            aria-label={`${prefix}... Describe the lead you want to hear about.`}
            className="relative z-10 block min-h-[4.2em] w-full resize-none bg-transparent v2-serif text-[clamp(1.25rem,1.9vw,1.6rem)] leading-snug text-[var(--ink)] caret-[var(--spot)] outline-none"
          />
          {!value && (
            <div aria-hidden className="pointer-events-none absolute inset-x-5 top-4 v2-serif text-[clamp(1.25rem,1.9vw,1.6rem)] leading-snug text-[var(--ink-soft)]">
              {shown}
              {typing && !focused && <span className="jh-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-[var(--spot)]" />}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--ink)] py-0 pl-5">
          <span className="v2-caps text-[10px] text-[var(--ink-soft)]">Pages · time · scroll · headings · answers</span>
          <button type="submit" className="group inline-flex h-12 items-center gap-3 bg-[var(--ink)] px-6 v2-caps text-[12px] text-[var(--paper)] transition-colors hover:bg-[var(--spot)] focus-visible:bg-[var(--spot)]">
            Hook it
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </div>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-soft)]">Write it in your own words. Free during early access.</p>
    </form>
  );
}
