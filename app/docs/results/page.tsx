import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, OL, B, Callout, Example, DataTable, DocFooter } from "../ui";

export const metadata: Metadata = {
  title: "The results",
  description: "How Hook draws its answers: numbers with context, breakdowns, session replays, lead profiles, why a result is there, and comparing two hooks.",
  alternates: { canonical: "/docs/results" },
};

export default function ResultsPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="The results"
        intro="After Run hook, the answer appears under the builder, drawn as what it is: people, sessions, pages and numbers. You never see raw ids. The view is chosen for you from what your question returns."
      />

      <Section title="What you see for each kind of answer">
        <DataTable
          head={["Your hook returns", "You see"]}
          rows={[
            [<B key="a">the number of / the number of different</B>, "A big number with its base rate: \"4 out of 52 sessions overall (7.7%)\". The base rate appears when your hook has conditions."],
            [<B key="b">a calculation:</B>, "A big number with the same calculation over everything: \"across all page views: 12 sec\"."],
            [<B key="c">a breakdown by hour, day, week or month</B>, "Bars over time. Hover for values."],
            [<B key="d">a breakdown by anything else</B>, "A ranked bar list."],
            [<B key="e">a list of ... values</B>, "Value chips."],
            [<B key="f">a list of sessions</B>, "Full session replays, 6 at a time."],
            [<B key="g">a list of page views / away periods</B>, "The sessions they belong to, as replays, with the returned visits highlighted."],
            [<B key="h">a list of form submissions (leads)</B>, "Lead mini profiles, 12 at a time."],
            [<B key="i">a list of visitors</B>, "Visitor cards, 12 at a time."],
            [<B key="j">a list of pages</B>, "A table of views and form submissions per page."],
            [<B key="k">a list of form activity</B>, "Cards with page, status, fill time, fields touched and last field."],
            [<B key="l">a list of form fields</B>, "A table with time in the field, typed or not, and a \"gave up here\" mark."],
          ]}
        />
        <Example
          title="A number with context"
          build={
            <>
              <B>the number of</B> sessions where converted is true shows 4, with &quot;out of 52 sessions overall (7.7%)&quot;. The 7.7% is the base rate: the same count without your conditions.
            </>
          }
          why="A bare number is hard to judge. The base rate says whether 4 is a lot."
        />
      </Section>

      <Section title="Lead profiles">
        <UL>
          <li>
            <B>Name</B> in yellow, linking to the lead. <B>Email</B>, <B>phone</B>, and when and on which page it was submitted.
          </li>
          <li>A qualified or not qualified badge when your sales team has reviewed the lead.</li>
          <li>
            <B>Show form answers</B> reveals everything they filled in (up to 40 fields). It is hidden until you click.
          </li>
          <li>
            <B>Open the lead</B> goes to the lead&apos;s page.
          </li>
        </UL>
        <P>Visitor cards show device, browser, first and last seen, number of sessions, and the lead&apos;s name if they submitted a form.</P>
      </Section>

      <Section title="Why a result is there (highlighting)">
        <P>
          When your question looked at connected rows, the results show which ones made the difference. This only happens when you filtered on connected rows; a plain filter shows the cards as they are.
        </P>
        <DataTable
          head={["Your hook", "What you see"]}
          rows={[
            ["Sessions filtered by their page views", "Inside each replay, the matching visits are ringed in cyan and the rest is dimmed. The header says how many visits matched."],
            ["Page views or away periods returned", "Each session shown once, with the returned visits highlighted."],
            ["Leads filtered by their session", "Under each lead, the session they converted in, with your page conditions highlighted."],
            ["Visitors filtered by their sessions", "Under each visitor, up to 2 matching sessions, newest first, highlighted."],
          ]}
        />
        <P>
          This works with everything Hook can filter on, including journeys, so &quot;visited /blogs then /pricing&quot; rings both visits.
        </P>
      </Section>

      <Section title="Showing more">
        <UL>
          <li>
            The first items are drawn immediately. <B>Show 6 more</B> (or 12) loads the next ones.
          </li>
          <li>
            <B>Showing more is free.</B> It does not run your question again and uses no credits.
          </li>
          <li>
            A list keeps at most <B>500</B> items. The result says &quot;Showing the first 500 of N&quot; when there are more.
          </li>
          <li>
            You can keep loading more for about a day after a run. After that, a notice tells you to run the hook again.
          </li>
        </UL>
      </Section>

      <Section title="Comparing two hooks">
        <P>
          <B>Compare with another hook</B> (under the builder) adds <B>Hook B</B> and a <B>Result</B> formula. Both hooks must return one number.
        </P>
        <DataTable
          head={["Formula", "Gives you"]}
          rows={[
            [<B key="a">A / B</B>, "A ratio."],
            [<B key="b">A / B x 100 (%)</B>, "A share, as a percentage."],
            [<B key="c">A - B</B>, "The difference."],
            [<B key="d">change from B to A (%)</B>, "How much A is above or below B."],
          ]}
        />
        <OL>
          <li>
            Press <B>Compare with another hook</B>.
          </li>
          <li>Build Hook A and Hook B. Each returns one number.</li>
          <li>
            Choose the formula and press <B>Run comparison</B>. You see A, B and the result side by side.
          </li>
          <li>
            <B>Stop comparing</B> goes back to a single hook.
          </li>
        </OL>
        <Example
          title="Does /pricing help conversion?"
          build={
            <>
              Hook A: <B>the number of</B> sessions where converted is true and a page view is /pricing. Hook B: <B>the number of</B> sessions where converted is true. Result: <B>A / B x 100 (%)</B> is the share of conversions that saw /pricing.
            </>
          }
        />
        <H3>Cost</H3>
        <P>A comparison costs the credits of both hooks.</P>
      </Section>

      <Section title="Privacy and what is never shown">
        <UL>
          <li>Internal ids are never shown. Links go to the app&apos;s own pages.</li>
          <li>The technical details of a run (the statement and the database cost) are shown only on the developer bench, not here.</li>
        </UL>
        <Callout title="Not available yet">
          <p>Exporting results, sorting inside a list, overlaying two breakdowns and saving a canvas to a dashboard are not built.</p>
        </Callout>
        <P>
          Curious how the canvas chooses a view and finds the highlighted rows? See{" "}
          <Link href="/docs/results/how-it-works" className="text-[var(--lime)] hover:underline">
            How the results work
          </Link>
          .
        </P>
      </Section>

      <DocFooter feature="results" />
    </div>
  );
}
