import { MarketingPage } from "@/components/marketing/MarketingPage";

const YOUR_ACCOUNT_DATA = [
  ["Identity", "Your user ID, email, name, and profile photo from your sign-in provider."],
  ["Site configuration", "Domain, site name, API key, and tracking on/off state for each site you register."],
  ["Team membership", "Emails and roles of anyone you invite to a site."],
  ["Billing", "Your plan, subscription status, and billing history — processed by our billing provider, not stored as raw payment details on our servers."],
];

const VISITOR_DATA = [
  ["Visitor & session identity", "A random ID generated in the visitor&apos;s browser (not tied to a real name unless they submit a form) plus session timing."],
  ["Page activity", "Page paths, time spent on each page, scroll depth, and whether a page was revisited."],
  ["Technical context", "Device type, approximate country (from IP address), timezone, and referrer URL."],
  ["Form submissions", "Whatever fields your form collects — commonly name, email, and phone — tied to the page and session it came from."],
  ["Page structure", "Heading text and position captured from your pages, used only to score page health."],
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
            This describes exactly what Jellyhook collects and why — split into what we collect about you as a
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
            This is collected on your behalf, from people visiting the site YOU install the tracker on — it never
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
            We do not build a cross-site profile of an individual visitor — data is scoped per site, and a visitor can
            only be linked to a real identity (name/email) if and when they submit a form on that site.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-4">How it&apos;s used</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Solely to run the product you signed up for: showing you your own site&apos;s traffic, session replays, leads,
            and page-health analysis. We don&apos;t sell tracked data, and we don&apos;t share it across accounts — every query
            in the dashboard is scoped to sites you own or have been invited to.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-4">Retention & deletion</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Data for an active site is retained for as long as that site is active. Deactivating a site stops new
            data collection but doesn&apos;t automatically erase history already collected — if you want a site&apos;s data
            fully deleted, reach out through your dashboard&apos;s support channel and we&apos;ll process the request.
          </p>
        </div>
      </section>
    </MarketingPage>
  );
}
