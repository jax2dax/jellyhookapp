import Link from "next/link";
import Image from "next/image";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { ArrowRight, ArrowUpRight, Eye, UserCheck, Flame } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { primaryBtn, ghostBtn, avatarAppearance } from "@/components/marketing/MarketingTheme";
import { RandomIconBadge } from "@/components/RandomIconBadge";
import { HALLOWEEN_ICONS } from "@/components/marketing/halloweenIcons";

// Real capabilities, not generic SaaS boilerplate — see SAAS_PRODUCT_AUDIT.md
// §3 (Core Features) for the implementation each of these describes.
const FEATURES = [
  {
    icon: Eye,
    title: "Session Replay",
    desc: "Every visit becomes a scroll-by-scroll timeline: pages viewed, time on each one, and exactly how far down they actually scrolled.",
  },
  {
    icon: UserCheck,
    title: "Lead Intelligence",
    desc: "Every form submission is automatically linked back to the visitor&apos;s full browsing history: the pages, the dwell time, the path that led to the conversion.",
  },
  {
    icon: Flame,
    title: "Page Health Scoring",
    desc: "An algorithmic score flags which pages are quietly losing visitors' attention before it shows up in your conversion rate.",
  },
];

const TICKER = ["Session replay", "Scroll depth", "Lead capture", "Page health scoring", "Conversion paths"];

const LandingPage = () => {
  return (
    <MarketingPage>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-[#1b1b18] pt-16 md:pt-28">
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
            <div className="relative lg:col-span-7 lg:pr-14">
              {/* seasonal — a random little ghost, different one on every load */}
              <RandomIconBadge
                images={HALLOWEEN_ICONS}
                size={36}
                className="pointer-events-none absolute -top-6 left-[9.5rem] -rotate-6 select-none object-contain sm:left-[13rem]"
              />

              <div className="mb-8 flex items-center gap-3">
                <span className="h-1.5 w-1.5 animate-pulse bg-[var(--lime)]" />
                <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#8b8980]">Website analytics &amp; lead intelligence</span>
              </div>

              <h1 className="ff-display text-[clamp(3rem,7.5vw,6.25rem)] leading-[0.9] tracking-[-0.025em] text-[#f4f2ea]">
                Stop chasing.
                <br />
                Start <em className="italic text-[var(--lime)]">hooking</em>.
              </h1>

              <p className="mt-8 max-w-md ff-body text-[15px] leading-[1.75] text-[#8b8980]">
                Install one script and Jellyhook turns every visit to your site into a full session replay: pages seen,
                time spent, how far they scrolled. It also links every form submission straight back to that history.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Show when="signed-out">
                  <SignUpButton mode="modal">
                    <button className={primaryBtn}>
                      Start tracking your site
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
                  <span className="ff-mono text-[10px] uppercase tracking-[0.26em] text-[#77756d]">Page health</span>
                  <span className="ff-display text-2xl leading-none text-[var(--lime)]">scored per page</span>
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
                Not a generic analytics widget: behavior tracking built specifically to answer &ldquo;which pages and forms actually turn visitors into leads.&rdquo;
              </p>
            </div>
          </div>

          <div className="border-t border-[#1b1b18]">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group grid grid-cols-1 items-center gap-4 border-b border-[#1b1b18] px-2 py-7 transition-colors duration-300 hover:bg-[var(--lime)] md:grid-cols-12 md:gap-6 md:px-5 md:py-9"
                >
                  <span className="ff-mono text-[11px] tracking-[0.2em] text-[#77756d] transition-colors group-hover:text-black/60 md:col-span-1">0{i + 1}</span>

                  <h3 className="ff-display text-3xl leading-none tracking-[-0.01em] text-[#f4f2ea] transition-colors group-hover:text-black md:col-span-4 md:text-4xl">
                    {feature.title}
                  </h3>

                  <p className="ff-body text-[14px] leading-relaxed text-[#8b8980] transition-colors group-hover:text-black/70 md:col-span-5">{feature.desc}</p>

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
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="relative overflow-hidden border-b border-[#1b1b18] bg-[var(--lime)] text-black">
        {/* subtle vine/rope accent on the right of the CTA too */}
        <div className="pointer-events-none absolute -right-4 top-0 hidden h-full xl:block">
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
    </MarketingPage>
  );
};

export default LandingPage;
