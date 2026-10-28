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
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[var(--ink)]">Billing and plans</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
        Jellyhook is in early access right now. Every feature on every account is on for everyone, free, no
        card required, regardless of what either page below happens to show as your current plan. Nothing here
        charges you anything today.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Billing page</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Shows your current plan, your billing email, and a history of billing events once there have been any.
            There is no transaction history yet for any account, since nothing is being charged.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Your team</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Everyone you invite to a site gets every feature on that site. See{" "}
            <Link href="/docs/reference/team" className="text-[var(--lime)] hover:underline">
              Team and invites
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
