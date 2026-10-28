import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conversions page",
  description: "The converted leads, the referrer donut and the leads origin radar. (The Reach and Conversions charts are on the Dashboard.)",
  alternates: { canonical: "/docs/reference/conversions" },
};

export default function ConversionsReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[var(--ink)]">Conversions page</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
        Where marketing-side questions get answered: how many new people showed up, how many converted, and where
        they actually came from.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Converted leads</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            One card per converted lead, filterable by date range (last 3 days, last week, last month, all time, or
            a custom range) and paginated, not every conversion the site has ever had rendered onto one page at
            once. Each card is collapsed to a single line by default: name, email, the page they converted on, and
            the date, so a long list of conversions stays scannable; click anywhere on that line to expand it.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            A lead&apos;s name in this list is colored the same yellow the{" "}
            <Link href="/docs/concepts/session-replay" className="text-[var(--lime)] hover:underline">
              visit chart
            </Link>{" "}
            itself uses for a converted page, since that color means the same thing everywhere in the dashboard, not
            just here.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Expanding a card shows only that lead&apos;s path to conversion: start of the session through the
            exact page visit they converted on, nothing after. If the real session kept going past that point, the
            rest of it is deliberately cut from this view. Click{" "}
            <span className="text-[var(--ink)]">View lead information</span> to see the whole thing, uncut, on that
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
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The list itself is cached in your browser for a couple of minutes, so switching the date filter back to
            a range you already looked at recently loads instantly instead of re-querying. Changing the filter to
            something genuinely new, or waiting past that window, always fetches fresh data.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Reach and Conversions</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The New Reach and Conversions charts (new visitors, and unique people who converted, over time) are now on
            the <Link href="/docs/reference/dashboard" className="text-[var(--lime)] hover:underline">Dashboard</Link>,
            with the Merged, Split and Separate layouts.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Referrers</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
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
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Leads Origin</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Where converted leads came from. Each lead counts once, as a person, under one source.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            <li>
              <strong className="text-[var(--ink-2)]">First visit / Last non-direct visit</strong>: which of the person&apos;s visits gets the credit. First visit
              is the default. The choice is kept in the page address, so a shared link shows the same view.
            </li>
            <li>
              <strong className="text-[var(--ink-2)]">Show where all unique visitors came from</strong> (on by default): adds a second, dashed blue shape for every
              visitor, converted or not, by the same rule. Both shapes then show shares of their own total, because a few leads next to hundreds
              of visitors would otherwise be a dot. Where the yellow shape reaches further than the blue one, that source turns visitors into
              leads better than average. Turn it off to see leads as plain counts.
            </li>
            <li>
              Up to eight spokes: the sources with the most leads first, then the biggest visitor sources that have not produced a lead yet, then
              generic names (Direct, Facebook, Instagram, Google, LinkedIn, TikTok) so the shape stays readable with very little data.
            </li>
          </ul>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
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
