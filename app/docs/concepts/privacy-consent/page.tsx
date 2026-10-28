import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Privacy and consent",
  description:
    "What the Jellyhook tracker stores, how it follows your cookie banner, how long data is kept, how to erase a person, and text for your own privacy notice.",
  alternates: { canonical: "/docs/concepts/privacy-consent" },
};

const BLOCK = "overflow-x-auto border border-[var(--rule)] bg-[var(--paper-2)] p-4 ff-mono text-[12px] leading-relaxed text-[var(--info)]";
const link = "text-[var(--lime)] hover:underline";

function Code({ children }: { children: string }) {
  return (
    <pre className={BLOCK}>
      <code>{children}</code>
    </pre>
  );
}

const NOTICE = `Visitor analytics (Jellyhook)

We use Jellyhook (jellyhook.com) to understand how visitors use our website before they contact us, so we can answer enquiries better.

What is stored on your device: a random identifier and the state of your current visit, in your browser's local storage. Jellyhook does not use cookies.

What is recorded: the pages you visit, how long you stay, how far you scroll, which headings of a page you reach, the website or campaign that brought you here, your device type, screen size, approximate country and time zone, and clicks on some buttons. On our forms it records how long each field takes and whether it was filled, not what you type. When you send a form, its contents are recorded with your visit. Payment card, bank account and identity numbers are never recorded.

Your IP address is not stored. A one-way hash of it is kept to recognise the same device on the same day. When the country cannot be read otherwise, your IP address is sent once to a lookup service (ipwho.is) and then deleted.

This data is used only by us. It is not sold, and it is not used to follow you on other websites. It is stored by Jellyhook in the United States and kept for [13] months.

If your browser sends Do Not Track or Global Privacy Control, nothing is recorded. [If you refuse analytics in our cookie banner, nothing is recorded.]

To have your data deleted, write to [your contact email] with the email address you used in our form.`;

export default function PrivacyConsentPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Core concepts"
        title="Privacy and consent"
        intro="What the tracker stores, how it follows your cookie banner, how long data is kept, and how to erase a person. This page describes the product. It is not legal advice; you decide what your own site needs."
      />

      <Section title="What the tracker stores in the visitor's browser">
        <P>No cookies. These keys live in the browser&apos;s storage for your site only:</P>
        <DataTable
          head={["Key", "Where", "What it is"]}
          rows={[
            [<C key="a">visitor_id</C>, "local storage", "A random id for the browser. Not a name or an email. Kept until the visitor clears their data."],
            [<C key="b">jh_session</C>, "local storage", "The current visit and when it was last active. A visit ends after 30 minutes without activity."],
            [<C key="c">jh_active, jh_sc, jh_hr</C>, "local storage", "Helpers: which window is in use, when page structure and the health report were last sent."],
            [<C key="d">jh_consent</C>, "local storage", "Only with consent mode: the visitor's answer, so they are not asked again."],
            [<C key="e">jh_ignore</C>, "local storage", "Only on your own browser, after opening a page with ?jh_ignore=1: this browser is never tracked."],
            [<C key="f">jh_outbox</C>, "session storage", "What could not be sent yet, including a submitted form. Retried for up to 30 minutes, deleted once sent and when the tab closes."],
          ]}
        />
        <P>
          A browser that blocks local storage gets the same keys in session storage, which lasts one tab. The IP address is never stored: a salted one-way hash of it and of the
          browser string is kept to count one device as one visitor per day. The full list of what is recorded is in the <Link href="/privacy" className={link}>privacy policy</Link>.
        </P>
      </Section>

      <Section title="Visitors who asked not to be tracked">
        <P>
          When the browser sends <B>Global Privacy Control</B> or <B>Do Not Track</B>, the tracker does nothing: it reads and writes no storage and sends nothing. This cannot
          be turned off.
        </P>
      </Section>

      <Section title="Your cookie banner">
        <P>The tracker reads the banner you already have. No code is needed. It recognises:</P>
        <UL>
          <li>Cookiebot, OneTrust, CookieYes and Complianz</li>
          <li>any banner built on the IAB Transparency and Consent Framework (TCF v2)</li>
          <li>Google Consent Mode (the <C>analytics_storage</C> value), which most other banners and Google Tag Manager set</li>
        </UL>
        <DataTable
          head={["The visitor", "The tracker"]}
          rows={[
            ["Has not answered yet", "Waits. Nothing is stored or sent."],
            ["Accepts analytics or statistics", "Starts at once."],
            ["Refuses", "Stays off and erases anything it stored before."],
            ["Withdraws later", "Stops sending and erases what it stored."],
          ]}
        />
        <P>
          When no banner shows up within one second of the page loading, the tracker runs. <B>Settings, Privacy</B> then shows <B>No banner found</B>, and lists any pages
          where the banner is missing. Sites with visitors from the EU or the UK usually need a banner before tracking.
        </P>
        <H3>Other banners</H3>
        <P>
          For a banner the tracker does not recognise, add <C>data-require-consent</C> to the script tag and call <C>window.jellyhook.consent</C> from the banner:
        </P>
        <Code>{`<script defer src="https://jellyhook.com/tracker.js" data-key="YOUR_KEY" data-require-consent></script>\n\n// when the visitor accepts:\nwindow.jellyhook.consent(true);\n\n// when they refuse or withdraw:\nwindow.jellyhook.consent(false);`}</Code>
        <UL>
          <li>The answer is remembered, so the visitor is not asked again.</li>
          <li><C>consent(false)</C> erases what the tracker stored and reloads the page once.</li>
          <li>Call it after the tracker script has loaded.</li>
          <li>To have the tracker ignore every banner, add <C>data-banner=&quot;ignore&quot;</C> to the script tag.</li>
        </UL>
        <P>With Google Tag Manager, you can also require <C>analytics_storage</C> in the tag&apos;s consent settings.</P>
      </Section>

      <Section title="How long data is kept">
        <P>
          Each site keeps visits, leads and form activity for <B>13 months</B> by default. An owner or admin can choose 6, 13 or 25 months, or keep everything, in{" "}
          <B>Settings, Privacy</B>. Older data is deleted once a day and cannot be recovered.
        </P>
      </Section>

      <Section title="Erasing a person">
        <P>
          When someone asks you to delete their data, an owner or admin opens <B>Settings, Privacy, Erase a person</B> and enters the email they used in your form. Jellyhook
          deletes:
        </P>
        <UL>
          <li>every lead with that email, with its marks, groups, hooks and notifications;</li>
          <li>every visit, page view, form activity and click of the browsers that sent those leads.</li>
        </UL>
        <P>
          It cannot be undone. The record of the request keeps the date, the counts and a one-way hash of the email, never the email itself. Messages already sent to Slack or
          a webhook are outside Jellyhook: delete those there.
        </P>
      </Section>

      <Section title="Where the data is stored">
        <P>
          In the United States (Oregon), on Supabase (database) and Vercel (hosting). See the <Link href="/privacy" className={link}>privacy policy</Link> for every provider.
        </P>
        <Callout title="Sites with visitors from the EU or the UK">
          <p>
            Jellyhook does not offer a data processing agreement yet. Sites that must have one with every tool handling their visitors&apos; data, which is usually the case
            under the GDPR, should not install Jellyhook yet.
          </p>
        </Callout>
      </Section>

      <Section title="Text for your privacy notice">
        <P>
          Your own privacy notice should describe the tracker. This text matches what the tracker does. Replace the parts in brackets, and keep the banner sentence only if
          you have a banner.
        </P>
        <Code>{NOTICE}</Code>
      </Section>
    </div>
  );
}
