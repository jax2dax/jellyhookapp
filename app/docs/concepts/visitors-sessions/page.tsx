import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visitors, sessions, and page views",
  description: "How Jellyhook tells one visitor from another, what counts as a session, and when a page view starts and ends.",
  alternates: { canonical: "/docs/concepts/visitors-sessions" },
};

export default function VisitorsSessionsPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Visitors, sessions, and page views</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        These three things are not the same, and the difference matters once you are reading a chart. A visitor is a
        browser. A session is one continuous visit. A page view is one page during that visit.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Visitor</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The tracker stores an id for the browser the first time it sees it, in that browser&apos;s own storage. It
            stays there across visits, so the same person coming back next week is still the same visitor. It does
            not survive clearing browser data, and it does not follow the same person to a different browser or
            device. Someone who reads your site on their phone and later fills out the form on their laptop shows up
            as two separate visitors, with no way to tell they were the same person.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Session</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One session is one continuous visit, in one browser tab. Closing the tab ends it. Opening a new tab
            starts a new one, even for the same visitor a second later.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A session also ends after 30 minutes of the tab being backgrounded (switched away from, or the computer
            asleep). If someone leaves a tab open in the background and comes back three hours later, that does not
            count as one long session. It gets split into two, and the first one is closed with the time they
            actually stopped looking at anything, not the time you happen to notice it ended.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Page view</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One page view covers one page, for as long as it is the one on screen. Navigating to another page ends
            it and starts a new one, whether that navigation reloads the whole page or is handled instantly by the
            site&apos;s own code without a reload. Switching away from the tab and back also starts a fresh page
            view for whatever page is still open, even though it is technically the same page as before.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Why a session can show a live border but the page inside it is not blue</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            On the session replay chart, the green border around the whole chart means the session itself has not
            formally ended yet. That is different from the blue page frame, which means the visitor is looking at
            that exact page right now. A visitor can leave a page open, switch to another tab, and still be inside a
            live session, while the page they left is no longer the one that is blue.
          </p>
        </div>
      </div>
    </div>
  );
}
