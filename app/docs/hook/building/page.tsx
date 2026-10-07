import type { Metadata } from "next";
import Link from "next/link";
import { SCHEMA, type EntityKey } from "@/jh-hook/schema";
import { DocHeader, Section, P, UL, OL, B, C, Callout, Example, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Build a question",
  description: "How to choose what you look at, add conditions and values, pick the output and run a Hook question.",
  alternates: { canonical: "/docs/hook/building" },
};

// One line per kind of row. Typed as a full Record: adding an entity to Hook without describing it
// here is a compile error, so this table cannot silently miss one.
const ENTITY_DOCS: Record<EntityKey, { means: string; asks: string }> = {
  pageView: { means: "one visit to one page", asks: "which pages hold attention, how far people scroll" },
  session: { means: "one visit to your site, start to finish", asks: "which journeys convert, where people come from" },
  lead: { means: "one submitted form", asks: "who your leads are, where they converted" },
  visitor: { means: "one browser or person", asks: "devices, returning visitors" },
  form: { means: "one form seen by one visitor in one session", asks: "how many started, finished, abandoned" },
  formField: { means: "one field of a form that someone clicked into", asks: "where people stall on a form" },
  page: { means: "one page address of your site", asks: "ranking pages" },
  awayGap: { means: "a stretch of 15 seconds or more when a visitor left your site and came back", asks: "how long people stay away" },
};

export default function BuildingPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Build a question"
        intro="Everything you need to build a question from nothing: choosing what you look at, adding conditions, typing values correctly, choosing what comes back, and running it."
      />

      <Section title="1. Choose what you are looking at">
        <P>
          The menu after <B>of</B> decides what one row is. Everything else in the question refers to that row.
        </P>
        <DataTable
          head={["Choice", "One row is", "Typical questions"]}
          rows={(Object.keys(SCHEMA) as EntityKey[]).map((k) => [<B key={k}>{SCHEMA[k].plural}</B>, ENTITY_DOCS[k].means, ENTITY_DOCS[k].asks])}
        />
        <P>
          An <B>away period</B> is the time between one page view ending and the next starting in the same session, when it lasts 15 seconds or more. It is the same rule the visit chart useslay uses to draw a purple away bar.
        </P>
        <P>
          <B>Form fields</B> has one row per field someone clicked into. That is the data behind questions about where people give up on a form. See{" "}
          <Link href="/docs/hook/examples" className="text-[var(--lime)] hover:underline">
            the form examples
          </Link>
          .
        </P>
      </Section>

      <Section title="2. Add conditions">
        <P>Three buttons sit under every list of conditions.</P>
        <DataTable
          head={["Button", "What it does"]}
          rows={[
            [<B key="a">+ Condition</B>, "Tests one value of the row: \"page is /blogs\", \"session length more than 2 min\", \"campaign source (utm) is any of facebook, google\"."],
            [<B key="b">+ Look at its...</B>, "Tests the rows connected to this one. See Connected rows."],
            [<B key="c">+ Any of / none of</B>, "A group: any (OR), all (AND), or none of them (NOT). See Connected rows."],
          ]}
        />
        <P>
          All conditions at the same level must all be true. To say &quot;this or that&quot;, use a group.
        </P>
        <P>
          Field menus are grouped by topic (<B>Which page</B>, <B>When and how long</B>, <B>How much of the page was seen</B>, <B>Place in the session</B> and so on). Hover a field to read exactly what it means. The full list is in the{" "}
          <Link href="/docs/hook/field-reference" className="text-[var(--lime)] hover:underline">
            Field reference
          </Link>
          .
        </P>
      </Section>

      <Section title="3. Values, units and time">
        <P>Every field has a type, and the type decides which comparisons you are offered and what the value box looks like.</P>
        <DataTable
          head={["Type", "Comparisons", "How you type the value"]}
          rows={[
            [<B key="n">Numbers, durations, percentages, pixels</B>, "is, is not, more than, at least, less than, at most, between, not between, is empty", "A number. Durations in any unit: ms, sec, min, hr, day. Percentages as the plain number (30 means 30%)."],
            [<B key="t">Text</B>, "is, is not, is any of, is none of, contains, does not contain, starts with, ends with, is empty", "Text. For lists, type a value and press Enter for each one. Your own site's values are suggested."],
            [<B key="d">Date and time</B>, "after, on or after, before, on or before, between, not between, is empty", "Choose time ago (\"7 days ago\") or exact date."],
            [<B key="e">One of a fixed list</B>, "is, is not, is any of, is none of", "Pick from the allowed values."],
            [<B key="y">Yes / no</B>, "is true, is false, is empty", "Nothing to type."],
          ]}
        />
        <UL>
          <li>
            <B>Ranges:</B> choose <B>between</B> and give two values, including durations (&quot;between 3 sec and 5 sec&quot;).
          </li>
          <li>
            <B>Empty checks:</B> <B>is empty</B> and <B>is not empty</B> work on any type. A value can be empty, for example <B>left at</B> while a visitor is still on the page.
          </li>
          <li>
            Every value has a coloured badge with its type. The same colour always means the same kind of value, and each condition&apos;s left edge carries the colour of what it tests.
          </li>
        </UL>
      </Section>

      <Section title="4. Choose what you want back">
        <DataTable
          head={["Choice", "You get", "Example"]}
          rows={[
            [<B key="a">the number of</B>, "One number.", "How many sessions converted."],
            [<B key="b">the number of different (unique)</B>, "One number, counting each value once.", "How many different pages were visited."],
            [<B key="c">a calculation:</B>, "One value: average, total, lowest, highest, median or percentile of a field.", "Average time on page."],
            [<B key="d">a list of sessions</B>, "The matching rows themselves. The name follows what you look at (a list of leads, a list of page views). Results draw them as cards and visit charts; as a sub-hook the list is handed over as ids.", "The sessions that match."],
            [<B key="e">a list of ... values</B>, "The different values of one field.", "Which campaign sources brought leads."],
            [<B key="f">a breakdown:</B>, "A table: one measure per value of a field, or per hour, day, week or month. Sort it, and keep the top N.", "Page views per page; sessions per day."],
          ]}
        />
        <P>
          The line under the menu says exactly what the hook returns, for example &quot;Returns number: single value, a number (how many sessions)&quot;. That line is also what decides where a sub-hook can be used.
        </P>
      </Section>

      <Section title="5. Run it">
        <OL>
          <li>
            Read the <B>Reads as:</B> line. If it says something you did not mean, fix the condition now.
          </li>
          <li>
            Press <B>Run hook</B>. The answer appears under the builder, with its cost in credits.
          </li>
          <li>
            Open <B>How it ran</B> to see the order Hook used and why.
          </li>
        </OL>
        <P>
          The answer is drawn as what it is, not as a table of ids. See <Link href="/docs/results" className="text-[var(--lime)] hover:underline">The results</Link>.
        </P>
      </Section>

      <Section title="A complete example, step by step">
        <Example
          title="Sessions that read /blogs for real but did not convert"
          build={
            <>
              <B>Show</B> <B>the number of</B> <B>sessions</B> where:
              <UL>
                <li>
                  <B>+ Look at its...</B> page views, <B>count or total</B>: number of page views, at least 2, where page is /blogs and time on page more than 5 sec;
                </li>
                <li>
                  <B>+ Condition</B>: converted is false.
                </li>
              </UL>
            </>
          }
          why="These are people the content reached but did not persuade."
        />
      </Section>

      <Section title="Good to know">
        <Callout title="Time on page: two fields">
          <p>
            <B>Time on page</B> is what the visit chart shows. <B>Time on page (browser timer)</B> is the browser&apos;s own stopwatch, and the two can differ by a second or more. Use <B>time on page</B> to match what you see in the visit chart.
          </p>
        </Callout>
        <Callout title="Share of page seen is sometimes empty">
          <p>
            For older visits whose screen height was never recorded, <B>share of page seen</B> is empty. Hook never guesses it, because a guessed percentage would be worse than none.
          </p>
        </Callout>
        <UL>
          <li>
            <B>Fields touched</B> counts only fields someone clicked into, so it is a lower bound.
          </li>
          <li>
            Errors say what to change. If something breaks on our side you get a short reference code to quote to support.
          </li>
          <li>
            Names, notes and layout travel with the question when you share it. See <Link href="/docs/hook/organizing" className="text-[var(--lime)] hover:underline">Organize, share and run</Link>.
          </li>
        </UL>
        <P>
          Next: <Link href="/docs/hook/connected-rows" className="text-[var(--lime)] hover:underline">Connected rows, groups and journeys</Link>. For details of any field, see the <C>Field reference</C>.
        </P>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
