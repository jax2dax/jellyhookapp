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
        What you can change about a site after it is created, and who is allowed to. Owners and admins change
        most of it; members can only view. Settings has a sidebar with four groups, and each entry opens its own page:
        Workspace (General), Tracking (Installation, Connection, Attribute check), Forms (Lead forms, Form fields) and
        Integrations (AI access, when it is switched on). Old links such as <code className="ff-mono text-[#c9c7bd]">?tab=fields</code> still open the right page.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">General: name and domain</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Both editable by the owner and admins. The domain is not just a label: the tracker must report from it, so after you change it the
            site has to be verified again and events from the old domain stop being recorded until then. Nothing already recorded is affected.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Installation: script and API key</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Can be copied or regenerated. Regenerating issues a new key and the old one keeps working for <strong className="text-[#c9c7bd]">72 hours</strong>, or
            until your site first sends data with the new key, so a live site does not lose data while you update the script. Settings shows how much of
            that time is left. After that the old key is rejected.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Connection and Attribute check</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Connection shows whether the site is verified (or when an unverified setup expires) and when data last arrived. Attribute check tells
            you, per page, whether the optional attributes <code className="ff-mono text-[#c9c7bd]">data-conversion</code>, <code className="ff-mono text-[#c9c7bd]">data-track-field</code> and{" "}
            <code className="ff-mono text-[#c9c7bd]">data-track-click</code> are found and actually producing data. An attribute you do not use reads &quot;Not in use&quot;, which is not a problem. The time on a page row is the last real
            event of that kind, for example the last lead from a marked form, not the last event of the site. See{" "}
            <Link href="/docs/concepts/tracking-attributes" className="text-[var(--lime)] hover:underline">
              Tracking attributes
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Connection: allowed hosts</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
Events are recorded only from your domain and its subdomains. Add another website here only if it really is part of the site, such as a separate checkout
            domain. Everything from an allowed host is recorded into the site&apos;s real analytics and mixed with it, so do not add test, staging or local copies. If the tracker
            has been turned away from some other host, Settings says which one and offers to allow it.
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
            The owner and admins invite a teammate by email and remove members on the{" "}
            <Link href="/docs/reference/team" className="text-[var(--lime)] hover:underline">
              Team page
            </Link>
            . Only the owner can hand ownership to someone else. What each role can do is described there.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Lead forms: which forms count as leads</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Lists every form Jellyhook has seen a submission from, with its page, its leads, the submissions it skipped and a <strong className="text-[#c9c7bd]">Lead</strong> and a{" "}
            <strong className="text-[#c9c7bd]">Not a lead</strong> switch. By default every form with an email counts. A form that is not a lead is only counted; its name,
            email and answers are never kept. A form marked with <code className="ff-mono text-[#c9c7bd]">data-conversion</code> in your page shows &quot;marked in code&quot; and its
            switch is locked, because the attribute wins. At the top, <strong className="text-[#c9c7bd]">Forms found from now on</strong> sets what a new form does: count as a
            lead (every site created recently) or wait until you switch it on (sites created with &quot;Only the form I label&quot;). Changes apply within about a minute; leads already
            recorded are not changed. Only the owner and admins can change it.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Form fields</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Readable names for the fields of your forms, used by marks that look at answers. See{" "}
            <Link href="/docs/reference/form-fields" className="text-[var(--lime)] hover:underline">
              Form fields
            </Link>
            .
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
