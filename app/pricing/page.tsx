import { PricingTable } from "@clerk/nextjs";
import { Check, X } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";

// Feature availability mirrors the real gating logic in
// lib/actions/permission.actions.js (PLAN_LEVELS: free < pro < elite) and
// app/platform/billing/BillingClient.tsx's own plan-feature bullets — this
// table is not marketing copy invented separately from what the product
// actually enforces.
const TIERS: { name: string; blurb: string; features: { label: string; on: boolean }[] }[] = [
  {
    name: "Free",
    blurb: "Install the tracker and see who's on your site.",
    features: [
      { label: "Visitor & session tracking", on: true },
      { label: "Page views, scroll depth, time on page", on: true },
      { label: "Lead capture from forms", on: true },
      { label: "Lead intelligence (full visitor journey per lead)", on: false },
      { label: "Conversion path analysis", on: false },
      { label: "Intent / page-health signals", on: false },
    ],
  },
  {
    name: "Pro",
    blurb: "Turn raw traffic into a lead list you can act on.",
    features: [
      { label: "Visitor & session tracking", on: true },
      { label: "Page views, scroll depth, time on page", on: true },
      { label: "Lead capture from forms", on: true },
      { label: "Lead intelligence (full visitor journey per lead)", on: true },
      { label: "Conversion path analysis", on: true },
      { label: "Intent / page-health signals", on: false },
    ],
  },
  {
    name: "Elite",
    blurb: "Know which pages are losing people before your conversion rate tells you.",
    features: [
      { label: "Visitor & session tracking", on: true },
      { label: "Page views, scroll depth, time on page", on: true },
      { label: "Lead capture from forms", on: true },
      { label: "Lead intelligence (full visitor journey per lead)", on: true },
      { label: "Conversion path analysis", on: true },
      { label: "Intent / page-health signals", on: true },
    ],
  },
];

export default function PricingPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[#1b1b18] pt-16 md:pt-24">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Pricing</span>
          <h1 className="mt-4 ff-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f2ea]">
            Start free. Upgrade when the <em className="italic text-[var(--lime)]">leads</em> start piling up.
          </h1>
          <p className="mt-5 max-w-xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
            Every plan gets the real tracker — full sessions, real scroll depth, no sampling. Higher tiers unlock the
            analysis layered on top of that data: linking leads to their full visit history, mapping the paths that lead
            to a conversion, and scoring which pages are underperforming.
          </p>
        </div>
      </section>

      {/* ── Feature comparison, by real plan tier ─────────────────────── */}
      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div key={tier.name} className="flex flex-col border border-[#1b1b18] bg-[#0a0a09] p-6">
                <h2 className="ff-display text-2xl text-[#f4f2ea]">{tier.name}</h2>
                <p className="mt-2 ff-body text-[13px] leading-relaxed text-[#8b8980]">{tier.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f.label} className="flex items-start gap-2.5 ff-body text-[13px] leading-snug">
                      {f.on ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lime)]" strokeWidth={2} />
                      ) : (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-[#3a3a34]" strokeWidth={2} />
                      )}
                      <span className={f.on ? "text-[#e9e7e0]" : "text-[#5f5d57]"}>{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 ff-mono text-[10px] uppercase tracking-[0.2em] text-[#5f5d57]">
            Exact prices and billing cycles are set below — cancel any time, no long-term contract.
          </p>
        </div>
      </section>

      {/* ── Real, live prices — Clerk Billing is the source of truth, not this page ── */}
      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <PricingTable fallback={<div className="py-10 text-center ff-mono text-[11px] uppercase tracking-[0.2em] text-[#77756d]">Loading plans…</div>} />
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-8">Questions</h2>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {[
              {
                q: "What does the free plan actually include?",
                a: "Full visitor and session tracking, page views, scroll depth, time on page, and lead capture from your forms — the same tracker script every plan uses. Free stops at raw data; Pro and Elite add the analysis layered on top.",
              },
              {
                q: "What's the difference between Pro and Elite?",
                a: "Pro adds Lead Intelligence (every lead's full browsing history) and Conversion Path analysis (the sequence of pages that led to a conversion). Elite adds Intent Signals — a per-page score that flags pages losing visitor attention before it shows up as a drop in your conversion rate.",
              },
              {
                q: "Can I install it on more than one site?",
                a: "Each tracked site is its own workspace inside your account, with its own tracker script and dashboard.",
              },
              {
                q: "Can I cancel any time?",
                a: "Yes — plans are month-to-month through Clerk Billing, and a cancellation takes effect at the end of your current billing period.",
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
