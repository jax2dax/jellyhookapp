import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leads page",
  description: "How to search, filter, and qualify leads.",
  alternates: { canonical: "/docs/reference/leads" },
};

export default function LeadsReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Leads page</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Every form submission on the site, one row each. Defaults to showing today&apos;s leads only.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Search</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">Matches against a lead&apos;s name or email, whichever one has text in it.</p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Date filter</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Today, a custom date, or all time. Today is the default so the page opens on what actually needs
            attention right now, not the entire history.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Qualify filter</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            All leads, qualified, junk, or unreviewed. See{" "}
            <a href="/docs/concepts/leads-qualification" className="text-[var(--lime)] hover:underline">
              Leads and qualification
            </a>{" "}
            for what qualified and junk actually mean.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The list itself</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Capped to a fixed height with its own scroll rather than stretching the page indefinitely. Click a
            lead&apos;s name to open their full profile.
          </p>
        </div>
      </div>
    </div>
  );
}
