import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Marks",
  description: "Mark the leads you care about by what they did before sending your form: visits, pages, headings, answers and how they filled it.",
  alternates: { canonical: "/docs/reference/marks" },
};

export default function MarksReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Feature reference"
        title="Marks"
        intro="Which new leads are worth a call first? A mark is a set of conditions on what a lead did before sending your form. Every lead that meets them gets the mark's coloured badge on the Leads page, and a notification rule can tell your team the moment one arrives."
      />

      <Section title="When you would use it">
        <P>
          Your best customers usually find you on Google, come back later, read your offers and pick a budget over $3,000. You make a mark with exactly
          that. From then on, every lead who did the same carries the badge, and the others are dimmed when you apply it.
        </P>
      </Section>

      <Section title="Building a mark">
        <P>
          On the Leads page, in the Marks panel, press the <B>+</B> button (New mark). Describe the leads in your own words with <B>Enter with AI</B>, or build it by hand
          with <B>Enter manually</B>. Either way you see the conditions and can change them before saving.
        </P>
        <H3>The three starting points</H3>
        <DataTable
          head={["Button", "What it adds"]}
          rows={[
            [<B key="a">Visit condition</B>, "A visit card: which visit, and conditions on the visit as a whole (length, pages seen, a heading read anywhere in it, device, and where it came from: a platform, an ad or free, a campaign, a specific ad)."],
            [<B key="b">Page condition</B>, "A page in the visit they sent the form in, with conditions on that page (time on it, share of it seen, a heading read on it, times viewed)."],
            [<B key="c">Form condition</B>, "What they answered (budget, service...) or how they filled the form (fill time, hesitation on a field, a field left empty, leaving the form while filling)."],
          ]}
        />
        <H3>Which visit</H3>
        <UL>
          <li><B>The visit they sent the form in</B> (the default), also offered as <B>Their last visit</B>: the same visit.</li>
          <li><B>Any visit</B>, <B>Their first visit</B>, or <B>Visit number</B> (counted from their first visit ever: exactly 4, after the 4th, between the 4th and the 5th).</li>
          <li><B>Every visit</B> (under More): each visit up to sending must meet it.</li>
        </UL>
        <H3>Then, a later visit</H3>
        <P>
          On a visit card, <B>Then, a later visit</B> adds a visit that must come after it (any later visit, or a visit number). Chain up to three. A second
          card on its own (<B>Another visit</B>) is a separate visit that must also have happened, in any order.
        </P>
        <H3>Pages in order</H3>
        <P>
          With two or more pages in a visit, choose <B>in any order</B> or <B>in this order</B>. In order, each page says how it follows the one before:{" "}
          <B>right after</B> (the very next page) or <B>later in the same visit</B>.
        </P>
        <H3>Headings</H3>
        <P>
          A heading is picked from the page&apos;s real headings: type part of its name. It can be <B>read</B> (on screen for at least 1 second, and for how
          long if you say so) or <B>not read</B> (never on screen for 1 second; scrolling past does not count). Under More: the share of the page&apos;s or the
          visit&apos;s reading that went to it.
        </P>
      </Section>

      <Section title="Enter with AI">
        <P>
          Write what you want, for example: leads that read our <C>&quot;What we do&quot;</C> section for more than 20 seconds, then went straight to pricing and read{" "}
          <C>&quot;Offers&quot;</C> for 20 seconds, with a budget over $30. Put section names in quotes so they are not mixed up with the rest of the sentence.
        </P>
        <UL>
          <li>It knows your form fields by name, so &quot;budget&quot; finds your budget field. If none of your fields fits, it says so and offers to name your fields.</li>
          <li>It knows sales words: &quot;hesitation&quot; is the time between clicking into a field and typing; &quot;rushed&quot; is a short fill time; &quot;came back&quot; is a later visit. When such a word comes with no number, it asks one question, for example how many seconds counts as hesitation.</li>
          <li>It sees your pages, your form fields and only the headings your sentence names. It never sees any lead&apos;s answers or visits.</li>
        </UL>
      </Section>

      <Section title="Preview, and which leads are checked">
        <UL>
          <li><B>Preview.</B> While you build a mark, it is tried on your last 100 leads: &quot;9 of your last 100 leads match&quot;, with the first few and why. Nothing is saved.</li>
          <li><B>New leads.</B> While a mark is on, every new lead is checked when the form is sent, and again when that visit ends.</li>
          <li>
            <B>Past leads.</B> When you save a new or changed mark, or turn one on, you choose which earlier leads to check too: <B>Last 30 days</B> (the
            default), <B>Last 90 days</B>, <B>All leads</B>, or <B>None, only new leads</B>. Each choice shows how many leads it covers. They are checked in the
            background, newest first: the save does not wait, and the mark shows &quot;checking 120 of 412&quot; until it is done.
          </li>
          <li><B>Off</B> means not checked: while a mark is off, new leads are not checked and its badges are hidden. Turning it on asks the past-leads question again.</li>
          <li><B>Changing the rule</B> clears the old results: a badge always belongs to the rule you see.</li>
          <li><B>Not checked.</B> When you apply a mark, a lead it never checked (older than your choice, sent while it was off, or not reached yet) says &quot;not checked&quot; instead of looking like it does not match.</li>
          <li><B>Re-check its leads</B> (in the mark&apos;s menu) checks the same leads again, in the background.</li>
        </UL>
      </Section>

      <Section title="How it is checked">
        <UL>
          <li>Only what happened before the lead sent the form counts. A badge never changes because of what they did afterwards.</li>
          <li>A lead is checked against the conditions in a fixed order, the cheapest first (answers, then how the form was filled, then visits). The first condition it fails ends the check for that lead.</li>
          <li>The numbers are the ones the lead&apos;s visit chart shows: time on a page is from opening it to leaving it, time per heading counts stays of 1 second or more.</li>
          <li>A range answer matches when any part of it qualifies: &quot;$1k-$5k&quot; meets &quot;budget at least 3,000&quot;.</li>
          <li>The badge shows why: for example <C>Budget: $1k-$5k</C>, <C>visit 2: /pricing 2 min &gt; /contact</C>.</li>
        </UL>
        <Callout title="When a condition cannot be known">
          A visit recorded before time per heading existed (before October 2026) cannot prove a heading was or was not read, so heading conditions do
          not match it. A form whose activity was not recorded cannot meet a condition about how it was filled.
        </Callout>
      </Section>

      <Section title="Limits">
        <UL>
          <li>Everything in a mark must be true (AND). There is no OR yet.</li>
          <li>Up to 6 visits, 3 visits chained with &quot;then&quot;, 8 conditions on a visit or a page, 6 pages in a visit, 6 answer and 6 form conditions.</li>
          <li>No dates or times of day: marks are for spotting good leads as they arrive.</li>
          <li>Marks made with the earlier builder keep opening in it. The marks you add from the library are made that way too, for now.</li>
          <li>&quot;Compared with your other leads&quot; (below normal, normal, above normal time on a section) is planned; it appears once Jellyhook has enough leads to compare.</li>
        </UL>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/form-fields" className="text-[var(--lime)] hover:underline">Form fields</Link>,{" "}
          <Link href="/docs/reference/notifications" className="text-[var(--lime)] hover:underline">Notifications</Link>,{" "}
          <Link href="/docs/reference/leads" className="text-[var(--lime)] hover:underline">Leads page</Link>.
        </P>
      </Section>
    </div>
  );
}
