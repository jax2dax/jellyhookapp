// app/page.tsx: the home page, in the magazine look chosen by the founder on 2026-10-28 (white paper, ink, one green).
// Copy: the founder's landing copy of 2026-10-28, kept inside marketing/claims-ledger.md (rows noted per section).
// The previous home page is kept, unrouted, in app/_legacy-home/page.tsx. Before/after: marketing/changes.md.
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { ArrowRight } from "lucide-react";
import { IssueHookBox } from "@/components/showcase/v2/IssueHookBox";
import { HookMark } from "@/components/showcase/v2/HookMark";
import { Reveal } from "@/components/showcase/v2/Reveal";
import { HubSpotCardShowcase } from "@/components/showcase/v2/HubSpotCardShowcase";
import { SlackDesktopShowcase } from "@/components/showcase/SlackDesktopShowcase";
import { LeadsShowcase } from "@/components/showcase/LeadsShowcase";
import { MarketingThemeStyles } from "@/components/marketing/MarketingTheme";
import { marketingFontVariables, v2FontVariables } from "@/components/marketing/fonts";
import "./landing.css";

const DESCRIPTION =
  "Your leads have already told you something through their behavior. Jellyhook connects what they visited, read and hesitated on to each lead, so your next call is not a cold one. One script. Free to try.";

export const metadata: Metadata = {
  title: "Stop treating every lead like a stranger",
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: "Jellyhook: Stop treating every lead like a stranger", description: DESCRIPTION, url: "/" },
};

const WRAP = "mx-auto max-w-[1440px] px-5 md:px-12 lg:px-[72px]";
const H2 = "v2-serif text-[clamp(2.2rem,4.2vw,3.8rem)] leading-[1.02] tracking-[-0.02em]";
const BODY = "text-[17px] leading-[1.7] text-[var(--ink-soft)]";
const RULE_COL = "lg:border-l lg:border-[var(--ink)] lg:pl-12";

/** The issue's cover art: a jelly dome, a whale's back and a hook on its line, as flat shapes. */
function CoverArt() {
  return (
    <svg viewBox="0 0 1300 340" className="h-full w-full" aria-hidden preserveAspectRatio="xMinYMid slice">
      <rect width="1300" height="340" fill="var(--paper-2)" />
      <path className="v2-shape" d="M120 340 A230 230 0 0 1 580 340 Z" fill="var(--spot)" />
      <circle className="v2-shape" cx="700" cy="250" r="44" fill="var(--ink)" />
      <path className="v2-shape" d="M1300 0 V340 H820 C 900 300, 1010 290, 980 200 C 950 110, 1080 60, 1180 0 Z" fill="var(--ink)" />
      <g className="v2-shape">
        <g className="v2-sway" fill="none" stroke="var(--spot)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1110 0 V64" strokeWidth="4" />
          <circle cx="1110" cy="80" r="15" strokeWidth="11" />
          <path d="M1110 95 V226 A42 42 0 0 1 1026 226 V182" strokeWidth="14" />
          <path d="M1026 182 L1052 210" strokeWidth="14" />
        </g>
      </g>
    </svg>
  );
}

function Cta({ href = "/sign-up", children }: { href?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="group inline-flex h-14 w-fit items-center gap-3 bg-[var(--spot)] px-8 v2-caps text-[13px] text-white transition-colors duration-300 hover:bg-[var(--ink)]">
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
    </Link>
  );
}

function Dash({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((t, i) => (
        <li key={t} data-reveal="rise" style={{ "--d": `${i * 90}ms` } as React.CSSProperties} className="grid grid-cols-[1.5rem_1fr] text-[17px] leading-[1.6]">
          <span aria-hidden className="mt-[0.7em] h-[3px] w-3 bg-[var(--spot)]" />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** A heavy section rule that draws itself in. */
const Rule = ({ h = 6 }: { h?: number }) => <div data-reveal="rule" className="bg-[var(--ink)]" style={{ height: h }} />;

const ROUTE = [
  { n: "1", page: "/", time: "0:20", note: "Read the top, left at the second heading" },
  { n: "2", page: "/pricing", time: "1:04", note: "Scrolled 72%, most time on “Business”" },
  { n: "3", page: "/pricing", time: "0:51", note: "Came back the next day" },
  { n: "4", page: "/contact", time: "0:48", note: "Sent the form" },
];

const JOURNEY = [
  ["Pages visited", "Follow their path from the first recorded visit to conversion."],
  ["Reading behavior", "See which headings and content sections they reached."],
  ["Engagement", "Inspect time spent, scroll depth, and recorded interactions."],
  ["Form behavior", "Investigate field-level time and forms started but never submitted."],
  ["Previous visits", "Connect eligible browsing history to the lead when they submit a supported form."],
];

const MARKERS = [
  ["Flag buying intent.", "Identify leads whose recorded behavior matches your criteria, such as repeated visits to your pricing page."],
  ["Flag potential confusion.", "Surface specified behaviors that may indicate hesitation or friction, based on the rules you configure."],
  ["Define your own conditions.", "Set narrow rules around supported pages, sections, visits, and interactions."],
];

const CRM = [
  ["Personalize sales outreach.", "Use recorded website activity to prepare more relevant calls and follow-ups."],
  ["Nurture leads with context.", "Build more relevant messaging around the pages, services, and content a lead explored."],
  ["Spend less time guessing.", "Use the information you have about a lead to make better decisions about what to say next."],
];

const STEPS = [
  ["Install Jellyhook", "Add one script to your website."],
  ["Configure your tracking", "Use the supported setup for your site, including Google Tag Manager if you prefer a no-code installation."],
  ["Let visitors browse", "Jellyhook records the supported page, engagement, and form events."],
  ["Investigate your leads", "Explore lead journeys, configure intent markers, and uncover opportunities to improve your outreach and conversion process."],
];

function Columns({ items }: { items: string[][] }) {
  return (
    <div className="grid border-t-4 border-[var(--ink)] lg:grid-cols-3">
      {items.map(([t, d], i) => (
        <div key={t} data-reveal="rise" style={{ "--d": `${i * 120}ms` } as React.CSSProperties} className={"py-8 lg:px-10 " + (i === 0 ? "lg:pl-0" : "lg:border-l lg:border-[var(--ink)]")}>
          <h3 className="v2-serif text-[1.7rem] leading-tight">{t}</h3>
          <p className={"mt-4 " + BODY}>{d}</p>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className={`v2 ${v2FontVariables} min-h-screen overflow-x-clip`}>
      <Reveal />

      {/* masthead */}
      <header className={WRAP}>
        <div className="flex flex-wrap items-end justify-between gap-4 pb-3 pt-7">
          <Link href="/" className="flex items-end gap-2 v2-serif text-[clamp(2.4rem,4.5vw,3.8rem)] leading-none tracking-[-0.02em]">
            <span>
              Jelly<span className="text-[var(--spot)]">hook</span>
            </span>
            <HookMark className="mb-1 h-[0.7em] w-[0.46em] text-[var(--spot)]" strokeWidth={3.6} />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 pb-1 v2-caps text-[12px]">
            <Link href="#journey" className="transition-colors hover:text-[var(--spot)]">How it works</Link>
            <Link href="/docs" className="transition-colors hover:text-[var(--spot)]">Docs</Link>
            <Link href="/pricing" className="transition-colors hover:text-[var(--spot)]">Pricing</Link>
            <Link href="/sign-in" className="transition-colors hover:text-[var(--spot)]">Sign in</Link>
            <Link href="/sign-up" className="bg-[var(--ink)] px-4 py-2.5 text-[var(--paper)] transition-colors hover:bg-[var(--spot)]">Try it free</Link>
          </nav>
        </div>
        <div className="h-[6px] bg-[var(--ink)]" />
        <div className="flex justify-between gap-4 border-b border-[var(--ink)] py-2.5 v2-caps text-[11px]">
          <span>Lead intelligence for lead-generation websites</span>
          <span className="hidden sm:inline">Free to try</span>
        </div>
      </header>

      <main className={WRAP}>
        {/* 01 hero (ledger 1, 2, 23, 26) */}
        <section className="grid lg:grid-cols-[7fr_5fr]">
          <div className="py-12 lg:py-16 lg:pr-12">
            <h1 className="v2-serif text-[clamp(3rem,6.2vw,6rem)] leading-[0.98] tracking-[-0.025em]">
              Stop treating every lead like a <span className="text-[var(--spot)]">stranger</span>.
            </h1>
            <p className="v2-dek mt-8 max-w-[36rem] text-[19px] leading-[1.6]">
              Your leads have already told you something through their behavior. What they visited, what they read, where they
              hesitated, and what brought them to your website.
            </p>
            <div className="mt-9 flex flex-col gap-3">
              <Cta>Try Jellyhook for free</Cta>
              <span className="text-[15px] text-[var(--ink-soft)]">One simple script to install. Too technical? Use Google Tag Manager.</span>
            </div>
          </div>
          <div className="border-t border-[var(--ink)] py-12 lg:border-l lg:border-t-0 lg:py-16 lg:pl-12">
            <p className="v2-serif mb-8 text-[clamp(1.6rem,2.4vw,2.2rem)] leading-[1.2]">Which new lead should someone call right now?</p>
            <IssueHookBox />
          </div>
        </section>

        {/* what it does, in three lines */}
        <section className="grid border-y border-[var(--ink)] sm:grid-cols-3">
          {["See the journey behind every converted lead.", "Spot high-intent behaviors with custom intent markers.", "Discover what your best leads have in common."].map((t, i) => (
            <p key={t} className={"flex items-start gap-3 py-6 text-[16px] font-semibold leading-snug sm:px-8 " + (i === 0 ? "sm:pl-0" : "border-t border-[var(--ink)] sm:border-l sm:border-t-0")}>
              <HookMark className="mt-0.5 h-6 w-4 shrink-0 text-[var(--spot)]" />
              {t}
            </p>
          ))}
        </section>

        {/* 02 sales intelligence */}
        <section className="py-20">
          <h2 data-reveal="rise" className={H2 + " max-w-[18ch]"}>Be one step ahead on your next call.</h2>
          <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-0">
            <div data-reveal="rise" className="space-y-5 lg:pr-12">
              <p className="v2-dek text-[19px] leading-[1.6]">
                Your next lead is about to get another generic email, another scripted pitch, another follow-up that sounds like
                everyone else&apos;s.
              </p>
              <p className="v2-serif text-[1.6rem] leading-snug">Unless you know something they don&apos;t expect you to know.</p>
              <p className={BODY}>Jellyhook gives you the behavioral context to make your next conversation more relevant.</p>
            </div>
            <div className={RULE_COL}>
              <ul className="border-t-4 border-[var(--ink)]">
                {["Did they revisit your pricing page?", "Spend time exploring a particular service?", "Read your implementation guide before booking a call?"].map((q, i) => (
                  <li key={q} data-reveal="rise" style={{ "--d": `${i * 140}ms` } as React.CSSProperties} className="flex items-baseline gap-4 border-b border-[var(--ink)] py-5">
                    <span aria-hidden className="v2-serif text-[2.2rem] leading-none text-[var(--spot)]">?</span>
                    <span className="v2-serif text-[1.45rem] leading-tight">{q}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-[17px] font-semibold leading-[1.6]">Personalize your follow-ups. Nurture leads with context. Make every conversation count.</p>
              <Link href="/sign-up" className="group mt-5 inline-flex items-center gap-2 v2-caps text-[12px] underline decoration-2 hover:text-[var(--spot)]">
                Explore your leads <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </section>

        {/* cover art band */}
        <section className="relative h-[220px] overflow-hidden border-y-[6px] border-[var(--ink)] md:h-[320px]">
          <CoverArt />
        </section>

        {/* 03 the journey (ledger 2, 3, 4) */}
        <section id="journey" className="scroll-mt-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[5fr_7fr] lg:gap-0">
            <div className="lg:pr-12">
              <h2 data-reveal="rise" className={H2}>Stop watching session videos. Understand the journey at a glance.</h2>
              <p data-reveal="rise" className={"mt-6 " + BODY}>
                Session replays make you watch what happened. Traditional analytics show you aggregate numbers. Jellyhook helps you
                investigate the structural footprint of a lead&apos;s journey.
              </p>
              <p data-reveal="rise" className="v2-serif mt-6 text-[1.5rem]">See the journey, not just the numbers.</p>
            </div>
            <div className={RULE_COL}>
              <div className="flex items-baseline justify-between border-t-4 border-[var(--ink)] pt-3 v2-caps text-[11px]">
                <span>One lead&apos;s journey</span>
                <span className="text-[var(--ink-soft)]">Example data</span>
              </div>
              <ol>
                {ROUTE.map((r, i) => (
                  <li
                    key={r.n}
                    data-reveal="rise"
                    style={{ "--d": `${i * 160}ms` } as React.CSSProperties}
                    className={"grid grid-cols-[3rem_1fr_auto] items-baseline gap-x-4 border-b border-[var(--ink)] py-5 " + (i === ROUTE.length - 1 ? "text-[var(--spot)]" : "")}
                  >
                    <span className="v2-serif v2-num text-[2rem] leading-none">{r.n}</span>
                    <span>
                      <span className="v2-serif block text-[1.5rem] leading-tight">{r.page}</span>
                      <span className="mt-1 block text-[15px] text-[var(--ink-soft)]">{r.note}</span>
                    </span>
                    <span className="v2-caps v2-num text-[14px]">{r.time}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <dl className="mt-16 grid gap-x-12 border-t border-[var(--ink)] sm:grid-cols-2 lg:grid-cols-5">
            {JOURNEY.map(([t, d], i) => (
              <div key={t} data-reveal="rise" style={{ "--d": `${i * 90}ms` } as React.CSSProperties} className="border-b border-[var(--ink)] py-6 lg:border-b-0">
                <dt className="v2-caps text-[12px] text-[var(--spot)]">{t}</dt>
                <dd className="mt-3 text-[16px] leading-[1.6]">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-12 max-w-[40rem] text-[17px] leading-[1.7]">
            Get the context you need without manually watching session after session.{" "}
            <span className="font-semibold">One lead. One journey. More context for your next move.</span>
          </p>
        </section>

        {/* 04 intent markers (ledger 23) */}
        <Rule />
        <section className="py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <h2 data-reveal="rise" className={H2}>
              Tell Jellyhook what matters. <span className="text-[var(--spot)]">Let it flag the signals.</span>
            </h2>
            <p data-reveal="rise" className={"self-end " + BODY + " " + RULE_COL}>
              Not every lead is ready to buy. Not every action means the same thing. Define the behaviors that matter to your business
              and use Jellyhook&apos;s intent markers to surface matching leads.
            </p>
          </div>
          <div className="mt-14">
            <Columns items={MARKERS} />
          </div>
          <p className="mt-6 flex items-center gap-4 text-[17px] font-semibold">
            <HookMark className="h-7 w-5 shrink-0 text-[var(--spot)]" />
            Filter out the noise. Spend your time on leads worth investigating.
          </p>
        </section>
      </main>

      {/* try it: the interactive demo, a dark spread (ledger 25) */}
      <section id="try-it" className={`${marketingFontVariables} bg-[#070706] py-20 text-[#e9e7e0]`}>
        <MarketingThemeStyles />
        <div className={WRAP}>
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6 border-b border-white/25 pb-6">
            <h2 data-reveal="rise" className={H2 + " max-w-[20ch] text-white"}>
              Try it: build a marker on a made-up site.
            </h2>
            <p className="max-w-[26rem] text-[15px] leading-[1.6] text-white/70">Sample data. Nothing here is saved or sent. Best on a computer.</p>
          </div>
          <LeadsShowcase />
        </div>
      </section>

      <main className={WRAP}>
        {/* 05 ads and lead quality (ledger 5, 23, 27) */}
        <section className="py-20">
          <div className="grid gap-12 lg:grid-cols-[7fr_5fr] lg:gap-0">
            <div className="lg:pr-12">
              <h2 data-reveal="rise" className={H2}>More traffic doesn&apos;t automatically mean more revenue.</h2>
              <div className={"mt-8 space-y-4 " + BODY}>
                <p>Paying for ads to generate leads? Stop judging your campaigns by clicks alone.</p>
                <p>
                  An ad that brings thousands of visitors isn&apos;t necessarily better than one that brings fewer visitors who become
                  qualified prospects. Jellyhook helps you investigate what happens after the click.
                </p>
              </div>
              <div className="mt-8">
                <Dash
                  items={[
                    "Trace supported traffic-source and UTM information alongside visitor journeys.",
                    "Identify which sources bring leads matching your high-quality criteria.",
                    "Explore what those leads viewed and engaged with before converting.",
                    "Use the patterns to inform your next campaign and landing-page experiments.",
                  ]}
                />
              </div>
            </div>
            <blockquote data-reveal="rise" className={"flex flex-col justify-between gap-10 " + RULE_COL}>
              <p className="v2-serif text-[clamp(2rem,3.4vw,3rem)] leading-[1.1]">
                <span className="text-[var(--spot)]">&ldquo;</span>More traffic isn&apos;t always the answer. Better-qualified leads might be.
              </p>
              <p className="text-[17px] font-semibold leading-[1.6]">
                Judge your ads by the quality of the opportunities they create, not just the traffic they deliver.
              </p>
            </blockquote>
          </div>
        </section>

        {/* 06 hidden conversion drivers (ledger 4, 15) */}
        <section className="-mx-5 bg-[var(--paper-2)] px-5 py-20 md:-mx-12 md:px-12 lg:-mx-[72px] lg:px-[72px]">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-0">
            <div className="lg:pr-12">
              <h2 data-reveal="rise" className={H2}>Find the content your best leads have in common.</h2>
              <p data-reveal="rise" className={"mt-6 " + BODY}>
                Your website might already contain the content that helps visitors decide to convert. The challenge is finding it.
                Jellyhook helps you investigate the journeys of converted leads and discover patterns in the content they reached.
              </p>
            </div>
            <div className={RULE_COL}>
              <Dash
                items={[
                  "See which headings and sections converted leads reached.",
                  "Compare converted leads with visitors who never sent the form.",
                  "Investigate which pages and sections your best leads read.",
                  "Identify content worth testing, improving, or promoting.",
                ]}
              />
              <p className="v2-serif mt-8 text-[1.5rem] leading-snug">Find your hidden content gems. Turn behavioral evidence into better optimization decisions.</p>
            </div>
          </div>
        </section>

        {/* 07 high-quality lead detection, with Slack (ledger 23, 24) */}
        <section className="py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <h2 data-reveal="rise" className={H2}>
              Define your ideal lead. <span className="text-[var(--spot)]">Find the ones who match.</span>
            </h2>
            <div data-reveal="rise" className={"space-y-4 self-end " + BODY + " " + RULE_COL}>
              <p>
                Every business has a different definition of a high-quality lead. Maybe it&apos;s someone who repeatedly visits your
                pricing page, explores a specific service, or returns for another session.
              </p>
              <p>Configure the conditions that matter to you. Jellyhook flags matching leads, so you can prioritize the ones that deserve a closer look.</p>
              <p className="font-semibold text-[var(--ink)]">Less guesswork. More context. A clearer way to prioritize.</p>
            </div>
          </div>
          <div data-reveal="fade" className="mt-12 overflow-x-clip">
            <SlackDesktopShowcase />
          </div>
        </section>

        {/* 08 CRM and the HubSpot card (ledger 20, 28) */}
        <Rule />
        <section className="py-20">
          <div className="grid gap-8 lg:grid-cols-[7fr_5fr]">
            <h2 data-reveal="rise" className={H2}>
              Your CRM tells you who your leads are. <span className="text-[var(--spot)]">Jellyhook helps you understand their journey.</span>
            </h2>
            <div data-reveal="rise" className={"space-y-4 self-end " + BODY + " " + RULE_COL}>
              <p>Already using HubSpot? We love HubSpot. Keep your existing CRM workflow.</p>
              <p className="font-semibold text-[var(--ink)]">
                Every form&apos;s footprint shows up in a Jellyhook card on the HubSpot contact. Read it and call, without leaving HubSpot.
              </p>
            </div>
          </div>
          <div data-reveal="fade" className="mt-12">
            <HubSpotCardShowcase />
          </div>
          <div className="mt-14">
            <Columns items={CRM} />
          </div>
          <p className="v2-serif mt-6 text-[1.5rem] italic">Your next email shouldn&apos;t sound like it could have been sent to anyone.</p>
        </section>

        {/* 09 setup (ledger 1, 26) */}
        <Rule />
        <section className="py-20">
          <h2 data-reveal="rise" className={H2}>Everything starts with one simple script.</h2>
          <p className={"mt-6 max-w-[40rem] " + BODY}>No complicated analytics implementation. No need to build your own tracking infrastructure.</p>
          <ol className="mt-12 grid border-t-4 border-[var(--ink)] sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} data-reveal="rise" style={{ "--d": `${i * 120}ms` } as React.CSSProperties} className={"py-8 lg:px-8 " + (i === 0 ? "lg:pl-0" : "lg:border-l lg:border-[var(--ink)]")}>
                <span className="v2-serif v2-num block text-[3.5rem] leading-none text-[var(--spot)]">{i + 1}</span>
                <h3 className="v2-caps mt-5 text-[13px]">{t}</h3>
                <p className={"mt-3 " + BODY}>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 10 close */}
        <Rule />
        <section className="grid py-20 lg:grid-cols-[7fr_5fr]">
          <div className="lg:pr-12">
            <h2 data-reveal="rise" className="v2-serif text-[clamp(2.6rem,5.4vw,5rem)] leading-[1] tracking-[-0.025em]">
              Filter out the noise. <span className="text-[var(--spot)]">Find your whale.</span>
            </h2>
            <p className={"mt-8 max-w-[34rem] " + BODY}>
              Your next high-quality lead might already be browsing your website. Know what they explored. Understand the signals they
              left behind. Be better prepared when it&apos;s time to reach out.
            </p>
          </div>
          <div className={"mt-10 flex flex-col justify-end gap-4 lg:mt-0 " + RULE_COL}>
            <p className="v2-serif text-[1.6rem] leading-snug">Throw your hook. Find your whale.</p>
            <Cta>Try Jellyhook for free</Cta>
            <span className="text-[15px] text-[var(--ink-soft)]">One script. A clearer view of your leads.</span>
          </div>
        </section>
      </main>

      <footer className={WRAP}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--ink)] py-6 v2-caps text-[11px]">
          <span className="v2-serif text-[20px] normal-case tracking-normal">Jellyhook</span>
          <span className="flex gap-6">
            <Link href="/docs" className="hover:text-[var(--spot)]">Docs</Link>
            <Link href="/pricing" className="hover:text-[var(--spot)]">Pricing</Link>
            <Link href="/privacy" className="hover:text-[var(--spot)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--spot)]">Terms</Link>
            <Link href="/about" className="hover:text-[var(--spot)]">About</Link>
          </span>
        </div>
      </footer>

      {/* Jellyhook tracking its own public pages (same key as components/marketing/MarketingPage.tsx) */}
      <Script src="https://jellyhook.com/tracker.js" data-key="0b4ba5bf-b233-48d2-ad22-4fcbef07018c" strategy="afterInteractive" />
    </div>
  );
}
