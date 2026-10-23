import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Get told when a new lead has the marks you care about, in Jellyhook and in Slack or a webhook.",
  alternates: { canonical: "/docs/reference/notifications" },
};

export default function NotificationsReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Feature reference"
        title="Notifications"
        intro="Which new leads should someone look at right now? A notification rule answers that. When a new lead has all the marks a rule names, the people you chose are told in Jellyhook, and in Slack or a webhook if you add one."
      />

      <Section title="When you would use it">
        <P>
          Say you have a mark &quot;Pricing reader&quot; and another &quot;Came back&quot;. A lead who has both is worth a call today. You make a rule
          with those two marks, choose your sales colleague as the person to tell, and send it to #sales in Slack too. The next lead who sends the
          form with both marks shows up in their bell and in #sales a few seconds later.
        </P>
      </Section>

      <Section title="What you see">
        <P>
          <B>Notifications</B> in the sidebar, with a count of unread ones. The page has three tabs.
        </P>
        <H3>Inbox</H3>
        <P>
          The notifications that reached you, newest first. Click one to open the lead. <B>Mark all as read</B> clears the count. Empty state: &quot;No
          notifications yet.&quot;
        </P>
        <H3>Rules</H3>
        <P>
          Every rule on the site, with its marks, who it tells and where. <B>Add action</B> opens the editor. Each rule has a switch: a rule that is off
          does nothing until it is on again. The editor has the rule&apos;s name at the top (New rule until you change it) and these rows:
        </P>
        <DataTable
          head={["Row", "What it does"]}
          rows={[
            [<B key="a">Lead marks</B>, "One or more of your marks. The lead must have all of them. Marks shared by teammates can be picked after Copy to my marks."],
            [<B key="e">Notify</B>, "All (every member, the default) or Custom (the members you pick). Picking people is how you hand a kind of lead to someone."],
            [<B key="d">Message</B>, <span key="d2">A Subject and a message. Left empty, the message reads <C>{"{lead} matched {marks}"}</C>. <C>{"{lead}"}</C> is the lead&apos;s name in Jellyhook and &quot;a new lead&quot; outside it. <C>{"{marks}"}</C> is the mark names.</span>],
            [<B key="f">Integrations</B>, "The Slack channels and webhooks this rule also sends to. Every rule notifies inside Jellyhook."],
            [<B key="g">Add to group</B>, "Optional: add the lead to a group as well."],
          ]}
        />
        <H3>Channels</H3>
        <P>
          The outside places rules can send to: <B>Slack</B> (an incoming webhook URL from Slack) or <B>Webhook</B> (any https address,
          for example Zapier, Make or your CRM). <B>Send test</B> posts a test message before you connect. A channel that keeps failing is marked
          &quot;failing&quot; with the last error.
        </P>
      </Section>

      <Section title="What it needs">
        <UL>
          <li>At least one mark of your own that is switched on. Make one on the Leads page.</li>
          <li>A new form submission. Rules are checked once, when the form is sent. Leads from before the rule existed are not notified.</li>
          <li>Only an owner or admin of the site can add or remove channels. Anyone on the site can make rules.</li>
        </UL>
      </Section>

      <Section title="How it works">
        <UL>
          <li>When a form is sent, the lead is queued for its site. Each site&apos;s leads are checked in order, so one busy site does not slow another.</li>
          <li>The lead&apos;s marks are worked out, then every rule that is on is compared with them. A rule fires when the lead has all of its marks.</li>
          <li>The same person fires the same rule at most once in 24 hours, so a visitor who sends three forms in a row makes one notification, not three.</li>
          <li>Slack and webhook messages that fail are tried again later (after 30 seconds, 2 minutes, 10 minutes, 1 hour, 3 hours).</li>
        </UL>
        <Callout title="Rules belong to the site">
          A rule is part of the site, not of the person who made it. It keeps running if they leave. Its maker, or an owner or admin, can change
          or delete it. Someone who leaves the site no longer gets its notifications and cannot see them.
        </Callout>
      </Section>

      <Section title="What is sent outside Jellyhook">
        <P>
          Slack and webhook messages carry the rule&apos;s title, the message with &quot;a new lead&quot; in place of the name, the mark names, the
          site and a link to the lead. The link only opens for people signed in to the site. The lead&apos;s name, email, form answers and the
          conditions inside a mark are never sent.
        </P>
        <P>
          Webhook requests are signed. When you add a webhook you get a signing secret once. Each request has a header{" "}
          <C>X-Jellyhook-Signature: t=&lt;seconds&gt;,v1=&lt;hex&gt;</C>, where the hex is HMAC-SHA256 of <C>&lt;t&gt;.&lt;raw body&gt;</C> with
          that secret. Check it, and reject requests whose time is old.
        </P>
      </Section>

      <Section title="When it is empty or looks wrong">
        <UL>
          <li>&quot;No rules yet.&quot; Make one with Add action.</li>
          <li>A mark on a rule is shown in red: it is off or was deleted, and the rule is paused until you turn it on or replace it.</li>
          <li>No notification for a lead you expected: check that the lead has every mark of the rule, that the rule is on, and that the same person did not fire it in the last 24 hours.</li>
          <li>&quot;Notifications are not set up on this database yet&quot;: the site&apos;s database is missing the notifications tables.</li>
        </UL>
      </Section>

      <Section title="Limits">
        <UL>
          <li>10 rules per person per site, and up to 10 marks in one rule.</li>
          <li>500 Slack and webhook messages per site per day. In Jellyhook notifications are not capped.</li>
          <li>Marks connected to a published mark cannot be used in a rule. Use a copy.</li>
          <li>No email or SMS yet. No &quot;any of these marks&quot; rules: a rule needs all of its marks.</li>
        </UL>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/groups" className="text-[var(--lime)] hover:underline">Lead groups</Link>,{" "}
          <Link href="/docs/reference/leads" className="text-[var(--lime)] hover:underline">Leads page</Link>,{" "}
          <Link href="/docs/reference/team" className="text-[var(--lime)] hover:underline">Team and invites</Link>.
        </P>
      </Section>
    </div>
  );
}
