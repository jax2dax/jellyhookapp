import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referrers and attribution",
  description: "Why a referrer can say Direct when it should not, and what UTM tags actually fix.",
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
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">First touch, not every visit</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The referrer and leads origin charts count each visitor once, under whichever source brought them in
            the very first time. A visitor who converts weeks later, after several return visits from a bookmark,
            still counts under their original source, not Direct.
          </p>
        </div>
      </div>
    </div>
  );
}
