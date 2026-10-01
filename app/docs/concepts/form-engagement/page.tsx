import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Form engagement",
  description: "What Jellyhook tracks about a form before it is ever submitted, and when it actually gets marked abandoned.",
  alternates: { canonical: "/docs/concepts/form-engagement" },
};

export default function FormEngagementPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Core concepts</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Form engagement</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        A form submission is one moment. Everything that happened before it, or instead of it, is form engagement.
        It answers a question a plain submission count cannot: how far did someone actually get before they gave up.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The four states</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A tracked form moves through, at most: viewed (it scrolled into view), started (a field was focused for
            the first time), and then either submitted or abandoned. It never goes backward. A form that reaches
            started cannot fall back to viewed just because a duplicate event arrives out of order.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Per-field timing</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            For every field the visitor touches, Jellyhook records how long they spent actually focused on it, in
            the order they filled the fields in. If someone fills the email field, moves on, then comes back later
            to fix it, both visits to that field count toward its total. This is what the Field Timing chart on a
            lead&apos;s page is built from: which field took the longest, and in what order they were filled.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Leaving the page is not the same as abandoning the form</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Switching tabs, or briefly visiting another page on the same site, does not mark a form abandoned. The
            visitor might come straight back and keep typing. A form only gets marked abandoned once the whole
            visit is actually over, not just the current page. When that happens, the abandoned time recorded is
            the real last moment they were doing something in the form, never the moment the system happened to
            notice they were gone.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">A limitation worth knowing</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            This only sees fields a person actually focuses. A field filled by browser autofill without ever
            receiving a focus event, which happens in some browsers, will not show timing data, even though it was
            filled in.
          </p>
        </div>
      </div>
    </div>
  );
}
