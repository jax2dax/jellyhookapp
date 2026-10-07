import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Team and invites",
  description: "How to invite a teammate to a site, what happens when they accept, and what each role can do.",
  alternates: { canonical: "/docs/reference/team" },
};

export default function TeamReferencePage() {
  return (
    <div>
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[#77756d]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[#f4f2ea]">Team and invites</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[#8b8980]">
        A site can have more than one person with access to it. The Network page and the Team members section on{" "}
        <Link href="/docs/reference/settings" className="text-[var(--lime)] hover:underline">
          Site settings
        </Link>{" "}
        both manage the same underlying team list, just laid out differently. Either one works.
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Roles</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Three roles. Everyone can see and use every page a site tracks: the dashboard, leads, conversions and every lead&apos;s full history.
            The difference is what they can change.
          </p>
          <div className="mt-4 divide-y divide-[#1b1b18] border-t border-b border-[#1b1b18]">
            {[
              ["Owner", "Everything. Also the only role that can delete the site and transfer ownership. Whoever creates the site, or is named by a transfer."],
              ["Admin", "Everything the owner can do except override the owner: rename the site, change its domain, regenerate the key, pause it, manage allowed hosts, invite and remove people, promote members. An admin cannot delete the site, transfer ownership, remove the owner or change another admin's role."],
              ["Member", "View only. Cannot change the site, its key, its team or its settings."],
            ].map(([role, desc]) => (
              <div key={role} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-24 sm:shrink-0">{role}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[#8b8980]">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Settings only shows the controls your role can use, and the server refuses anything your role does not allow either way. More roles, and
            custom permissions per role, are planned.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Inviting someone</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The owner or an admin enters a teammate&apos;s email and sends the invite (the owner can invite an admin too). If that person already has an account,
            access is granted the next time they sign in. If they do not have an account yet, they get access the
            moment they sign up with that exact email address.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            An invite sits as pending until the person it was sent to signs in or signs up with the matching email.
            The owner can cancel a pending invite at any time before that happens.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Accepting or declining</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            Signing in with an invited email shows an accept-or-decline screen before anything else. Accepting adds
            the site to that person&apos;s account and gives them a member role immediately. Declining removes the
            invite and sends them to add their own site instead.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Removing someone</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The owner and admins can remove a member, never themselves, and never the owner. To step down as owner, transfer ownership first. Members and admins can
            also leave on their own from Settings, Your access. The owner cannot leave until ownership is transferred.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Transferring ownership</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The owner can make any active member the new owner from the team list. The previous owner becomes an admin: they keep working access but
            lose the owner-only rights. The new owner must already have accepted their invite.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Joining a site by matching domain</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One account can belong to more than one site, switchable from the site name at the top of the sidebar.
            Adding a domain that another account has already verified, using a work email on that domain (not a mailbox provider such as Gmail),
            joins that existing site as a member instead of creating a duplicate. Without a matching email, an invite is the way in. This is
            also why the domain entered when a site is created matters beyond tracking: it is what a teammate&apos;s
            work email gets matched against.
          </p>
        </div>
      </div>
    </div>
  );
}
