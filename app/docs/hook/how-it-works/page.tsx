import type { Metadata } from "next";
import { DocHeader, Section, H3, P, UL, OL, B, Callout, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "How Hook works",
  description: "What happens between pressing Run and seeing an answer: the query, sub-hooks, planning, cost, safety and definitions.",
  alternates: { canonical: "/docs/hook/how-it-works" },
};

export default function HookHowItWorksPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="How Hook works"
        intro="You can use Hook well without reading this page. Read it when you want to know why an answer is what it is, why a question costs what it costs, or what Hook does and does not do on your behalf."
      />

      <Section title="A question is a small, plain description">
        <P>
          Everything you build in the builder is saved as a small description of the question, called the query. It holds the conditions, the output, the sub-hooks, and also your names, notes, collapsed blocks and spacing. It holds no data and no site.
        </P>
        <UL>
          <li>
            In the builder it is what you edit. In a <B>Copy link</B> it sits in the address, so the link reopens the exact question.
          </li>
          <li>
            Whoever opens a link runs it against <B>their own</B> current site. Your site is never in the link.
          </li>
          <li>
            A query from anywhere (a link, the code panel) is treated as untrusted. It is upgraded to the current format, then checked for size and structure, then checked for types, on every run.
          </li>
          <li>
            Queries are versioned. When Hook changes, old links are upgraded step by step and keep working, and Hook tells you when it did that.
          </li>
        </UL>
      </Section>

      <Section title="What happens when you press Run">
        <OL>
          <li>
            <B>Who and which site.</B> The server works out who you are and which site you are looking at, exactly as every page in the dashboard does. The browser is never asked to name a site.
          </li>
          <li>
            <B>Upgrade and check.</B> An older query is upgraded; the query is checked against the limits and types.
          </li>
          <li>
            <B>Sub-hooks first.</B> Every sub-hook runs once, inside the database, and its result is held ready for the hook above it.
          </li>
          <li>
            <B>Estimate.</B> Hook asks the database how many rows each top-level step would keep. This is a planning question answered from the statistics the database already holds, so no visitor data is read.
          </li>
          <li>
            <B>Plan and cost.</B> Hook decides the order, works out the credits, and compares them with your limit.
          </li>
          <li>
            <B>Run.</B> If the cost is within the limit, the database runs the whole question in one statement.
          </li>
          <li>
            <B>Answer and account.</B> The answer comes back with how it was found: the order, what each sub-hook carried, the cost and the timings.
          </li>
        </OL>
      </Section>

      <Section title="Steps: one pass or step by step">
        <P>
          The top-level conditions are the steps of a question. When their sizes are very different, Hook runs the smallest first and each next step only checks what survived. When they are similar, it runs them together and the database orders them itself. Either way <B>the answer is identical</B>; only the speed differs.
        </P>
        <P>
          If you set the order by hand and it would be at least 10 times slower, Hook runs the faster order and tells you, unless you switched that safeguard off. An estimate can be wrong when conditions are correlated or when a measure over connected rows is rough, and a wrong estimate costs speed, never correctness.
        </P>
      </Section>

      <Section title="Connected rows and tunnels, precisely">
        <H3>Connected rows</H3>
        <P>
          A connected-row condition looks at rows linked by the identifiers the tracker records (session, visitor, page address). Its conditions apply to the same row together. A count or total is measured over exactly the connected rows that match.
        </P>
        <H3>Tunnels</H3>
        <UL>
          <li>A sub-hook runs once. Its result never travels to the browser and back, so its size does not change the cost the way manual copying would.</li>
          <li>One value feeds comparisons; a list feeds is any of and is none of. Types must match. Breaking a rule is an error naming both sides, never a silent conversion.</li>
          <li>Sub-hooks can nest, and the depth is capped.</li>
        </UL>
      </Section>

      <Section title="Credits and cost">
        <P>
          The cost is known before anything runs. Hook asks the database for its own estimate of the work in the exact statement it is about to run, and converts that into credits, with a minimum of 1. If the estimate is over your limit, nothing runs. Because the estimate is for the real statement, the cost you are shown is the cost you pay.
        </P>
        <DataTable
          head={["What lowers the cost", "Why"]}
          rows={[
            ["A narrow first condition", "Later steps only look at what survived."],
            ["Sub-hooks", "Computed once per run, however many rows read them."],
            ["Conditions before measures", "Measures over connected rows are cheap on a filtered set and expensive as the first step over a whole site."],
          ]}
        />
      </Section>

      <Section title="Safety">
        <UL>
          <li>
            <B>One site only.</B> The site comes from the server, never from the query. Every table in the statement is pinned to it.
          </li>
          <li>
            <B>Read only.</B> Hook runs through a database login that can read, not write.
          </li>
          <li>
            <B>Values are never pasted into the statement.</B> Every value you type is passed separately, so text cannot change the meaning of a question.
          </li>
          <li>
            <B>A run is stopped after 8 seconds</B> so a heavy question cannot hold the database.
          </li>
          <li>
            <B>Errors tell you what to change.</B> Server problems show only a short reference code; the details stay in the server log.
          </li>
        </UL>
      </Section>

      <Section title="What is kept">
        <DataTable
          head={["What", "Where", "How long"]}
          rows={[
            ["Step size estimates", "Server memory", "5 minutes"],
            ["Value suggestions (pages, campaigns, countries)", "Fetched when you choose a field", "Per page load"],
            ["Answers", "Not kept", "Every run is live"],
            ["The query", "The address bar", "As long as the link exists"],
          ]}
        />
        <P>Nothing runs on its own. Every run is started by a person, because every run is metered.</P>
      </Section>

      <Section title="Definitions Hook relies on">
        <DataTable
          head={["Term", "Definition"]}
          rows={[
            [<B key="a">Page</B>, "A page address of your site, as recorded for the page view."],
            [<B key="b">Converted session</B>, "A session that has a form submission."],
            [<B key="c">Lead</B>, "A form submission. Its visitor is the browser that submitted it."],
            [<B key="d">Time on page</B>, "Left at minus entered at, both stamped by our server. This is the figure the visit chart shows. The browser timer is a separate field."],
            [<B key="e">Away period</B>, "The time between one page view ending and the next starting in the same session, when it is 15 seconds or more. The same rule the visit chart uses for its away bars."],
            [<B key="f">Share of page seen</B>, "The share of the page that was on screen, from the recorded scroll positions and screen height. Empty, never guessed, when the screen height was not recorded."],
            [<B key="g">Hours and weekdays</B>, "UTC."],
          ]}
        />
      </Section>

      <Section title="Limitations today">
        <UL>
          <li>Custom form answers are not available as fields in conditions yet.</li>
          <li>The referrer is raw text; the classified traffic source is not a field yet.</li>
          <li>Hours and weekdays are UTC, not the visitor&apos;s local time.</li>
          <li>Share of page seen uses where the visitor entered, went deepest, and scrolled back to. The visit chart can show finer detail.</li>
          <li>Very large questions make long links. Saved hooks will remove this.</li>
        </UL>
        <Callout title="Want the engineering detail?">
          <p>
            The developer guides live in the repository under <code className="ff-mono text-[#c9c7bd]">jh-hook/</code>: architecture, data flow, the field reference and the decision log.
          </p>
        </Callout>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
