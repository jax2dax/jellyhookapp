import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, P, UL, B, DataTable } from "./ui";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Jellyhook shows what each form lead did on your website before they contacted you. Start here: what it is, who it is for, and where to read next.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Jellyhook Docs",
    description:
      "Jellyhook shows what each form lead did on your website before they contacted you. Start here: what it is, who it is for, and where to read next.",
    url: "/docs",
  },
};

const link = "text-[var(--lime)] hover:underline";

export default function DocsIndexPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Docs"
        title="Introduction"
        intro={
          <>
            Jellyhook is one script tag and a dashboard for websites whose main job is to produce form leads. When someone fills in your
            form, you can open that lead and see what they did on your site first: which pages they read, how long they stayed, how far they
            scrolled and how long they spent on each form field. It also shows where people start your form and leave.
          </>
        }
      />

      <Section title="What it is, and what it is not">
        <P>
          It is built for a person who reads each lead and decides what to do next. It does not follow up for you and it does not rank
          leads. Visitors are anonymous until they submit a form, so it does not tell you who an unknown visitor is.
        </P>
        <P>
          Want to see one first? Open the{" "}
          <Link href="/demo" className={link}>sample lead page</Link>. It uses made-up data and needs no sign-up.
        </P>
      </Section>

      <Section title="Where to go next">
        <DataTable
          head={["If you want to", "Read"]}
          rows={[
            [
              "Know if it fits your site, and what it will not do",
              <Link key="a" href="/docs/use-cases" className={link}>What Jellyhook is for</Link>,
            ],
            [
              "Install it",
              <Link key="b" href="/docs/installation" className={link}>Installation and setup</Link>,
            ],
            [
              "Understand a number on the first screen",
              <Link key="c" href="/docs/reference/dashboard" className={link}>Dashboard overview</Link>,
            ],
            [
              "Understand one lead and read its visit chart",
              <span key="d">
                <Link href="/docs/reference/lead-profile" className={link}>Lead profile page</Link>
                {", "}
                <Link href="/docs/concepts/session-replay" className={link}>Visit chart</Link>
              </span>,
            ],
            [
              "See where visitors and leads came from",
              <Link key="e" href="/docs/reference/conversions" className={link}>Conversions page</Link>,
            ],
            [
              "Ask a question across all your data",
              <Link key="f" href="/docs/hook" className={link}>What is Hook</Link>,
            ],
            [
              "Check what is stored and how consent works",
              <Link key="g" href="/docs/concepts/privacy-consent" className={link}>Privacy and consent</Link>,
            ],
            [
              "Fix something that looks empty or wrong",
              <Link key="h" href="/docs/troubleshooting" className={link}>Troubleshooting</Link>,
            ],
          ]}
        />
      </Section>

      <Section title="Two words to know first">
        <UL>
          <li>
            A <B>lead</B> is one form submission. A <B>visitor</B> is one browser. The same person on a phone and a laptop is two visitors.
            More in <Link href="/docs/concepts/visitors-sessions" className={link}>Visitors, sessions, and page views</Link>.
          </li>
          <li>
            <B>Leads</B> counts every submission, while <B>Conversions</B> and <B>Conversion Rate</B> count each person once.
            An example is on <Link href="/docs/use-cases" className={link}>What Jellyhook is for</Link>.
          </li>
        </UL>
      </Section>
    </div>
  );
}
