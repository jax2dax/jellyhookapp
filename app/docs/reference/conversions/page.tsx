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
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">New Reach and Conversions</h2>
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
            source, not every return visit. See{" "}
            <Link href="/docs/concepts/referrers-attribution" className="text-[var(--lime)] hover:underline">
              Referrers and attribution
            </Link>{" "}
            for what this can and cannot know.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Leads Origin</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The same idea, restricted to visitors who actually converted, not all traffic. Always shows a fixed
            set of six spokes: real sources fill in first, ranked by how many leads came through them, and generic
            placeholders (Direct, Facebook, Instagram, Google, LinkedIn, TikTok) fill any spokes that are not yet
            real, so the shape stays readable with very little data. A placeholder disappears the moment a
            seventh distinct real source shows up.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Conversions list</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One card per converted lead, filterable by date range (last 3 days, last week, last month, all time, or
            a custom range) and paginated — not every conversion the site has ever had rendered onto one page at
            once. Each card is collapsed to a single line by default — name, email, the page they converted on, and
            the date — so a long list of conversions stays scannable; click anywhere on that line to expand it.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A lead&apos;s name in this list is colored the same yellow the{" "}
            <Link href="/docs/concepts/session-replay" className="text-[var(--lime)] hover:underline">
              session replay chart
            </Link>{" "}
            itself uses for a converted page — that color means the same thing everywhere in the dashboard, not
            just here.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Expanding a card shows only that lead&apos;s path to conversion: start of the session through the
            exact page visit they converted on, nothing after. If the real session kept going past that point, the
            rest of it is deliberately cut from this view — click{" "}
            <span className="text-[#f4f2ea]">View full information</span> to see the whole thing, uncut, on that
            lead&apos;s own{" "}
            <Link href="/docs/reference/lead-profile" className="text-[var(--lime)] hover:underline">
              profile page
            </Link>
            . Clicking a frame inside any card&apos;s chart works exactly like it does there too — see{" "}
            <Link href="/docs/concepts/session-replay" className="text-[var(--lime)] hover:underline">
              Session replay
            </Link>
            .
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The list itself is cached in your browser for a couple of minutes, so switching the date filter back to
            a range you already looked at recently loads instantly instead of re-querying. Changing the filter to
            something genuinely new, or waiting past that window, always fetches fresh data.
          </p>
        </div>
      </div>
    </div>
  );
}
