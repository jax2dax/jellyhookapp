import type { Metadata } from "next";
import { DocHeader, Section, P, UL, B, Callout, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "How the preview works",
  description: "How the Hook preview turns a question into shapes, what it never draws, and its limits.",
  alternates: { canonical: "/docs/preview/how-it-works" },
};

export default function PreviewHowItWorksPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="How the preview works"
        intro="The preview is a translation of your question into shapes. This page explains the rules of that translation, so you can predict exactly what it will draw."
      />

      <Section title="It draws the description, never the data">
        <P>
          The preview reads your question and nothing else. It never reads visitor data, so it costs nothing and is instant. It only looks at your site&apos;s list of page addresses, to label how many pages a vague condition could mean (&quot;12+&quot;).
        </P>
        <P>
          A shape appears when, and only when, a condition describes it. That is the contract. Because of it, a shape is never a guess and never a sample from your data.
        </P>
      </Section>

      <Section title="From conditions to shapes">
        <DataTable
          head={["Condition", "What is drawn"]}
          rows={[
            [<B key="a">converted is true</B>, "A yellow frame with the yellow bulb. If no page says where, it is placed at the end and captioned \"converted here\"."],
            [<B key="b">converted is false</B>, "The caption \"did not convert\", no yellow."],
            [<B key="c">still open is true</B>, "A cyan border around the whole session."],
            [<B key="d">landing page / exit page</B>, "The first or last plate gets that address."],
            [<B key="e">has at least one page view where ...</B>, "One plate described by those conditions."],
            [<B key="f">count of page views</B>, "That many plates: the minimum as normal, extras faint with a question mark (at most 3 drawn), unbounded as a plus."],
            [<B key="g">number of different pages</B>, "That many plates captioned \"different page\"."],
            [<B key="h">away periods</B>, "Purple bars between visits, labelled with the time away."],
            [<B key="i">form activity status</B>, "A plate with a form mini-plate: yellow for seen or started, bright yellow for submitted, orange for abandoned."],
            [<B key="j">time on page</B>, "The frame gets wider with the time you describe, with a label such as \"> 5 sec\"."],
            [<B key="k">share of page seen</B>, "A light green band from the top to that share."],
            [<B key="l">seen 2x+ or scrolled back up</B>, "A dark green band inset in the light one."],
            [<B key="m">never seen</B>, "A hatched bottom part."],
            [<B key="n">entered / furthest / left (% down)</B>, "Green, blue and red bulbs at that height. A bulb with no number is faint, in the middle."],
            [<B key="o">page height of at least 3000 px</B>, "A taller plate."],
            [<B key="p">page number in the session is N</B>, "The plate lands at position N, with dashed unknown pages before it."],
            [<B key="q">anything else</B>, "A text chip under the figure."],
          ]}
        />
      </Section>

      <Section title="How many pictures there are">
        <UL>
          <li>
            A session hook is one figure. <B>match any (OR)</B> at session level makes one figure per alternative, up to 4.
          </li>
          <li>
            <B>exclude (NOT)</B> at session level adds one extra figure with red diagonal lines. The other figure shows the rest of the description.
          </li>
          <li>
            Two different descriptions of a session in one hook (for example a visitor with two session conditions) get one figure each.
          </li>
          <li>
            Every sub-hook that describes something gets its own smaller figures.
          </li>
          <li>
            An OR inside a single page&apos;s conditions is a chip, not a picture: it would multiply plates without telling you more.
          </li>
        </UL>
        <P>
          When the number of pages in a session is not described, its figure always ends with a plus: the described pages are some of its pages, not all of them. A described count (&quot;exactly 4 pages&quot;) removes the plus.
        </P>
      </Section>

      <Section title="What it never draws">
        <UL>
          <li>Real data: no actual pages, times or scroll from the database.</li>
          <li>
            Shapes for a value that comes from a sub-hook&apos;s result are drawn, but labelled &quot;from a sub-hook&quot;, because the preview does not know the value.
          </li>
          <li>Anything beyond its limits, which are counted in a note instead.</li>
        </UL>
        <DataTable
          head={["Limit", "Value"]}
          rows={[
            ["Faint (maybe) plates per range", "3"],
            ["Shapes per figure", "14"],
            ["Alternatives", "4"],
            ["Figures in total", "12"],
          ]}
        />
      </Section>

      <Section title="Motion">
        <P>
          Every edit gives one pulse of the whole preview and a glow on exactly the shapes that changed. Shapes keep stable identities derived from your conditions, so unrelated shapes do not glow. Both effects switch off when your system asks for reduced motion.
        </P>
        <Callout title="Not built yet">
          <p>
            Editing the question by dragging shapes in the preview is planned, not available. Today the preview is read only.
          </p>
        </Callout>
      </Section>

      <DocFooter feature="preview" />
    </div>
  );
}
