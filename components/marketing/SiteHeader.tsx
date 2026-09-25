// components/marketing/SiteHeader.tsx
// Shared top nav for every public marketing page. The wordmark now renders
// in the lime brand color (was plain off-white) and the logo mark is
// jellyhookMark.png — a chroma-keyed, transparent version of the original
// darkMainLogo.png. That original file has an opaque WHITE background baked
// into the PNG (no alpha channel at all), so on this near-black header it
// rendered as a pale square smudge behind the hook — effectively invisible
// as a "logo" rather than displaying one. jellyhookMark.png keys that white
// out to transparent and is trimmed to the mark's real bounding box, so only
// the black badge + green hook show, sitting flush on the header's own
// near-black background.
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { SignInButton, SignUpButton, Show, UserButton, SignOutButton } from "@clerk/nextjs";
import { ArrowRight, Menu, X } from "lucide-react";
import { avatarAppearance } from "./MarketingTheme";

const NAV = [
  { label: "Features", href: "/#features", index: "01" },
  { label: "Pricing", href: "/pricing", index: "02" },
  { label: "About", href: "/about", index: "03" },
  { label: "Docs", href: "/docs", index: "04" },
];

export function Wordmark({ size = 28, textClassName = "text-[13px]" }: { size?: number; textClassName?: string }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <span
        className="relative flex shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-110"
        style={{ height: size, width: size }}
      >
        <Image src="/jellyhookMark.png" alt="Jellyhook" width={size} height={size} priority className="h-full w-full object-contain" />
      </span>
      <span className={`ff-mono ${textClassName} font-semibold uppercase tracking-[0.34em] text-[var(--lime)] drop-shadow-[0_0_12px_var(--lime-glow)]`}>
        Jellyhook
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1b1b18] bg-[#070706]/85 backdrop-blur-xl">
      <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
        <div className="flex h-16 items-center justify-between md:h-[72px]">
          <Wordmark size={30} textClassName="text-[12px]" />

          {/* desktop links */}
          <nav className="hidden items-center gap-9 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-baseline gap-2 ff-mono text-[10px] uppercase tracking-[0.24em] text-[#77756d] transition-colors hover:text-[#e9e7e0]"
              >
                <span className="text-[var(--lime)]/60 transition-colors group-hover:text-[var(--lime)]">{item.index}</span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* desktop auth */}
          <div className="hidden items-center gap-3 md:flex">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="h-10 px-4 ff-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8a69d] transition-colors hover:text-[var(--lime)]">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="group inline-flex h-10 items-center gap-2.5 bg-[var(--lime)] px-5 ff-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-black transition-colors hover:bg-[var(--lime-bright)]">
                  Get started
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </SignUpButton>
            </Show>

            <Show when="signed-in">
              <Link href="/dashboard">
                <button className="group inline-flex h-10 items-center gap-2.5 bg-[var(--lime)] px-5 ff-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-black transition-colors hover:bg-[var(--lime-bright)]">
                  Dashboard
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </Link>
              <UserButton appearance={avatarAppearance} />
            </Show>
          </div>

          {/* mobile toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            className="p-2 text-[#e9e7e0] transition-colors hover:text-[var(--lime)] md:hidden"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* mobile menu */}
      {isMobileMenuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-[#1b1b18] bg-[#070706] md:hidden">
          <div className="px-5 py-2">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-baseline gap-3 border-b border-[#141412] py-4 ff-mono text-[11px] uppercase tracking-[0.24em] text-[#a8a69d] transition-colors hover:text-[var(--lime)]"
              >
                <span className="text-[var(--lime)]/60">{item.index}</span>
                {item.label}
              </Link>
            ))}

            <div className="flex flex-col gap-3 py-5">
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button className="inline-flex w-full items-center justify-center bg-[var(--lime)] py-4 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-black">
                    Get started
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button className="inline-flex w-full items-center justify-center border border-[#2b2b25] py-4 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cac8bf]">
                    Sign in
                  </button>
                </SignInButton>
              </Show>

              <Show when="signed-in">
                <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                  <button className="inline-flex w-full items-center justify-center bg-[var(--lime)] py-4 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-black">
                    Dashboard
                  </button>
                </Link>
                <div className="flex items-center justify-between border border-[#1b1b18] px-4 py-3">
                  <span className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]">Account</span>
                  <UserButton appearance={avatarAppearance} />
                </div>
                <SignOutButton redirectUrl="/">
                  <button className="inline-flex w-full items-center justify-center border border-[#3a1c1c] py-4 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ff7a6b] transition-colors hover:bg-[#ff7a6b]/10">
                    Sign out
                  </button>
                </SignOutButton>
              </Show>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
