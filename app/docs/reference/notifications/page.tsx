import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Hooks and notifications",
  description: "Hooks catch the new leads that have the marks you choose and tell your team, in Jellyhook and in Slack or a webhook.",
  alternates: { canonical: "/docs/reference/notifications" },
};

export default function NotificationsReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Feature reference"
        title="Hooks and notifications"
        intro="Which new leads should someone call right now? A hook answers that. It watches every new lead, and when one has all of the hook's marks, the lead is hooked: your team is told in Jellyhook, and in Slack or a webhook if you choose."
      />

      <Section title="When you would use it">
        <P>
          Say you have a mark &quot;Pricing reader&quot; and another &quot;Came back&quot;. A lead who has both is worth a call today. You make a hook with
          those two marks, tell your sales colleague, and send it to #sales in Slack too. The next lead who sends the form with both marks is hooked: it
          shows up in Hooked leads, in their notifications and in #sales a few seconds later.
        </P>
      </Section>

      <Section title="The Hooks page">
        <P>
          <B>Hooks</B> in the sidebar. Three tabs:
        </P>
        <H3>Hooked leads</H3>
        <P>Every lead one of your hooks caught, newest first, with the hooks that caught it. Click one to open the lead.</P>
        <H3>Hooks</H3>
        <P>
          Every hook on the site, with its marks, who it tells and where. <B>Add hook</B> opens the editor. Each hook has a <B>Live</B> /{" "}
          <B>Paused</B> button: a paused hook catches nothing until it is live again. The editor has the hook&apos;s name at the top (New hook until you
          change it) and these rows:
        </P>
        <DataTable
          head={["Row", "What it does"]}
          rows={[
            [<B key="a">Lead marks</B>, "One or more of your marks. The lead must have all of them. Marks shared by teammates can be picked after Copy to my marks."],
            [<B key="e">Notify</B>, "All (every member, the default) or Custom (the members you pick). Picking people is how you hand a kind of lead to someone."],
            [<B key="d">Message</B>, <span key="d2">A Subject and a message. Left empty, the message reads <C>{"{lead} matched {marks}"}</C>. <C>{"{lead}"}</C> is the lead&apos;s name in Jellyhook and &quot;a new lead&quot; outside it. <C>{"{marks}"}</C> is the mark names.</span>],
            [<B key="f">Notification method</B>, "In app (always on) and any Slack channels and webhooks you click. A channel that is not picked is shown dimmed."],
            [<B key="g">Add lead to group (optional)</B>, "Also puts every lead this hook catches into a group."],
          ]}
        />
        <H3>Integrations</H3>
        <P>
          Where hooks can send outside Jellyhook: <B>Slack</B> (Connect opens Slack&apos;s own screen to pick a channel; a webhook URL can be pasted
          instead) or <B>Webhook</B> (any https address, for example Zapier, Make or your CRM). A channel that keeps failing is marked
          &quot;Failing&quot; with the last error.
        </P>
      </Section>

      <Section title="The Notifications page">
        <UL>
          <li>
            <B>From Jellyhook</B>: updates from us about the product. A red dot (no number) on <B>Notifications</B> in the sidebar while one is unread. In
            the app only, never in Slack.
          </li>
          <li>
            Your inbox: one entry for every lead a hook caught for you. A yellow circle with the number of entries you have not opened. Click one to
            open the lead; <B>Mark all as read</B> clears the number.
          </li>
        </UL>
      </Section>

      <Section title="What it needs">
        <UL>
          <li>At least one mark of your own that is switched on. Make one on the Leads page.</li>
          <li>A new form submission. Hooks are checked when the form is sent and again when that visit ends. Leads from before the hook existed are not caught.</li>
          <li>Only an owner or admin of the site can connect or remove integrations. Anyone on the site can make hooks.</li>
        </UL>
      </Section>

      <Section title="How it works">
        <UL>
          <li>When a form is sent, the lead is queued for its site. Each site&apos;s leads are checked in order, so one busy site does not slow another.</li>
          <li>The lead&apos;s marks are worked out, then every live hook is compared with them. A hook catches the lead when it has all of the hook&apos;s marks.</li>
          <li>The same person is caught by the same hook at most once in 24 hours, so a visitor who sends three forms in a row makes one notification, not three.</li>
          <li>Slack and webhook messages that fail are tried again later (after 30 seconds, 2 minutes, 10 minutes, 1 hour, 3 hours).</li>
        </UL>
        <Callout title="Hooks belong to the site">
          A hook is part of the site, not of the person who made it. It keeps running if they leave. Its maker, or an owner or admin, can change or
          delete it. Someone who leaves the site no longer gets its notifications and cannot see them.
        </Callout>
      </Section>

      <Section title="What is sent outside Jellyhook">
        <P>
          Slack and webhook messages carry the hook&apos;s subject, the message with &quot;a new lead&quot; in place of the name, the mark names, the site and
          a link to the lead. The link only opens for people signed in to the site. The lead&apos;s name, email, form answers and the conditions inside a mark
          are never sent.
        </P>
        <P>
          Webhook requests are signed. When you add a webhook you get a signing secret once. Each request has a header{" "}
          <C>X-Jellyhook-Signature: t=&lt;seconds&gt;,v1=&lt;hex&gt;</C>, where the hex is HMAC-SHA256 of <C>&lt;t&gt;.&lt;raw body&gt;</C> with that secret.
          Check it, and reject requests whose time is old.
        </P>
      </Section>

      <Section title="When it is empty or looks wrong">
        <UL>
          <li>&quot;No hooks yet.&quot; Make one with Add hook.</li>
          <li>A mark on a hook is shown in red: it is off or was deleted, and the hook is paused until you turn it on or replace it.</li>
          <li>No hooked lead you expected: check that the lead has every mark of the hook, that the hook is Live, and that the same person was not caught by it in the last 24 hours.</li>
          <li>&quot;Hooks are not set up on this database yet&quot;: the site&apos;s database is missing the tables.</li>
        </UL>
      </Section>

      <Section title="Limits">
        <UL>
          <li>10 hooks per person per site, and up to 10 marks in one hook.</li>
          <li>500 Slack and webhook messages per site per day. In-app notifications are not capped.</li>
          <li>Marks connected to a published mark cannot be used in a hook. Use a copy.</li>
          <li>No email or SMS yet. A hook needs all of its marks (no &quot;any of these&quot;).</li>
        </UL>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/marks" className="text-[var(--lime)] hover:underline">Marks</Link>,{" "}
          <Link href="/docs/reference/groups" className="text-[var(--lime)] hover:underline">Lead groups</Link>,{" "}
          <Link href="/docs/reference/team" className="text-[var(--lime)] hover:underline">Team and invites</Link>.
        </P>
      </Section>
    </div>
  );
}
