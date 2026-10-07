import type { Metadata } from "next";
import { DocHeader, Section, P, UL, OL, B, Callout, Example, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Sub-hooks and tunnels",
  description: "How to use the result of one Hook question as a value in another.",
  alternates: { canonical: "/docs/hook/sub-hooks" },
};

export default function SubHooksPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Sub-hooks and tunnels"
        intro="The most powerful part of Hook. A sub-hook is a whole question whose answer becomes a value inside another question. The tunnel is that flow. It replaces copying a result from one report into the next."
      />

      <Section title="Why you would use one">
        <P>
          Some questions have two steps: &quot;find these people, then look at what they did&quot;. Without a sub-hook you would run one question, copy its answer, and paste it into a second. With a sub-hook it is a single question, and Hook runs it in one go.
        </P>
        <Example
          title="Everything a named lead viewed"
          build={
            <>
              <B>Show</B> <B>a list of ... values</B> of page, of <B>page views</B> where visitor id is any of [sub-hook: <B>a list of ... values</B> of visitor id, of <B>form submissions (leads)</B> where name contains &quot;hanna&quot;].
            </>
          }
          why="The sub-hook finds Hanna's visitor, the main hook lists the pages that visitor viewed."
        />
        <Example
          title="Pages people spent longer on than the /pricing average"
          build={
            <>
              <B>Show</B> <B>the number of</B> <B>page views</B> where time on page more than [sub-hook: <B>a calculation:</B> average time on page, of page views where page is /pricing].
            </>
          }
          why="Compares every visit with a benchmark that is itself computed from your data."
        />
      </Section>

      <Section title="How to add one">
        <OL>
          <li>
            Next to any value, choose <B>the result of a sub-hook (tunnel)</B> instead of <B>a value I type</B>.
          </li>
          <li>A full hook builder opens inside a dashed box. Build it exactly like any other question.</li>
          <li>Look at the box border. It says <B>Fits</B> in green, or the reason in red.</li>
        </OL>
        <P>
          A sub-hook can contain sub-hooks of its own. The innermost one runs first.
        </P>
      </Section>

      <Section title="What fits where">
        <P>Two rules decide whether a sub-hook can feed a value. Hook enforces both and never converts silently.</P>
        <DataTable
          head={["Rule", "Meaning"]}
          rows={[
            [<B key="a">Shape</B>, "A sub-hook returning one value (a count or a calculation) fits any single-value comparison, such as \"more than\". A sub-hook returning a list fits only is any of and is none of."],
            [<B key="b">Type</B>, "The kinds must match. A list of visitor ids fits a visitor id field. A count cannot feed a duration."],
          ]}
        />
        <UL>
          <li>
            If you used a comparison with a list, the box turns red and offers <B>Use &quot;is any of&quot; instead</B>. One click fixes it.
          </li>
          <li>
            A <B>breakdown</B> hands over its keys. &quot;The 5 pages with the most views&quot; becomes a list of 5 pages.
          </li>
          <li>
            Sub-hooks offer every output the main hook has: a number, a calculation, a list, values or a breakdown.
          </li>
        </UL>
      </Section>

      <Section title="Turning a hook into a sub-hook">
        <P>
          Sometimes you build a question and then realise it should feed a bigger one. Press <B>Use this hook as a sub-hook...</B> under the main hook. Your whole hook moves inside a new one, you pick where its result should flow, and Hook offers only the places it fits.
        </P>
      </Section>

      <Section title="Seeing what a sub-hook did">
        <UL>
          <li>
            The <B>preview</B> draws each sub-hook as a smaller figure under &quot;Sub-hooks, flowing in through tunnels&quot;, saying which value it flows into.
          </li>
          <li>
            <B>How it ran</B> reports what each tunnel carried: one value, or a count and the first few values.
          </li>
        </UL>
        <Callout title="It is fast, and the size of the list does not matter">
          <p>
            A sub-hook runs once, inside the database. Its result never travels to your browser and back, so a tunnel carrying fifty thousand ids still costs one run. Copying and pasting a list of that size by hand would not even be possible.
          </p>
        </Callout>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
