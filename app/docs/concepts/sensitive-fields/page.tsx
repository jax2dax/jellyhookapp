import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sensitive fields",
  description: "Which form values Jellyhook never stores (payment cards, bank accounts, identity numbers), how they are recognised, and how to leave out any other field with data-jh-ignore.",
  alternates: { canonical: "/docs/concepts/sensitive-fields" },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto border border-[#1b1b18] bg-[#0a0a09] p-4 ff-mono text-[12px] leading-relaxed text-[#4fc3ff]">
      <code>{children}</code>
    </pre>
  );
}

const NEVER: [string, string][] = [
  ["Payment cards", "Card number, security code (CVV, CVC, CSC), expiry date. Also any value that is a valid card number, whatever the field is called."],
  ["Bank accounts", "IBAN, BIC or SWIFT code, routing number, sort code, account number."],
  ["Identity and tax numbers", "Social security number, national insurance number, national id, passport number, tax id (TIN, ITIN, EIN). Also any value written like a US social security number (123-45-6789)."],
  ["Secrets", "Passwords and PINs."],
];

const RULES: [string, string][] = [
  ["The field says it is a card field", "Its autocomplete attribute starts with cc- (cc-number, cc-csc, cc-exp). Browsers and payment forms set this."],
  ["Its name or label says so", "The field's name, id, placeholder, accessible label or visible label is one of the words above, for example card_number, Card Number, cvv, IBAN, Social Security Number, passport_no, tax_id."],
  ["The value looks like one", "13 to 19 digits that pass the checksum every payment card uses, or the pattern 123-45-6789. Phone fields are never checked this way, because a long phone number can pass the checksum by chance."],
  ["The site owner says so", "The field, or an element around it inside the form, carries data-jh-ignore."],
];

export default function SensitiveFieldsPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Sensitive fields</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        When a visitor submits a lead form, Jellyhook stores what they entered so you can see the lead. Some values should never be stored by a
        lead tool at all: payment cards, bank accounts and identity numbers. Jellyhook leaves those out automatically, in the visitor&apos;s browser,
        before anything is sent. You can leave out any other field yourself with one attribute.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">When this matters</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A consultancy&apos;s enquiry form also takes a deposit: it has a card number and a security code below the message box. With Jellyhook
            installed, the lead arrives with the name, email, company and message. The card details never leave the visitor&apos;s browser, so they
            are not in your Jellyhook data, not in exports and not in anything an AI app connected to your account can read.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">What is never stored</h2>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {NEVER.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-60 sm:shrink-0">{k}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">How a field is recognised</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">A field is left out when any one of these is true:</p>
          <div className="divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {RULES.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-60 sm:shrink-0">{k}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">{v}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The same rules run again on Jellyhook&apos;s servers when a submission arrives, so a value is still removed if an old copy of the script is
            cached in a visitor&apos;s browser. HubSpot forms follow the same rules, using the field names HubSpot reports.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">data-jh-ignore: leave out any other field</h2>
          <p className="mb-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            For anything the rules above cannot know about, such as a medical question, an internal reference or a free-text box you would rather not
            keep, add <code className="ff-mono text-[#c9c7bd]">data-jh-ignore</code> to the field or to an element around it inside the form.
          </p>
          <CodeBlock>{`<form data-conversion="true">\n  <input name="email">\n  <input name="name">\n  <div data-jh-ignore>\n    <label>Describe your symptoms</label>\n    <textarea name="symptoms"></textarea>\n  </div>\n</form>`}</CodeBlock>
          <p className="mt-4 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            An ignored field is left out of everything: its value, its timing, the form&apos;s field list and validation errors. It is also not used to
            find the lead&apos;s name, email or phone, so do not put it on those fields. On the form element itself, it leaves out every field: only the
            fact that the form was submitted is recorded.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">What is still recorded for a sensitive field</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A field recognised by the rules (not one marked data-jh-ignore) still appears in{" "}
            <Link href="/docs/concepts/form-engagement" className="text-[var(--lime)] hover:underline">
              form engagement
            </Link>{" "}
            with its timing: when it was clicked into and how long the visitor spent in it. This shows, for example, that people stop at the card
            number. Its value is never recorded, there or anywhere else. To leave out the timing too, use data-jh-ignore.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Limits</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Recognition works from names, labels and value patterns. A sensitive field with a meaningless name and no label (for example
            &quot;field_12&quot;) whose value does not look like a card or social security number cannot be recognised: mark it with data-jh-ignore.
            Card fields inside a payment provider&apos;s own frame (Stripe, PayPal and similar) are never visible to Jellyhook at all. Submissions
            stored before 14 October 2026 were not filtered this way.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Related</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            <Link href="/docs/concepts/tracking-attributes" className="text-[var(--lime)] hover:underline">Tracking attributes</Link>,{" "}
            <Link href="/docs/concepts/form-engagement" className="text-[var(--lime)] hover:underline">Form engagement</Link>,{" "}
            <Link href="/docs/concepts/privacy-consent" className="text-[var(--lime)] hover:underline">Privacy and consent</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
