"use client";
// components/showcase/HeroHookBox.tsx
// The hero's "write a hook" box. Its first line says what a hook does ("Notify me when..." / "Notify me on Slack
// when..."); under it, example conditions type themselves out, wait, erase and type the next, as a moving placeholder.
// A visitor can click in and write their own; "Hook it" takes them to sign-up. Every example is a condition a mark can
// check today (components/marks/v2/RuleEditor.tsx; marketing/claims-ledger.md row 23).
import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const PREFIXES = ["Notify me when", "Notify me on Slack when"];

export const EXAMPLES = [
  "their budget is between $20k and $30k, and they stayed on the site for at least 2 minutes",
  'they saw 90% or more of "/pricing" and did not hesitate on the form',
  'they came from a Facebook ad and spent 40 seconds or more on "Best deals"',
  'they came from a TikTok ad, opened "/" and went straight to "/contact"',
];

const TYPE_MS = 34;
const ERASE_MS = 14;
const HOLD_MS = 2400;
const GAP_MS = 350;

/** The example being typed: its index and how many characters are shown. Stops while the visitor writes. */
export function useTypewriter(paused: boolean) {
  const [i, setI] = React.useState(0);
  const [n, setN] = React.useState(0);
  const [erasing, setErasing] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  React.useEffect(() => {
    if (paused) return;
    const text = EXAMPLES[i];
    let t: number;
    if (reduced) {
      // no typing: the whole sentence, changed every few seconds
      t = window.setTimeout(() => setI((x) => (x + 1) % EXAMPLES.length), HOLD_MS * 2);
    } else if (!erasing && n < text.length) t = window.setTimeout(() => setN(n + 1), TYPE_MS);
    else if (!erasing) t = window.setTimeout(() => setErasing(true), HOLD_MS);
    else if (n > 0) t = window.setTimeout(() => setN(n - 1), ERASE_MS);
    else
      t = window.setTimeout(() => {
        setErasing(false);
        setI((x) => (x + 1) % EXAMPLES.length);
      }, GAP_MS);
    return () => window.clearTimeout(t);
  }, [i, n, erasing, paused, reduced]);

  return { index: i, shown: reduced ? EXAMPLES[i] : EXAMPLES[i].slice(0, n), typing: !reduced };
}

export function HeroHookBox() {
  const [value, setValue] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const { index, shown, typing } = useTypewriter(focused || value.length > 0);
  // the first line changes with each new example
  const prefix = PREFIXES[index % PREFIXES.length];
  const href = "/sign-up" + (value.trim() ? "?hook=" + encodeURIComponent(value.trim().slice(0, 300)) : "");

  return (
    <form
      action={href}
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = href;
      }}
      className="group relative max-w-2xl"
    >
      <div className={"relative border bg-[#0a0a09] transition-colors duration-300 " + (focused ? "border-[var(--lime)] shadow-[0_0_0_4px_var(--lime-glow)]" : "border-[#2a2a25] hover:border-[#3a3a33]")}>
        <label htmlFor="hero-hook" className="flex items-center gap-2 border-b border-[#1b1b18] px-5 pb-3 pt-4 ff-mono text-[11px] uppercase tracking-[0.22em] text-[var(--lime)]">
          <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime)]" />
          <span key={prefix} className="jh-hero-prefix">{prefix}...</span>
        </label>
        <div className="relative px-5 pb-4 pt-3">
          <textarea
            id="hero-hook"
            rows={2}
            value={value}
            maxLength={300}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                window.location.href = href;
              }
            }}
            aria-label={`${prefix}... Describe the lead you want to hear about.`}
            className="relative z-10 block min-h-[3.6em] w-full resize-none bg-transparent ff-display text-[clamp(1.15rem,2vw,1.5rem)] leading-snug text-[#f4f2ea] outline-none"
          />
          {/* the moving placeholder, under the empty field */}
          {!value && (
            <div aria-hidden className="pointer-events-none absolute inset-x-5 top-3 ff-display text-[clamp(1.15rem,2vw,1.5rem)] leading-snug text-[#8b8980]">
              {shown}
              {typing && !focused && <span className="jh-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-[var(--lime)]" />}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1b1b18] px-5 py-3">
          <span className="ff-mono text-[10px] uppercase tracking-[0.2em] text-[#5f5d57]">Pages · time · scroll · headings · answers · where they came from</span>
          <button type="submit" className="group/btn inline-flex h-10 items-center gap-2 bg-[var(--lime)] px-5 ff-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-black transition-colors hover:bg-[var(--lime-bright)]">
            Hook it
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </button>
        </div>
      </div>
      <p className="mt-3 ff-body text-[13px] text-[#77756d]">
        Write it in your own words, or <Link href="#try-it" className="text-[#c9c7bf] underline underline-offset-4 hover:text-[var(--lime)]">build one in the demo below</Link>. Free during early access.
      </p>
    </form>
  );
}
