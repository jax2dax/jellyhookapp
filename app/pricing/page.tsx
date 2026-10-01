import type { Metadata } from "next";
import Script from "next/script";
import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { PricingCards } from "@/components/marketing/PricingCards";
import { primaryBtn } from "@/components/marketing/MarketingTheme";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Jellyhook is free during early access. Every feature on every account, including lead intelligence, conversion paths, and page health scoring, is unlocked with no card required.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Jellyhook Pricing",
    description:
      "Jellyhook is free during early access. Every feature on every account, including lead intelligence, conversion paths, and page health scoring, is unlocked with no card required.",
    url: "/pricing",
  },
};

const FAQS = [
  {
    q: "Is this actually free, no catch?",
    a: "Yes. Jellyhook is in early access, and every feature on every account is free while we onboard early sites. No card on file, no trial countdown.",
  },
  {
    q: "What happens when paid plans launch?",
    a: "We'll give plenty of notice before anything changes, and none of your tracked data or history disappears. You'll get to choose a plan that fits; nothing switches to paid automatically.",
  },
  {
    q: "What's the difference between Pro and Elite going to be?",
    a: "Pro will add Lead Intelligence (every lead's full browsing history) and Conversion Path analysis (the sequence of pages that led to a conversion). Elite will add Intent Signals, a per-page score that flags pages losing visitor attention before it shows up as a drop in your conversion rate. All of it is free right now regardless of tier.",
  },
  {
    q: "Can I install it on more than one site?",
    a: "Each tracked site is its own workspace inside your account, with its own tracker script and dashboard.",
  },
  {
    q: "What's the difference between upgrading a site and upgrading just me?",
    a: "Once paid plans launch, every paid tier will offer both. Upgrading a SITE upgrades it for everyone on it — anyone you invite as a team member inherits that tier's access, and upgrading is what unlocks inviting team members at all. Upgrading PERSONALLY gives just you that tier's access, solo, with no team invites. Both cost the same and unlock the same features; the only difference is who else benefits from it.",
  },
];

export default function PricingPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[#1b1b18] pt-16 md:pt-24">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Pricing</span>
          <h1 className="mt-4 ff-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f2ea]">
            Everything, free, <em className="italic text-[var(--lime)]">right now</em>.
          </h1>
          <p className="mt-5 max-w-xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
            Jellyhook is in early access. Every feature (full sessions, lead intelligence, conversion paths, page
            health scoring, all of it) is unlocked on every account, no card required. Paid plans are coming later,
            but not yet.
          </p>

          <div className="mt-8">
            <Show when="signed-out">
              <Link href="/sign-up">
                <button className={primaryBtn}>Get started free</button>
              </Link>
            </Show>
          </div>
        </div>
      </section>

      {/* ── Where pricing is headed — nothing here is enforced yet ──────── */}
      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-2">Where pricing is headed</h2>
          <p className="mb-4 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            This is the plan structure Jellyhook will eventually charge for. Today, every tier below is free on every
            account. There&apos;s no locked feature to unlock.
          </p>
          <p className="mb-8 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Once paid plans launch, each tier will be purchasable two ways — this is how pricing will be maintained
            going forward, not a today-vs-tomorrow distinction. Upgrading a <strong className="text-[#e9e7e0]">site</strong>{" "}
            upgrades it for everyone on it: anyone invited as a team member inherits that tier, and upgrading a site
            is what unlocks inviting team members at all (a Free-tier site can&apos;t invite anyone). Upgrading{" "}
            <strong className="text-[#e9e7e0]">personally</strong> gives just the signed-in person that tier&apos;s
            access, solo, with no team invites. Both cost the same and unlock the same features per tier; toggle
            below to see how each card&apos;s note changes depending on which one you&apos;re looking at.
          </p>
          <PricingCards />
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-8">Questions</h2>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {FAQS.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="cursor-pointer list-none ff-body text-[15px] font-medium text-[#e9e7e0] marker:content-none">{item.q}</summary>
                <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FAQPage structured data — built directly from FAQS above, so it can
          never say anything the visible page doesn't already say. */}
      <Script id="ld-pricing-faq" type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        })}
      </Script>
    </MarketingPage>
  );
}
