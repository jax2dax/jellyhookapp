import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Supported forms",
  description: "Which lead forms Jellyhook tracks (HubSpot, Salesforce, Marketo, WordPress plugins, Typeform and more), where to put the attribute for each, and which cannot be tracked.",
  alternates: { canonical: "/docs/concepts/supported-forms" },
};

const BLOCK = "overflow-x-auto border border-[#1b1b18] bg-[#0a0a09] p-4 ff-mono text-[12px] leading-relaxed text-[#4fc3ff]";

function Code({ children }: { children: string }) {
  return (
    <pre className={BLOCK}>
      <code>{children}</code>
    </pre>
  );
}

export default function SupportedFormsPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Core concepts"
        title="Supported forms"
        intro="Jellyhook records the leads your forms collect, whatever tool made the form. This page lists what works, how to mark your form for each tool, and the few cases that cannot be tracked, so you know before you install."
      />

      <Section title="The short version">
        <UL>
          <li>
            <B>Forms that appear on your own pages</B> are tracked with name, email and phone. That is almost every form: your own HTML, WordPress form plugins, HubSpot, Salesforce Web-to-Lead, Pardot form handlers, Marketo, Mailchimp and most website builders.
          </li>
          <li>
            <B>Forms inside an iframe</B> belong to another website, so your page cannot read them. Typeform, Calendly and Jotform announce submissions, so each one is counted as a lead <B>without name or email</B>. Other iframes (a Pardot iframe form, Zoho, Pipedrive, Google Forms) cannot be tracked at all.
          </li>
          <li>
            Settings, Tracking, Attribute check shows which of your pages have a form that cannot be tracked.
          </li>
        </UL>
      </Section>

      <Section title="What works, by tool">
        <DataTable
          head={["Tool", "How it appears on your page", "What you get"]}
          rows={[
            [<B key="a">Your own HTML or React form</B>, "A form on the page", "Name, email, phone, every field. Works even when the form submits with JavaScript instead of a page reload."],
            [<B key="b">HubSpot (script embed)</B>, "A form rendered into the page", "Name, email, phone, every field."],
            [<B key="b2">HubSpot (iframe embed)</B>, "An iframe that reports to the page", "Name, email and fields, when HubSpot reports the submission to your page."],
            [<B key="c">Salesforce Web-to-Lead</B>, "A plain HTML form that posts to Salesforce", "Name (first and last), email, phone, company, every field."],
            [<B key="d">Pardot / Account Engagement form handler</B>, "Your own HTML form that posts to Pardot", "Name, email, every field."],
            [<B key="e">Pardot / Account Engagement form (iframe)</B>, "An iframe from go.pardot.com or your own tracker domain", "Cannot be tracked. Use a form handler instead."],
            [<B key="f">Marketo Forms 2.0</B>, "A form rendered into the page by script", "Name, email, phone, every field."],
            [<B key="g">Mailchimp embedded form</B>, "A form that posts to Mailchimp", "Email and name, every field. Its hidden spam-trap field is ignored."],
            [<B key="h">Contact Form 7, Gravity Forms, WPForms</B>, "A form rendered by the plugin", "Name (first and last), email, phone, every field."],
            [<B key="i">Typeform</B>, "An iframe or pop-up", "A lead without name or email when someone submits."],
            [<B key="j">Calendly</B>, "An inline or pop-up scheduler", "A lead without name or email when someone books."],
            [<B key="k">Jotform (iframe)</B>, "An iframe", "A lead without name or email when someone submits."],
            [<B key="l">Zoho Forms, Pipedrive Web Forms, Google Forms (iframe)</B>, "An iframe", "Cannot be tracked."],
          ]}
        />
        <Callout title="How this was checked">
          <p>
            Each row marked with a form on your page was tested in a real browser against that tool&apos;s standard markup, by typing into the form and submitting it. The iframe rows were tested by simulating the message those providers document sending to your page. Vendors can change their markup; if a form stops being captured, tell support which tool and which embed option you use.
          </p>
        </Callout>
      </Section>

      <Section title="Where to put the attribute">
        <P>
          If your site is set to <B>Only the form I label</B> (recommended), the form you want counted must carry <C>data-conversion=&quot;true&quot;</C>. You can put it on the <C>&lt;form&gt;</C> itself, or on <B>any element around the form</B>. The second option is what you use for forms a tool builds for you, because you cannot edit the form tag it produces.
        </P>
        <H3>A form you can edit (your own HTML, Web-to-Lead, a Pardot form handler, a Mailchimp embed)</H3>
        <Code>{`<form data-conversion="true" action="..." method="post">\n  ...\n</form>`}</Code>
        <H3>HubSpot, Marketo and other script embeds</H3>
        <P>Wrap the embed in an element that carries the attribute.</P>
        <Code>{`<div data-conversion="true">\n  <script src="//js.hsforms.net/forms/embed/v2.js"></script>\n  <script>\n    hbspt.forms.create({ portalId: "...", formId: "..." });\n  </script>\n</div>`}</Code>
        <H3>WordPress form plugins (Contact Form 7, Gravity Forms, WPForms)</H3>
        <P>
          Put the plugin&apos;s shortcode or block inside a Custom HTML block that adds the wrapper:
        </P>
        <Code>{`<div data-conversion="true">\n  [contact-form-7 id="123" title="Contact"]\n</div>`}</Code>
        <H3>Typeform, Calendly, Jotform</H3>
        <Code>{`<div data-conversion="true">\n  <iframe src="https://form.typeform.com/to/..."></iframe>\n</div>`}</Code>
        <P>
          Sites set to <B>Every form on my site</B> need no attribute for any of these.
        </P>
      </Section>

      <Section title="Choosing which fields are tracked">
        <P>
          By default every field of a form is tracked (recommended). To track only some, add <C>data-track-field</C> to those inputs. See{" "}
          <Link href="/docs/concepts/tracking-attributes" className="text-[var(--lime)] hover:underline">
            Tracking attributes
          </Link>
          . This applies to forms on your own page; it cannot reach inside an iframe.
        </P>
      </Section>

      <Section title="Forms that cannot be tracked, and what to do instead">
        <P>
          A form inside an iframe is a page from another website shown inside yours. Browsers do not let your page see inside it, and neither can Jellyhook. The fix is never a Jellyhook setting; it is to show the tool&apos;s form on your own page instead of in an iframe:
        </P>
        <DataTable
          head={["If you use", "Use this instead"]}
          rows={[
            [<B key="a">Pardot iframe form</B>, "A Pardot form handler: build the form in your site and let Pardot receive the submission. Pardot keeps scoring and routing the lead."],
            [<B key="b">Salesforce hosted form pages</B>, "Salesforce Web-to-Lead, which is plain HTML on your page."],
            [<B key="c">Zoho Forms iframe</B>, "Zoho's JavaScript embed option, which renders the form in your page."],
            [<B key="d">Pipedrive web form (embed)</B>, "Your own form on your page, with the Pipedrive integration or its API receiving the submission."],
            [<B key="e">Google Forms</B>, "A form on your own page. Google Forms cannot be tracked from outside."],
          ]}
        />
        <Callout title="Leads without a name or email">
          <p>
            A lead counted from Typeform, Calendly or Jotform has no name or email, because the iframe never shares them. It still counts as a conversion and ties to the visitor&apos;s whole visit, so the visit chart and conversion paths work. It shows a dash in the Leads list. Your CRM holds the person&apos;s details.
          </p>
        </Callout>
      </Section>

      <Section title="Check it yourself">
        <P>
          Open Settings, then Tracking, then Attribute check. <B>Conversion form</B> says whether a marked form was found and whether a real lead has come from it. <B>Forms inside an iframe</B> lists the pages that have a form the tracker can only count (Typeform, Calendly, Jotform) or cannot see at all, with the tool&apos;s name. See{" "}
          <Link href="/docs/concepts/tracking-attributes" className="text-[var(--lime)] hover:underline">
            Tracking attributes
          </Link>{" "}
          for the four states.
        </P>
      </Section>
    </div>
  );
}
