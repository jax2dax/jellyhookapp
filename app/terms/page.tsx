import * as React from "react";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/MarketingPage";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. What Jellyhook is",
    body: (
      <p>
        Jellyhook (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a website analytics and lead-intelligence service. You install a tracker script on
        your own website (&ldquo;your site&rdquo;); it collects behavioral data from your site&apos;s visitors and presents it to you
        through the Jellyhook dashboard. These Terms govern your use of that dashboard and the tracker script.
      </p>
    ),
  },
  {
    title: "2. Your account",
    body: (
      <p>
        You need an account, authenticated through our identity provider, to use Jellyhook. You&apos;re responsible for
        keeping your account credentials and your site&apos;s API key confidential. The API key authenticates tracking
        requests as coming from your site, so treat it like a secret. If you believe a key has been exposed, regenerate
        it from your site settings immediately.
      </p>
    ),
  },
  {
    title: "3. Your site and your visitors",
    body: (
      <p>
        You are responsible for how you use Jellyhook on your own site, including having any consent, disclosures, or
        privacy notices required by law for the visitor data you collect through it. Jellyhook processes data on your
        behalf about people who visit the websites you track. You control what site the tracker runs on and what
        forms it captures.
      </p>
    ),
  },
  {
    title: "4. Plans and billing",
    body: (
      <p>
        Jellyhook offers a free tier and paid plans with additional features, billed on a recurring basis through our
        billing provider. You can view and change your plan, and see your billing history, from your account&apos;s
        billing page. Cancelling a paid plan takes effect at the end of the current billing period. You keep access
        to that plan&apos;s features until then, and your account reverts to the free tier afterward.
      </p>
    ),
  },
  {
    title: "5. Acceptable use",
    body: (
      <p>
        You agree not to use Jellyhook to track a website you don&apos;t own or aren&apos;t authorized to install tracking on,
        to attempt to access another account&apos;s or site&apos;s data, to send fabricated or abusive traffic to our
        ingestion endpoints, or to use the service in a way that violates applicable law.
      </p>
    ),
  },
  {
    title: "6. Data retention and deletion",
    body: (
      <p>
        Tracked data (sessions, page views, form submissions) is retained for as long as your site remains active.
        Deactivating a site disables its tracker and stops new data collection for it; it does not immediately erase
        previously collected data. If you&apos;d like your site&apos;s data fully deleted, contact us and we&apos;ll process that
        request. See our <Link href="/privacy" className="text-[var(--lime)] hover:underline">Privacy Policy</Link> for
        the full detail on what&apos;s collected and why.
      </p>
    ),
  },
  {
    title: "7. Service availability",
    body: (
      <p>
        We aim to keep the tracking pipeline and dashboard available and accurate, but Jellyhook is provided &ldquo;as is&rdquo;
        without guarantees of uninterrupted availability. We&apos;re not liable for lost data, missed leads, or business
        decisions made on the basis of analytics that were temporarily unavailable or delayed.
      </p>
    ),
  },
  {
    title: "8. Changes to these terms",
    body: (
      <p>
        We may update these Terms as the product changes. Continuing to use Jellyhook after an update means you
        accept the revised Terms. Material changes will be reflected here with an updated date.
      </p>
    ),
  },
  {
    title: "9. Contact",
    body: <p>Questions about these Terms can be sent through your account&apos;s support channel in the dashboard.</p>,
  },
];

export default function TermsPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[#1b1b18] pt-16 md:pt-24">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Legal</span>
          <h1 className="mt-4 ff-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f2ea]">Terms of Service</h1>
          <p className="mt-4 ff-mono text-[10px] uppercase tracking-[0.2em] text-[#5f5d57]">Last updated 2026</p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <div className="space-y-10">
            {SECTIONS.map((s) => (
              <div key={s.title}>
                <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">{s.title}</h2>
                <div className="ff-body text-[14px] leading-relaxed text-[#8b8980]">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
