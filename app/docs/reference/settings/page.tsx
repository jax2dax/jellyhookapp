import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Site settings",
  description: "What can actually be changed about a site after it is created.",
  alternates: { canonical: "/docs/reference/settings" },
};

export default function SettingsReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Site settings</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        A smaller list than it might seem. Some choices made when the site was first created cannot be changed
        here later.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Name and domain</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Both editable by the owner and admins. The domain is not just a label: the tracker must report from it, so after you change it the
            site has to be verified again and events from the old domain stop being recorded until then. Nothing already recorded is affected.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">API key</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Can be copied or regenerated. Regenerating issues a new key and the old one keeps working for <strong className="text-[#c9c7bd]">72 hours</strong>, or
            until your site first sends data with the new key, so a live site does not lose data while you update the script. Settings shows how much of
            that time is left. After that the old key is rejected.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Tracking</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Shows whether the site is verified (or when an unverified setup expires), when data last arrived, and an Attribute check that tells
            you, per page, whether <code className="ff-mono text-[#c9c7bd]">data-conversion</code>, <code className="ff-mono text-[#c9c7bd]">data-track-field</code> and{" "}
            <code className="ff-mono text-[#c9c7bd]">data-track-click</code> are installed correctly and actually producing data. See{" "}
            <Link href="/docs/concepts/tracking-attributes" className="text-[var(--lime)] hover:underline">
              Tracking attributes
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Allowed hosts</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Events are recorded only from your domain and its subdomains. Add another website here, such as a staging site or{" "}
            <code className="ff-mono text-[#c9c7bd]">localhost</code> while testing, and its events are recorded too. If the tracker has been turned away from
            some other host, Settings says which one and offers to allow it.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Pause and resume</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Pausing stops the site from accepting new tracking data without removing the script or any data
            already collected. Resume to start accepting it again. This is reversible, any time.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Team members</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The owner and admins can, from this page, invite a teammate by email and remove members. Only the owner can hand ownership to someone else.
            What each role can do is on the team page. The{" "}
            <Link href="/docs/reference/team" className="text-[var(--lime)] hover:underline">
              Network page
            </Link>{" "}
            does the exact same thing with a different layout. Use whichever one you land on first; they share the
            same team list.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Which forms count as leads</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Choose between only forms labeled with <code className="ff-mono text-[#c9c7bd]">data-conversion=&quot;true&quot;</code> (recommended) or every form on the
            site. You can change it any time; it applies within about a minute and leads already recorded are not changed.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Leaving a site</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Admins and members can leave a site from Settings. The owner cannot: transfer ownership first.
          </p>
        </div>
      </div>
    </div>
  );
}
