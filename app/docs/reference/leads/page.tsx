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
        Every form submission on the site, one row each, newest first. It opens on all leads, and the address bar remembers your search and filters.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Search</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">Matches against a lead&apos;s name or email, whichever one has text in it.</p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Date filter</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            All time (the default), today, or a custom range. Custom range opens a calendar: click the first day,
            then the last day (or use a quick pick such as Last 7 days). A range includes both of its days in
            full.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Opening a lead</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Click anywhere on a row to open that lead (or focus a row and press Enter). The qualify toggle on the
            row works on its own and does not open the lead. When more rows are hidden below the visible part of
            the table, a soft fade at the bottom says so; it disappears when everything fits or you reach the end.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Sharing a view</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Your search, date filter and qualify filter are kept in the page address, so refreshing, going back
            or sending someone the link brings up the same view. Only choices that differ from the defaults appear
            in the address.
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
