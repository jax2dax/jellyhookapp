import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Site settings",
  description: "What can be changed about a site after it is created, and who can change it.",
  alternates: { canonical: "/docs/reference/settings" },
};

const H2 = "ff-display text-xl text-[var(--ink)] mb-3";
const P = "ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]";
const B = "text-[var(--ink-2)]";
const CODE = "ff-mono text-[var(--ink-2)]";
const LINK = "text-[var(--lime)] hover:underline";

export default function SettingsReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[var(--ink)]">Site settings</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
        Settings has a sidebar with five groups: Workspace, Tracking, Forms, Privacy and Integrations (AI access, when it is switched on).
        Owners and admins can change settings; members can view them. Old links such as <code className={CODE}>?tab=fields</code> still open the
        right page.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className={H2}>General</h2>
          <p className={P}>
            <strong className={B}>Name and domain.</strong> The tracker must report from the domain, so after a domain change the site is verified
            again, and events from the old domain are not recorded until then. Data already recorded is unaffected.{" "}
            <strong className={B}>Pause and resume.</strong> Pausing stops new data from being recorded without removing the script or existing
            data; resuming starts recording again. <strong className={B}>Leave the site.</strong> Admins and members can leave; the owner must
            transfer ownership first. Teammates are invited and removed on the{" "}
            <Link href="/docs/reference/team" className={LINK}>
              Team page
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className={H2}>Installation</h2>
          <p className={P}>
            The script and the API key, ready to copy. Regenerating the key issues a new one; the old key keeps working for{" "}
            <strong className={B}>72 hours</strong>, or until the site first sends data with the new key, so a live site does not lose data
            during the change. Settings shows the time left.
          </p>
        </div>

        <div>
          <h2 className={H2}>Connection</h2>
          <p className={P}>
            Whether the site is verified (or when an unverified setup expires) and when data last arrived.{" "}
            <strong className={B}>Allowed hosts:</strong> events are recorded only from your domain and its subdomains. Add another website only
            if it is part of the site, such as a separate checkout domain; its traffic is mixed into the site&apos;s data, so do not add test or
            staging copies. When the tracker reports from a host that is not allowed, Settings names it and offers to allow it.
          </p>
        </div>

        <div>
          <h2 className={H2}>Attribute check</h2>
          <p className={P}>
            Per page, whether the optional attributes <code className={CODE}>data-conversion</code>, <code className={CODE}>data-track-field</code>{" "}
            and <code className={CODE}>data-track-click</code> are found and producing data. &quot;Not in use&quot; means the attribute is not on
            the page, which is fine if you do not need it. The time on each row is the last event of that kind, for example the last lead from a
            marked form. See{" "}
            <Link href="/docs/concepts/tracking-attributes" className={LINK}>
              Tracking attributes
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className={H2}>Forms</h2>
          <p className={P}>
            <strong className={B}>Lead forms</strong> lists every form that sent a submission, with its page, its leads, the submissions it skipped,
            and a <strong className={B}>Lead</strong> / <strong className={B}>Not a lead</strong> switch. By default every form with an email
            field counts. A form that is not a lead is only counted; its name, email and answers are not kept. A form marked with{" "}
            <code className={CODE}>data-conversion</code> shows &quot;marked in code&quot; and its switch is locked. <strong className={B}>Forms
            found from now on</strong> sets what a new form does: count as a lead, or wait until you switch it on. Changes apply within about a
            minute and do not change leads already recorded. <strong className={B}>Form fields</strong> gives your fields readable names for marks
            that use answers; see{" "}
            <Link href="/docs/reference/form-fields" className={LINK}>
              Form fields
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className={H2}>Privacy</h2>
          <p className={P}>
            <strong className={B}>Cookie banner</strong> shows the consent tool the tracker found on your pages, or{" "}
            <strong className={B}>No banner found</strong>. <strong className={B}>Data retention</strong> sets how long visits and leads are kept: 6,
            13 (the default) or 25 months, or everything. <strong className={B}>Erase a person</strong> deletes everything about someone who sent your
            form, by their email. See{" "}
            <Link href="/docs/concepts/privacy-consent" className={LINK}>
              Privacy and consent
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
