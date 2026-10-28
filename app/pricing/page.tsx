import type { Metadata } from "next";
import Script from "next/script";
import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { primaryBtn } from "@/components/marketing/MarketingTheme";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Jellyhook is free during early access. Every feature is on every account, including lead visit charts, form field timing and conversion paths. No card required.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Jellyhook Pricing",
    description:
      "Jellyhook is free during early access. Every feature is on every account, including lead visit charts, form field timing and conversion paths. No card required.",
    url: "/pricing",
  },
};

const FAQS = [
  {
    q: "Is this actually free, no catch?",
    a: "Yes. Jellyhook is in early access, and every feature on every account is free while we onboard early sites. No card on file, no trial countdown. There are limits so the service stays fast for everyone: up to 5 sites per account, 10 hooks per person on each site, and 500 Slack and webhook messages per site per day.",
  },
  {
    q: "Can I install it on more than one site?",
    a: "Yes. During early access one account can have up to 5 sites, each its own workspace with its own tracker script and dashboard.",
  },
  {
    q: "Can my team use it?",
    a: "Yes. Invite teammates to a site as owner, admin or member. Everyone on the site sees its leads, marks and hooks.",
  },
];

export default function PricingPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[var(--rule)] pt-16 md:pt-24">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Pricing</span>
          <h1 className="mt-4 ff-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-[var(--ink)]">
            Everything, free, <em className="not-italic text-[var(--lime)]">right now</em>.
          </h1>
          <p className="mt-5 max-w-xl ff-body text-[15px] leading-[1.75] text-[var(--ink-soft)]">
            Jellyhook is in early access. Every feature (lead visit charts, form field timing, marks, hooks, all of it)
            is on every account, for your whole team, no card required.
          </p>

          <div className="mt-8">
            <Show when="signed-out">
              <Link href="/sign-up">
                <button className={primaryBtn}>Get started free</button>
              </Link>
            </Show>
            <p className="mt-4 max-w-xl ff-body text-[13px] leading-relaxed text-[var(--ink-mute)]">
              In return we ask for feedback and a short call. Setup is one script tag.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-8">Questions</h2>
          <div className="divide-y divide-[var(--rule)] border-t border-b border-[var(--rule)]">
            {FAQS.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="cursor-pointer list-none ff-body text-[15px] font-medium text-[var(--ink)] marker:content-none">{item.q}</summary>
                <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">{item.a}</p>
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
