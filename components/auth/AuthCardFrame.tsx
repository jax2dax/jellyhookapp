// components/auth/AuthCardFrame.tsx
// Shared shell for SignInCard/SignUpCard so both read as one deliberate
// piece of UI instead of two generic forms: an ambient lime glow behind the
// card (jh-glow-pulse, same breathing-light language as the hero image's
// drop-shadow), viewfinder-style corner brackets that sharpen in on hover,
// and a top accent bar that draws in left-to-right — all on-brand with the
// terminal/mono aesthetic used everywhere else (ff-mono index labels, the
// lime-invert hover on the landing page's feature rows).
"use client";

import * as React from "react";

export function AuthCardFrame({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="group relative w-full max-w-sm">
      <div className="jh-glow-pulse pointer-events-none absolute -inset-8 -z-10 rounded-full bg-[var(--lime-glow)] blur-3xl" />

      <span className="pointer-events-none absolute -left-px -top-px h-4 w-4 border-l border-t border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -right-px -top-px h-4 w-4 border-r border-t border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b border-l border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b border-r border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative overflow-hidden border border-[#1b1b18] bg-[#0a0a09] p-7 transition-[border-color,box-shadow] duration-500 group-hover:border-[#2b2b25] group-hover:shadow-[0_0_60px_-12px_var(--lime-glow)]">
        <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[var(--lime)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
        <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">{eyebrow}</span>
        {children}
      </div>
    </div>
  );
}
