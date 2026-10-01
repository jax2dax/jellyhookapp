import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard overview",
  description: "What each card on the main dashboard actually shows.",
  alternates: { canonical: "/docs/reference/dashboard" },
};

export default function DashboardReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Dashboard overview</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        The screen you land on. Meant to be scanned in a few seconds, not read closely.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The five stat tiles</h2>
          <ul className="space-y-2 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <li>Active Now: visitors on the site at this exact moment.</li>
            <li>Page Views (24h): page views in the last day.</li>
            <li>Total Sessions: all sessions ever recorded for this site.</li>
            <li>Total Leads: all form submissions ever recorded.</li>
            <li>
              Conversion Rate: unique converting visitors divided by unique visitors, both counted once per
              person no matter how many times they visited or submitted.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Visits over time</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Number of sessions started, by time period. Adjustable window: last 3 days, 7 days, a month, 3 months,
            or all time.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Pages</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Every page that has recorded views, ranked by view count, with unique visitors, average time on page,
            and average scroll depth for each one. Capped to a fixed height with its own scroll, so a site with
            many pages does not stretch the whole dashboard.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">New Reach and Conversions (mini)</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Small, fixed versions of the last 3 days, no controls. The full interactive versions, with a real date
            range picker, live on the Conversions page.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Live Ticker</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The most recent page views, newest at the top, updating on its own while the tab stays open.
          </p>
        </div>
      </div>
    </div>
  );
}
