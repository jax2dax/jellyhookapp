import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referrers and attribution",
  description: "How Jellyhook decides where a visitor or a lead came from: referrers, UTM tags, how source names are merged, and which visit gets the credit (first visit or last non-direct visit).",
  alternates: { canonical: "/docs/concepts/referrers-attribution" },
};

export default function ReferrersAttributionPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Referrers and attribution</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        This is a real, honest limitation worth understanding before trusting a source breakdown chart, not
        something specific to Jellyhook. Every analytics tool that reads a plain referrer hits the same wall.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">What a plain referrer actually tells you</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The browser hands over the address of whatever page someone was on the instant they clicked through to
            yours. Nothing more. If they clicked an ad directly, it correctly shows the ad platform. If they saw
            the ad, opened a new tab, and searched your business name on Google instead, it shows Google, because
            that is genuinely the page they were on when they clicked through. The ad still caused the visit. The
            referrer has no way to know that.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Many mobile apps also strip the referrer entirely when opening a link in their own in-app browser, which
            shows up as Direct even though it was not.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">UTM tags: the actual fix, and it takes deliberate setup</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Adding <code className="ff-mono text-[#c9c7bd]">?utm_source=facebook&amp;utm_medium=paid</code> to the end
            of a link, before posting it, is how a marketer labels their own traffic in advance. When a link is
            tagged this way, Jellyhook uses that tag as the source, ahead of whatever the raw referrer says.
            Google&apos;s and Meta&apos;s own click ids on an ad link, when present, are used as a fallback if no UTM
            tag was added, so a straightforward ad click still gets attributed correctly even without manual
            tagging. Neither of these can attribute a visit that never clicked a tracked link at all.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">How one visit gets its source</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">Every visit gets exactly one source, decided in this order:</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <li>The link&apos;s <code className="ff-mono text-[#c9c7bd]">utm_source</code> tag, when it has one.</li>
            <li>Otherwise the site the visitor came from (the referrer): google.com is Google, reddit.com is Reddit, an unknown site shows its own name.</li>
            <li>Otherwise Direct: a typed-in address, a bookmark, or an app that hid where the click came from.</li>
          </ol>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">A referrer and a UTM tag are two ways of answering the same question, so they are never shown as two separate things. The tag wins because it is the marketer&apos;s own label.</p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">One source, many spellings</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Links get tagged by different people in different ways. Before anything is counted, common spellings of the same platform are merged:
            fb, Facebook, facebook.com and www.facebook.com all count as Facebook; li and linkedin as LinkedIn; x and twitter as Twitter/X; ig as
            Instagram; yt as YouTube; tt as TikTok. A tagged visit and an untagged one from the same platform therefore land on the same source. A
            name that is not in the list is shown as written, with a capital letter (newsletter shows as Newsletter).
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Which visit gets the credit</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Most people visit more than once before they convert. The Leads Origin chart lets you choose which of their visits is credited:
          </p>
          <div className="mt-3 divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-60 sm:shrink-0">First visit (default)</span>
              <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">The source of the person&apos;s very first visit. Answers: where do people discover me?</span>
            </div>
            <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-60 sm:shrink-0">Last non-direct visit</span>
              <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">
                The source of the last visit before they converted that came from somewhere (search, social, an ad, a tagged link). Direct visits are
                skipped, so a bookmark or a typed-in return never hides the channel that brought them back. Direct only when every visit was direct.
                Answers: what brought them back to act?
              </span>
            </div>
          </div>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">The same three people under each choice:</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[13px] text-[#8b8980]">
              <thead className="text-[#c9c7bd]">
                <tr className="border-b border-[#1b1b18]">
                  <th className="py-2 pr-4 font-medium">What the person did</th>
                  <th className="py-2 pr-4 font-medium">First visit</th>
                  <th className="py-2 font-medium">Last non-direct visit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#1b1b18]">
                  <td className="py-2 pr-4">Clicked your Facebook post, came back later by typing your address, then converted</td>
                  <td className="py-2 pr-4">Facebook</td>
                  <td className="py-2">Facebook</td>
                </tr>
                <tr className="border-b border-[#1b1b18]">
                  <td className="py-2 pr-4">Saw you on Facebook, later searched your name on Google, then converted</td>
                  <td className="py-2 pr-4">Facebook</td>
                  <td className="py-2">Google</td>
                </tr>
                <tr className="border-b border-[#1b1b18]">
                  <td className="py-2 pr-4">Typed your address first, later clicked a Facebook link, then converted</td>
                  <td className="py-2 pr-4">Direct</td>
                  <td className="py-2">Facebook</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Neither choice is the truth on its own: in the second example Facebook made them aware and Google is how they came back. Comparing the
            two views shows which channels discover people and which close. Each visit keeps its own source, so the full chain is always on the
            lead&apos;s own page. The Referrers chart always uses the first visit.
          </p>
        </div>
      </div>
    </div>
  );
}
