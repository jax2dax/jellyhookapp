// components/auth/AuthCardFrame.tsx
// Shared shell for SignInCard/SignUpCard in the marketing pages' magazine look (2026-10-28): the serif wordmark with
// the hook mark over a heavy ink rule, then the card on white with a 2px ink border. The green line under the rule
// draws in on hover, the one accent.
"use client";

import * as React from "react";
import Link from "next/link";
import { HookMark } from "@/components/showcase/v2/HookMark";

export function AuthCardFrame({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="group relative w-full max-w-sm">
      <Link href="/" className="mb-4 flex items-end gap-1.5 ff-display text-[34px] leading-none tracking-[-0.02em] text-[var(--ink)]">
        <span>
          Jelly<span className="text-[var(--lime)]">hook</span>
        </span>
        <HookMark className="mb-[0.08em] h-[0.7em] w-[0.46em] text-[var(--lime)]" strokeWidth={3.6} />
      </Link>
      <div className="h-[6px] bg-[var(--ink)]" />
      <div className="relative border-2 border-t-0 border-[var(--ink)] bg-[var(--paper)] p-7 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-[var(--lime)] transition-transform duration-500 ease-out group-hover:scale-x-100" />
        <span className="ff-body text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-mute)]">{eyebrow}</span>
        {children}
      </div>
    </div>
  );
}
