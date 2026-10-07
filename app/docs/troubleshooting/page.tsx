import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Troubleshooting",
  description: "What to check when something in the dashboard looks wrong.",
  alternates: { canonical: "/docs/troubleshooting" },
};

export default function TroubleshootingPage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Troubleshooting</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Troubleshooting</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        Real cases, not a general list of things that could theoretically go wrong.
      </p>

      <div className="mt-12 space-y-12">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">A page in the session replay chart shows an impossible duration</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A blue frame (still open) with a duration in the tens or hundreds of thousands of minutes means a
            page view that was never properly closed, from before a specific fix, and its duration is being
            computed against right now every time the chart renders, growing a little more each day.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            If you see this: hard refresh the page first. Session data is cached in the browser for a short time
            (15 seconds for a still-open session, longer once it&apos;s closed), so a number that looked wrong a
            minute ago may already be stale rather than currently true. If it persists after a genuine reload,
            that is a real case worth reporting with the exact lead or visitor it belongs to, not a guess.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">The site is stuck on &quot;Pending Verification&quot;</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            See the checklist in{" "}
            <Link href="/docs/installation" className="text-[var(--lime)] hover:underline">
              Installation and setup
            </Link>
            . In short: confirm the script is actually deployed and live, on the exact domain you registered, with
            the right API key, and that nothing on the page is blocking it from loading at all.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">&quot;We received data from another-site.com&quot;</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Your script is running on a website that is not the one this site was registered for, so its events were not recorded. If you pasted the
            script on the wrong website, move it. If it is a staging copy or <code className="ff-mono text-[#c9c7bd]">localhost</code>, allow that host under Settings,
            Tracking, Allowed hosts. The count and the last time are shown there.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">&quot;Setup expired&quot;</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            A site that never received data from its own domain stops recording after 3 days. Nothing is lost that was recorded; nothing new is stored
            until you press Renew (Settings, Tracking, or the setup screen) and install the script. If someone else installed theirs on the same domain first,
            the domain is theirs and you can add a different one.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Data stopped after I changed the domain or regenerated the key</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Changing the domain means the tracker must now report from the new one, and the site is verified again; until then events from the old
            domain are turned away. Regenerating the key leaves the old key working for 72 hours: update the script on your site within that time.
            Settings, API key shows the time left.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">An attribute is installed but nothing happens</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Open Settings, Tracking, Attribute check. &quot;Found, waiting for activity&quot; means it is placed correctly and just has not been used;
            submit your form or click your button once. &quot;Misplaced&quot; names what is wrong, for example <code className="ff-mono text-[#c9c7bd]">data-conversion</code> on a div
            instead of the form. See{" "}
            <Link href="/docs/concepts/tracking-attributes" className="text-[var(--lime)] hover:underline">
              Tracking attributes
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">A referrer shows &quot;Direct&quot; when it shouldn&apos;t</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            This is expected in specific, real situations, not automatically a bug. See{" "}
            <Link href="/docs/concepts/referrers-attribution" className="text-[var(--lime)] hover:underline">
              Referrers and attribution
            </Link>{" "}
            for exactly which situations cause this and what actually fixes it.
          </p>
        </div>
      </div>
    </div>
  );
}
