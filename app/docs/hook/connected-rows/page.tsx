import type { Metadata } from "next";
import { DocHeader, Section, H3, P, UL, B, Callout, Example, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Connected rows, groups and journeys",
  description: "How to ask about the rows connected to a row, combine conditions with any of and none of, and follow visitors from page to page.",
  alternates: { canonical: "/docs/hook/connected-rows" },
};

export default function ConnectedRowsPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Connected rows, groups and journeys"
        intro="Real questions are rarely about one row on its own. They are about the pages inside a session, the forms behind a lead, the page someone saw next. This page covers how to ask about all of that."
      />

      <Section title="Connected rows">
        <P>
          Every kind of row is connected to others. A session has page views, away periods, form submissions, form activity and its visitor. A form has its fields. A page view has its session, its visitor and its forms. Under <B>+ Look at its...</B> you choose a connection, and a box opens where you add conditions for those connected rows.
        </P>
        <P>Then you choose how to use them.</P>
        <DataTable
          head={["Choice", "Meaning", "Example"]}
          rows={[
            [<B key="a">has at least one</B>, "At least one connected row matches.", "Sessions that have a page view where page is /pricing."],
            [<B key="b">count or total</B>, "Measure the connected rows and compare the result with any operator: exactly 2, fewer than 3, between 2 and 5.", "Sessions where the number of page views where page is /blogs is at least 2."],
          ]}
        />
        <H3>Measures you can use</H3>
        <P>
          <B>number of</B>, <B>number of different</B>, <B>total</B>, <B>average</B>, <B>lowest</B>, <B>highest</B>, <B>median</B> and <B>percentile</B>. Which ones are offered depends on the field you measure (you cannot total a text field). The Field reference lists them.
        </P>
        <Callout title="Conditions inside a box apply to the same row">
          <p>
            &quot;Page is /blogs <B>and</B> time on page more than 5 sec&quot; means one page view that is both, not one page view of each. If you want two different page views, add two separate connected-row conditions.
          </p>
        </Callout>
        <P>
          Connected rows can have connected rows of their own: the page views of a session, and the fields of the forms on those page views. There is a limit on how deep you can nest, and Hook tells you if you reach it.
        </P>
        <Example
          title="Sessions with at least 2 page views of /blogs over 5 sec"
          build={
            <>
              <B>Show</B> <B>the number of</B> <B>sessions</B> where <B>+ Look at its...</B> page views, <B>count or total</B>: number of page views, at least 2, where page is /blogs and time on page more than 5 sec.
            </>
          }
          why="Counting pages is how you separate people who skimmed from people who read."
        />
      </Section>

      <Section title="Any of, all of, none of (groups)">
        <P>
          <B>+ Any of / none of</B> adds a group. Inside it, choose <B>match any (OR)</B> or <B>match all (AND)</B>, and tick <B>exclude (NOT)</B> to turn it into &quot;none of these&quot;. Groups nest as deep as you need.
        </P>
        <DataTable
          head={["Group", "Keeps a row when"]}
          rows={[
            [<B key="a">match all (AND)</B>, "Every condition in the group is true. This is also how top-level conditions combine."],
            [<B key="b">match any (OR)</B>, "At least one condition in the group is true."],
            [<B key="c">exclude (NOT)</B>, "None of the conditions in the group is true."],
          ]}
        />
        <Callout title="NOT keeps rows where the value is empty">
          <p>
            &quot;Not campaign source is facebook or google&quot; also keeps sessions that have no campaign at all, because a missing campaign is certainly not facebook. If you only want sessions that have a campaign, add <B>is not empty</B> as well.
          </p>
        </Callout>
        <Example
          title="Sessions that came from neither facebook nor google"
          build={
            <>
              <B>Show</B> <B>the number of</B> <B>sessions</B> where <B>+ Any of / none of</B>, tick <B>exclude (NOT)</B>, and inside it: campaign source (utm) is any of facebook, google.
            </>
          }
          why="Everything else, including direct visits, in a single count."
        />
      </Section>

      <Section title="Journeys: the page before and after">
        <P>
          Every page view has four extra connections under <B>+ Look at its...</B>:
        </P>
        <UL>
          <li>
            <B>the next page</B> and <B>the previous page</B>: the single page view right after or right before this one in the same session.
          </li>
          <li>
            <B>the pages after it</B> and <B>the pages before it</B>: all the page views later or earlier in the session.
          </li>
        </UL>
        <P>
          They work like any other connected rows: <B>has at least one</B>, or <B>count or total</B> with any comparison.
        </P>
        <Example
          title="Visited /pricing before /contact"
          build={
            <>
              <B>Show</B> <B>the number of</B> <B>sessions</B> where <B>+ Look at its...</B> page views, <B>has at least one</B> where page is /contact, and inside it <B>+ Look at its...</B> the pages before it, <B>has at least one</B> where page is /pricing.
            </>
          }
          why="Tells you whether the pricing page is part of the path to contact."
        />
        <Example
          title="Exactly 3 pages after converting"
          build={
            <>
              <B>Show</B> <B>the number of</B> <B>sessions</B> where <B>+ Look at its...</B> page views, <B>has at least one</B> where converted on this page is true, and inside it the pages after it, <B>count or total</B>: number of, is 3.
            </>
          }
        />
        <Example
          title="What people open right after the homepage"
          build={
            <>
              <B>Show</B> <B>a breakdown:</B> number of page views, for each page, where <B>+ Look at its...</B> the previous page matches, where page is /.
            </>
          }
          why="A ranked list of the next step from your homepage."
        />
        <P>The preview draws these in order, so you can see the path you described before you run it.</P>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
