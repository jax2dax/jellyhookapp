"use client"

import React from 'react'
import {
    SignInButton,
    SignUpButton,
    Show,
    UserButton,
    SignOutButton,
} from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, Zap, Shield, Rocket, Menu, X } from 'lucide-react'
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from 'next/font/google'

const display = Instrument_Serif({
    subsets: ['latin'],
    weight: ['400'],
    style: ['normal', 'italic'],
    variable: '--font-display',
})
const body = Inter_Tight({ subsets: ['latin'], variable: '--font-body' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

const FEATURES = [
    { icon: Zap,    title: 'Lightning Fast',    desc: 'Optimized for performance with sub-millisecond response times.' },
    { icon: Shield, title: 'Enterprise Grade',  desc: 'Bank-level security with end-to-end encryption out of the box.' },
    { icon: Rocket, title: 'Deploy Instantly',  desc: 'One-click deployment to the edge with global CDN distribution.' },
]

const TICKER = [
    'Conversion tracking',
    'Intent discovery',
    'Pipeline signals',
    'Zero-latency ingestion',
    'Edge native',
]

const NAV = [
    { label: 'Features', href: '#features', index: '01' },
    { label: 'Pricing',  href: '#pricing',  index: '02' },
    { label: 'About',    href: '#about',    index: '03' },
]

const primaryBtn =
    'group relative inline-flex h-14 w-full sm:w-auto items-center justify-center gap-3 bg-[var(--lime)] px-7 text-black ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] transition-colors duration-200 hover:bg-[var(--lime-bright)] active:bg-[var(--lime-dim)]'

const ghostBtn =
    'inline-flex h-14 w-full sm:w-auto items-center justify-center gap-3 border border-[#2b2b25] px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#cac8bf] transition-colors duration-200 hover:border-[var(--lime)] hover:text-[var(--lime)]'

const avatarAppearance = {
    elements: {
        avatarBox: 'w-8 h-8 rounded-none border border-[#2b2b25]',
    },
}

const LandingPage = () => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

    return (
        <div
            className={`${display.variable} ${body.variable} ${mono.variable} ff-body min-h-screen overflow-x-hidden bg-[#070706] text-[#e9e7e0] antialiased selection:bg-[var(--lime)] selection:text-black`}
        >
            <style>{`
                /* ===================================================
                   🎨 LIME / GREEN THEME — TWEAK THESE 3 VALUES
                   ===================================================
                   --lime-h : hue        (lower = more yellow-green, higher = more blue-green)
                   --lime-s : saturation (0% = grey, 100% = full intensity)
                   --lime-l : lightness  (0% = black,  100% = white)

                   For a softer neon:  try  s:75%  l:65%
                   For a harsher acid: try  s:100% l:58%
                   For a warmer moss:  try  h:70  s:70%  l:58%
                */
                :root {
                    --lime-h: 78;
                    --lime-s: 100%;
                    --lime-l: 62%;

                    --lime:        hsl(var(--lime-h) var(--lime-s) var(--lime-l));
                    --lime-bright: hsl(var(--lime-h) var(--lime-s) 78%);
                    --lime-dim:    hsl(var(--lime-h) 85% 46%);
                    --lime-glow:   hsl(var(--lime-h) var(--lime-s) var(--lime-l) / 0.28);
                    --lime-fade:   hsl(var(--lime-h) 55% 55% / 0.45);
                }

                .ff-display { font-family: var(--font-display), Georgia, 'Times New Roman', serif; }
                .ff-body    { font-family: var(--font-body), system-ui, sans-serif; }
                .ff-mono    { font-family: var(--font-mono), ui-monospace, monospace; }

                /* ---------- rope hook idle animation ---------- */
                @keyframes jh-rope-bob {
                    0%, 68%, 100% { transform: translateY(0); }
                    78%, 90%      { transform: translateY(18px); }
                }
                .jh-rope {
                    animation: jh-rope-bob 9s ease-in-out infinite;
                    will-change: transform;
                    transform-origin: top center;
                }
                @media (prefers-reduced-motion: reduce) {
                    .jh-rope { animation: none; }
                }

                /* ---------- marquee ---------- */
                @keyframes jh-marquee {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-50%); }
                }
                .jh-marquee { animation: jh-marquee 32s linear infinite; }

                .jh-grid {
                    background-image: linear-gradient(to right, #151512 1px, transparent 1px);
                    background-size: calc(100% / 6) 100%;
                }

                .jh-grain {
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
                }
            `}</style>

            {/* film grain */}
            <div className="jh-grain pointer-events-none fixed inset-0 z-[100] opacity-[0.05] mix-blend-overlay" />

            {/* ================= NAV ================= */}
            <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1b1b18] bg-[#070706]/85 backdrop-blur-xl">
                <div className="mx-auto max-w-[1400px] px-5 lg:px-10">
                    <div className="flex h-16 items-center justify-between md:h-[72px]">
                        {/* mark */}
                        <Link href="/" className="group flex items-center gap-3">
                            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-110">
                                <Image
                                    src="/darkMainLogo.png"
                                    alt="Jellyhook"
                                    width={28}
                                    height={28}
                                    priority
                                    className="h-7 w-7 object-contain"
                                />
                            </span>
                            <span className="ff-mono text-[12px] font-medium uppercase tracking-[0.34em] text-[#e9e7e0]">
                                Jellyhook
                            </span>
                        </Link>

                        {/* desktop links */}
                        <nav className="hidden items-center gap-9 md:flex">
                            {NAV.map((item) => (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className="group flex items-baseline gap-2 ff-mono text-[10px] uppercase tracking-[0.24em] text-[#77756d] transition-colors hover:text-[#e9e7e0]"
                                >
                                    <span className="text-[var(--lime)]/60 transition-colors group-hover:text-[var(--lime)]">
                                        {item.index}
                                    </span>
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
                                        <span className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]">
                                            Account
                                        </span>
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

            {/* ================= HERO ================= */}
            <section className="relative overflow-hidden border-b border-[#1b1b18] pt-32 md:pt-44">
                <div className="jh-grid pointer-events-none absolute inset-0 hidden lg:block" />

                {/* ✦ ANIMATED ROPE + HOOK — decorative, hangs from the top */}
                <div className="pointer-events-none absolute right-[3%] top-0 z-0 hidden xl:block">
                    <div className="jh-rope">
                        <Image
                            src="/ropeWithHook.png"
                            alt=""
                            width={150}
                            height={560}
                            priority
                            className="h-auto w-[150px] select-none opacity-90 drop-shadow-[0_0_35px_var(--lime-glow)]"
                            draggable={false}
                        />
                    </div>
                </div>

                <div className="relative mx-auto max-w-[1400px] px-5 lg:px-10">
                    <div className="grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-0">
                        {/* left */}
                        <div className="lg:col-span-7 lg:pr-14">
                            <div className="mb-8 flex items-center gap-3">
                                <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime)]" />
                                <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#8b8980]">
                                    Lead intelligence — public beta
                                </span>
                            </div>

                            <h1 className="ff-display text-[clamp(3rem,7.5vw,6.25rem)] leading-[0.9] tracking-[-0.025em] text-[#f4f2ea]">
                                Stop chasing.
                                <br />
                                Start{' '}
                                <em className="italic text-[var(--lime)]">hooking</em>.
                            </h1>

                            <p className="mt-8 max-w-md ff-body text-[15px] leading-[1.75] text-[#8b8980]">
                                The lead tracking platform that helps you close more deals.
                                Blazing fast, ridiculously simple, and unapologetically green.
                            </p>

                            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                                <Show when="signed-out">
                                    <SignUpButton mode="modal">
                                        <button className={primaryBtn}>
                                            Start and grow your business
                                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                        </button>
                                    </SignUpButton>
                                    <SignInButton mode="modal">
                                        <button className={ghostBtn}>Sign in</button>
                                    </SignInButton>
                                </Show>

                                <Show when="signed-in">
                                    <Link href="/dashboard">
                                        <button className={primaryBtn}>
                                            Go to dashboard
                                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                        </button>
                                    </Link>
                                    <div className="flex h-14 items-center gap-3 border border-[#1b1b18] px-4">
                                        <UserButton appearance={avatarAppearance} />
                                        <span className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]">
                                            Welcome back
                                        </span>
                                    </div>
                                </Show>
                            </div>
                        </div>

                        {/* right — pipeline panel */}
                        <div className="flex flex-col justify-end lg:col-span-5 lg:border-l lg:border-[#1b1b18] lg:pl-14">
                            <div className="relative border border-[#1b1b18] bg-[#0a0a09]">
                                <div className="flex items-center justify-between border-b border-[#1b1b18] px-4 py-3">
                                    <span className="ff-mono text-[10px] uppercase tracking-[0.26em] text-[#77756d]">
                                        Lead pipeline
                                    </span>
                                    <span className="flex items-center gap-2 ff-mono text-[10px] uppercase tracking-[0.26em] text-[var(--lime)]">
                                        <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime)]" />
                                        live
                                    </span>
                                </div>

                                {[
                                    { label: 'Inbound',     value: '2,481', pct: 82 },
                                    { label: 'Qualified',   value: '913',   pct: 46 },
                                    { label: 'Closed won',  value: '214',   pct: 19 },
                                ].map((row) => (
                                    <div
                                        key={row.label}
                                        className="flex items-center gap-4 border-b border-[#141412] px-4 py-4"
                                    >
                                        <span className="w-24 shrink-0 ff-mono text-[10px] uppercase tracking-[0.18em] text-[#8b8980]">
                                            {row.label}
                                        </span>
                                        <span className="h-[3px] flex-1 bg-[#1b1b18]">
                                            <span
                                                className="block h-full bg-[var(--lime)]"
                                                style={{ width: `${row.pct}%` }}
                                            />
                                        </span>
                                        <span className="ff-mono text-[11px] tabular-nums text-[#e9e7e0]">
                                            {row.value}
                                        </span>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between px-4 py-4">
                                    <span className="ff-mono text-[10px] uppercase tracking-[0.26em] text-[#77756d]">
                                        Conversion
                                    </span>
                                    <span className="ff-display text-3xl leading-none text-[var(--lime)]">
                                        8.6%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* hero footer strip */}
                    <div className="mt-20 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-[#1b1b18] py-5 md:mt-28">
                        <div className="flex items-center gap-5">
                            <span className="flex -space-x-2">
                                {[0, 1, 2, 3].map((i) => (
                                    <span
                                        key={i}
                                        className="h-6 w-6 border border-[#070706] bg-gradient-to-br from-[var(--lime-fade)] to-[var(--lime-dim)]"
                                    />
                                ))}
                            </span>
                            <span className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]">
                                <span className="text-[var(--lime)]">100+</span> businesses
                            </span>
                            <span className="hidden ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d] sm:inline">
                                ★★★★★ <span className="text-[#5f5d57]">4.2 / 5</span>
                            </span>
                        </div>

                        <div className="flex items-center gap-6 ff-mono text-[10px] uppercase tracking-[0.22em] text-[#5f5d57]">
                            <span className="hidden sm:inline">Est. 2026</span>
                            <span className="hidden md:inline">v1.0.0</span>
                            <span>Scroll ↓</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= TICKER ================= */}
            <div className="overflow-hidden border-b border-[#1b1b18] bg-[var(--lime)]">
                <div className="jh-marquee flex w-max">
                    {[0, 1].map((half) => (
                        <div key={half} className="flex shrink-0">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <span
                                    key={i}
                                    className="flex items-center gap-6 whitespace-nowrap px-6 py-3 ff-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-black"
                                >
                                    {TICKER[i % TICKER.length]}
                                    <span className="text-black/35">✦</span>
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* ================= FEATURES ================= */}
            <section id="features" className="border-b border-[#1b1b18]">
                <div className="mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-32">
                    <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-12">
                        <div className="lg:col-span-4">
                            <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">
                                02 / Capabilities
                            </span>
                        </div>
                        <div className="lg:col-span-8">
                            <h2 className="ff-display text-[clamp(2rem,4.2vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-[#f4f2ea]">
                                Built for conversion tracking &amp;{' '}
                                <em className="italic text-[var(--lime)]">intent discovery</em>.
                            </h2>
                            <p className="mt-5 max-w-lg ff-body text-[15px] leading-[1.75] text-[#8b8980]">
                                Understand your business&apos;s conversion rate better.
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-[#1b1b18]">
                        {FEATURES.map((feature, i) => {
                            const Icon = feature.icon
                            return (
                                <div
                                    key={feature.title}
                                    className="group grid grid-cols-1 items-center gap-4 border-b border-[#1b1b18] px-2 py-7 transition-colors duration-300 hover:bg-[var(--lime)] md:grid-cols-12 md:gap-6 md:px-5 md:py-9"
                                >
                                    <span className="ff-mono text-[11px] tracking-[0.2em] text-[#77756d] transition-colors group-hover:text-black/60 md:col-span-1">
                                        0{i + 1}
                                    </span>

                                    <h3 className="ff-display text-3xl leading-none tracking-[-0.01em] text-[#f4f2ea] transition-colors group-hover:text-black md:col-span-4 md:text-4xl">
                                        {feature.title}
                                    </h3>

                                    <p className="ff-body text-[14px] leading-relaxed text-[#8b8980] transition-colors group-hover:text-black/70 md:col-span-5">
                                        {feature.desc}
                                    </p>

                                    <div className="flex items-center justify-start gap-3 md:col-span-2 md:justify-end">
                                        <Icon
                                            className="h-5 w-5 text-[#4a4a43] transition-colors group-hover:text-black"
                                            strokeWidth={1.5}
                                        />
                                        <ArrowUpRight
                                            className="h-5 w-5 text-[#2b2b25] transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-black"
                                            strokeWidth={1.5}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ================= CTA ================= */}
            <section className="relative overflow-hidden border-b border-[#1b1b18] bg-[var(--lime)] text-black">
                {/* subtle vine/rope accent on the right of the CTA too */}
                <div className="pointer-events-none absolute -right-4 top-0 hidden h-full xl:block">
                    <div className="jh-rope" style={{ animationDelay: '2.5s' }}>
                        <Image
                            src="/ropeWithHook.png"
                            alt=""
                            width={130}
                            height={480}
                            className="h-auto w-[130px] select-none opacity-30 mix-blend-multiply"
                            draggable={false}
                        />
                    </div>
                </div>

                <div className="relative mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-28">
                    <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-12">
                        <div className="lg:col-span-7">
                            <span className="mb-6 block ff-mono text-[10px] uppercase tracking-[0.3em] text-black/50">
                                04 / Get started
                            </span>
                            <h3 className="ff-display text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.94] tracking-[-0.025em]">
                                Ready to <em className="italic">hook</em>
                                <br />
                                your leads?
                            </h3>
                        </div>

                        <div className="lg:col-span-5">
                            <p className="max-w-sm ff-body text-[15px] leading-[1.75] text-black/65">
                                Join us building the future at Jellyhook insights.
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <Show when="signed-out">
                                    <SignUpButton mode="modal">
                                        <button className="group inline-flex h-14 w-full items-center justify-center gap-3 bg-black px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--lime)] transition-colors hover:bg-[#151515] sm:w-auto">
                                            Get started free
                                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                        </button>
                                    </SignUpButton>
                                    <SignInButton mode="modal">
                                        <button className="inline-flex h-14 w-full items-center justify-center border border-black/35 px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-black transition-colors hover:bg-black hover:text-[var(--lime)] sm:w-auto">
                                            Sign in
                                        </button>
                                    </SignInButton>
                                </Show>

                                <Show when="signed-in">
                                    <Link href="/dashboard">
                                        <button className="group inline-flex h-14 w-full items-center justify-center gap-3 bg-black px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--lime)] transition-colors hover:bg-[#151515] sm:w-auto">
                                            Go to dashboard
                                            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                        </button>
                                    </Link>
                                </Show>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= FOOTER ================= */}
            <footer className="px-5 lg:px-10">
                <div className="mx-auto flex max-w-[1400px] flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <Image
                            src="/darkMainLogo.png"
                            alt="Jellyhook"
                            width={20}
                            height={20}
                            className="h-5 w-5 object-contain"
                        />
                        <span className="ff-mono text-[10px] uppercase tracking-[0.28em] text-[#8b8980]">
                            Jellyhook
                        </span>
                        <span className="ff-mono text-[10px] uppercase tracking-[0.28em] text-[#4a4a43]">
                            © 2026
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                        {['Privacy', 'Terms', 'Docs'].map((item) => (
                            <Link
                                key={item}
                                href="#"
                                className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[#77756d] transition-colors hover:text-[var(--lime)]"
                            >
                                {item}
                            </Link>
                        ))}
                        <span className="flex items-center gap-2 ff-mono text-[10px] uppercase tracking-[0.24em] text-[#5f5d57]">
                            <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime)]" />
                            All systems go
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default LandingPage