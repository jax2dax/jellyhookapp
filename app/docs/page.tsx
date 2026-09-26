import Link from "next/link";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { RandomIconBadge } from "@/components/RandomIconBadge";
import { HALLOWEEN_ICONS } from "@/components/marketing/halloweenIcons";

const ENDPOINTS = [
  { path: "/api/track", desc: "Core ingestion endpoint — receives page-view and session events from the tracker script." },
  { path: "/api/track-form", desc: "Receives form submissions and stores them as leads, deduplicated within a short window." },
  { path: "/api/track-structure", desc: "Receives page heading/layout metadata, used by page-health scoring." },
  { path: "/api/site-config", desc: "Returns per-site tracker configuration (e.g. whether form capture is restricted to a specific form)." },
];

const COLLECTED = [
  ["Session data", "Session start/end, referrer, timezone, device type, approximate country from IP."],
  ["Page views", "Page path, time on page, scroll depth, max scroll depth, page height, viewport height."],
  ["Form submissions", "Name, email, phone, and any other fields your form collects, tied to the page and session it came from."],
  ["Page structure", "Heading text and position on each page, used to score page health."],
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-[#1b1b18] bg-[#0a0a09] p-4 ff-mono text-[12px] leading-relaxed text-[#c9c7bd]">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <MarketingPage>
      <section className="relative border-b border-[#1b1b18] pt-16 md:pt-24">
        <div className="relative mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          {/* seasonal — a random little ghost, different one on every load */}
          <RandomIconBadge images={HALLOWEEN_ICONS} size={40} className="pointer-events-none absolute -top-2 left-16 -rotate-12 select-none object-contain sm:left-24" />
          <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Docs</span>
          <h1 className="mt-4 ff-display text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] tracking-[-0.02em] text-[#f4f2ea]">
            From install to first session in <em className="italic text-[var(--lime)]">under five minutes</em>.
          </h1>
          <p className="mt-5 max-w-xl ff-body text-[15px] leading-[1.75] text-[#8b8980]">
            There&apos;s no SDK to configure and no event schema to design — one script tag, and Jellyhook starts recording
            sessions, scroll depth, and form submissions automatically.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[900px] px-5 py-16 lg:px-10 lg:py-20">
          <div className="space-y-14">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="ff-mono text-[11px] text-[var(--lime)]">01</span>
                <h2 className="ff-display text-2xl text-[#f4f2ea]">Create a site</h2>
              </div>
              <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
                From your dashboard, register your site&apos;s domain. Jellyhook generates a unique API key for it —
                this is what authenticates every event your tracker sends, so no one else can post fake data under
                your site.
              </p>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="ff-mono text-[11px] text-[var(--lime)]">02</span>
                <h2 className="ff-display text-2xl text-[#f4f2ea]">Install the tracker</h2>
              </div>
              <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
                Paste the snippet from your site&apos;s setup page into your site&apos;s <code className="ff-mono text-[#c9c7bd]">&lt;head&gt;</code> — the exact
                key is generated per-site, this is the shape of it:
              </p>
              <CodeBlock>{`<script\n  src="https://your-jellyhook-domain/tracker.js"\n  data-key="YOUR_SITE_API_KEY"\n></script>`}</CodeBlock>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="ff-mono text-[11px] text-[var(--lime)]">03</span>
                <h2 className="ff-display text-2xl text-[#f4f2ea]">That&apos;s it — it&apos;s already tracking</h2>
              </div>
              <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
                From here the tracker runs on its own: it identifies each visitor and session, records every page
                view with scroll depth and time on page, and picks up form submissions on the page automatically. No
                further configuration is required unless you want to restrict lead capture to one specific form —
                that&apos;s a toggle in your site settings, not a code change.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-2">What gets collected</h2>
          <p className="mb-8 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Exactly this, and nothing more — see <Link href="/privacy" className="text-[var(--lime)] hover:underline">Privacy</Link> for the full
            breakdown of storage and retention.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {COLLECTED.map(([title, desc]) => (
              <div key={title} className="border border-[#1b1b18] bg-[#0a0a09] p-5">
                <h3 className="ff-mono text-[11px] uppercase tracking-[0.2em] text-[var(--lime)]">{title}</h3>
                <p className="mt-2 ff-body text-[13px] leading-relaxed text-[#8b8980]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[1400px] px-5 py-16 lg:px-10 lg:py-20">
          <h2 className="ff-display text-2xl text-[#f4f2ea] mb-2">Ingestion endpoints</h2>
          <p className="mb-8 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Reference only — the tracker script calls these for you. Every request is authenticated with your site&apos;s
            API key.
          </p>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <code className="ff-mono text-[13px] text-[var(--lime)] sm:w-52 sm:shrink-0">{e.path}</code>
                <span className="ff-body text-[13px] text-[#8b8980]">{e.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingPage>
  );
}
