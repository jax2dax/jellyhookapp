import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tracking attributes",
  description: "The HTML attributes that tell Jellyhook which form, which fields and which buttons to track, which fields to leave out, and how to check they are working.",
  alternates: { canonical: "/docs/concepts/tracking-attributes" },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-[var(--rule)] bg-[var(--paper-2)] p-4 ff-mono text-[12px] leading-relaxed text-[var(--info)]">
      <code>{children}</code>
    </pre>
  );
}

const STATES: [string, string][] = [
  ["Working", "A real event came from it: a real lead from the marked form, real field timings from a marked field, a real click on a marked element. This is the only state that proves it works."],
  ["Found, waiting for activity", "The tracker saw the attribute on a page, but nobody has used it yet. Submit your own form or click your own button once to prove it."],
  ["Misplaced", "The attribute is on the wrong kind of element, or has the wrong value. The check names the page and what is wrong."],
  ["Not in use", "The tracker has not seen the attribute on any page it has loaded. The attributes are optional, so this is not a problem."],
];

export default function TrackingAttributesPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[var(--ink)]">Tracking attributes</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
        Four optional HTML attributes tell Jellyhook what matters on your pages. Everything works without them; they exist so you can decide
        in code which form is a lead, which fields are measured, which fields are left out and which buttons are counted. Which forms count as
        leads can also be set without code, in Settings, Lead forms.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">data-conversion: decide in code whether a form is a lead</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Optional. By default every form with an email counts as a lead, and each form has a switch in Settings, Lead forms.{" "}
            <code className="ff-mono text-[var(--ink-2)]">data-conversion=&quot;true&quot;</code> makes a form always a lead and{" "}
            <code className="ff-mono text-[var(--ink-2)]">data-conversion=&quot;false&quot;</code> never one. The attribute wins over the switch, and the form&apos;s row in Settings shows
            that it is set in code. Put it on the <code className="ff-mono text-[var(--ink-2)]">&lt;form&gt;</code> element itself, or on any element around it (needed for forms a
            tool such as HubSpot builds for you; see Supported forms). Sites created with the older choice &quot;Only the form I label&quot; keep that behaviour: a form
            counts only when it carries the attribute or is switched on in Settings.
          </p>
          <CodeBlock>{`<form data-conversion="true">\n  ...\n</form>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The value must be exactly <code className="ff-mono text-[var(--ink-2)]">true</code> or <code className="ff-mono text-[var(--ink-2)]">false</code>. On the form itself or on an element
            around it is fine; on a button it does nothing.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">data-track-field: which fields are measured</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            By default every field of a form is measured: how long people stay in it and where they stop. Add{" "}
            <code className="ff-mono text-[var(--ink-2)]">data-track-field</code> to some fields and only those are measured (and only those are stored in the
            lead&apos;s raw form data). A form with no marked field keeps tracking all of them.
          </p>
          <CodeBlock>{`<form data-conversion="true">\n  <input name="email" data-track-field>\n  <input name="company" data-track-field>\n  <input name="notes">   <!-- not measured -->\n</form>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            It goes on the input itself, or on a wrapper around it, and it must be inside a form. The lead&apos;s name, email and phone are still
            recognised from the form as before, so restricting fields does not stop a lead from being identified.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">data-jh-ignore: which fields are left out</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Put it on a field, or on an element around it inside the form, and that field is left out completely: no value, no timing, not in the
            field list. Payment cards, bank accounts and identity numbers are already left out automatically; use this for anything else you do not
            want stored.
          </p>
          <CodeBlock>{`<div data-jh-ignore>\n  <textarea name="medical_history"></textarea>\n</div>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Details and the full list of what is never stored:{" "}
            <Link href="/docs/concepts/sensitive-fields" className="text-[var(--lime)] hover:underline">
              Sensitive fields
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">data-track-click: which buttons are counted</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Clicks are not recorded unless you ask. Put the attribute on a button or link and give the click a name; the name is what you will see
            in your data.
          </p>
          <CodeBlock>{`<a href="/pricing" data-track-click="hero-pricing">See pricing</a>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            With an empty value, the element&apos;s id is used, then its visible text. Repeated clicks on the same name within one second count once.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Checking they work</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            People put these attributes in the wrong place and assume they work. Open{" "}
            <Link href="/docs/reference/settings" className="text-[var(--lime)] hover:underline">
              Settings
            </Link>
            , Tracking, Attribute check. Each attribute shows one of four states, per page:
          </p>
          <div className="divide-y divide-[var(--rule)] border-t border-b border-[var(--rule)]">
            {STATES.map(([state, desc]) => (
              <div key={state} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-60 sm:shrink-0">{state}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[var(--ink-soft)]">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The tracker reports what it finds when a page loads, at most once every six hours per page, so a fix shows up the next time the page is
            opened after that.
          </p>
        </div>
      </div>
    </div>
  );
}
