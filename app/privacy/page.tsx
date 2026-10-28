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
  ["Page activity", "Page paths, time spent on each page, scroll depth, whether a page was revisited, and how long each part of the page (by its headings) was on screen."],
  ["Technical context", "Device type, screen width, approximate country, timezone, and referrer URL. The country normally comes from the hosting platform's own header. When that is missing, the visitor's IP address is held briefly, sent over HTTPS to a third-party lookup service (ipwho.is) to get the country, and then deleted whether or not the lookup worked. We also keep a salted one-way hash of the IP and of the browser's identifier string, which together recognise one device (so one person opening the site in several private windows on the same day counts as one visitor) but cannot be turned back into an address or a browser string. Our hosting provider's own request logs are outside Jellyhook's control."],
  ["First visit", "For a new visitor, the referrer, campaign tags (UTM) and landing page of their very first visit, kept to show where visitors originally came from."],
  ["Clicks", "Only on elements you mark with data-track-click on your own pages."],
  ["Form submissions", "Whatever fields your form collects, commonly name, email, and phone, tied to the page and session it came from."],
  ["Waiting to be sent", "If our servers do not answer, the tracker keeps what it was sending (including a submitted form's values, without the fields that are always left out) in that browser tab's session storage and tries again for up to 30 minutes. Each item is deleted as soon as our servers accept it, and in any case when the tab is closed."],
  ["Page structure", "Heading text and position captured from your pages, used to mark headings on the visit chart."],
];

const PROVIDERS = [
  ["Supabase", "Database. Stores the tracked visit, form and lead data for each site, and your account settings."],
  ["Vercel", "Hosting. Serves the website, the dashboard and the tracker script, and keeps its own request logs."],
  ["Clerk", "Sign-in and accounts for Jellyhook customers. It does not receive data about your site's visitors."],
  ["ipwho.is", "Country lookup, only when the hosting platform did not provide a country. Receives the visitor's IP address over HTTPS; the IP is deleted afterwards."],
  ["Google Analytics and Vercel Analytics", "Visit statistics for jellyhook.com."],
  ["OpenAI", "Only when you use Ask Hook: receives your typed question, the list of fields Hook can use, up to 25 of your site's page paths, and the question already in the builder. It never receives visitor records."],
];

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <section className="border-b border-[var(--rule)] pt-16 md:pt-24">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Legal</span>
          <h1 className="mt-4 ff-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[0.98] tracking-[-0.02em] text-[var(--ink)]">Privacy Policy</h1>
          <p className="mt-4 ff-mono text-[10px] uppercase tracking-[0.2em] text-[var(--ink-mute)]">Last updated October 28, 2026</p>
          <p className="mt-6 max-w-2xl ff-body text-[15px] leading-[1.75] text-[var(--ink-soft)]">
            This describes exactly what Jellyhook collects and why, split into what we collect about you as a
            Jellyhook customer, and what your tracker script collects about visitors to your site.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-6">Data about you, our customer</h2>
          <div className="divide-y divide-[var(--rule)] border-t border-b border-[var(--rule)]">
            {YOUR_ACCOUNT_DATA.map(([title, desc]) => (
              <div key={title} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <span className="ff-mono text-[11px] uppercase tracking-[0.18em] text-[var(--lime)] sm:w-44 sm:shrink-0">{title}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[var(--ink-soft)]">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-2">Data your tracker collects from your site&apos;s visitors</h2>
          <p className="mb-6 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            This is collected on your behalf, from people visiting the site YOU install the tracker on. It never
            leaves the boundary of that one site&apos;s data, and it&apos;s visible only to you and the teammates you invite.
          </p>
          <div className="divide-y divide-[var(--rule)] border-t border-b border-[var(--rule)]">
            {VISITOR_DATA.map(([title, desc]) => (
              <div key={title} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <span className="ff-mono text-[11px] uppercase tracking-[0.18em] text-[var(--lime)] sm:w-56 sm:shrink-0">{title}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[var(--ink-soft)]">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 ff-body text-[13px] leading-relaxed text-[var(--ink-soft)]">
            We do not build a cross-site profile of an individual visitor. Data is scoped per site, and a visitor can
            only be linked to a real identity (name/email) if and when they submit a form on that site.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-4">Consent and your responsibilities</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The tracker stores a random visitor ID and session details in the visitor&apos;s browser (local storage), keeps anything
            still waiting to be sent in that tab&apos;s session storage, and sends the data above to Jellyhook. It sets no cookies. When Global Privacy Control or Do Not Track is on, the tracker does nothing at all. When the site has a cookie banner it recognises (Cookiebot, OneTrust, CookieYes, Complianz, an IAB TCF banner or Google Consent Mode), it starts only after the visitor accepts analytics, and stops and erases what it stored if they refuse or withdraw. Sites with another banner can call the tracker from it (consent mode).
          </p>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            You are responsible for getting consent where your visitors&apos; law requires it, and for describing the tracking in your own
            privacy notice; the <a href="/docs/concepts/privacy-consent" className="text-[var(--lime)] hover:underline">Privacy and consent</a> docs have text you can use.
            Jellyhook does not offer a data processing agreement yet, so it is not set up for sites that must have one, which is usually the case for sites with visitors from the EU or the UK. Nothing here is legal advice.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-4">Enter Hook with AI</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            When you use Enter Hook with AI, your typed question, the query currently in the builder, today&apos;s date and up to 25 page paths of your site are sent to OpenAI, our AI processor, to turn the question into a Hook query. Your visitors&apos; data, query results, names, emails and IP addresses are never sent. We record how many questions each account asks and what they cost, not the text of the questions.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-4">How forms are measured</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            On a tracked form the script records when each field is clicked into and left, whether it was left filled or empty, how many times its value changed, when the browser refused the form because a field was invalid, the form&apos;s list of fields (their names, types and whether they are required), and how long the form was on screen before someone started. It never records what is typed, or how long it is. The values of a form are only sent when the form is submitted, as a lead, and even then payment card numbers and security codes, bank account numbers and government identity or tax numbers are left out in the visitor&apos;s browser and checked again on our servers. Site owners can leave out any other field.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-4">Connecting an AI app</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            A site owner or admin can create an access token that lets an AI app they choose (for example Claude or Cursor) read that site&apos;s Hook data. Answers go to that app&apos;s AI provider. Emails, names and phone numbers are hidden unless the token was created with an extra confirmation, and form answers are never sent. Tokens expire and can be revoked. The owner is responsible for choosing apps they are allowed to share the data with. We record how many calls each token makes, not what was asked or answered.
          </p>
        </div>
      </section>

      <section className="border-b border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-4">How it&apos;s used</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Solely to run the product you signed up for: showing you your own site&apos;s traffic, visit charts, leads,
            and page-health analysis. We don&apos;t sell tracked data, and we don&apos;t share it across accounts. Every query
            in the dashboard is scoped to sites you own or have been invited to.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-4">Retention & deletion</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Visit, lead and form data is kept for 13 months by default and deleted after that, once a day. A site owner or admin can choose
            6, 13 or 25 months, or keep it for as long as the site is active. Pausing a site stops new data collection but does not erase
            history already collected. When a visitor asks a site to delete their data, an owner or admin erases them by the email they used
            in the form: their leads and the visits of the browsers that sent them are deleted, and only a count and a one-way hash of the
            email are kept as a record. Removing a site or a teammate hides it from the dashboard but does not erase the data on its own. If
            you want a site&apos;s data fully deleted, ask through the Support button in your dashboard and we will permanently delete it
            within 30 days of your request.
          </p>
        </div>
      </section>

      <section className="border-t border-[var(--rule)]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[var(--ink)] mb-4">Service providers we rely on</h2>
          <p className="mb-6 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Jellyhook runs on these providers. Each one only receives what it needs to do its job. Our database and hosting run in
            the United States (US West, Oregon).
          </p>
          <div className="divide-y divide-[var(--rule)] border-t border-b border-[var(--rule)]">
            {PROVIDERS.map(([title, desc]) => (
              <div key={title} className="flex flex-col gap-1 py-4 sm:flex-row sm:gap-6">
                <span className="ff-mono text-[11px] uppercase tracking-[0.18em] text-[var(--lime)] sm:w-44 sm:shrink-0">{title}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[var(--ink-soft)]">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
