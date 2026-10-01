// components/marketing/PricingCards.tsx
// Custom plan cards for the public /pricing page — replaces Clerk's
// PricingTable (which was never actually used here; this page had its own
// plain TIERS grid) with the same corner-bracket / accent-bar / glow
// language as AuthCardFrame, plus a site-vs-personal scope toggle for the
// two-tier subscription model (see lib/pricing/tiers.ts). Preview-only:
// pricing isn't live yet, so these buttons don't charge anyone anything.
"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { PRICING_TIERS, type PlanScope } from "@/lib/pricing/tiers";

function scopeToggleClass(active: boolean) {
  return `flex-1 border px-4 py-2.5 ff-mono text-[10px] uppercase tracking-[0.18em] transition-all duration-200 ${
    active
      ? "border-[var(--lime)] bg-[var(--lime)] text-black shadow-[0_0_24px_-6px_var(--lime-glow)]"
      : "border-[#2b2b25] text-[#8b8980] hover:border-[var(--lime)] hover:text-[var(--lime)]"
  }`;
}

export function PricingCards() {
  const [scope, setScope] = React.useState<PlanScope>("site");

  return (
    <div>
      <div className="mb-8 inline-flex w-full max-w-xs gap-2 sm:w-auto">
        <button type="button" onClick={() => setScope("site")} className={scopeToggleClass(scope === "site")}>
          Upgrade a site
        </button>
        <button type="button" onClick={() => setScope("personal")} className={scopeToggleClass(scope === "personal")}>
          Upgrade just me
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => {
          const option = tier.scopes?.find((s) => s.scope === scope);
          return (
            <div
              key={tier.name}
              className="group relative flex flex-col border border-[#1b1b18] bg-[#0a0a09] p-6 transition-all duration-300 hover:border-[#2b2b25] hover:shadow-[0_0_50px_-14px_var(--lime-glow)]"
            >
              <span className="pointer-events-none absolute -left-px -top-px h-3 w-3 border-l border-t border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="pointer-events-none absolute -right-px -top-px h-3 w-3 border-r border-t border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b border-l border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b border-r border-[var(--lime)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[var(--lime)] transition-transform duration-500 ease-out group-hover:scale-x-100" />

              <span className="absolute right-4 top-4 ff-mono text-[9px] uppercase tracking-[0.18em] text-[var(--lime)]">Free now</span>
              <h3 className="ff-display text-2xl text-[#f4f2ea]">{tier.name}</h3>
              <p className="mt-2 ff-body text-[13px] leading-relaxed text-[#8b8980]">{tier.blurb}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 ff-body text-[13px] leading-snug">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--lime)]" strokeWidth={2} />
                    <span className="select-none text-[#e9e7e0] blur-[5px]">{f}</span>
                  </li>
                ))}
              </ul>

              {option && (
                <p className="mt-6 border-t border-[#1b1b18] pt-4 ff-body text-[12px] leading-relaxed text-[#77756d]">
                  <span className="select-none blur-[5px]">{option.note}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
