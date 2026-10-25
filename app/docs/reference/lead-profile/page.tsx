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
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Order of the page</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            From the top: the lead&apos;s profile, the activity numbers, Session History, Form activity, the other leads sent from
            the same browser (only when there are any), and Path to Conversion at the very bottom. The &quot;other forms
            started, not sent&quot; fold in Form activity opens and closes smoothly, and its rows and bars play a short entrance.
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
            loads the visit chart. The selected session is kept in the page address, so a link opens the same one. See{" "}
            <Link href="/docs/concepts/session-replay" className="text-[var(--lime)] hover:underline">
              Visit chart
            </Link>{" "}
            for how to read it.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Above the visits, one paragraph sums up every visit: when they came, how much time they spent, which
            pages got most of it and when they sent the form. The list of visits can be folded to a thin strip of
            visit numbers with the button at its top, so the chart gets more room. Under the chart, a short paragraph
            describes the selected visit, and clicking a page in the chart describes that page. In these paragraphs
            pages, dates and times, and headings are highlighted in different colours.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <strong>Time per section.</strong> A page&apos;s sections are its main headings (its h1s, or its h2s when
            the page has no h1), with the smaller headings under them. For each page view the tracker counts how long
            each section was in front of the visitor: the section whose heading is just above the middle of the screen
            (at the very bottom of the page, the last one on screen). It only counts while the page is visible and the
            visitor is active. The page&apos;s paragraph then says where the time went, one sentence per main section,
            for example: Spent 3m in total on the &quot;Pricing&quot; section …. The &quot;…&quot; after a section
            opens its smaller headings in place (1m 45s on &quot;Business&quot;, 45s on &quot;Starter&quot;). The visit&apos;s
            paragraph says how many headings got time across its pages, and where the most and the least went. The
            three-stripe button next to a paragraph shows it one sentence per line instead; the choice is remembered. A page view under 3 seconds is described as left
            almost immediately, with the headings that were on screen. A heading with less than about 2 seconds is said to
            be skimmed. When one heading takes 80% or more of a page view longer than 10 seconds, or half or more of a
            whole visit longer than 10 seconds, the paragraph says so first. The chart key (the i above the chart) has a Heat map tab that shows the colour scale. Dates are highlighted in orange and times in yellow. The top of the page has a Whole Journey Summary; each visit has a Session summary and each clicked page a Page summary, which slides in when the page is clicked. On wide screens the visit list is as tall as
            the chart, and the space under it labels the cards on the right (Page details, Visit details). Page details lists every heading in page order, main headings in
            blue and smaller ones indented, each with a bar showing its share of the time on the page. This is time on screen, not proof of reading. Visits recorded before this was added have no section
            times. A heading the page no longer has is named &quot;a heading no longer on the page&quot;.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <strong>Summary length.</strong> Next to the three-stripe button, the Session summary has three versions; each
            (i) says what it keeps. <strong>Long</strong> is the full paragraph described above. <strong>Moderate</strong> keeps
            the key points, one per line: the visit and its pages in order with their times, for example Their 23rd
            visit: / (20s) → /pricing (1m 4s) → away 15m → / (8s); the page with the most time (when they opened more than
            one); the heading with half of the visit or more; the headings with the most and the least time; and how often
            they left and came back. Visits are numbered from the visitor&apos;s first visit ever. Two views of one page in a
            row with no time away between them are one step, and a path of more than 10 steps keeps the first 5 and the
            last 4. <strong>Short</strong> is the first line only. The choice is remembered in this browser. Hooks can send
            the same summary to Slack (see Hooks and notifications).
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The <strong>Seen / By section</strong> switch above the chart changes what each page shows. Seen is the
            usual view: how much of the page they scrolled past. By section turns each page into a heat map of its sections,
            from one main heading to the next: the deeper the green, the longer it was on screen (a smaller heading is never deeper than its section), with the heading and
            the time written on it. A section nobody reached has a dashed outline. Smaller headings are boxes inside
            their section; untick Sub-headings to see only the main sections. Two main headings on the same row (side
            by side columns) share the band, and each gets the time they were on screen together. Hovering a page lists
            every section with its time. Pages without section times keep the Seen view. Your choice is
            remembered in this browser.
          </p>
        </div>
      </div>
    </div>
  );
}
