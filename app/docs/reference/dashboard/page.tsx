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
            <li>
              Active Now: sessions open on the site at this exact moment. Updates on its own, every second, while
              the tab stays open, no reload needed.
            </li>
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
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Sessions online</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A live chart of how many visitors were actively on a page at the same time, drawn over a chosen
            interval (from 5 seconds up to 1 day per point). It moves on its own while you watch it: the right edge
            is always now, and it keeps counting forward every second.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            &quot;Online&quot; means a page is actually open, not just that a visit hasn&apos;t formally ended. If
            someone leaves the site, the chart bumps down right away rather than assuming they are still there; if
            they come back, it bumps back up. A visitor who leaves for a few minutes and returns will show as a
            dip and a recovery, not an unbroken stretch at the top.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Three ways to draw the same data: Smooth (a curved line through each point, the default), Steps (the
            value held flat until the next point, showing exact values with nothing rounded off visually), and
            Trend (a point only where the number actually changed, averaged across the gap, so a long quiet
            stretch reads as a gentle slope instead of a flat line). Switching between them does not reload
            anything.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Drag to move back through history, further than it shows by default. Pinch on a trackpad, or use the
            plus and minus buttons, to zoom. A plain scroll never touches the chart, so the page underneath still
            scrolls normally with your mouse wheel.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Two optional markers, each behind its own checkbox and off by default: Conversions (a mark on the line
            for every form submission) and Team joined (a mark for every teammate who joined this site). Both are
            drawn on top of the chart and never change the line itself.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One honest limitation: the last 30 minutes are drawn in a different color because a visitor whose tab
            crashed, rather than closing normally, can still be counted online for up to that long before the
            system notices and marks them gone. It always corrects itself once that happens; the chart is just
            telling you that specific stretch is not final yet.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Visits over time</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A different chart from Sessions online above: this one is a bar chart of how many sessions started in
            each period, not how many were open at once. Adjustable window: last 3 days, 7 days, a month, 3
            months, or all time.
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
            Small, fixed versions of the last 3 days, no controls. Clicking either one goes straight to the
            Conversions page, where the full interactive versions live, with a real date range picker.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Lead footprints</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Two small session replay charts, each labeled with one specific lead&apos;s name or email. The leads
            shown are whichever two have submitted the most forms on this site, since someone who has shown up
            repeatedly is the most useful example to preview. A link below takes you to the full leads list.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Live Ticker</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The most recent page views, newest at the top, updating on its own while the tab stays open. A new
            visitor is pushed in as soon as it happens; the ticker also checks for anything new every couple of
            seconds as a backup, so it keeps working even if the instant push is unavailable for a moment.
          </p>
        </div>
      </div>
    </div>
  );
}
