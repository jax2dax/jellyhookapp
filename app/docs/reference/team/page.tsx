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
            Owner and member. The owner is whoever created the site, or whoever an invite names as the owner. A
            member can see and use every page a site tracks, the same as the owner: the dashboard, leads,
            conversions, and every lead&apos;s full history. What a member cannot do is change the site itself:
            invite or remove anyone, rename the site, change its domain, regenerate the API key, or pause the site.
            Those actions are owner-only.
          </p>
          <p className="mt-3 ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The Site settings page does not currently hide these controls from a member, it only blocks the action
            itself when they try it, with an error saying it is owner-only. Seeing the button is not the same as
            being able to use it.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Inviting someone</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            The owner enters a teammate&apos;s email and sends the invite. If that person already has an account,
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
            Only the owner can remove a member, and only someone other than themself. There is currently no
            self-serve way for a member to remove their own access and leave a site; ask the owner to remove you
            instead.
          </p>
        </div>

        <div>
          <h2 className="ff-display text-xl text-[#f4f2ea] mb-3">Joining a site by matching domain</h2>
          <p className="ff-body text-[14px] leading-relaxed text-[#8b8980]">
            One account can belong to more than one site, switchable from the site name at the top of the sidebar.
            But adding a new site with an email that matches an existing, already-registered domain joins that
            existing site automatically instead of creating a duplicate registration for the same domain. This is
            also why the domain entered when a site is created matters beyond tracking: it is what a teammate&apos;s
            work email gets matched against.
          </p>
        </div>
      </div>
    </div>
  );
}
