import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Form fields",
  description: "How Jellyhook names the fields of your forms, why some have no name, and how to name them so marks can filter leads by their answers.",
  alternates: { canonical: "/docs/reference/form-fields" },
};

export default function FormFieldsReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Feature reference"
        title="Form fields"
        intro="Marks can find leads by their form answers, such as a budget, once Jellyhook knows which field holds it. Jellyhook reads each field's name from your page. When your page gives a field no name, you name it once in Settings."
      />

      <Section title="When you would use it">
        <P>
          Your contact form asks for a budget. You want a mark for leads with a budget over $3,000. If your page labels that field &quot;Budget&quot;,
          the mark finds it. If your page only calls it <C>field_3</C>, nothing can tell it is the budget, so you name it once:{" "}
          <B>Settings</B>, <B>Form fields</B>, type &quot;Budget&quot; next to it.
        </P>
      </Section>

      <Section title="How a field gets its name">
        <P>When a visitor first sees a form, the tracker reads each field&apos;s visible name, in this order:</P>
        <UL>
          <li>its <C>&lt;label&gt;</C> (linked with <C>for</C>, or wrapped around the field);</li>
          <li>its <C>aria-label</C> or <C>aria-labelledby</C>;</li>
          <li>for a group of radio buttons or checkboxes, the group&apos;s <C>&lt;legend&gt;</C>;</li>
          <li>its placeholder text;</li>
          <li>a short piece of text right before it.</li>
        </UL>
        <P>
          A name you give in Settings always wins. When none of these exist, and the field&apos;s own key is generated (<C>field_3</C>, <C>input_17</C>,{" "}
          <C>q12</C>), the field shows as <B>Needs a name</B>.
        </P>
        <Callout title="The best fix is on your page">
          Give every field a <C>&lt;label&gt;</C>. It helps your visitors and screen readers too, and Jellyhook reads it on its own. Naming in Settings is
          for forms you cannot change, such as forms from a form builder.
        </Callout>
      </Section>

      <Section title="What you see in Settings → Form fields">
        <UL>
          <li>Every field of your forms, the ones that need a name first.</li>
          <li>For each: the name used by marks, what the page calls it (or &quot;no visible name&quot;), its key, its kind, its choices, and how many of your recent leads answered it.</li>
          <li>A box to type your own name. It saves when you leave the box or press Enter. Empty the box to go back to the page&apos;s name.</li>
        </UL>
        <H3>Kinds of field</H3>
        <DataTable
          head={["Kind", "What it is", "What a mark can check"]}
          rows={[
            [<B key="a">Number</B>, "A number box, a slider, a text box where most answers are numbers, or a dropdown of ranges like $1k-$5k", "more than, at least, less than, at most, equal to, between"],
            [<B key="b">One choice</B>, "A dropdown or radio buttons", "is, is one of, is not"],
            [<B key="c">Several choices</B>, "A group of checkboxes", "includes"],
            [<B key="d">Yes / no</B>, "A single checkbox", "checked, not checked"],
            [<B key="e">Text</B>, "Free text", "contains, empty, not empty"],
          ]}
        />
      </Section>

      <Section title="How answers are read as numbers">
        <P>
          Visitors write numbers in many ways. Jellyhook reads <C>5000</C>, <C>$5,000</C>, <C>5k</C>, <C>1.5k</C>, <C>2 million</C>, ranges like{" "}
          <C>$1k - $5k</C> or <C>10 to 20</C>, and open ones like <C>under 10k</C> or <C>50k+</C>. An answer with no number in it (&quot;not sure&quot;)
          never matches a number condition.
        </P>
        <P>
          A range matches when any part of it does. A lead who picked <C>$1k-$5k</C> matches &quot;budget at least 3,000&quot; (5,000 is) and
          &quot;budget at most 2,000&quot; (1,000 is).
        </P>
      </Section>

      <Section title="When a field cannot be found">
        <P>
          If you name a field in a mark, or in Enter with AI, that none of your forms has, Jellyhook says so and lists the fields it knows. From there,
          <B> Name your form fields</B> opens Settings at the first field that needs a name. The usual cause: the field exists, but your page gives it no
          name.
        </P>
      </Section>

      <Section title="What is collected">
        <UL>
          <li>Field names, kinds, choices and limits are read from the page. They are not answers.</li>
          <li>Answers are kept with the lead, as before. Radio buttons and checkboxes are now included (the picked choice, or &quot;yes&quot; for a box with no value).</li>
          <li>Card, bank and identity numbers are never collected, and neither are passwords or hidden fields.</li>
          <li>Answers are never sent to the AI and never in Slack or webhook messages.</li>
        </UL>
      </Section>

      <Section title="Limits">
        <UL>
          <li>A field appears after a visitor sees the form with the current tracker. Forms nobody has opened since are not listed yet.</li>
          <li>Leads from before radio buttons and checkboxes were collected have no answer for those fields.</li>
          <li>A slider always sends its position, even when the visitor did not move it.</li>
          <li>Forms inside an iframe from another website (for example Typeform or Google Forms) cannot be read.</li>
        </UL>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/leads" className="text-[var(--lime)] hover:underline">Leads page</Link>,{" "}
          <Link href="/docs/reference/notifications" className="text-[var(--lime)] hover:underline">Notifications</Link>,{" "}
          <Link href="/docs/reference/settings" className="text-[var(--lime)] hover:underline">Site settings</Link>.
        </P>
      </Section>
    </div>
  );
}
