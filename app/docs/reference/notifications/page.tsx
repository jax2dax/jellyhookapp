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
          <B>Hooks</B> in the sidebar, with a yellow circle showing how many leads your hooks caught that you have not looked at yet. Two tabs:
        </P>
        <H3>Hooked leads</H3>
        <P>Every lead one of your hooks caught, newest first, with the hooks that caught it. Click one to open the lead. Opening this tab clears the yellow circle.</P>
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
            [<B key="h">Slack message</B>, "Shown once a Slack channel is picked. Customize chooses what the Slack message shows, with a preview and Send a test to Slack. See The Slack message below."],
            [<B key="i">Same visitor again</B>, "Notify once a day (default) or every time, when one visitor sends several forms that match."],
            [<B key="g">Add lead to group (optional)</B>, "Also puts every lead this hook catches into a group."],
          ]}
        />
      </Section>

      <Section title="The Slack message">
        <P>Every Slack message has the hook&apos;s subject and message. Under <B>Slack message</B> → <B>Customize</B> you choose what else it shows:</P>
        <DataTable
          head={["Part", "What it shows", "Shown when"]}
          rows={[
            [<B key="a">Where they came from</B>, <span key="a2">&quot;Came from: Meta · Ads · Spring sale · 2026 Core Demo Video&quot;: the source, campaign and ad the lead is credited to (see <Link href="/docs/reference/acquisition" className="text-[var(--lime)] hover:underline">Acquisition</Link>)</span>, "The lead's visits are known. A lead who only ever came directly reads \"Direct\""],
            [<B key="b">The ad&apos;s thumbnail</B>, "The ad's image, large", "The ad has a thumbnail in Acquisition → Ads"],
            [<B key="c">Watch the ad button</B>, "Opens the ad's video", "The ad has a video link in Acquisition → Ads"],
            [<B key="d">Open the lead button</B>, <span key="d2">Opens the lead in Jellyhook, or its HubSpot contact when <Link href="/docs/reference/hubspot" className="text-[var(--lime)] hover:underline">HubSpot</Link> is connected (Open the lead in: HubSpot, Jellyhook or both)</span>, "Always"],
            [<B key="e">Hook, site and time</B>, "A small line under the message", "Always"],
            [<B key="h">Sent late</B>, <span key="h2">&quot;Sent 54 minutes late. Jellyhook was busy when this form came in. The form was sent ...&quot;, right under the message, so nobody calls a lead believing the form was just sent</span>, "The message goes out more than 2 minutes after the form. Always on"],
            [<B key="f">Visit summary</B>, "What they did in the visit with the form, before sending it: Short, Moderate (the default) or Long, as on the lead page. A form they started and left unsent is always said, with the field they left it at", "Set to anything but Off"],
            [<B key="i">Earlier visits</B>, <span key="i2">The visits before the one with the form: when they first saw the site, how many visits and how long, then one line per visit (the last 4) with its key events: a form left unsent and the field, or a long time on one heading. &quot;Oct 9: 5m 50s, mostly /pricing. Spent 2m 40s on &quot;Enterprise&quot; on /pricing. Started the form on /contact and left it at the &quot;phone&quot; field.&quot;</span>, "Ticked (off by default), and the lead had earlier visits"],
            [<B key="g">Page summaries</B>, <span key="g2">Up to 3 pages you pick, one line each: &quot;/pricing: 3m 10s over 2 views in 2 visits; read up to 72% of the page ...&quot;, or &quot;Page not visited&quot;</span>, "At least one page is picked"],
          ]}
        />
        <UL>
          <li>
            A new hook shows every part, with the Moderate visit summary and no page summaries. Hooks made before the summary existed send the Moderate
            summary too. The choice is saved with the hook and applies to every Slack channel it sends to.
          </li>
          <li>
            The preview next to the options is drawn from the exact message Slack receives. It uses your newest ad that has a thumbnail (or an example ad)
            and an example visit.
          </li>
          <li>
            <B>Send a test to Slack</B> sends the message, as the hook would send it now, to the Slack channels picked in it. The message says &quot;a new
            lead&quot; and the summaries are made from your site&apos;s newest lead. It works before the hook is saved.
          </li>
          <li>
            Webhooks always receive every field that was made for the hook, whatever is shown in Slack, including <C>previous_visits</C> when Earlier visits is ticked.
            Every lead a hook catches is sent to each webhook picked in that hook, so a webhook can start an automation in Zapier, Make, n8n or your CRM.
          </li>
        </UL>
        <H3>Visit summary and page summaries</H3>
        <UL>
          <li>
            Both are made once, when the hook catches the lead, and cover what they did <B>before sending the form</B>. The visit with the form is cut at
            the form, so time spent on the site after sending it is not included.
          </li>
          <li>
            The tracker sends the form page&apos;s heading times and scroll with the form, so that page is complete at that moment, before the visitor
            leaves it. A site still running an older copy of the tracker (cached in a visitor&apos;s browser) shows the form page&apos;s time without its
            headings.
          </li>
          <li>
            Page summaries read <B>every visit of the lead</B> up to the form, or <B>only the visit with the form</B>, as chosen in the hook. A page they
            did not open reads &quot;Page not visited&quot; (or &quot;Page not visited in this visit&quot;). /pricing and /pricing/ are the same page.
          </li>
          <li>
            The message never waits long for them: if they cannot be made within 2.5 seconds, or the visit cannot be read, the message is sent without
            them. If Slack refuses the full message (for example an ad image it cannot load), it is sent once more as a plain message: subject, message,
            where they came from and Open the lead.
          </li>
        </UL>
      </Section>

      <Section title="The Integrations page">
        <P>
          <B>Integrations</B> in the sidebar: where hooks can send outside Jellyhook, and <B>HubSpot</B> under CRM (see{" "}
          <Link href="/docs/reference/hubspot" className="text-[var(--lime)] hover:underline">HubSpot</Link>). Channels: <B>Slack</B> (Connect opens Slack&apos;s own screen to pick a channel; a webhook URL can be pasted
          instead) or <B>Webhook</B> (any https address, for example Zapier, Make or your CRM). A channel that keeps failing is marked
          &quot;Failing&quot; with the last error.
        </P>
      </Section>

      <Section title="The Notifications page">
        <P>A red dot (never a number) on <B>Notifications</B> in the sidebar while anything there is unread.</P>
        <UL>
          <li>
            <B>From Jellyhook</B>: updates from us about the product. In the app only, never in Slack.
          </li>
          <li>
            Your inbox: one entry for every lead a hook caught for you. Click one to open the lead; <B>Mark all as read</B> marks them all.
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
          <li>
            By default the same visitor is caught by the same hook at most once in 24 hours, so a visitor who sends three forms in a row makes one notification, not three.
            Each hook can change this under <B>Same visitor again</B>: <B>Notify once a day</B> (the default) or <B>Notify every time</B>, which is useful for testing. The lead
            still gets its marks and group when a notification is held back.
          </li>
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
          a link to the lead, and, unless switched off for Slack, where the lead came from: the source, campaign and ad, with the ad&apos;s tag, thumbnail and
          video link from Acquisition → Ads. When the hook has them, they also carry the visit summary and page summaries: page addresses, heading
          texts from your site and times. The link only opens for people signed in to the site. The lead&apos;s name, email, form answers and the
          conditions inside a mark are never sent.
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
          <li>No hooked lead you expected: check that the lead has every mark of the hook, that the hook is Live, and that the same visitor was not caught by it in the last 24 hours (see Same visitor again; testing from one browser needs a new private window each time, or Notify every time).</li>
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
