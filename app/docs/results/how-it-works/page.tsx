import type { Metadata } from "next";
import { DocHeader, Section, P, UL, B, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "How the results work",
  description: "How the results canvas picks a view, finds the rows to highlight, loads more items, and what it costs.",
  alternates: { canonical: "/docs/results/how-it-works" },
};

export default function ResultsHowItWorksPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="How the results work"
        intro="Hook finds rows. The results canvas decides how a person should see them. This page explains how it chooses, what extra work it does, and what each part costs."
      />

      <Section title="Choosing the view">
        <P>
          The view comes only from the shape of your question: its output and what you are looking at. You do not choose it, and it never depends on the data. That is why the same question always draws the same kind of view.
        </P>
        <P>
          A list of page views or away periods is drawn as the sessions they belong to, because a single page view means little outside its visit. A list of ids never reaches you: the rows are drawn instead.
        </P>
      </Section>

      <Section title="The base rate">
        <P>
          For a count or a calculation with conditions, the canvas also runs the same measure with no conditions, to give the number context (&quot;out of 52 sessions overall&quot;). It costs about the same credits as the run itself, and it is included in the credits you are shown.
        </P>
      </Section>

      <Section title="Finding the evidence">
        <P>
          Highlighting is only done when your question filtered on connected rows. The canvas does not guess which rows matter: it asks Hook again, with the conditions on the connected rows, for the rows on screen. Because it uses the same engine, every field, comparison, sub-hook and journey that can filter can also highlight.
        </P>
        <UL>
          <li>A page-view condition under <B>exclude (NOT)</B>, or a count of 0, highlights nothing: those visits are absent by definition.</li>
          <li>A session filter with no page-view condition shows the visit chart as it is.</li>
          <li>Visitors show at most 2 matching sessions each, newest first.</li>
        </UL>
      </Section>

      <Section title="Loading only what is on screen">
        <P>
          The first page of a list is drawn right away. The rest wait as sealed tokens: encrypted, tied to your site and to the view, and valid for 24 hours. <B>Show more</B> opens the next tokens on the server and draws them. It does not run your question again, so it costs no credits, and nobody can open another site&apos;s results with a token.
        </P>
        <DataTable
          head={["List", "First batch"]}
          rows={[
            ["Visit charts", "6"],
            ["Lead profiles, visitor cards, form activity", "12"],
            ["Pages", "24"],
            ["Form fields", "50"],
            ["Maximum kept per list", "500"],
          ]}
        />
      </Section>

      <Section title="What each part costs">
        <DataTable
          head={["Part", "Credits"]}
          rows={[
            ["The run itself", "Its credits, as shown before you run."],
            ["The base rate", "About the same again, included in the figure shown."],
            ["A comparison", "The credits of both hooks."],
            ["Highlighting and Show more", "Small fixed lookups for the rows on screen. Not metered as hook runs."],
          ]}
        />
      </Section>

      <Section title="If something fails">
        <UL>
          <li>If the answer was computed but drawing it failed, the canvas says so and still shows the number. A reference code is logged for support.</li>
          <li>If Show more fails or the tokens have expired, a notice says to run the hook again.</li>
        </UL>
      </Section>

      <DocFooter feature="results" />
    </div>
  );
}
