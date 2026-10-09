// components/dashboard/HookShortcutCard.tsx
// Replaces the old "Site Health" card on the dashboard: a green shortcut to
// Hook (/platform/hook). The hook icon swings gently (jh-hook-swing in
// app/globals.css, off under reduced motion); it is dark on the green in
// dark mode and white in light mode.
import Link from "next/link";
import { ArrowRight, FishingHook } from "lucide-react";

export function HookShortcutCard() {
  return (
    <Link
      href="/platform/hook"
      className="group relative flex h-full min-h-48 flex-col justify-between overflow-hidden rounded-xl bg-primary p-5 text-black shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-black/70">Hook</p>
        <h3 className="mt-1 text-xl font-bold leading-tight">Ask your data a precise question.</h3>
        <p className="mt-2 text-sm text-black/75">
          Sessions, leads, pages, forms: describe what you&apos;re looking for, and Hook finds it and draws it.
        </p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
        Open Hook <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
      <FishingHook aria-hidden className="jh-hook-swing pointer-events-none absolute -right-2 top-3 h-24 w-24 text-white dark:text-black" strokeWidth={1.6} />
    </Link>
  );
}
