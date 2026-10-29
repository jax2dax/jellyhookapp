import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leads and qualification",
  description: "What a lead is in Jellyhook, and how the qualify flag works.",
  alternates: { canonical: "/docs/concepts/leads-qualification" },
};

export default function LeadsQualificationPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[var(--ink)]">Leads and qualification</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
        A lead is one form submission. Nothing more is required for it to show up on your leads list. Whether it is
        a good lead is a separate question, one nobody but a person can answer.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Qualify: a person&apos;s call</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The qualify toggle on a lead, on the leads list and on the lead&apos;s own page, is a plain human
            decision. It has three states: not reviewed yet, qualified, or junk. It exists for whoever is calling
            these leads to mark, quickly, which ones were worth the call.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Clicking the same qualify state again resets it back to not reviewed. It is not a one-way switch.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Filtering leads by qualify state</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The leads page has a filter for this: all, qualified, junk, or unreviewed. Use it alongside the search
            and date filters to narrow the list down to whichever leads need attention.
          </p>
        </div>
      </div>
    </div>
  );
}
