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
            A tracked form moves through, at most: viewed (at least half of it came on screen), started (a field was
            focused for the first time), and then either submitted or abandoned. Abandoned means started and not
            submitted: a form that was only seen, and never clicked into, stays viewed. It never goes backward. A form
            that reaches started cannot fall back to viewed just because a duplicate event arrives out of order.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Per-field timing</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            For every field the visitor touches, Jellyhook records how long they spent actually focused on it, in
            the order they filled the fields in. If someone fills the email field, moves on, then comes back later
            to fix it, both visits count toward its total, and each visit is kept on its own, so the pause between
            fields and the return to a field can be shown exactly. This is what the Form activity drawing on a
            lead&apos;s page is built from.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Reading the form drawing</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Each form is drawn in three parts. At the top, a row of number tiles: how long before typing, the total activity on the form (first
            input until it was submitted or given up, pauses and time away included), time in fields, pausing, on other pages and away from the site, and how many fields were touched. Below
            that, the Timeline: the whole form on one line, in the order things happened, with pauses, other pages and time away as coloured
            blocks. Below the rule, the fields: one numbered row per field in the order they were used.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A field&apos;s bar has two parts: a light start (clicked in, nothing typed yet) and a solid part (typing). Each part carries its own
            seconds, for example 2 s in the light part and 11 s in the solid part: together the 13 seconds the field was in use. When the light
            part is too short for its seconds, one text sits on the solid part instead, such as &quot;13 s (2 s before typing)&quot;: the 13 seconds
            already include the 2, they are not added. When the bar is too short for that, only the seconds are inside; when it is too short for any text, the seconds
            are written next to it. The lighter start of a bar is the time clicked in without typing yet. A field with a dashed outline was
            never touched. The Timeline is a summary of the rows beneath it, not a field: each field block in it carries the field&apos;s number and name above it
            (just the number when the block is narrow) and its seconds inside, matching the numbered rows below.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">What else is recorded, and what never is</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            For each field: whether it was filled or left empty when the visitor moved on, how many times its value was
            changed, and how many times the browser refused the form because that field was invalid (for example a
            required field left empty). For each form: its list of fields with their type and whether they are
            required, so fields nobody touched can be shown, and how long the form was on screen before the visitor
            started. Nothing the visitor types is recorded, not even its length: only times, counts and yes or no.
            The values of a submitted lead form are captured as before, when it is submitted.
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
            filled in. Validation errors are only the browser&apos;s own checks (required fields, email format); a
            site&apos;s own error messages are not seen. Forms filled before 14 October 2026 have totals only, so a
            field visited more than once is drawn as approximate.
          </p>
        </div>
      </div>
    </div>
  );
}
