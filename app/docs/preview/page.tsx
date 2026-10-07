import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, P, UL, B, Callout, Example, DataTable, DocFooter } from "../ui";

export const metadata: Metadata = {
  title: "The preview",
  description: "How to read the live picture beside the Hook builder: what each shape means and when it appears.",
  alternates: { canonical: "/docs/preview" },
};

export default function PreviewPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="The preview"
        intro="Beside the Hook builder, a live picture shows what your question describes, drawn in the same shapes as the visit chart. It answers one question before you spend a credit: is this the session I mean?"
      />

      <Section title="What it is, and what it is not">
        <UL>
          <li>
            It fills in as you build. The more you describe, the more detailed it gets.
          </li>
          <li>
            It shows the <B>question</B>, not the <B>answer</B>. It does not change when you run, it uses no credits, and it never reads visitor data.
          </li>
          <li>
            It is faint at rest. It pulses once each time you edit, and the shapes that changed glow. With reduced motion turned on in your system, nothing moves.
          </li>
          <li>On a narrow screen it sits under the builder instead of beside it.</li>
        </UL>
        <Example
          title="Converted, then exactly 3 pages"
          build={
            <>
              <B>Show</B> <B>the number of</B> <B>sessions</B> where page views <B>has at least one</B> where converted on this page is true, and the pages after it, <B>count or total</B>: number of, is 3. The preview draws a yellow frame followed by three dashed plates.
            </>
          }
        />
      </Section>

      <Section title="Reading the shapes">
        <DataTable
          head={["Shape", "Meaning"]}
          rows={[
            [<B key="a">Dashed white plate</B>, "Any page, not chosen yet. The label says how many pages it could be (\"12+\"). Hover to list them."],
            [<B key="b">Solid plate with an address</B>, "A specific page."],
            [<B key="c">Yellow frame</B>, "Converted here."],
            [<B key="d">Orange frame</B>, "A form was abandoned here."],
            [<B key="e">Cyan border</B>, "The session is still open."],
            [<B key="f">Purple bar</B>, "Time away from the site, labelled with the time."],
            [<B key="g">Light green band</B>, "Share of the page seen. Dashed edge means at least; solid means exactly or at most."],
            [<B key="h">Dark green band</B>, "Seen more than once (seen 2x+, or scrolled back up)."],
            [<B key="i">Hatched area</B>, "Never seen."],
            [<B key="j">Green, blue and red bulbs</B>, "Where they entered, the furthest point they reached, and where they left."],
            [<B key="k">Faint plate with ?</B>, "May or may not exist, because of a range."],
            [<B key="l">+</B>, "There may be more, because the count has no upper limit."],
            [<B key="m">Cyan ring</B>, "The page view your hook returns, inside its session."],
            [<B key="n">Red diagonal lines</B>, "Excluded: matching rows must NOT look like this."],
            [<B key="o">Red corner on a plate</B>, "That page must not be something."],
          ]}
        />
        <P>The same legend is in the corner of the preview as <B>What the shapes mean</B>.</P>
      </Section>

      <Section title="When a picture appears">
        <DataTable
          head={["Your hook returns", "You see"]}
          rows={[
            [<B key="a">sessions</B>, "A session figure, always. An empty session hook shows one page, maybe more."],
            [<B key="b">page views</B>, "A big single page for the page's own conditions, plus its session when your hook involves the session."],
            [<B key="c">pages, form activity, form fields</B>, "A page with a form."],
            [<B key="d">form submissions (leads)</B>, "A session figure, but only when you describe the session (its session, converted, or the submitted-on page). A plain filter like name contains hanna draws nothing."],
            [<B key="e">visitors</B>, "One picture per session you describe. Visitor fields alone draw nothing."],
            [<B key="f">away periods</B>, "A session with the described away period."],
          ]}
        />
        <P>
          A page view &quot;involves its session&quot; when you use <B>its session</B>, <B>session converted</B>, <B>is the landing page</B>, <B>is the exit page</B>, <B>page number in the session</B>, or the next or previous pages.
        </P>
        <P>
          Conditions that have no shape (dates, campaign, country, session length) appear as plain text chips under the picture, so nothing you wrote is hidden.
        </P>
      </Section>

      <Section title="Ranges and counts">
        <DataTable
          head={["You write", "You see"]}
          rows={[
            ["Exactly 4 pages", "4 plates."],
            ["Between 2 and 5 pages", "2 solid plates and up to 3 faint ones, labelled \"2 to 5 pages\"."],
            ["At least 3 pages", "3 plates and a +."],
            ["Has a page view of /blogs", "A /blogs plate and a + (it is one of possibly more)."],
          ]}
        />
      </Section>

      <Section title="Alternatives, exclusions and sub-hooks">
        <UL>
          <li>
            <B>match any (OR)</B> draws one picture per option, titled &quot;option 1 of 2&quot;.
          </li>
          <li>
            <B>exclude (NOT)</B> draws an extra picture crossed with red diagonal lines, titled &quot;Not this&quot;.
          </li>
          <li>
            <B>Sub-hooks</B> get their own smaller pictures under &quot;Sub-hooks, flowing in through tunnels&quot;, saying which value they flow into.
          </li>
        </UL>
      </Section>

      <Section title="Sequences">
        <P>
          <B>The next page</B>, <B>the previous page</B>, <B>the pages after it</B> and <B>the pages before it</B> are drawn in order, with captions such as &quot;next page&quot; and &quot;later&quot;. See{" "}
          <Link href="/docs/hook/connected-rows" className="text-[var(--lime)] hover:underline">
            Journeys
          </Link>
          .
        </P>
      </Section>

      <Section title="When it says nothing matches">
        <Callout title="Contradictions">
          <p>
            If what you described cannot match anything, the preview says so. For example, &quot;at most 1 page&quot; together with &quot;at least 2 pages of /a&quot; reads &quot;this part matches nothing&quot;. Fix the contradiction before you run.
          </p>
        </Callout>
        <P>
          Want to know why a shape appears, or why one does not? See{" "}
          <Link href="/docs/preview/how-it-works" className="text-[var(--lime)] hover:underline">
            How the preview works
          </Link>
          .
        </P>
      </Section>

      <DocFooter feature="preview" />
    </div>
  );
}
