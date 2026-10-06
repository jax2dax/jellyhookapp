import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Lead profile page",
  description: "What each section of an individual lead's page shows.",
  alternates: { canonical: "/docs/reference/lead-profile" },
};

export default function LeadProfileReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Lead profile page</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Everything known about one specific lead, from the moment they first showed up to the moment they
        converted, if they did.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Header</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Name, email, phone, whether they converted, and whether they were a first-time or returning visitor
            when they did. The qualify toggle lives here too.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Activity stats</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One card with six numbers: visits, page views, pages per visit (page views divided by visits, with a
            row of dots), time engaged, average scroll depth (with a bar), and time to convert, from their very
            first visit to the moment they submitted (shown in yellow once they have converted). The (i) next to
            each explains how it is counted.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Form Engagement</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            How long the form sat on screen before they typed anything, how long they spent actually filling it
            in, and how many other forms this same visitor started elsewhere but never submitted. Only shown when
            there is a real fact to display, not for every lead.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Field Timing</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One bar per field on the form they submitted, in the order they actually filled them in, longest one
            highlighted. See{" "}
            <Link href="/docs/concepts/form-engagement" className="text-[var(--lime)] hover:underline">
              Form engagement
            </Link>{" "}
            for how this is measured.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Path to Conversion</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Every page they viewed before converting, in order, bar length is time spent on that page.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Conversion Events</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Only appears when this same browser has submitted more than one form, so it never shows a list of
            one. Each submission is a small badge with its page and time, laid out in a row; the one you are
            viewing is highlighted. Past 12, the rest sit behind a &quot;+N more&quot; button.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Submitted form details</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Name, email and phone are already in the header, so this block only appears when the form had other
            fields (a business name, a budget...). The first four are shown as plain key and value, and the rest
            sit behind one compact &quot;+N more fields&quot; button.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Session History</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Every session from this visitor, including ones where they left without converting. Selecting one
            loads the session replay chart. The selected session is kept in the page address, so a link opens the same one. See{" "}
            <Link href="/docs/concepts/session-replay" className="text-[var(--lime)] hover:underline">
              Session replay
            </Link>{" "}
            for how to read it.
          </p>
        </div>
      </div>
    </div>
  );
}
