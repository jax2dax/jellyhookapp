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
      <span className="ff-mono text-[10px] uppercase tracking-[0.3em] text-[var(--ink-mute)]">Feature reference</span>
      <h1 className="mt-3 ff-display text-3xl text-[var(--ink)]">Team and invites</h1>
      <p className="mt-5 max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
        A site can have more than one person with access to it. The Team page in the sidebar has the invite box on top, the invites waiting
        for an answer under it, then the team. Leaving a site is in{" "}
        <Link href="/docs/reference/settings" className="text-[var(--lime)] hover:underline">
          Site settings
        </Link>
        .
      </p>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">When you would use it</h2>
          <p className="max-w-2xl ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            You run the site and someone else answers the leads. You invite them by email from the Team page and they join as a member:
            they can open every lead and its visit history before they call, but they cannot change the site&apos;s key, its settings or
            its team.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Roles</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Three roles. Everyone can see and use every page a site tracks: the dashboard, leads, conversions and every lead&apos;s full history.
            The difference is what they can change.
          </p>
          <div className="mt-4 divide-y divide-[var(--rule)] border-t border-b border-[var(--rule)]">
            {[
              ["Owner", "Everything: every setting, and inviting and removing people. Whoever created the site."],
              ["Admin", "Every setting the owner can change: rename the site, change its domain, regenerate the key, pause it, manage allowed hosts, lead forms and privacy. An admin cannot delete the site."],
              ["Member", "View only. Cannot change the site, its key, its team or its settings."],
            ].map(([role, desc]) => (
              <div key={role} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="ff-mono text-[12px] text-[var(--lime)] sm:w-24 sm:shrink-0">{role}</span>
                <span className="ff-body text-[13px] leading-relaxed text-[var(--ink-soft)]">{desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Settings only shows the controls your role can use, and the server refuses anything your role does not allow either way.
            Everyone you invite joins as a member. There is no button yet to make a member an admin.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Inviting someone</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The owner types a teammate&apos;s email on the Team page and presses Send Invite. Other people on the site see the team but not the
            invite box. If that person already has an account, access is granted the next time they sign in. If they do not have an account
            yet, they get access the moment they sign up with that exact email address.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The invite waits under &quot;Sent invites, awaiting response&quot; until the person signs in or signs up with the matching email.
            The owner can press Cancel invite at any time before that happens.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Accepting or declining</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            Signing in with an invited email shows an accept-or-decline screen before anything else. Accepting adds the site to that
            person&apos;s account straight away, as a member. Declining sends them to add their own site instead. The declined invite stays
            on the Team page, dimmed under Declined, and inviting the same email again sends a new invite.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Removing someone</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            The owner can remove anyone else from the Team page. Members and admins can also leave on their own from Settings → General →
            Your access.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Handing the site to someone else</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
            There is no button yet to transfer ownership, so the owner cannot leave the site either. When it comes, the rule is already set:
            the new owner must have accepted their invite, and the previous owner becomes an admin.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[var(--ink)] mb-3">Joining a site by matching domain</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[var(--ink-soft)]">
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
