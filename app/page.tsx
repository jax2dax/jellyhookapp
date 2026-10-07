import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Show, UserButton } from "@clerk/nextjs";
import { ArrowRight, ArrowUpRight, UserCheck, TrendingUp, Users } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { primaryBtn, ghostBtn, avatarAppearance } from "@/components/marketing/MarketingTheme";
import { RandomIconBadge } from "@/components/RandomIconBadge";
import { HALLOWEEN_ICONS } from "@/components/marketing/halloweenIcons";

export const metadata: Metadata = {
  title: "Lead Intelligence & Conversion Insights",
  description:
    "Jellyhook shows you what a lead saw before they converted, exactly where your forms lose people, and which pages are actually turning visitors into leads.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Jellyhook: Lead Intelligence & Conversion Insights",
    description:
      "Jellyhook shows you what a lead saw before they converted, exactly where your forms lose people, and which pages are actually turning visitors into leads.",
    url: "/",
  },
};

// Promises, not features — the hero makes the case for what the business
// gets out of this. The mechanism (one tracker script → session replay →
// linked form submissions) is explained once, lower down, right before the
// per-team breakdown it enables. See SAAS_PRODUCT_AUDIT.md §3 for what each
// team-facing claim below is actually backed by.
const HERO_PROMISES = ["Close more deals", "Decrease form friction", "Increase conversions", "Grow your business"];

// Who actually uses this and what it does for them — not a list of
// standalone features. Every claim here is traceable to a real, shipped
// capability (session replay, linked form submissions, abandoned-form
// tracking); nothing here is a scored/algorithmic claim like the old
// "Page Health Scoring" line used to be — that was never a real algorithm,
// just heuristic if-statements, and roadmap.md already rules out marketing
// it as one.
const AUDIENCES = [
  {
    icon: UserCheck,
    title: "Sales",
    desc: "Walk into every call already knowing what a lead saw: which pages, how long, and what was on screen right before they converted. Wear their shoes before you ever say hello.",
  },
  {
    icon: TrendingUp,
    title: "Marketing",
    desc: "Spot the pages and moments that actually push visitors to convert, see whether a campaign change really moved the needle, and put budget behind the channels proven to bring in leads.",
  },
  {
    icon: Users,
    title: "Business managers",
    desc: "Watch conversions trend over time and see, from the real session replays, exactly which pages hold attention and which ones quietly lose it, giving your whole team a shared, factual picture to work from.",
  },
];

const TICKER = ["Session replay", "Hook queries", "Scroll depth", "Lead intelligence", "HubSpot forms", "Conversion paths"];

// The four hero promises, said again with the "why" behind them — outcomes
// a reader can picture, not a feature re-explained in smaller text.
const PROMISE_DETAILS = [
  {
    title: "Close more deals",
    desc: "Know what a lead actually looked at and cared about before you ever pick up the phone, so you can open with the thing that already has their attention, not a generic script.",
  },
  {
    title: "Decrease form friction",
    desc: "Stop guessing why your conversion rate won't move. See exactly where people stall out on a form, down to the field and the moment, every time it happens.",
  },
  {
    title: "Increase conversions",
    desc: "Find the pages and paths quietly doing the work, and the ones quietly losing you leads, so every change you make is aimed at something real.",
  },
  {
    title: "Grow your business",
    desc: "Give sales, marketing, and leadership the same real picture of what's happening on your site, instead of three different guesses pulling in three different directions.",
  },
];

// New: Hook. Every line is a shipped capability (see app/docs/hook). Not claimed: saved hooks, exports,
// natural-language questions.
const HOOK_POINTS = [
  { title: "No SQL. No analyst.", desc: "Build a question out of plain choices. Hook reads it back to you in plain English before you run it." },
  { title: "Questions that chain", desc: "Feed the answer of one question into another: find your Hanna leads, then see every page they viewed, in one run." },
  { title: "See it before you run it", desc: "A live preview draws the visit your question describes in the same shapes as session replay, for free." },
  { title: "Answers, not tables of ids", desc: "Results come back as session replays, lead profiles and numbers with context, with the pages that made each result match highlighted." },
  { title: "Find where forms lose people", desc: "Ask which field people give up on, which they click but never type in, and how long each one takes." },
  { title: "Compare two questions", desc: "Divide one answer by another: what share of conversions passed through your pricing page?" },
];

const HOOK_EXAMPLES = [
  "Which pages did leads named Hanna view before converting?",
  "How many sessions read /blogs for real, then left without converting?",
  "Which form field do people give up on most?",
  "What do visitors open right after the homepage?",
];

const LandingPage = () => {
  return (
    <MarketingPage>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-[#1b1b18] pt-16 md:pt-28">
        <div className="jh-grid pointer-events-none absolute inset-0 hidden lg:block" />

        {/* ✦ ANIMATED ROPE + HOOK — decorative, hangs from the top */}
        <div className="pointer-events-none absolute -top-12 right-[3%] z-0 hidden xl:block">
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
            <div className="relative lg:col-span-7 lg:pr-14">
              {/* seasonal — a random little ghost, different one on every load, above the headline's top-left corner */}
              <RandomIconBadge
                images={HALLOWEEN_ICONS}
                size={36}
                className="pointer-events-none absolute -top-14 left-0 -rotate-6 select-none object-contain sm:-top-16"
              />

              <div className="mb-8 flex items-center gap-3">
                <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime)]" />
                <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#8b8980]">Lead intelligence, conversion insights &amp; form friction</span>
              </div>

              <h1 className="ff-display text-[clamp(3rem,7.5vw,6.25rem)] leading-[0.9] tracking-[-0.025em] text-[#f4f2ea]">
                Stop chasing.
                <br />
                Start <em className="italic text-[var(--lime)]">hooking</em>.
              </h1>

              <ul className="mt-8 grid max-w-md grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-6">
                {HERO_PROMISES.map((promise) => (
                  <li key={promise} className="flex items-center gap-2 ff-display text-[17px] leading-tight text-[#f4f2ea]">
                    <ArrowRight className="h-4 w-4 shrink-0 text-[var(--lime)]" />
                    {promise}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Show when="signed-out">
                  <Link href="/sign-up">
                    <button className={primaryBtn}>
                      Start tracking your site
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  </Link>
                  <Link href="/sign-in">
                    <button className={ghostBtn}>Sign in</button>
                  </Link>
                </Show>

                <Show when="signed-in">
                  <Link href="/platform/dashboard">
                    <button className={primaryBtn}>
                      Go to dashboard
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  </Link>
                  <div className="flex h-14 items-center gap-3 border border-[#1b1b18] px-4">
                    <UserButton appearance={avatarAppearance} />
                    <span className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]">Welcome back</span>
                  </div>
                </Show>
              </div>
            </div>

            {/* right — sample session panel */}
            <div className="flex flex-col justify-end lg:col-span-5 lg:border-l lg:border-[#1b1b18] lg:pl-14">
              <div className="relative border border-[#1b1b18] bg-[#0a0a09]">
                <div className="flex items-center justify-between border-b border-[#1b1b18] px-4 py-3">
                  <span className="ff-mono text-[10px] uppercase tracking-[0.26em] text-[#77756d]">Sample dashboard</span>
                  <span className="flex items-center gap-2 ff-mono text-[10px] uppercase tracking-[0.26em] text-[#5f5d57]">
                    <span className="h-1.5 w-1.5 bg-[var(--lime)]/60" />
                    preview
                  </span>
                </div>

                {[
                  { label: "Sessions", value: "tracked" },
                  { label: "Scroll depth", value: "captured" },
                  { label: "Form fills", value: "linked to visitor" },
                ].map((row, i) => (
                  <div key={row.label} className="flex items-center gap-4 border-b border-[#141412] px-4 py-4">
                    <span className="w-28 shrink-0 ff-mono text-[10px] uppercase tracking-[0.18em] text-[#8b8980]">{row.label}</span>
                    <span className="h-[3px] flex-1 bg-[#1b1b18]">
                      <span className="block h-full bg-[var(--lime)]" style={{ width: `${72 - i * 18}%` }} />
                    </span>
                    <span className="ff-mono text-[10px] uppercase tracking-[0.16em] text-[#e9e7e0]">{row.value}</span>
                  </div>
                ))}

                <div className="flex items-center justify-between px-4 py-4">
                  <span className="ff-mono text-[10px] uppercase tracking-[0.26em] text-[#77756d]">Conversion path</span>
                  <span className="ff-display text-2xl leading-none text-[var(--lime)]">mapped end-to-end</span>
                </div>
              </div>
            </div>
          </div>

          {/* hero footer strip */}
          <div className="mt-20 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-[#1b1b18] py-5 md:mt-28">
            <span className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[#77756d]">
              One tracker script. Every session, replayed. Not sampled or estimated.
            </span>

            <div className="flex items-center gap-6 ff-mono text-[10px] uppercase tracking-[0.22em] text-[#5f5d57]">
              <span className="hidden sm:inline">Est. 2026</span>
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
                <span key={i} className="flex items-center gap-6 whitespace-nowrap px-6 py-3 ff-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-black">
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
              <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">02 / Capabilities</span>
            </div>
            <div className="lg:col-span-8">
              <h2 className="ff-display text-[clamp(2rem,4.2vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-[#f4f2ea]">
                Built for conversion tracking &amp; <em className="italic text-[var(--lime)]">intent discovery</em>.
              </h2>
              <p className="mt-5 max-w-lg ff-body text-[15px] leading-[1.75] text-[#8b8980]">
                Install one script and Jellyhook turns every visit into a full session replay: pages seen, time
                spent, how far they scrolled. It also links every form submission straight back to that history.
                Here&apos;s what that means for the people who actually use it.
              </p>
            </div>
          </div>

          <div className="border-t border-[#1b1b18]">
            {AUDIENCES.map((audience, i) => {
              const Icon = audience.icon;
              return (
                <div
                  key={audience.title}
                  className="group grid grid-cols-1 items-center gap-4 border-b border-[#1b1b18] px-2 py-7 transition-colors duration-300 hover:bg-[var(--lime)] md:grid-cols-12 md:gap-6 md:px-5 md:py-9"
                >
                  <span className="ff-mono text-[11px] tracking-[0.2em] text-[#77756d] transition-colors group-hover:text-black/60 md:col-span-1">0{i + 1}</span>

                  <h3 className="ff-display text-3xl leading-none tracking-[-0.01em] text-[#f4f2ea] transition-colors group-hover:text-black md:col-span-4 md:text-4xl">
                    {audience.title}
                  </h3>

                  <p className="ff-body text-[14px] leading-relaxed text-[#8b8980] transition-colors group-hover:text-black/70 md:col-span-5">{audience.desc}</p>

                  <div className="flex items-center justify-start gap-3 md:col-span-2 md:justify-end">
                    <Icon className="h-5 w-5 text-[#4a4a43] transition-colors group-hover:text-black" strokeWidth={1.5} />
                    <ArrowUpRight
                      className="h-5 w-5 text-[#2b2b25] transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-black"
                      strokeWidth={1.5}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 ff-mono text-[10px] uppercase tracking-[0.22em]">
            <span className="text-[#5f5d57]">Works with</span>
            <span className="text-[#f4f2ea]">plain HTML forms</span>
            <span className="text-[#5f5d57]">·</span>
            <span className="text-[#f4f2ea]">HubSpot embeds</span>
            <span className="text-[#5f5d57]">·</span>
            <span className="text-[#f4f2ea]">most other form builders</span>
          </div>
        </div>
      </section>

      {/* ================= WHY IT MATTERS ================= */}
      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-32">
          <div className="mb-16 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">03 / Why it matters</span>
            </div>
            <div className="lg:col-span-8">
              <h2 className="ff-display text-[clamp(2rem,4.2vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-[#f4f2ea]">
                Every lost lead had a reason. <em className="italic text-[var(--lime)]">You just never saw it.</em>
              </h2>
              <p className="mt-5 max-w-lg ff-body text-[15px] leading-[1.75] text-[#8b8980]">
                A bounce rate tells you someone left. It never tells you why. Jellyhook is built to close that
                gap, so the four things above aren&apos;t just promises: they&apos;re what you actually get.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-[#1b1b18] sm:grid-cols-2">
            {PROMISE_DETAILS.map((item) => (
              <div key={item.title} className="bg-[#0a0a09] p-7 lg:p-9">
                <h3 className="ff-display text-xl text-[#f4f2ea]">{item.title}</h3>
                <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOOK ================= */}
      <section id="hook" className="relative overflow-hidden border-b border-[#1b1b18]">
        <div className="jh-grid pointer-events-none absolute inset-0 hidden opacity-60 lg:block" />
        <div className="relative mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-32">
          <div className="mb-14 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--lime)]">New / Hook</span>
            </div>
            <div className="lg:col-span-8">
              <h2 className="ff-display text-[clamp(2.2rem,5vw,4rem)] leading-[0.95] tracking-[-0.02em] text-[#f4f2ea]">
                Ask your visitors <em className="italic text-[var(--lime)]">anything</em>. Get the answer in seconds.
              </h2>
              <p className="mt-6 max-w-2xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
                Meet Hook, the new way to question your own data. Dashboards answer the questions someone thought of in advance. Hook answers yours: precise questions about
                sessions, leads, pages and forms, built from plain choices, answered live, drawn as the people and visits behind the numbers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px border border-[#1b1b18] bg-[#1b1b18] md:grid-cols-2 lg:grid-cols-3">
            {HOOK_POINTS.map((p) => (
              <div key={p.title} className="bg-[#070706] p-7">
                <h3 className="ff-display text-xl text-[#f4f2ea]">{p.title}</h3>
                <p className="mt-3 ff-body text-[13px] leading-[1.7] text-[#8b8980]">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Questions Hook answers today</span>
              <ul className="mt-5 space-y-3">
                {HOOK_EXAMPLES.map((q) => (
                  <li key={q} className="flex items-start gap-3 ff-display text-[18px] leading-snug text-[#f4f2ea]">
                    <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-[var(--lime)]" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7">
              <div className="border border-[#1b1b18] bg-[#0a0a09] p-6">
                <span className="ff-mono text-[10px] uppercase tracking-[0.26em] text-[#77756d]">Reads as</span>
                <p className="mt-3 ff-display text-2xl leading-snug text-[#f4f2ea]">
                  Show <span className="text-[var(--lime)]">the number of</span> sessions where <span className="text-[var(--lime)]">converted</span> is true and one page view is{" "}
                  <span className="text-[var(--lime)]">/pricing</span>.
                </p>
                <p className="mt-4 ff-body text-[13px] leading-relaxed text-[#8b8980]">
                  Every question reads back like a sentence, so you check it before you run it. It is included on every plan during early access.
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/sign-up">
                  <button className={primaryBtn}>
                    Try Hook
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </button>
                </Link>
                <Link href="/docs/hook">
                  <button className={ghostBtn}>Read how Hook works</button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative overflow-hidden border-b border-[#1b1b18] bg-[var(--lime)] text-black">
        {/* subtle vine/rope accent on the right of the CTA too */}
        <div className="pointer-events-none absolute -right-4 -top-12 hidden h-full xl:block">
          <div className="jh-rope" style={{ animationDelay: "2.5s" }}>
            <Image src="/ropeWithHook.png" alt="" width={130} height={480} className="h-auto w-[130px] select-none opacity-30 mix-blend-multiply" draggable={false} />
          </div>
        </div>

        <div className="relative mx-auto max-w-[1400px] px-5 py-20 lg:px-10 lg:py-28">
          <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <span className="mb-6 block ff-mono text-[10px] uppercase tracking-[0.3em] text-black/50">04 / Get started</span>
              <h3 className="ff-display text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.94] tracking-[-0.025em]">
                Ready to <em className="italic">hook</em>
                <br />
                your leads?
              </h3>
            </div>

            <div className="lg:col-span-5">
              <p className="max-w-sm ff-body text-[15px] leading-[1.75] text-black/65">
                Create a site, drop the tracker script in, and watch your first session replay come in. Free to start.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Show when="signed-out">
                  <Link href="/sign-up">
                    <button className="group inline-flex h-14 w-full items-center justify-center gap-3 bg-black px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--lime)] transition-colors hover:bg-[#151515] sm:w-auto">
                      Get started free
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  </Link>
                  <Link href="/sign-in">
                    <button className="inline-flex h-14 w-full items-center justify-center border border-black/35 px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-black transition-colors hover:bg-black hover:text-[var(--lime)] sm:w-auto">
                      Sign in
                    </button>
                  </Link>
                </Show>

                <Show when="signed-in">
                  <Link href="/platform/dashboard">
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
    </MarketingPage>
  );
};

export default LandingPage;
