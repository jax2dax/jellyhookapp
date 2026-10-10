// app/landing-preview/page.tsx
//
// PREVIEW of the new landing page: the winning variant (R3B + post-test fixes) from marketing/landing/final.md.
// Not linked anywhere and not indexed. app/page.tsx stays the live landing page until the founder approves this one.
// Every claim is mapped to a file in marketing/landing/final.md ("Accuracy audit").
//
// Theme: same identity as the rest of the marketing site (MarketingPage, primaryBtn, ghostBtn), minus decorative noise,
// with text colours that pass WCAG AA (body #9d9b92, secondary #8b8980; nothing dimmer is used for text).
//
// Measurement: every call to action carries data-track-click (the Jellyhook tracker records clicks only on marked
// elements), and each section has one h2, so jellyhook.com's own visit charts show which sections a visitor reached.
import type { Metadata } from "next";
import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { MarketingPage } from "@/components/marketing/MarketingPage";
import { primaryBtn, ghostBtn } from "@/components/marketing/MarketingTheme";
import { HeroLead } from "./HeroLead";
import { Shot } from "./Shot";

export const metadata: Metadata = {
  title: "Landing preview",
  robots: { index: false, follow: false },
};

const INK = "text-[#f4f2ea]";
const BODY = "text-[#9d9b92]";
const SECOND = "text-[#8b8980]";
const LABEL = `ff-mono text-[11px] uppercase tracking-[0.2em] ${SECOND}`;
const H2 = `ff-display text-[clamp(2rem,4vw,3.25rem)] leading-[1.04] tracking-[-0.02em] ${INK}`;
const H3 = `ff-display text-[1.5rem] leading-[1.15] tracking-[-0.01em] ${INK}`;
const P = `ff-body text-[16px] leading-[1.65] ${BODY}`;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lime)]";
const LINK = `ff-body text-[14px] text-[var(--lime)] underline-offset-4 hover:underline ${FOCUS}`;
const ghost = ghostBtn.replace("border-[#2b2b25]", "border-[#5f5d57]");
const TAG = "border border-[#5f5d57] bg-[#0f0f0d] px-2 py-0.5 ff-mono text-[11px] uppercase tracking-[0.2em] text-[#8b8980]";

function Arrow() {
  return <ArrowRight aria-hidden="true" className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:translate-x-1" />;
}

function StartFree({ track }: { track: string }) {
  return (
    <Link href="/sign-up" data-track-click={track} className={`group ${FOCUS}`}>
      <span className={primaryBtn}>
        Start free
        <Arrow />
      </span>
    </Link>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <span className={LABEL}>{eyebrow}</span>
      </div>
      <div className="lg:col-span-8">
        <h2 className={H2}>{title}</h2>
        {sub && <p className={`mt-5 max-w-[38rem] ${P}`}>{sub}</p>}
      </div>
    </div>
  );
}

const SAMPLE_STATS = [
  { label: "Pages read", value: "4" },
  { label: "Time engaged", value: "12m" },
  { label: "Avg scroll", value: "80%" },
  { label: "Time to convert", value: "38m" },
];

const READ_STEPS = [
  "Each column is one page, in the order they read it. Wider means longer.",
  "Green shows what they scrolled past. Small marks show the headings, so you see which ones they reached.",
  "The highlighted page is where they sent the form. A purple gap is time away before they came back.",
];

const SETUP_STEPS = [
  { title: "Create your site.", text: "Free during early access, no card." },
  {
    title: "Paste one script tag into your site's head.",
    text: "If you can add custom code to your site, you can install it. Snippets for plain HTML, Next.js and Vite/React.",
    code: '<script defer src="https://jellyhook.com/tracker.js" data-key="YOUR-KEY"></script>',
  },
  { title: "Choose which forms count.", text: "Mark your form with one attribute, or count every form. No form yet? Setup gives you one." },
  { title: "Visit your site.", text: "Setup confirms the script is live and opens your dashboard. Your first lead page appears with your next real form submission." },
];

const FACTS: { q: string; a: string; href?: string; link?: string }[] = [
  { q: "How big is the script?", a: "About 31 KB compressed, one file. We have not published a page-load timing yet." },
  { q: "Does it set cookies?", a: "No. It keeps a random visitor ID in the browser's local storage. Visitors stay anonymous until they send a form, and it never records screens, mouse movement or keystrokes." },
  {
    q: "Consent and privacy signals?",
    a: "It stays off when the browser sends Global Privacy Control or Do Not Track, and has an optional consent mode that waits for your banner.",
    href: "/docs/concepts/privacy-consent",
    link: "How consent works",
  },
  {
    q: "Which forms work?",
    a: "Your own HTML forms, HubSpot, Marketo, Contact Form 7, Gravity Forms, WPForms, Salesforce Web-to-Lead and Mailchimp forms. Some forms inside an iframe cannot be read; the list says which.",
    href: "/docs/concepts/supported-forms",
    link: "Full list and limits",
  },
  { q: "How do I know it is working?", a: "A built-in check tells you whether the script and your form are set up right." },
];

const FOR_YOU = ["Your website's main job is to bring in form leads: demo, quote or contact requests.", "Someone follows up on the leads, and someone works on the pages and the form."];
const NOT_FOR_YOU = ["You run an online store checkout, or your site has no form.", "You want the names or companies of anonymous visitors.", "You need video recordings of sessions or A/B testing."];
const NEXT_STEPS = ["Sign up", "Name your site", "Paste the tag", "Visit your site, and the dashboard opens"];

export default function LandingPreview() {
  return (
    <MarketingPage>
      {/* ================= HERO ================= */}
      <section className="border-b border-[#1b1b18] pt-12 md:pt-20">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-5 pb-16 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:pb-24">
          <div className="lg:col-span-5">
            <span className={LABEL}>For websites that run on form leads</span>
            <h1 className={`mt-5 ff-display text-[clamp(2.5rem,5.6vw,4.5rem)] leading-[0.98] tracking-[-0.025em] ${INK}`}>
              See what your leads did <em className="italic text-[var(--lime)]">before they sent your form</em>.
            </h1>
            <p className={`mt-6 max-w-[38rem] ff-body text-[18px] leading-[1.6] ${BODY}`}>
              See what each person read before they sent your form, and which field the people who never sent it stopped on. Read one lead before you follow up.
              Read them all before you change a page or a form.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Show when="signed-out">
                <StartFree track="landing-hero-start-free" />
                <Link href="/demo" data-track-click="landing-hero-sample-lead" className={FOCUS}>
                  <span className={ghost}>See a sample lead</span>
                </Link>
              </Show>
              <Show when="signed-in">
                <Link href="/platform/dashboard" className={`group ${FOCUS}`}>
                  <span className={primaryBtn}>
                    Go to dashboard
                    <Arrow />
                  </span>
                </Link>
              </Show>
            </div>
            <p className={`mt-4 ${LABEL}`}>Free during early access · No card</p>
            <p className={`mt-6 max-w-[34rem] ff-body text-[14px] leading-[1.55] ${SECOND}`}>
              One script tag. No screen, mouse or keystroke recording. Visitors stay anonymous until they send a form.
              <br />
              Works next to your CRM: paste a lead&apos;s link into the contact note.
            </p>
          </div>

          <div className="min-w-0 lg:col-span-7">
            <HeroLead />
          </div>
        </div>
      </section>

      {/* ================= WHO OPENS IT ================= */}
      <section id="features" className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1200px] px-5 py-20 lg:px-10 lg:py-28">
          <SectionHeader
            eyebrow="Who opens it"
            title={
              <>
                Sales reads one lead. Marketing reads <em className="italic text-[var(--lime)]">them all</em>. Both open the same page.
              </>
            }
          />

          <div className="divide-y divide-[#1b1b18] border-y border-[#1b1b18]">
            <div id="follow-up" className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <span className={LABEL}>Following up · inbound sales, SDRs, nurture</span>
                <h3 className={`mt-4 ${H3}`}>Before you reply, read what they read.</h3>
                <p className={`mt-4 ${P}`}>
                  Open the lead and see the pages they read, how long they stayed, which headings they reached and whether they came back before converting.
                  If the interest is clear, narrow the pitch. If it isn&apos;t, keep it general. Mark the lead Qualified or Junk, and paste the lead&apos;s
                  link into your CRM note so a teammate can open it.
                </p>
              </div>
              <div className="lg:col-span-7">
                <Shot
                  file="lead-page.png"
                  title="Lead page"
                  alt="A lead's page in Jellyhook with sample data: the pages they read, time, scroll and the visit chart."
                  capture="a lead's page from your demo site (top of the page: name, stats card, form details). Blur nothing real; use a made-up lead."
                  fallback={
                <div className="border border-[#1b1b18] bg-[#0a0a09]">
                  <div className="flex items-center justify-between border-b border-[#1b1b18] px-4 py-3">
                    <span className={LABEL}>Lead at a glance</span>
                    <span className={TAG}>Sample data</span>
                  </div>
                  <dl className="grid grid-cols-2 divide-x divide-y divide-[#1b1b18] sm:grid-cols-4 sm:divide-y-0">
                    {SAMPLE_STATS.map((s) => (
                      <div key={s.label} className="p-4">
                        <dt className={LABEL}>{s.label}</dt>
                        <dd className={`mt-2 ff-display text-[28px] leading-none ${INK}`}>{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                  }
                />
              </div>
            </div>

            <div id="improve-pages" className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <span className={LABEL}>Improving pages and forms · CRO, digital marketing, demand gen</span>
                <h3 className={`mt-4 ${H3}`}>Find the field where people give up.</h3>
                <p className={`mt-4 ${P}`}>
                  Field timing is recorded for every tracked visitor who starts your form, including the ones who never send it. Ask &ldquo;which field do people
                  give up on most?&rdquo; or &ldquo;what did people who sent the form read first?&rdquo; and see the answer from your own visits, with the leads it is
                  based on. You build the question from plain choices, or type it in your own words.
                </p>
                <p className={`mt-4 ${P}`}>Also: the route each converted lead took, and where new visitors and converted leads first came from (referrer and campaign tags).</p>
              </div>
              <div className="lg:col-span-7">
                <Shot
                  file="field-dropoff.png"
                  title="Hook answer"
                  alt="Hook's answer to 'Which form field do people give up on most?' with sample data."
                  capture="Hook (/platform/hook) after running 'Which form field do people give up on most?' on your demo site: the result panel with the field breakdown."
                  fallback={
                <div className="border border-[#1b1b18] bg-[#0a0a09] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className={LABEL}>Ask across all your visits</span>
                    <span className={TAG}>Example</span>
                  </div>
                  <p className={`ff-display text-[22px] leading-snug ${INK}`}>&ldquo;Which form field do people give up on most?&rdquo;</p>
                  <p className={`mt-3 ff-body text-[14px] ${SECOND}`}>An example question. The answer comes from your own data.</p>
                </div>
                  }
                />
              </div>
            </div>

            <div id="team" className="grid grid-cols-1 gap-8 py-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <span className={LABEL}>Running the team · heads of growth, managers</span>
                <h3 className={`mt-4 ${H3}`}>Set it up for the team. Everyone sees the same lead.</h3>
                <p className={`mt-4 ${P}`}>Invite your team with roles. Marketing and sales open the same lead page and agree on Qualified or Junk.</p>
              </div>
              <div className="lg:col-span-7">
                <Shot
                  file="leads-list.png"
                  title="Leads"
                  alt="The leads list in Jellyhook with sample data, each lead marked Qualified, Junk or unreviewed."
                  capture="the Leads page (/platform/leads) on your demo site with 5 to 8 made-up leads, some marked Qualified and some Junk."
                />
              </div>
            </div>
          </div>

          <Link href="/docs/reference/lead-profile" data-track-click="landing-docs-lead-page" className={`mt-6 inline-block ${LINK}`}>
            See everything a lead page shows →
          </Link>
        </div>
      </section>

      {/* ================= HOW TO READ ================= */}
      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1200px] px-5 py-20 lg:px-10 lg:py-28">
          <SectionHeader eyebrow="How to read it" title="How to read a visit." sub="It is a chart of what was measured, not a video." />
          <ol className="grid grid-cols-1 gap-px bg-[#1b1b18] md:grid-cols-3">
            {READ_STEPS.map((s, i) => (
              <li key={s} className="bg-[#0a0a09] p-7">
                <span className="ff-display text-[28px] leading-none text-[var(--lime)]">{i + 1}</span>
                <p className={`mt-4 ${P}`}>{s}</p>
              </li>
            ))}
          </ol>
          <Link href="/docs/concepts/session-replay" data-track-click="landing-docs-visit-chart" className={`mt-6 inline-block ${LINK}`}>
            How the visit chart works →
          </Link>
        </div>
      </section>

      {/* ================= SETUP ================= */}
      <section id="setup" className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1200px] px-5 py-20 lg:px-10 lg:py-28">
          <SectionHeader eyebrow="Setup" title="One script tag. Your next lead arrives with its visit." />
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <ol className="space-y-8 lg:col-span-7">
              {SETUP_STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
                  <span className="ff-display text-[28px] leading-none text-[var(--lime)]">{i + 1}</span>
                  <div className="min-w-0">
                    <h3 className={H3}>{s.title}</h3>
                    <p className={`mt-2 ${P}`}>{s.text}</p>
                    {s.code && (
                      <pre className="mt-3 overflow-x-auto border border-[#1b1b18] bg-[#0f0f0d] p-3 ff-mono text-[13px] leading-[1.6] text-[#e9e7e0]">
                        <code>{s.code}</code>
                      </pre>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <div className="lg:col-span-5">
              <span className={LABEL}>The facts IT and legal will ask for</span>
              <div className="mt-4 divide-y divide-[#1b1b18] border-y border-[#1b1b18]">
                {FACTS.map((w) => (
                  <details key={w.q} className="group py-4">
                    <summary data-track-click="landing-fact-open" className={`cursor-pointer list-none ff-body text-[16px] ${INK} ${FOCUS}`}>
                      <span className="mr-2 text-[var(--lime)] group-open:hidden" aria-hidden="true">+</span>
                      <span className="mr-2 hidden text-[var(--lime)] group-open:inline" aria-hidden="true">−</span>
                      {w.q}
                    </summary>
                    <p className={`mt-3 ff-body text-[14px] leading-[1.55] ${BODY}`}>
                      {w.a}{" "}
                      {w.href && (
                        <Link href={w.href} className={LINK}>
                          {w.link} →
                        </Link>
                      )}
                    </p>
                  </details>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <StartFree track="landing-setup-start-free" />
                <Link href="/docs/installation" data-track-click="landing-setup-guide" className={FOCUS}>
                  <span className={ghost}>Read the setup guide</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FIT AND LIMITS ================= */}
      <section className="border-b border-[#1b1b18]">
        <div className="mx-auto max-w-[1200px] px-5 py-20 lg:px-10 lg:py-28">
          <SectionHeader eyebrow="Fit and limits" title="Built for sites that live on their contact form." />
          <div className="grid grid-cols-1 gap-px bg-[#1b1b18] md:grid-cols-2">
            <div className="bg-[#0a0a09] p-7">
              <h3 className={H3}>For you if</h3>
              <ul className="mt-5 space-y-3">
                {FOR_YOU.map((t) => (
                  <li key={t} className={`flex gap-3 ${P}`}>
                    <span aria-hidden="true" className="text-[var(--lime)]">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#0a0a09] p-7">
              <h3 className={H3}>Not for you if</h3>
              <ul className="mt-5 space-y-3">
                {NOT_FOR_YOU.map((t) => (
                  <li key={t} className={`flex gap-3 ${P}`}>
                    <span aria-hidden="true" className={SECOND}>–</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className={`mt-8 max-w-[48rem] ${P}`}>
            What it does not do yet: it does not sync to your CRM or export data (paste the lead link into your CRM instead). It does not make you compliant; the
            legal call is yours. It does not promise results; it shows what happened.
          </p>
          <p className={`mt-4 max-w-[48rem] ${P}`}>
            Free during early access, no card. If pricing ever starts, you get notice first, and nothing switches to paid on its own.{" "}
            <Link href="/privacy" className={LINK}>
              Privacy →
            </Link>
          </p>
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="bg-[var(--lime)] text-black">
        <div className="mx-auto max-w-[1200px] px-5 py-20 lg:px-10 lg:py-28">
          <span className="ff-mono text-[11px] uppercase tracking-[0.2em] text-black/70">Next</span>
          <h2 className="mt-5 ff-display text-[clamp(2.5rem,5.6vw,4.5rem)] leading-[0.98] tracking-[-0.025em]">
            See what your next lead <em className="italic">did</em>.
          </h2>
          <p className="mt-6 ff-body text-[16px] text-black/70">What happens after you click:</p>
          <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {NEXT_STEPS.map((s, i) => (
              <li key={s} className="border border-black/25 p-4 ff-body text-[15px] leading-snug">
                <span className="mr-2 ff-mono text-[12px] font-semibold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" data-track-click="landing-final-start-free" className="group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
              <span className="inline-flex h-14 w-full items-center justify-center gap-3 bg-black px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--lime)] transition-colors hover:bg-[#151515] sm:w-auto">
                Start free
                <Arrow />
              </span>
            </Link>
            <Link href="/docs/installation" data-track-click="landing-final-setup-guide" className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
              <span className="inline-flex h-14 w-full items-center justify-center border border-black/50 px-7 ff-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-black transition-colors hover:bg-black hover:text-[var(--lime)] sm:w-auto">
                Read the setup guide first
              </span>
            </Link>
          </div>
          <p className="mt-5 ff-mono text-[11px] uppercase tracking-[0.2em] text-black/70">Free during early access · No card · Remove the tag any time</p>
        </div>
      </section>
    </MarketingPage>
  );
}
