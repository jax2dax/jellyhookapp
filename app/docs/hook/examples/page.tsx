import type { Metadata } from "next";
import { DocHeader, Section, B, Example, P, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Hook worked examples",
  description: "Twenty-four ready-to-build Hook questions for marketing, content, sales, form friction, journeys and comparisons.",
  alternates: { canonical: "/docs/hook/examples" },
};

export default function ExamplesPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Worked examples"
        intro="Each example says how to build it and why it is useful. Replace the page paths, dates and campaign names with your own. Labels in bold are exactly as they appear on screen."
      />

      <Section title="Marketing">
        <Example
          title="Readers your campaign reached but did not persuade"
          build={
            <>
              <B>Show</B> <B>the number of</B> sessions where started at is after (exact date: your launch time); <B>+ Look at its...</B> page views, <B>count or total</B>: number of page views, at least 2, where page is /blogs and time on page more than 5 sec; converted is false.
            </>
          }
          why="People the content reached but did not persuade."
        />
        <Example title="Which campaigns bring leads" build={<><B>Show</B> <B>a breakdown:</B> number of sessions, for each campaign source (utm), where converted is true. Sort <B>biggest first</B>.</>} why="Your best sources, ranked." />
        <Example title="Landing pages of sessions that converted" build={<><B>Show</B> <B>a list of ... values</B> of landing page, of sessions where converted is true.</>} why="Where converting visits start." />
        <Example title="Pages with the most views this week" build={<><B>Show</B> <B>a breakdown:</B> number of page views, for each page, where entered at is after 7 days ago. Top 10.</>} />
        <Example title="Mobile visitors who never came back" build={<><B>Show</B> <B>the number of</B> visitors where device is mobile and <B>+ Look at its...</B> sessions, <B>count or total</B>: number of sessions is 1.</>} why="Whether the mobile experience brings people back." />
      </Section>

      <Section title="Content and engagement">
        <Example title="How much of /pricing people actually see" build={<><B>Show</B> <B>a calculation:</B> average share of page seen, of page views where page is /pricing.</>} why="A page nobody scrolls through is not doing its job." />
        <Example title="Readers who went back over the content" build={<><B>Show</B> <B>the number of</B> page views where page is /blogs and share of page seen 2x+ is at least 20%.</>} />
        <Example title="Visits that bounced fast" build={<><B>Show</B> <B>the number of</B> sessions where <B>+ Look at its...</B> page views, <B>count or total</B>: number of page views is 1, and session length is less than 10 sec.</>} />
        <Example title="Where long sessions end" build={<><B>Show</B> <B>a breakdown:</B> number of sessions, for each exit page, where session length is more than 3 min.</>} why="The pages that close a long visit, converting or not." />
        <Example title="Time spent away" build={<><B>Show</B> <B>a calculation:</B> median time away, of away periods.</>} />
      </Section>

      <Section title="Sales">
        <Example
          title="Everything a specific lead viewed"
          build={<><B>Show</B> <B>a list of ... values</B> of page, of page views where visitor id is any of [sub-hook: <B>a list of ... values</B> of visitor id, of form submissions (leads) where name contains &quot;hanna&quot;].</>}
          why="Context for a call: what this person read before they wrote."
        />
        <Example title="Leads who looked at pricing before converting" build={<><B>Show</B> <B>the number of</B> form submissions (leads) where <B>+ Look at its...</B> its session matches, with its page views: <B>has at least one</B> where page is /pricing.</>} />
        <Example title="Qualified leads from Google" build={<><B>Show</B> <B>the number of</B> form submissions (leads) where marked qualified by sales is true and its session matches, where campaign source (utm) is google.</>} />
        <Example title="Leads who converted on the first page" build={<><B>Show</B> <B>the number of</B> page views where converted on this page is true and page number in the session (1 = first) is 1.</>} why="Visitors who needed no convincing." />
      </Section>

      <Section title="Form friction">
        <Example title="Where people give up" build={<><B>Show</B> <B>a breakdown:</B> number of form fields, for each field, where last field touched is true and form status is abandoned. Biggest first.</>} why="The field that ends the most forms." />
        <Example title="The slowest fields" build={<><B>Show</B> <B>a breakdown:</B> average time spent in the field, for each field. Biggest first.</>} />
        <Example title="Fields people click but do not type in" build={<><B>Show</B> <B>the number of</B> form fields where typed in it is false.</>} />
        <Example title="Abandoned forms that stopped on the phone field" build={<><B>Show</B> <B>the number of</B> form activity where status is abandoned and <B>+ Look at its...</B> its fields, <B>has at least one</B> where last field touched is true and field is phone.</>} />
        <Example title="Time from seeing a form to typing" build={<><B>Show</B> <B>a calculation:</B> median time from seeing to typing, of form activity.</>} />
        <P>Remember that fields touched counts only fields someone clicked into, so it is a lower bound.</P>
      </Section>

      <Section title="Journeys">
        <Example title="Visited /pricing before /contact" build={<><B>Show</B> <B>the number of</B> sessions where <B>+ Look at its...</B> page views, <B>has at least one</B> where page is /contact and the pages before it <B>has at least one</B> where page is /pricing.</>} />
        <Example title="Exactly 3 pages after converting" build={<><B>Show</B> <B>the number of</B> sessions where page views <B>has at least one</B> where converted on this page is true and the pages after it, <B>count or total</B>: number of, is 3.</>} />
        <Example title="What people open right after the homepage" build={<><B>Show</B> <B>a breakdown:</B> number of page views, for each page, where the previous page matches, where page is /.</>} />
      </Section>

      <Section title="Comparisons and benchmarks">
        <Example
          title="Does /pricing help conversion?"
          build={<>Use <B>Compare with another hook</B>. Hook A: <B>the number of</B> sessions where converted is true and has a page view of /pricing. Hook B: <B>the number of</B> sessions where converted is true. Result: <B>A / B x 100 (%)</B>.</>}
          why="The share of all conversions that passed through /pricing."
        />
        <Example title="Above-average engagement" build={<><B>Show</B> <B>the number of</B> page views where time on page is more than [sub-hook: <B>a calculation:</B> average time on page, of page views where page is /pricing].</>} />
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
