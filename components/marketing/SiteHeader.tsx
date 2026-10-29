// components/marketing/SiteHeader.tsx
// Shared masthead for the public marketing pages, in the home page's magazine look: the serif wordmark with the
// fish-hook mark, caps links, a heavy ink rule under it. Signed-in visitors get a Dashboard button (no avatar).
"use client";

import * as React from "react";
import Link from "next/link";
import { Show, SignOutButton } from "@clerk/nextjs";
import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";

const NAV = [
  { label: "How it works", href: "/#journey" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Docs", href: "/docs" },
];

const CAPS = "ff-body text-[12px] font-bold uppercase tracking-[0.16em]";

export function Wordmark({ className = "text-[30px]" }: { className?: string }) {
  return (
    <Link href="/" className={"flex items-end gap-1.5 ff-display leading-none tracking-[-0.02em] text-[var(--ink)] " + className}>
      <span>
        Jelly<span className="text-[var(--lime)]">hook</span>
      </span>
      <Image src="/jellyhook-nobg.png" alt="" width={56} height={56} className="mb-[0.04em] h-[0.95em] w-auto" />
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[var(--paper)]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1440px] px-5 md:px-12 lg:px-[72px]">
        <div className="flex h-[82px] items-end justify-between pb-3 md:h-[94px]">
          <Wordmark className="text-[clamp(1.9rem,3vw,2.6rem)]" />

          <nav className="hidden items-center gap-8 pb-1 md:flex">
            {NAV.map((item) => (
              <Link key={item.label} href={item.href} className={CAPS + " text-[var(--ink)] transition-colors hover:text-[var(--lime)]"}>
                {item.label}
              </Link>
            ))}
            <Show when="signed-out">
              <Link href="/sign-in" className={CAPS + " text-[var(--ink)] transition-colors hover:text-[var(--lime)]"}>
                Sign in
              </Link>
              <Link href="/sign-up" className={CAPS + " group inline-flex items-center gap-2 bg-[var(--ink)] px-4 py-2.5 text-white transition-colors hover:bg-[var(--lime)]"}>
                Try it free
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link href="/platform/dashboard" className={CAPS + " group inline-flex items-center gap-2 bg-[var(--ink)] px-4 py-2.5 text-white transition-colors hover:bg-[var(--lime)]"}>
                Dashboard
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Show>
          </nav>

          <button onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open} className="p-2 text-[var(--ink)] transition-colors hover:text-[var(--lime)] md:hidden">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        <div className="h-[6px] bg-[var(--ink)]" />
      </div>

      {open && (
        <div className="max-h-[calc(100vh-5.5rem)] overflow-y-auto border-b-2 border-[var(--ink)] bg-[var(--paper)] md:hidden">
          <div className="px-5 py-2">
            {NAV.map((item) => (
              <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className="block border-b border-[var(--ink)] py-4 ff-display text-[22px] text-[var(--ink)] hover:text-[var(--lime)]">
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 py-5">
              <Show when="signed-out">
                <Link href="/sign-up" onClick={() => setOpen(false)} className={CAPS + " flex justify-center bg-[var(--lime)] py-4 text-white"}>
                  Try it free
                </Link>
                <Link href="/sign-in" onClick={() => setOpen(false)} className={CAPS + " flex justify-center border-2 border-[var(--ink)] py-4 text-[var(--ink)]"}>
                  Sign in
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/platform/dashboard" onClick={() => setOpen(false)} className={CAPS + " flex justify-center bg-[var(--lime)] py-4 text-white"}>
                  Dashboard
                </Link>
                <SignOutButton redirectUrl="/">
                  <button className={CAPS + " w-full border-2 border-[var(--danger-rule)] py-4 text-[var(--danger)]"}>Sign out</button>
                </SignOutButton>
              </Show>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
