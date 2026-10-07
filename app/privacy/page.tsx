import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/MarketingPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Jellyhook collects about you as a customer, and what your tracker script collects about visitors to your site.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const YOUR_ACCOUNT_DATA = [
  ["Identity", "Your user ID, email, name, and profile photo if you upload one."],
  ["Site configuration", "Domain, site name, API key, and tracking on/off state for each site you register."],
  ["Team membership", "Emails and roles of anyone you invite to a site."],
  ["Billing", "Your plan, subscription status, and billing history, processed by our billing provider, not stored as raw payment details on our servers."],
];

const VISITOR_DATA = [
  ["Visitor & session identity", "A random ID generated in the visitor's browser (not tied to a real name unless they submit a form) plus session timing."],
  ["Page activity", "Page paths, time spent on each page, scroll depth, and whether a page was revisited."],
  ["Technical context", "Device type, screen width, approximate country, timezone, and referrer URL. The country normally comes from the hosting platform's own header. When that is missing, the visitor's IP address is held briefly, sent over HTTPS to a third-party lookup service (ipwho.is) to get the country, and then deleted whether or not the lookup worked. We also keep a salted one-way hash of the IP, which can recognise a repeat device but cannot be turned back into an address. Our hosting provider's own request logs are outside Jellyhook's control."],
  ["First visit", "For a new visitor, the referrer, campaign tags (UTM) and landing page of their very first visit, kept to show where visitors originally came from."],
  ["Clicks", "Only on elements you mark with data-track-click on your own pages."],
  ["Form submissions", "Whatever fields your form collects, commonly name, email, and phone, tied to the page and session it came from."],
  ["Page structure", "Heading text and position captured from your pages, used to mark headings on the visit chart."],
];

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[#1b1b18] pt-16 md:pt-24">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Legal</span>
          <h1 className="mt-4 ff-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f2ea]">Privacy Policy</h1>
          <p className="mt-4 ff-mono text-[10px] uppercase tracking-[0.2em] text-[#5f5d57]">Last updated 2026</p>
          <p className="mt-6 max-w-2xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
            This describes exactly what Jellyhook collects and why, split into what we collect about you as a
            Jellyhook customer, and what your tracker script collects about visitors to your site.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-6">Data about you, our customer</h2>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {YOUR_ACCOUNT_DATA.map(([title, desc]) => (
              <div key={title} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <span className="ff-mono text-[11px] uppercase tracking-[0.18em] text-[var(--lime)] sm:w-44 sm:shrink-0">{title}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-2">Data your tracker collects from your site&apos;s visitors</h2>
          <p className="mb-6 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            This is collected on your behalf, from people visiting the site YOU install the tracker on. It never
            leaves the boundary of that one site&apos;s data, and it&apos;s visible only to you and the teammates you invite.
          </p>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {VISITOR_DATA.map(([title, desc]) => (
              <div key={title} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <span className="ff-mono text-[11px] uppercase tracking-[0.18em] text-[var(--lime)] sm:w-56 sm:shrink-0">{title}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 ff-body text-[13px] leading-relaxed text-[#8b8980]">
            We do not build a cross-site profile of an individual visitor. Data is scoped per site, and a visitor can
            only be linked to a real identity (name/email) if and when they submit a form on that site.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-4">Consent and your responsibilities</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The tracker stores a random visitor ID and session details in the visitor&apos;s browser (local storage) and sends the data
            above to Jellyhook. It does not include a consent banner, but it respects the visitor&apos;s browser: when Global Privacy Control or Do Not Track is on, the tracker does nothing at all. A site owner can also switch on consent mode, where the tracker stays off until the site&apos;s own cookie banner says yes, and erases what it stored if the visitor says no.
          </p>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            If your site has visitors in the EU, the UK or anywhere else that requires consent for this kind of storage or tracking, you
            are responsible for getting that consent before the script loads, and for describing the tracking in your own privacy notice.
            Jellyhook does not claim compliance on your behalf, and nothing here is legal advice.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-4">How it&apos;s used</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Solely to run the product you signed up for: showing you your own site&apos;s traffic, visit charts, leads,
            and page-health analysis. We don&apos;t sell tracked data, and we don&apos;t share it across accounts. Every query
            in the dashboard is scoped to sites you own or have been invited to.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-4">Retention & deletion</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Data for an active site is retained for as long as that site is active. Pausing a site stops new
            data collection but doesn&apos;t automatically erase history already collected. If you want a site&apos;s data
            fully deleted, reach out through your dashboard&apos;s support channel and we&apos;ll process the request.
          </p>
        </div>
      </section>
    </MarketingPage>
  );
}
