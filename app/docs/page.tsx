import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs",
  description: "Documentation for Jellyhook: installation, how the tracker works, and what each part of the dashboard shows.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Jellyhook Docs",
    description: "Documentation for Jellyhook: installation, how the tracker works, and what each part of the dashboard shows.",
    url: "/docs",
  },
};

export default function DocsIndexPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Docs</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Introduction</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Jellyhook is a tracking script and dashboard for businesses that get leads through their website. It records
        what a visitor actually did before they filled out a form: which pages they read, how long they spent on
        each one, how far they scrolled, and where they came from. When a lead converts, you can see their whole
        visit laid out, and compare it against other leads who converted the same way.
      </p>
      <p className="mt-4 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        It does not close deals for you, and it does not tell a sales team who to call first. What it does is give
        them the context a name and email address alone never do.
      </p>
      <p className="mt-4 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Once data is flowing, <Link href="/docs/hook" className="text-[var(--lime)] hover:underline">Hook</Link> lets you ask precise questions of it:
        which sessions converted, which pages lose people, where a form is abandoned. Its{" "}
        <Link href="/docs/preview" className="text-[var(--lime)] hover:underline">preview</Link> shows what a question describes before you run it, and its{" "}
        <Link href="/docs/results" className="text-[var(--lime)] hover:underline">results</Link> draw the answer as people, sessions and pages.
      </p>
      <p className="mt-8 ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Start with{" "}
        <Link href="/docs/installation" className="text-[var(--lime)] hover:underline">
          Installation and setup
        </Link>
        .
      </p>
    </div>
  );
}
