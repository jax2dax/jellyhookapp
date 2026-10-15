import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conversions page",
  description: "The New Reach and Conversions charts, the three view modes, the referrer donut, and leads origin radar.",
  alternates: { canonical: "/docs/reference/conversions" },
};

export default function ConversionsReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Conversions page</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Where marketing-side questions get answered: how many new people showed up, how many converted, and where
        they actually came from.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Converted leads</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One card per converted lead, filterable by date range (last 3 days, last week, last month, all time, or
            a custom range) and paginated, not every conversion the site has ever had rendered onto one page at
            once. Each card is collapsed to a single line by default: name, email, the page they converted on, and
            the date, so a long list of conversions stays scannable; click anywhere on that line to expand it.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A lead&apos;s name in this list is colored the same yellow the{" "}
            <Link href="/docs/concepts/session-replay" className="text-[var(--lime)] hover:underline">
              visit chart
            </Link>{" "}
            itself uses for a converted page, since that color means the same thing everywhere in the dashboard, not
            just here.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Expanding a card shows only that lead&apos;s path to conversion: start of the session through the
            exact page visit they converted on, nothing after. If the real session kept going past that point, the
            rest of it is deliberately cut from this view. Click{" "}
            <span className="text-[#f4f2ea]">View lead information</span> to see the whole thing, uncut, on that
            lead&apos;s own{" "}
            <Link href="/docs/reference/lead-profile" className="text-[var(--lime)] hover:underline">
              profile page
            </Link>
            . Clicking a frame inside any card&apos;s chart works exactly like it does there too. See{" "}
            <Link href="/docs/concepts/session-replay" className="text-[var(--lime)] hover:underline">
              Visit chart
            </Link>
            .
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The list itself is cached in your browser for a couple of minutes, so switching the date filter back to
            a range you already looked at recently loads instantly instead of re-querying. Changing the filter to
            something genuinely new, or waiting past that window, always fetches fresh data.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">New Reach and Conversions</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Each chart has two small facts under its title. <strong>In range</strong> is the total for the whole
            chosen range. <strong>Growth</strong> compares the most recent interval with the first interval of the
            range, as a percent with the two numbers in brackets (for example +50% (2 to 3)). The most recent
            interval is usually still in progress, so it can look low until it ends. (The old Conversion Rate Over
            Time chart was removed: it repeated the Conversions chart.)
          </p>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            New Reach counts new unique visitors gained over time. Conversions counts unique visitors who converted
            over time, one person counted once per time period even if they submitted more than once in it.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Both default to showing the site&apos;s entire history. Switch to a custom range to narrow either one
            down, picked independently of each other.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Three ways to view them</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The layout you pick (Separate, Split or Merged) and the Conversions list&apos;s range and page are kept in the page
            address, so a refresh or a shared link shows the same view.
          </p>
          <ul className="space-y-2 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <li>Separate: both charts full width, stacked, each with its own independent date range.</li>
            <li>Split: the same two charts side by side in one card, still two independent ranges.</li>
            <li>
              Merged: one chart, one shared date range, both lines drawn together. This is a different chart
              entirely, not the same two lines squeezed into one, and it replaces the other two while active
              rather than sitting underneath them.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Referrers</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Where every new unique visitor actually came from, counted once each under their first-ever visit&apos;s
            source, not every return visit. This ring only appears once there are more than eight different sources, which is
            more than the Leads Origin radar below can show as spokes; up to eight sources the radar already shows them
            all. Small sources are grouped as Other. See{" "}
            <Link href="/docs/concepts/referrers-attribution" className="text-[var(--lime)] hover:underline">
              Referrers and attribution
            </Link>{" "}
            for what this can and cannot know.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Leads Origin</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Where converted leads came from. Each lead counts once, as a person, under one source.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <li>
              <strong className="text-[#c9c7bd]">First visit / Last non-direct visit</strong>: which of the person&apos;s visits gets the credit. First visit
              is the default. The choice is kept in the page address, so a shared link shows the same view.
            </li>
            <li>
              <strong className="text-[#c9c7bd]">Show where all unique visitors came from</strong> (on by default): adds a second, dashed blue shape for every
              visitor, converted or not, by the same rule. Both shapes then show shares of their own total, because a few leads next to hundreds
              of visitors would otherwise be a dot. Where the yellow shape reaches further than the blue one, that source turns visitors into
              leads better than average. Turn it off to see leads as plain counts.
            </li>
            <li>
              Up to eight spokes: the sources with the most leads first, then the biggest visitor sources that have not produced a lead yet, then
              generic names (Direct, Facebook, Instagram, Google, LinkedIn, TikTok) so the shape stays readable with very little data.
            </li>
          </ul>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The visitor shape under First visit only counts visitors seen since 7 October 2026, when first-visit sources started being recorded.
            How sources are decided and merged, and the two choices with examples:{" "}
            <Link href="/docs/concepts/referrers-attribution" className="text-[var(--lime)] hover:underline">
              Referrers and attribution
            </Link>
            .
          </p>
        </div>

      </div>
    </div>
  );
}
