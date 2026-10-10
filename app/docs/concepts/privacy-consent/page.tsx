import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Privacy and consent",
  description: "What the Jellyhook tracker stores, how it respects Do Not Track and Global Privacy Control, and how to wait for your cookie banner before tracking.",
  alternates: { canonical: "/docs/concepts/privacy-consent" },
};

const BLOCK = "overflow-x-auto border border-[#1b1b18] bg-[#0a0a09] p-4 ff-mono text-[12px] leading-relaxed text-[#4fc3ff]";

function Code({ children }: { children: string }) {
  return (
    <pre className={BLOCK}>
      <code>{children}</code>
    </pre>
  );
}

export default function PrivacyConsentPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Core concepts"
        title="Privacy and consent"
        intro="What the tracker stores, what it does when a visitor has asked not to be tracked, and how to make it wait for your cookie banner. This page describes the product. It is not legal advice, and you decide what your own site needs."
      />

      <Section title="What the tracker stores in the visitor's browser">
        <DataTable
          head={["Item", "What it is"]}
          rows={[
            [<C key="a">visitor_id</C>, "A random id for the browser, kept until the visitor clears their data. It is not a name or an email."],
            [<C key="b">jh_session</C>, "The current visit and when it was last active."],
            [<C key="c">jh_active, jh_sc, jh_hr</C>, "Small helper values: which window is active, and when a page was last reported."],
          ]}
        />
        <P>
          It does not set cookies. It stores these in the browser&apos;s local storage and sends the events described in <Link href="/docs/installation" className="text-[var(--lime)] hover:underline">Installation and setup</Link> to Jellyhook. The visitor&apos;s IP address is never stored as such: only a salted one-way hash is kept, and the visitor&apos;s country comes from the hosting platform&apos;s own header or a one-time lookup that deletes the address afterwards. The{" "}
          <Link href="/privacy" className="text-[var(--lime)] hover:underline">privacy policy</Link> has the full list.
        </P>
      </Section>

      <Section title="Visitors who have asked not to be tracked">
        <P>
          When the visitor&apos;s browser sends <B>Global Privacy Control</B> or <B>Do Not Track</B>, the tracker does nothing at all. It does not read or write storage and sends nothing, so that visitor never appears in your data. This is automatic and cannot be turned off.
        </P>
      </Section>

      <Section title="Waiting for your cookie banner (consent mode)">
        <P>
          If your visitors need to give consent first, add <C>data-require-consent</C> to the script tag. The tracker then stays completely off: nothing is stored and nothing is sent. When your banner records a yes, call:
        </P>
        <Code>{`<script defer src="https://jellyhook.com/tracker.js" data-key="YOUR_KEY" data-require-consent></script>\n\n// in your cookie banner's code, when the visitor accepts:\nwindow.jellyhook.consent(true);\n\n// when they decline, or later withdraw:\nwindow.jellyhook.consent(false);`}</Code>
        <UL>
          <li>
            <C>consent(true)</C> starts the tracker straight away, and remembers the choice, so the visitor is not asked on later visits.
          </li>
          <li>
            <C>consent(false)</C> erases the ids the tracker stored in that browser and stops it. The page reloads once to make sure nothing keeps running.
          </li>
          <li>
            Call <C>window.jellyhook.consent</C> only after the tracker script has loaded. A banner that runs earlier should wait for the script&apos;s load event.
          </li>
        </UL>
        <Callout title="What this does not do">
          <p>
            Jellyhook does not ship a banner, and it does not decide whether your visitors need consent. If your site has visitors in the EU, the UK or elsewhere with consent rules, getting that consent and describing the tracking in your own privacy notice is your responsibility. Consider asking a lawyer before onboarding those visitors.
          </p>
        </Callout>
      </Section>
    </div>
  );
}
