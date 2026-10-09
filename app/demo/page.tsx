import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { primaryBtn, ghostBtn } from "@/components/marketing/MarketingTheme";
import { DemoLead } from "./DemoLead";

export const metadata: Metadata = {
  title: "Sample lead page",
  description: "See what a lead's page looks like in Jellyhook: the pages they read, how far they scrolled and how long they spent on each form field. Made-up sample data, no signup.",
  alternates: { canonical: "/demo" },
  robots: { index: true, follow: true },
};

export default function DemoPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[#1b1b18] pt-12 md:pt-20">
        <div className="mx-auto max-w-[1100px] px-5 py-12 lg:px-10 lg:py-16">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Sample lead page</span>
          <h1 className="mt-4 ff-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1] tracking-[-0.02em] text-[#f4f2ea]">
            This is what you get for <em className="italic text-[var(--lime)]">every lead</em>.
          </h1>
          <p className="mt-5 max-w-2xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
            Everything below is made-up sample data, shown with the same chart your own leads get. No signup needed. Click the frames to
            see the page-level detail.
          </p>
          <div className="mt-6 inline-block border border-[#2a2a25] bg-[#0a0a09] px-3 py-2 ff-mono text-[10px] uppercase tracking-[0.2em] text-[#8b8980]">
            Sample data. Not a real person or company.
          </div>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1100px] px-5 py-12 lg:px-10 lg:py-16">
          <DemoLead />
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1100px] px-5 py-14 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea]">Your own leads, the same way.</h2>
          <p className="mt-3 max-w-xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Add one script tag to your site. Free during early access, no card. Visitors stay anonymous until they submit a form.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up">
              <button className={primaryBtn}>
                Start free
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </button>
            </Link>
            <Link href="/docs/installation">
              <button className={ghostBtn}>How setup works</button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
