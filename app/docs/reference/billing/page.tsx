import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Billing and plans",
  description: "What the Billing and Subscription pages show right now, during early access.",
  alternates: { canonical: "/docs/reference/billing" },
};

export default function BillingReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Billing and plans</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Jellyhook is in early access right now. Every feature on every account is unlocked for everyone, free, no
        card required, regardless of what either page below happens to show as your current plan. Nothing here
        charges you anything today.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Billing page</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Shows your current plan, your billing email, and a history of billing events once there have been any.
            There is no transaction history yet for any account, since nothing is being charged.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Subscription page</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A preview of the paid tiers Jellyhook is heading toward, Pro and Elite, with a toggle for two different
            ways a future upgrade could work: upgrading the whole site, or upgrading just your own access. See{" "}
            <Link href="/pricing" className="text-[var(--lime)] hover:underline">
              Pricing
            </Link>{" "}
            for the full explanation of that distinction, and for what is and is not decided about it yet. The
            specific feature lists on this page are intentionally blurred: they describe where pricing is headed,
            not something you can act on today.
          </p>
        </div>
      </div>
    </div>
  );
}
