import { SignUpButton, Show } from "@clerk/nextjs";
import { Check } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { primaryBtn } from "@/components/marketing/MarketingTheme";

// TIERS describes where pricing is HEADED, not what's enforced today — every
// feature listed here is unlocked on every account right now, during early
// access (see the hero + FAQ below). Once paid plans actually launch, this
// is the real gating logic they'll map to: lib/actions/permission.actions.js
// (PLAN_LEVELS: free < pro < elite) and app/platform/billing/BillingClient.tsx's
// plan-feature bullets.
const TIERS: { name: string; blurb: string; features: string[] }[] = [
  {
    name: "Free",
    blurb: "Install the tracker and see who's on your site.",
    features: ["Visitor & session tracking", "Page views, scroll depth, time on page", "Lead capture from forms"],
  },
  {
    name: "Pro",
    blurb: "Turn raw traffic into a lead list you can act on.",
    features: ["Everything in Free", "Lead intelligence (full visitor journey per lead)", "Conversion path analysis"],
  },
  {
    name: "Elite",
    blurb: "Know which pages are losing people before your conversion rate tells you.",
    features: ["Everything in Pro", "Intent / page-health signals"],
  },
];

export default function PricingPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[#1b1b18] pt-16 md:pt-24">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Pricing</span>
          <h1 className="mt-4 ff-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f2ea]">
            Everything, free — <em className="italic text-[var(--lime)]">right now</em>.
          </h1>
          <p className="mt-5 max-w-xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
            Jellyhook is in early access. Every feature — full sessions, lead intelligence, conversion paths, page
            health scoring, all of it — is unlocked on every account, no card required. Paid plans are coming later,
            but not yet.
          </p>

          <div className="mt-8">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className={primaryBtn}>Get started free</button>
              </SignUpButton>
            </Show>
          </div>
        </div>
      </section>

      {/* ── Where pricing is headed — nothing here is enforced yet ──────── */}
      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-2">Where pricing is headed</h2>
          <p className="mb-8 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            This is the plan structure Jellyhook will eventually charge for. Today, every tier below is free on every
            account — there&apos;s no locked feature to unlock.
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className="relative flex flex-col border border-[#1b1b18] bg-[#0a0a09] p-6">
                <span className="absolute right-4 top-4 ff-mono text-[9px] uppercase tracking-[0.18em] text-[var(--lime)]">Free now</span>
                <h3 className="ff-display text-2xl text-[#f4f2ea]">{tier.name}</h3>
                <p className="mt-2 ff-body text-[13px] leading-relaxed text-[#8b8980]">{tier.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 ff-body text-[13px] leading-snug">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lime)]" strokeWidth={2} />
                      <span className="text-[#e9e7e0]">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-8">Questions</h2>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {[
              {
                q: "Is this actually free, no catch?",
                a: "Yes. Jellyhook is in early access — every feature on every account is free while we onboard early sites. No card on file, no trial countdown.",
              },
              {
                q: "What happens when paid plans launch?",
                a: "We'll give plenty of notice before anything changes, and none of your tracked data or history disappears. You'll get to choose a plan that fits — nothing switches to paid automatically.",
              },
              {
                q: "What's the difference between Pro and Elite going to be?",
                a: "Pro will add Lead Intelligence (every lead's full browsing history) and Conversion Path analysis (the sequence of pages that led to a conversion). Elite will add Intent Signals — a per-page score that flags pages losing visitor attention before it shows up as a drop in your conversion rate. All of it is free right now regardless of tier.",
              },
              {
                q: "Can I install it on more than one site?",
                a: "Each tracked site is its own workspace inside your account, with its own tracker script and dashboard.",
              },
            ].map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="cursor-pointer list-none ff-body text-[15px] font-medium text-[#e9e7e0] marker:content-none">{item.q}</summary>
                <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
