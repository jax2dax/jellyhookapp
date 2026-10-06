import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard overview",
  description: "What each card on the main dashboard shows, and how each number is counted.",
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
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The stats row</h2>
          <ul className="space-y-2 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <li>
              Active now: the round badge with the green dot. It is the number of visitors on the site at this
              exact moment, and it updates on its own every second while the tab stays open. Hover it for the
              description.
            </li>
            <li>Page Views: pages opened in the chosen window.</li>
            <li>Sessions: visits that started in the chosen window.</li>
            <li>Leads: forms submitted in the chosen window, including repeat submissions from the same person.</li>
            <li>
              Conversion Rate: different people who submitted a form, divided by different people who visited,
              in the chosen window. Each person counts once on each side.
            </li>
          </ul>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Each of these four tiles has its own small window menu: 24h, 7d or 30d (the last 24 hours, 7 days or
            30 days, up to now) or All time (no arrow, since there is nothing before it). Next to the number, an arrow shows the change from the window just before:
            the previous 24 hours, 7 days or 30 days. Green and up means more, red and down means fewer. Hover
            the arrow for the full sentence, for example &quot;50% fewer form submissions than the previous 24
            hours&quot;. The conversion rate changes in percentage points (&quot;1.2 pts&quot;), because a
            percentage of a percentage is misleading. Each tile remembers its window in your browser. The (i)
            next to each title explains how that number is counted.
          </p>
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
            each period, not how many were open at once. Windows: the last 24 hours (one bar per hour), 7 days or
            a month (one bar per day), 3 months (one bar per week), or all time.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Unique visitors: tick it to count each person once per bar, however many sessions they started in that
            period. For example, someone who starts 3 sessions between 2:00 and 3:00 and 2 more between 3:00 and
            4:00 adds 1 to the 2:00 bar and 1 to the 3:00 bar, not 5.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Split by: Referrer, Device or Country turns each bar into a stacked bar, one coloured part per group.
            Hover a bar to see every colour, its group, its count and its share of the bar. The legend under the chart lists the
            groups with their totals. The 7 biggest groups in the window get their own colour and the rest share
            &quot;Other&quot;. A group keeps the same colour in every bar, and when Unique visitors is switched on
            or off. With both on, a person counts once per bar under the group of their first session in it, so
            the parts always add up to the bar. Referrers use the same names as the referrer chart: the campaign
            source when a link was tagged, otherwise the site they came from, or Direct.
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
            Conversions page, where the full interactive versions live, with a real date range picker. A period
            with nothing in it still draws the chart, as a flat line at 0 with a short note under it.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Hook shortcut</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The green card beside Visits over time opens Hook, where you can ask precise questions about your
            visitors, sessions, leads and forms. (It replaced the old Site Health card.)
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
