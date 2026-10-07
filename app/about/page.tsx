import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, AlertTriangle, Eye, Footprints, Route, TrendingUp } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { Show } from "@clerk/nextjs";
import { RandomIconBadge } from "@/components/RandomIconBadge";
import { HALLOWEEN_ICONS } from "@/components/marketing/halloweenIcons";

export const metadata: Metadata = {
  title: "About",
  description:
    "Jellyhook is a lead intelligence and conversion insight platform. Install a tracker script, watch how visitors move through your site, and see which pages and forms actually turn traffic into leads.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Jellyhook",
    description:
      "Jellyhook is a lead intelligence and conversion insight platform. Install a tracker script, watch how visitors move through your site, and see which pages and forms actually turn traffic into leads.",
    url: "/about",
  },
};

// What this actually changes for the business, not a tour of small
// features — see mds/progress_timeline.md (2026-10-01 landing-page
// rewrite) for why: a feature list reads as a spec sheet, not a reason to
// care. Every claim here still traces to a real, shipped capability
// (session replay, form_engagement tracking, the New Reach/Conversions
// charts) — nothing invented for the sake of sounding persuasive.
const COMPONENTS = [
  {
    icon: Footprints,
    title: "Every lead's footprints",
    desc: "Not a summary, the actual path: which pages, how long, how far they scrolled, before they ever filled out a form. Know what a lead saw before you ever talk to them.",
  },
  {
    icon: Route,
    title: "Conversion path tracking",
    desc: "The exact sequence of pages that led to a conversion, for every lead who converted, laid out start to finish, not reconstructed from a guess.",
  },
  {
    icon: AlertTriangle,
    title: "Form friction, spotted",
    desc: "See exactly where people stall out on a form, down to the field and the moment, instead of just watching your conversion rate stall and wondering why.",
  },
  {
    icon: TrendingUp,
    title: "Marketing decisions you can check",
    desc: "See whether a campaign or page change actually moved the needle, instead of guessing which one of five changes made the difference.",
  },
  {
    icon: Eye,
    title: "Spot confusion before it costs you",
    desc: "Notice which pages make visitors hesitate or leave, straight from their real sessions, not a theory about where your funnel might be leaking.",
  },
];

export default function AboutPage() {
  return (
    <MarketingPage>
      <section className="relative border-b border-[#1b1b18] pt-16 md:pt-24">
        <div className="relative mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          {/* seasonal — a random little ghost, different one on every load */}
          <RandomIconBadge images={HALLOWEEN_ICONS} size={32} className="pointer-events-none absolute right-6 top-8 rotate-6 select-none object-contain sm:right-16" />
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">About</span>
          <h1 className="mt-4 ff-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f2ea]">
            Most analytics tools tell you a page got hit. <em className="italic text-[var(--lime)]">Jellyhook tells you what happened on it.</em>
          </h1>
          <p className="mt-6 max-w-2xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
            Jellyhook is a lead intelligence and conversion-insight platform. You install a tracker script, it
            watches how people actually move through your site: the pages they land on, how long they stay, how far
            they scroll, whether they come back to something they&apos;d already seen. It also links every one of your form
            submissions back to that full visit history. The goal is one specific question: which pages and which
            forms are actually turning your traffic into leads, and which ones are quietly losing people.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">What it actually changes</span>
            </div>
            <div className="lg:col-span-8">
              <h2 className="ff-display text-[clamp(1.75rem,3.4vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-[#f4f2ea]">
                Not features. What you actually get.
              </h2>
            </div>
          </div>

          <div className="border-t border-[#1b1b18]">
            {COMPONENTS.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={c.title} className="grid grid-cols-1 items-start gap-4 border-b border-[#1b1b18] px-2 py-7 md:grid-cols-12 md:gap-6 md:px-5 md:py-8">
                  <span className="ff-mono text-[11px] tracking-[0.2em] text-[#77756d] md:col-span-1">0{i + 1}</span>
                  <div className="flex items-center gap-3 md:col-span-3">
                    <Icon className="h-5 w-5 shrink-0 text-[var(--lime)]" strokeWidth={1.5} />
                    <h3 className="ff-display text-xl leading-tight text-[#f4f2ea]">{c.title}</h3>
                  </div>
                  <p className="ff-body text-[14px] leading-relaxed text-[#8b8980] md:col-span-8">{c.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div>
              <h2 className="ff-display text-2xl text-[#f4f2ea]">Who it&apos;s for</h2>
              <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
                Website owners, marketers, and small business operators running a site with one or more conversion
                forms: anyone who wants to know what happens between a visitor landing on a page and either filling
                out a form or leaving.
              </p>
            </div>
            <div>
              <h2 className="ff-display text-2xl text-[#f4f2ea]">What it isn&apos;t</h2>
              <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
                Not a CRM, not a project management tool, not a generic AI content analyzer. Jellyhook doesn&apos;t manage
                your leads after capture or replace your existing tools. It tells you which pages and forms are
                actually working so you know where to focus.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[var(--lime)] text-black">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <h3 className="ff-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.98] tracking-[-0.02em]">
              See it on your own site.
            </h3>
            <Show when="signed-out">
              <Link href="/sign-up">
                <button className="group inline-flex h-14 w-full items-center justify-center gap-3 bg-black px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--lime)] transition-colors hover:bg-[#151515] sm:w-auto">
                  Get started free
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
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
      </section>
    </MarketingPage>
  );
}
