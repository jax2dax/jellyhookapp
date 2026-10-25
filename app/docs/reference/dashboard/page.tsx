import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Dashboard overview",
  description: "What the dashboard shows, top to bottom: tracking status, five key numbers, who to call first, and the traffic charts. How each number is counted.",
  alternates: { canonical: "/docs/reference/dashboard" },
};

export default function DashboardReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Analytics"
        title="Dashboard overview"
        intro="What happened on the site, and which leads need you first? The dashboard is the screen you land on: five key numbers, the leads your hooks caught, your marks, the newest leads, then the traffic charts."
      />

      <Section title="When you would use it">
        <P>
          You open Jellyhook in the morning. The Leads tile says 5 in the last 24 hours, up from 3. Under it, Hooked leads shows two of them were caught by your
          Big budget hook, so you open those first. Further down, the traffic charts tell you whether the extra leads came with extra visitors.
        </P>
      </Section>

      <Section title="What you see, top to bottom">
        <H3>The header</H3>
        <P>
          The site&apos;s name and domain, and a <B>Tracking active</B> or <B>Tracking paused</B> pill. <B>Open leads</B> goes to the Leads page.
        </P>

        <H3>The key numbers</H3>
        <DataTable
          head={["Tile", "What it counts"]}
          rows={[
            [<B key="a">Active now</B>, "Visitors on the site at this moment. It updates every second while the tab is open, from the same live data as the Sessions online chart, so the two always agree."],
            [<B key="b">Leads</B>, "Forms submitted in the chosen window. Every submission counts, including repeat submissions from the same person."],
            [<B key="c">Conversion rate</B>, "Different people who submitted a form, divided by different people who visited, in the chosen window. Each person counts once on each side. The tile shows the two counts under the rate, for example 5 of 119 visitors."],
            [<B key="d">Sessions</B>, "Visits that started in the chosen window. One visit can include many pages."],
            [<B key="e">Page views</B>, "Pages opened in the chosen window."],
          ]}
        />
        <P>
          Each tile except Active now has its own window menu: <B>24 hours</B>, <B>7 days</B>, <B>30 days</B> (up to now) or <B>All time</B>. Each tile remembers its
          window in your browser. Next to the number, a pill shows the change from the window just before (the previous 24 hours, 7 days or 30 days): green and up
          for more, red and down for fewer. Hover it for the full sentence, for example &quot;50% fewer form submissions than the previous 24 hours&quot;. The
          conversion rate changes in percentage points (&quot;1.2 pts&quot;), because a percentage of a percentage misleads. All time has no pill: there is nothing
          before it. The (i) beside each title says how that number is counted.
        </P>

        <H3>Hooked leads</H3>
        <P>
          The six newest leads your hooks caught, with the hook that caught each one and how long ago. Click one to open the lead. <B>All hooked</B> opens Hooks →
          Hooked leads. See <Link href="/docs/reference/notifications" className="underline underline-offset-4 hover:text-[#f4f2ea]">Hooks and notifications</Link>.
        </P>

        <H3>Your marks</H3>
        <P>
          Each mark that is on, most leads first: its number of leads and its share of all the site&apos;s leads, drawn as a bar in the mark&apos;s colour. Click a
          mark to open the Leads page with that mark applied. See <Link href="/docs/reference/marks" className="underline underline-offset-4 hover:text-[#f4f2ea]">Marks</Link>.
        </P>

        <H3>Latest leads</H3>
        <P>The eight newest form submissions: name and email, the page the form was sent from, the badges of their marks, and how long ago. Click a row to open the lead.</P>

        <H3>Traffic</H3>
        <P>Three charts about visitors rather than leads, described below: Reach and conversions, Sessions online / Pages online, and Visits over time.</P>
      </Section>

      <Section title="Reach and conversions">
        <P>
          New visitors and unique conversions on one timeline, with a date range picker. The three buttons above it switch the layout: <B>Merged</B> (the default, one
          chart with both lines), <B>Split</B> (two charts side by side) and <B>Separate</B> (two full-width charts). The choice is kept in the page address. A period
          with nothing in it still draws the chart, as a flat line at 0 with a short note under it.
        </P>
      </Section>

      <Section title="Sessions online and Pages online">
        <P>
          One live chart; its title is a menu that switches what it counts. <B>Sessions online</B> (the default) counts visits that are open: it goes up when a visit
          starts and down when the visitor was last seen, so someone who leaves and comes back within the same visit stays counted. <B>Pages online</B> counts
          visitors with a page actually open: when someone leaves, the line dips at once; when they come back, it rises again.
        </P>
        <P>
          The right edge is always now, and the chart moves forward every second while you watch. Each point covers an interval from 5 seconds to 1 day. Three ways
          to draw the same data: <B>Smooth</B> (the default), <B>Steps</B> (each value held flat until the next point) and <B>Trend</B> (a point only where the number
          changed). Drag to move back in time; pinch on a trackpad, or use the plus and minus buttons, to zoom. A plain scroll never moves the chart. Two optional
          markers, off by default: <B>Conversions</B> (every form submission) and <B>Team joined</B> (every teammate who joined the site).
        </P>
        <P>
          The last 30 minutes are drawn in a different colour. A visitor whose tab crashed, instead of closing normally, can still count as online for up to 30
          minutes before the system marks them gone, so that stretch is not final yet.
        </P>
      </Section>

      <Section title="Visits over time">
        <P>
          A bar chart of how many sessions started in each period (not how many were open at once). Windows: the last 24 hours (one bar per hour), 7 days or a month
          (one bar per day), 3 months (one bar per week), or all time.
        </P>
        <UL>
          <li>
            <B>Unique visitors</B> counts each person once per bar, however many sessions they started in it. Someone who starts 3 sessions between 2:00 and 3:00 and
            2 more between 3:00 and 4:00 adds 1 to each of the two bars, not 5.
          </li>
          <li>
            <B>Split by</B> Referrer, Device or Country stacks each bar by group. The 7 biggest groups get their own colour and the rest share &quot;Other&quot;. A group
            keeps its colour in every bar. With Unique visitors on, a person counts once per bar under the group of their first session in it, so the parts always add
            up to the bar. Referrers use the campaign source when a link was tagged, otherwise the site they came from, or Direct.
          </li>
        </UL>
      </Section>

      <Section title="When it is empty or looks wrong">
        <UL>
          <li>Every tile shows 0 and the charts are flat: the tracker has not recorded a visit yet. Check Settings → Tracker.</li>
          <li>A tile says <B>Could not load</B>: the database did not answer in time. The tile tries again by itself a few seconds later.</li>
          <li>Hooked leads says &quot;No hooked leads yet&quot;: no hook has caught a lead. Make a hook on the Hooks page.</li>
          <li>Your marks says &quot;No marks are on&quot;: make a mark on the Leads page, or switch one on in its Marks panel.</li>
          <li>Leads and Conversion rate move differently: Leads counts every submission; the rate counts people once.</li>
        </UL>
      </Section>

      <Section title="Limits">
        <UL>
          <li>Tiles compare with the window just before, not with the same day last week or last year.</li>
          <li>Active now and the live chart can count a crashed tab as online for up to 30 minutes.</li>
          <li>The dashboard shows one site. Switch sites in the sidebar.</li>
        </UL>
      </Section>

      <Section title="Related">
        <UL>
          <li>
            <Link href="/docs/concepts/visitors-sessions" className="underline underline-offset-4 hover:text-[#f4f2ea]">Visitors, sessions, and page views</Link>: what each word means.
          </li>
          <li>
            <Link href="/docs/concepts/leads-qualification" className="underline underline-offset-4 hover:text-[#f4f2ea]">Leads and qualification</Link>: why Leads and conversions differ.
          </li>
          <li>
            <Link href="/docs/troubleshooting" className="underline underline-offset-4 hover:text-[#f4f2ea]">Troubleshooting</Link>: empty or wrong numbers.
          </li>
        </UL>
      </Section>
    </div>
  );
}
