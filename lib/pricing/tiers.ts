// lib/pricing/tiers.ts
// Shared plan data for both pricing surfaces: the public /pricing marketing
// page and the in-app /platform/subscription billing page. One list, two
// renderers (components/marketing/PricingCards.tsx and
// components/billing/DashboardPricingCards.tsx) — so the tiers, features,
// and scope copy never drift apart between the two.
//
// Everything below describes where pricing is HEADED, not what's enforced
// today. Every feature listed is unlocked on every account right now during
// early access — see the "Free now" badge each card renders. See
// mds/progress_timeline.md (2026-09-30 entry) for why the site/personal
// split exists and what's still undecided about it.

export type PlanScope = "site" | "personal";

export interface ScopeOption {
  scope: PlanScope;
  label: string;
  note: string;
}

export interface PricingTier {
  name: string;
  blurb: string;
  features: string[];
  // Only paid tiers (Pro, Elite) have scopes — Free has nothing to upgrade.
  scopes?: ScopeOption[];
}

// Once pricing is actually live, upgrading a paid tier will work one of two
// ways:
//   - "site": upgrades the SITE's plan. Everyone invited as a team member
//     to that site inherits the upgraded tier's access, and upgrading is
//     what unlocks inviting team members at all (a Free-tier site can't
//     invite anyone).
//   - "personal": upgrades just the signed-in person, solo, with no team
//     invites. NOT confirmed to unlock exactly the same features or cost
//     the same as the site version — that split hasn't been decided yet,
//     so don't assume parity between the two anywhere in copy or code.
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Free",
    blurb: "Install the tracker and see who's on your site.",
    features: ["Visitor & session tracking", "Page views, scroll depth, time on page", "Lead capture from forms"],
  },
  {
    name: "Pro",
    blurb: "Turn raw traffic into a lead list you can act on.",
    features: ["Everything in Free", "Lead intelligence (full visitor journey per lead)", "Conversion path analysis"],
    scopes: [
      { scope: "site", label: "Upgrade this site", note: "Everyone invited to this site gets Pro, and you can invite team members." },
      { scope: "personal", label: "Upgrade just me", note: "Scoped to you alone on this site, no team invites. May not end up identical to the site upgrade." },
    ],
  },
  {
    name: "Elite",
    blurb: "Know which pages are losing people before your conversion rate tells you.",
    features: ["Everything in Pro", "Intent / page-health signals"],
    scopes: [
      { scope: "site", label: "Upgrade this site", note: "Everyone invited to this site gets Elite, and you can invite team members." },
      { scope: "personal", label: "Upgrade just me", note: "Scoped to you alone on this site, no team invites. May not end up identical to the site upgrade." },
    ],
  },
];
