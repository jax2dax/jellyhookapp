import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Installation and setup",
  description: "How to create a site in Jellyhook, install the tracker script, and confirm it is recording data.",
  alternates: { canonical: "/docs/installation" },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-[#1b1b18] bg-[#0a0a09] p-4 ff-mono text-[12px] leading-relaxed text-[#4fc3ff]">
      <code>{children}</code>
    </pre>
  );
}

const COLLECTED: [string, string][] = [
  ["Session data", "Session start and end, referrer, timezone, device type and approximate country. The IP address is kept only as a one-way hash, never in the clear."],
  ["First touch", "For a new visitor's first visit only: the referrer, UTM campaign and landing page that brought them. Kept on the visitor, never overwritten."],
  ["Page views", "Page path, time on page, scroll depth, max scroll depth, page height, viewport height and width."],
  ["Clicks", "Only on elements you mark with data-track-click. Nothing else is clicked-tracked."],
  ["Form submissions", "Name, email, phone, and any other fields the form collects, tied to the page and session it came from."],
  ["Form engagement", "When a form was viewed, when it was started, and how long was spent on each field, even if it was never submitted."],
  ["Page structure", "Heading text and position on each page, used to mark headings on the session replay chart."],
];

const ENDPOINTS: [string, string][] = [
  ["/api/track", "Core ingestion endpoint. Receives page view and session events from the tracker script."],
  ["/api/track-form", "Receives form submissions and stores them as leads, deduplicated within a short window."],
  ["/api/track-form-engagement", "Receives form view, start, field timing, submit, and abandon events."],
  ["/api/track-structure", "Receives page heading and layout metadata, used on the session replay chart."],
  ["/api/site-config", "Returns per-site tracker configuration, for example whether form capture is restricted to specific forms."],
];

export default function InstallationPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Getting started</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Installation and setup</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        There is no SDK to configure and no event schema to design. One script tag, and Jellyhook starts recording
        sessions, scroll depth, and form activity on its own.
      </p>

      <div className="mt-12 space-y-14">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="ff-mono text-[11px] text-[var(--lime)]">01</span>
            <h2 className="ff-display text-xl text-[#f4f2ea]">Create a site</h2>
          </div>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            From your dashboard, register the domain you want to track. Enter it without <code className="ff-mono text-[#c9c7bd]">https://</code> or{" "}
            <code className="ff-mono text-[#c9c7bd]">www.</code>, for example <code className="ff-mono text-[#c9c7bd]">yourdomain.com</code>. Jellyhook
            generates a unique API key for it. This key is what authenticates every event the tracker sends, so nothing else can post fake
            data under your site.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Install the script on this exact domain. Jellyhook only records events that come from this domain (and its subdomains), and it is
            what proves the site is yours: the first site to receive real data from a domain is verified and owns it. It is also what a
            teammate&apos;s work email gets matched against to join the site automatically.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Adding a domain starts a claim that lasts <strong className="text-[#c9c7bd]">3 days</strong>. If the script has not reported from your site by
            then, the setup expires and records nothing until you renew it with one click, or start again. Two people can set up the same
            domain at once; whoever installs the script on the real site first wins.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Testing on <code className="ff-mono text-[#c9c7bd]">localhost</code> or a staging site? Those are different hosts, so their data is not recorded
            until you allow them under Settings, Tracking, Allowed hosts.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One account can own or belong to more than one site. Switch between them from the site name at the top
            of the sidebar, or add another from the same menu.
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="ff-mono text-[11px] text-[var(--lime)]">02</span>
            <h2 className="ff-display text-xl text-[#f4f2ea]">Install the tracker</h2>
          </div>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Paste this inside the <code className="ff-mono text-[#c9c7bd]">&lt;head&gt;</code> of your site. Your setup page has the exact
            snippet with your real API key already filled in.
          </p>
          <CodeBlock>{`<script\n  src="your-domain/tracker.js"\n  data-key="YOUR_SITE_API_KEY"\n></script>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            By default, with nothing else configured, the tracker assumes there is one form on the site that matters and listens for a
            submission on any form, anywhere on the site. That is enough for a simple site with a single contact form.
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="ff-mono text-[11px] text-[var(--lime)]">03</span>
            <h2 className="ff-display text-xl text-[#f4f2ea]">Recommended: label your conversion form</h2>
          </div>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            If the site has more than one form (a newsletter signup, a search box, a real contact form), tell Jellyhook which one is
            actually a lead. Two steps, no extra code beyond one attribute:
          </p>
          <p className="mb-2 ff-body text-[13px] text-[#8b8980]">
            <span className="ff-mono text-[11px] text-[var(--lime)]">Step 1</span> &nbsp;Turn on &quot;I&apos;ll label my form&quot; when
            creating the site (it is preselected, and you can switch it any time in Settings).
          </p>
          <p className="mb-3 ff-body text-[13px] text-[#8b8980]">
            <span className="ff-mono text-[11px] text-[var(--lime)]">Step 2</span> &nbsp;Add one attribute to the form that should count as
            a conversion:
          </p>
          <CodeBlock>{`<form data-conversion="true">\n  ...\n</form>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Once this is on, only forms carrying <code className="ff-mono text-[#c9c7bd]">data-conversion=&quot;true&quot;</code> are
            recorded as leads. Everything else on the page is ignored, so a newsletter box or a search bar never shows up as a lead by
            mistake.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Two more optional attributes choose which fields of a form are measured and which buttons are counted. Settings shows whether each one
            is installed correctly and actually working. See{" "}
            <Link href="/docs/concepts/tracking-attributes" className="text-[var(--lime)] hover:underline">
              Tracking attributes
            </Link>
            .
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="ff-mono text-[11px] text-[var(--lime)]">04</span>
            <h2 className="ff-display text-xl text-[#f4f2ea]">If it looks stuck on &quot;Pending Verification&quot;</h2>
          </div>
          <p className="mb-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Right after creating a site, the dashboard shows a &quot;Listening for connection...&quot; screen and checks every few
            seconds. The instant one real event arrives with the right API key <em>from your own domain</em>, the site is marked verified and
            the page moves on by itself. There is no separate approval step. An event from any other website does not verify the site, even with
            the right key.
          </p>
          <p className="mb-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">If it stays on this screen, check, in order:</p>
          <ul className="mb-3 list-disc space-y-1.5 pl-5 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <li>The script is actually deployed and live, not just saved locally or sitting in a preview build.</li>
            <li>
              The page you are viewing is the domain you registered. If the screen says &quot;We received data from another-site.com&quot;, the
              script is on a different website than the one you registered: move it, or allow that host if it is a test copy.
            </li>
            <li>The setup has not expired. After 3 days without data it stops recording until renewed; the screen shows a Renew button.</li>
            <li>
              The <code className="ff-mono text-[#c9c7bd]">data-key</code> in the snippet matches exactly, no extra spaces or a key copied
              from a different site.
            </li>
            <li>Nothing on the page (an ad blocker, a strict content security policy) is blocking the script from loading at all.</li>
          </ul>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Registered the wrong domain entirely? Cancel and start over from the same screen, no site gets left behind half-configured.
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="ff-mono text-[11px] text-[var(--lime)]">05</span>
            <h2 className="ff-display text-xl text-[#f4f2ea]">Once it is verified</h2>
          </div>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The tracker identifies each visitor and session, records every page view with scroll depth and time on page, and picks up
            form activity on its own from here. No further setup is required.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Settings, Tracking shows the last time data arrived, any other website that sent data and was turned away, and whether your
            attributes are working. If you ever regenerate the API key, the old one keeps working for 72 hours so there is no gap in tracking.
          </p>
        </div>
      </div>

      <div className="mt-16">
        <h2 className="ff-display text-xl text-[#f4f2ea] mb-2">What gets collected</h2>
        <p className="mb-6 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
          Exactly this, and nothing more. See{" "}
          <Link href="/privacy" className="text-[var(--lime)] hover:underline">
            Privacy
          </Link>{" "}
          for the full breakdown of storage and retention.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {COLLECTED.map(([title, desc]) => (
            <div key={title} className="border border-[#1b1b18] bg-[#0a0a09] p-5">
              <h3 className="ff-mono text-[11px] uppercase tracking-[0.2em] text-[var(--lime)]">{title}</h3>
              <p className="mt-2 ff-body text-[13px] leading-relaxed text-[#8b8980]">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16">
        <h2 className="ff-display text-xl text-[#f4f2ea] mb-2">Ingestion endpoints</h2>
        <p className="mb-6 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
          Reference only. The tracker script calls these for you. Every request is authenticated with your site&apos;s API key.
        </p>
        <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
          {ENDPOINTS.map(([path, desc]) => (
            <div key={path} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
              <code className="ff-mono text-[13px] text-[var(--lime)] sm:w-64 sm:shrink-0">{path}</code>
              <span className="ff-body text-[13px] text-[#8b8980]">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
