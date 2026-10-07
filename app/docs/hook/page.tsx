import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, P, UL, B, C, Callout, DataTable, DocFooter } from "../ui";

export const metadata: Metadata = {
  title: "Hook: ask precise questions",
  description: "What Hook is, how a question is built, and where to go next. Start here to learn Hook.",
  alternates: { canonical: "/docs/hook" },
};

const MAP: [string, string, string][] = [
  ["/docs/hook/building", "Build a question", "Pick what you look at, add conditions, choose what you want back, run it."],
  ["/docs/hook/connected-rows", "Connected rows, groups and journeys", "Ask about a session's pages, combine conditions with any of / none of, follow visitors from page to page."],
  ["/docs/hook/sub-hooks", "Sub-hooks and tunnels", "Feed the answer of one question into another. The most powerful part of Hook."],
  ["/docs/hook/organizing", "Organize, share and run", "Names, notes, links, run order and credits."],
  ["/docs/hook/examples", "Worked examples", "Twenty-four questions for marketing, content, sales, forms and journeys."],
  ["/docs/hook/field-reference", "Field reference", "Every field, type, operator and measure. Always matches what the builder offers."],
  ["/docs/preview", "The preview", "The live picture beside the builder that shows what your question describes."],
  ["/docs/results", "The results", "How the answer is drawn: numbers, replays, lead profiles, comparisons."],
  ["/docs/hook/how-it-works", "How Hook works", "What happens between pressing Run and seeing the answer. Read this to trust it."],
  ["/docs/hook/glossary", "Glossary", "Every term in one place."],
];

export default function HookOverviewPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Hook: ask precise questions"
        intro="Hook answers questions about your visitors, sessions, leads and forms in seconds. You do not write SQL, you do not export anything, and you do not need an analyst. You build the question out of plain choices, and Hook works out how to answer it."
      />

      <Section title="The idea in one minute">
        <P>Every question has three parts, and the builder reads like a sentence:</P>
        <Callout title="The sentence">
          <p>
            <B>Show</B> [what you want back] <B>of</B> [what you are looking at] <B>where</B> [conditions].
          </p>
        </Callout>
        <UL>
          <li>
            <B>What you are looking at</B> is one kind of row: page views, sessions, leads, visitors and a few more.
          </li>
          <li>
            <B>Conditions</B> narrow those rows down: &quot;page is /pricing&quot;, &quot;time on page more than 30 sec&quot;.
          </li>
          <li>
            <B>What you want back</B> is a number, a calculation, a list or a breakdown.
          </li>
        </UL>
        <P>
          Under the builder, <B>Reads as:</B> repeats your question in plain English. Check it before you press <B>Run hook</B>.
        </P>
      </Section>

      <Section title="Your first question, in four clicks">
        <P>
          Open <B>Hook</B> in the sidebar. Suppose you want to know how many sessions converted.
        </P>
        <UL>
          <li>
            Leave <B>of</B> on <B>sessions</B>.
          </li>
          <li>
            Choose <B>the number of</B> after <B>Show</B>.
          </li>
          <li>
            Press <B>+ Condition</B>, pick <B>converted</B>, and set it to <B>is true</B>.
          </li>
          <li>
            Press <B>Run hook</B>.
          </li>
        </UL>
        <P>
          You get one number with its context, for example &quot;4 out of 52 sessions overall (7.7%)&quot;. Change <B>converted</B> to a page,
          a campaign or a time window and run again. That is the whole loop: describe, check <B>Reads as:</B>, run.
        </P>
      </Section>

      <Section title="What makes Hook different">
        <DataTable
          head={["Idea", "What it gives you"]}
          rows={[
            [<B key="a">Any field, any comparison</B>, "Every field has a type, and the type decides what you can compare it with. \"Time on page between 3 sec and 5 sec\" is a single condition, not a special report."],
            [<B key="b">Connected rows, measured</B>, "Ask about the rows around a row: sessions whose number of page views of /blogs, longer than 5 sec, is at least 2."],
            [<B key="c">Sub-hooks and tunnels</B>, "The answer of one question becomes a value in another: page views by visitors who are leads named Hanna."],
            [<B key="d">Built for long questions</B>, "Name, annotate, collapse and space out the parts so a long question stays readable, and share it as a link."],
            [<B key="e">Live and metered</B>, "Nothing is cached. Every run reads your current data, and its cost is known before it runs."],
          ]}
        />
      </Section>

      <Section title="Good to know before you start">
        <UL>
          <li>
            Hook runs on the <B>site currently selected</B> in the site switcher, the same one every page shows. It can never read another site.
          </li>
          <li>
            Answers are <B>live</B>. There is no saved copy, so two runs a minute apart can differ.
          </li>
          <li>
            Every run costs <B>at least 1 credit</B>, more for heavier questions. See <Link href="/docs/hook/organizing" className="text-[var(--lime)] hover:underline">Organize, share and run</Link>.
          </li>
          <li>
            Hours and weekdays are in <B>UTC</B>.
          </li>
          <li>
            Results show people, pages and sessions, <B>never internal ids</B>.
          </li>
        </UL>
      </Section>

      <Section title="Where to go next">
        <DataTable
          head={["Page", "What it covers"]}
          rows={MAP.map(([href, name, desc]) => [
            <Link key={href} href={href} className="text-[var(--lime)] hover:underline">
              {name}
            </Link>,
            desc,
          ])}
        />
        <P>
          Pages are split on purpose. The pages above that tell you <B>how to use</B> a feature never explain internals; <C>How Hook works</C> does, separately, so you can use Hook well without reading it and understand it fully after.
        </P>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
