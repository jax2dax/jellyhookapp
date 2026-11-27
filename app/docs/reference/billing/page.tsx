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
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">When you would use it</h2>
          <p className="max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Before you invite two teammates and add a second site, you want to know whether that will cost anything. It will not:
            during early access there is no card to add and no plan to pick, and everyone you invite gets every feature.
          </p>
          <p className="mt-3 max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The one limit: an account can belong to up to 5 sites during early access, and sites you joined as a teammate count too. Adding
            a site past that shows &quot;Site limit reached&quot;; ask through Support in the sidebar if you need more.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Billing page</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            It is not in the sidebar. Opened from its address (<span className="ff-mono text-[var(--ink-2)]">/platform/billing</span>), it shows
            &quot;Billing is coming soon&quot; over a blurred preview of the page to come: current plan, billing email and transaction history.
            Nothing on it can be clicked, and there is nothing to set up.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Subscription page</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Also not in the sidebar. It shows the plan cards, each marked &quot;Free now&quot;, with their details blurred while plans are
            being decided. The switch at the top (Upgrade this site, Upgrade just me) only changes the note at the bottom of each card. Nothing on it charges you.
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
