import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, Callout, Example, DataTable } from "../ui";

export const metadata: Metadata = {
  title: "What Jellyhook is for",
  description:
    "The problem Jellyhook solves, who it is for and who it is not for, and which screen answers each situation. Includes what it does not do.",
  alternates: { canonical: "/docs/use-cases" },
  openGraph: {
    title: "What Jellyhook is for",
    description: "The problem Jellyhook solves, who it is for and who it is not for, and which screen answers each situation.",
    url: "/docs/use-cases",
  },
};

const link = "text-[var(--lime)] hover:underline";

export default function UseCasesPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Getting started"
        title="What Jellyhook is for"
        intro={
          <>
            A form lead arrives as a name, an email and a message. You do not know what they read, how long they stayed, or whether they
            nearly gave up on the form. Jellyhook adds that missing part: for each lead, the pages they viewed, the time on each, how far
            they scrolled, and the time they spent on each form field. It also shows you, across all leads, where the form loses people.
          </>
        }
      />

      <Section title="Who it is for">
        <P>
          Websites whose main job is to produce form leads that a person follows up: a service business, an agency, a clinic, a consultancy,
          a B2B product with a &quot;contact us&quot; or &quot;book a demo&quot; form. If a human reads each submission and decides what to
          do next, the context Jellyhook adds is useful to that human.
        </P>
        <P>
          You do not need many leads. The screens below work from the first lead, and the{" "}
          <Link href="/demo" className={link}>sample lead page</Link> (made-up data, no sign-up) shows what one looks like.
        </P>
      </Section>

      <Section title="Who it is not for">
        <UL>
          <li>Shops and checkouts. Only form submissions count as a conversion. A purchase or a payment is not tracked as one.</li>
          <li>Sites with no form, or whose goal is page views or ad impressions. There is nothing to tie the visit to.</li>
          <li>Pages behind a login, or apps. Jellyhook is a script for public web pages.</li>
          <li>Teams that want to know which company an anonymous visitor works for. Jellyhook does not do that (see below).</li>
          <li>Sites with so many submissions that nobody looks at them one by one. The per-lead screens are made for reading one lead at a time.</li>
        </UL>
      </Section>

      <Section title="Situations, and the screen that answers each">
        <P>
          The scenarios are examples with made-up people and numbers. They show what you would do, not what any real site achieved.
        </P>

        <H3>1. A lead just came in. What did they read first?</H3>
        <Example
          title="Example: a bookkeeping firm"
          build={
            <>
              A form arrives from &quot;Priya&quot; asking for a quote. Before replying, the owner opens the{" "}
              <B>Leads</B> page and clicks her row. On the lead profile, <B>Path to Conversion</B> lists every page she viewed before
              submitting, in order, with the time on each. <B>Session History</B> loads the visit chart for each of her visits. In this
              example she read the pricing page twice and the page for sole traders, so the reply starts there.
            </>
          }
          why="You reply to what the person was looking at, not to a blank name and email."
        />
        <P>
          Screens: <Link href="/docs/reference/leads" className={link}>Leads page</Link>,{" "}
          <Link href="/docs/reference/lead-profile" className={link}>Lead profile page</Link>,{" "}
          <Link href="/docs/concepts/session-replay" className={link}>Visit chart</Link>.
        </P>

        <H3>2. Is this lead real?</H3>
        <Example
          title="Example: a lead with a one-word message"
          build={
            <>
              Three leads arrive in a morning. One has a message of &quot;test&quot;. On its profile, <B>Time engaged</B> and the visit
              chart show a session of a few seconds on one page. The owner marks it Junk with the toggle, and marks a lead who read four pages as
              Qualified. Later, the <B>Leads</B> page can be filtered to show only qualified, junk or unreviewed leads.
            </>
          }
          why="The visit is evidence next to the form text. The final call is still yours: the toggle is your judgement, not a score."
        />
        <P>
          Screens: <Link href="/docs/reference/lead-profile" className={link}>Lead profile page</Link>,{" "}
          <Link href="/docs/concepts/leads-qualification" className={link}>Leads and qualification</Link>.
        </P>

        <H3>3. People start the form but do not send it. Where do they stop?</H3>
        <Example
          title="Example: a quote form with eight fields"
          build={
            <>
              A consultancy sees visits to its contact page but few submissions. On a lead profile, <B>Field Timing</B> shows one bar per
              field in the order it was filled, and the longest is highlighted. <B>Form Engagement</B> shows how long the form sat on screen
              before anything was typed and how many other forms the same visitor started and never submitted. To ask it across everyone, open{" "}
              <B>Hook</B> and use the worked example &quot;Where people give up&quot;, which counts the field each abandoned form stopped on.
            </>
          }
          why="You find the field that costs you people, instead of guessing which one to remove."
        />
        <P>
          Screens: <Link href="/docs/concepts/form-engagement" className={link}>Form engagement</Link>,{" "}
          <Link href="/docs/hook/examples" className={link}>Hook worked examples</Link>. Needs the tracker on the page with the form, and a
          form it can read (see <Link href="/docs/concepts/supported-forms" className={link}>Supported forms</Link>).
        </P>

        <H3>4. Which sources bring leads, not just visits?</H3>
        <Example
          title="Example: a small agency running one newsletter and one ad"
          build={
            <>
              On the sidebar page <B>Conversion Paths</B>, the <B>Referrers</B> donut shows where all new visitors came from, and{" "}
              <B>Leads Origin</B> shows the same for visitors who converted. On the Overview, <B>Visits over time</B> can be split by
              Referrer. If the ad links carry UTM tags they appear by campaign name. If they carry none, a visit may show as Direct, which is
              not always direct.
            </>
          }
          why="A source with many visits and no leads reads differently from one with few visits and several leads."
        />
        <P>
          Screens: <Link href="/docs/reference/conversions" className={link}>Conversions page</Link> (called Conversion Paths in the sidebar),{" "}
          <Link href="/docs/reference/dashboard" className={link}>Dashboard overview</Link>,{" "}
          <Link href="/docs/concepts/referrers-attribution" className={link}>Referrers and attribution</Link>.
        </P>

        <H3>5. I just shared the page. Is anyone on the site now?</H3>
        <Example
          title="Example: a founder posts a link and checks the site"
          build={
            <>
              The Overview shows <B>Active now</B> (people on the site this moment), the <B>Sessions online</B> chart (how many were on at
              once, over time) and the <B>Live Ticker</B> (the newest page views). The <B>Pages</B> table then ranks pages by views, with
              average time and scroll.
            </>
          }
          why="You see the effect of a post within minutes, and which page the visitors went to."
        />
        <P>
          Screens: <Link href="/docs/reference/dashboard" className={link}>Dashboard overview</Link>,{" "}
          <Link href="/docs/concepts/visitors-sessions" className={link}>Visitors, sessions, and page views</Link>.
        </P>
      </Section>

      <Section title="Look-alike numbers: count people or count submissions">
        <Callout title="Leads is not Conversions">
          <p>
            <B>Leads</B> counts every form submission. <B>Conversions</B> and <B>Conversion Rate</B> count different people, each once.
          </p>
          <p>
            Example: one visitor submits the form 3 times today, and 20 different people visit. Leads shows 3. Conversions shows 1.
            Conversion Rate is 1 of 20, or 5%.
          </p>
          <p>
            Also, a person who uses their phone and later their laptop is two visitors, because there is no way to tell they are the same
            person. Details on the{" "}
            <Link href="/docs/reference/dashboard" className={link}>Dashboard overview</Link> and{" "}
            <Link href="/docs/concepts/visitors-sessions" className={link}>Visitors, sessions, and page views</Link>.
          </p>
        </Callout>
      </Section>

      <Section title="What it does not do">
        <DataTable
          head={["You might expect", "What is true"]}
          rows={[
            ["It tells me which company an anonymous visitor works for.", "No. Visitors are anonymous until they submit a form. A name or email exists only if the visitor typed one into a form."],
            ["It records the screen like a video.", "No. The visit chart is a chart of pages, time and scroll. It does not record the screen, mouse movement or keystrokes."],
            ["It syncs leads into my CRM.", "No. There is no CRM integration. It sits next to the tool where you keep your leads and does not replace it."],
            ["It shows a cookie or consent banner.", "No. The tracker has no banner of its own. It does nothing when the browser sends Global Privacy Control or Do Not Track, and a site owner can switch on a mode that waits for the site's own banner. You remain responsible for getting consent where the law requires it."],
            ["It follows one person across devices.", "No. A visitor is one browser. Phone and laptop are two visitors."],
            ["It tracks purchases.", "No. A conversion is a form submission."],
          ]}
        />
        <P>
          What the tracker stores and how consent mode works is in the{" "}
          <Link href="/privacy" className={link}>privacy policy</Link> and the{" "}
          <Link href="/docs/concepts/privacy-consent" className={link}>Privacy and consent</Link> page. Nothing on this page is legal advice.
        </P>
      </Section>

      <Section title="Next">
        <UL>
          <li>
            <Link href="/docs/installation" className={link}>Installation and setup</Link>: one script tag, then a form submission to see
            your first lead.
          </li>
          <li>
            <Link href="/docs/reference/dashboard" className={link}>Dashboard overview</Link>: what each number on the first screen means.
          </li>
          <li>
            <Link href="/docs/hook" className={link}>Hook</Link>: ask questions across all your data.
          </li>
        </UL>
      </Section>
    </div>
  );
}
