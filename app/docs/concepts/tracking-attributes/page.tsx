import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tracking attributes",
  description: "The three HTML attributes that tell Jellyhook which form, which fields and which buttons to track, and how to check they are working.",
  alternates: { canonical: "/docs/concepts/tracking-attributes" },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-[#1b1b18] bg-[#0a0a09] p-4 ff-mono text-[12px] leading-relaxed text-[#4fc3ff]">
      <code>{children}</code>
    </pre>
  );
}

const STATES: [string, string][] = [
  ["Working", "A real event came from it: a real lead from the marked form, real field timings from a marked field, a real click on a marked element. This is the only state that proves it works."],
  ["Found, waiting for activity", "The tracker saw the attribute on a page, but nobody has used it yet. Submit your own form or click your own button once to prove it."],
  ["Misplaced", "The attribute is on the wrong kind of element, or has the wrong value. The check names the page and what is wrong."],
  ["Not found", "The tracker has not seen the attribute on any page it has loaded."],
];

export default function TrackingAttributesPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Tracking attributes</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Three optional HTML attributes tell Jellyhook what matters on your pages. Everything works without them; they exist so you decide
        which form is a lead, which fields are measured and which buttons are counted.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">data-conversion: which form is a lead</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Put it on the <code className="ff-mono text-[#c9c7bd]">&lt;form&gt;</code> element itself, or on any element around it (needed for forms a tool such as HubSpot builds for you; see Supported forms). When you chose &quot;I&apos;ll label my form&quot; while creating
            the site, only forms carrying it are recorded as leads. A newsletter box or a search bar is then never mistaken for a lead.
          </p>
          <CodeBlock>{`<form data-conversion="true">\n  ...\n</form>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            It must be on the form, not on a button or a wrapping div, and the value must be exactly <code className="ff-mono text-[#c9c7bd]">true</code>.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">data-track-field: which fields are measured</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            By default every field of a form is measured: how long people stay in it and where they stop. Add{" "}
            <code className="ff-mono text-[#c9c7bd]">data-track-field</code> to some fields and only those are measured (and only those are stored in the
            lead&apos;s raw form data). A form with no marked field keeps tracking all of them.
          </p>
          <CodeBlock>{`<form data-conversion="true">\n  <input name="email" data-track-field>\n  <input name="company" data-track-field>\n  <input name="notes">   <!-- not measured -->\n</form>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            It goes on the input itself, or on a wrapper around it, and it must be inside a form. The lead&apos;s name, email and phone are still
            recognised from the form as before, so restricting fields does not stop a lead from being identified.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">data-track-click: which buttons are counted</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Clicks are not recorded unless you ask. Put the attribute on a button or link and give the click a name; the name is what you will see
            in your data.
          </p>
          <CodeBlock>{`<a href="/pricing" data-track-click="hero-pricing">See pricing</a>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            With an empty value, the element&apos;s id is used, then its visible text. Repeated clicks on the same name within one second count once.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Checking they work</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            People put these attributes in the wrong place and assume they work. Open{" "}
            <Link href="/docs/reference/settings" className="text-[var(--lime)] hover:underline">
              Settings
            </Link>
            , Tracking, Attribute check. Each attribute shows one of four states, per page:
          </p>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {STATES.map(([state, desc]) => (
              <div key={state} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-60 sm:shrink-0">{state}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The tracker reports what it finds when a page loads, at most once every six hours per page, so a fix shows up the next time the page is
            opened after that.
          </p>
        </div>
      </div>
    </div>
  );
}
