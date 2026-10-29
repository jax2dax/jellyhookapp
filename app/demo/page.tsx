import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { primaryBtn, ghostBtn } from "@/components/marketing/MarketingTheme";
import { DemoApp } from "./DemoApp";

export const metadata: Metadata = {
  title: "Try the demo",
  description:
    "Open sample leads and see every visit they made before the form, then mark the ones that matter and turn the mark into a hook. The real Jellyhook screens on a made-up site, no signup.",
  alternates: { canonical: "/demo" },
  robots: { index: true, follow: true },
};

export default function DemoPage() {
  return (
    <MarketingPage>
      <section className="mx-auto max-w-[1440px] px-5 pb-6 pt-10 md:px-12 lg:px-[72px]">
        <h1 className="ff-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1] tracking-[-0.02em] text-[var(--ink)]">
          Try Jellyhook on a <span className="text-[var(--lime)]">sample site</span>.
        </h1>
        <p className="mt-4 max-w-2xl ff-body text-[16px] leading-[1.7] text-[var(--ink-soft)]">
          Open any lead to see the visits they made before the form, page by page. Then follow the short tour to mark the leads that
          matter and get told about the next one. Real screens, made-up data, nothing is saved.
        </p>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-14 md:px-12 lg:px-[72px]">
        <DemoApp />
      </section>

      <section className="mx-auto max-w-[1440px] border-t border-[var(--rule)] px-5 py-14 md:px-12 lg:px-[72px]">
        <h2 className="ff-display text-2xl text-[var(--ink)]">Your own leads, the same way.</h2>
        <p className="mt-3 max-w-xl ff-body text-[15px] leading-relaxed text-[var(--ink-soft)]">One script on your site. Free during early access, no card.</p>
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
      </section>
    </MarketingPage>
  );
}
