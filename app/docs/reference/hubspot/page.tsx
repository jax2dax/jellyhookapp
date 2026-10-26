import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, OL, B, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "HubSpot",
  description: "Open hooked leads straight on their HubSpot contact, and see what each contact did on your site in a Jellyhook card inside HubSpot.",
  alternates: { canonical: "/docs/reference/hubspot" },
};

export default function HubSpotReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Feature reference"
        title="HubSpot"
        intro="Your sales team works in HubSpot. With HubSpot connected, a hooked lead in Slack opens on its HubSpot contact record, and every contact shows a Jellyhook card: what that person did on your site before sending the form, and their visit chart."
      />

      <Section title="When you would use it">
        <P>
          A hook posts &quot;Hot lead&quot; in #sales. Your rep clicks <B>Open in HubSpot</B> and lands on the contact they will call. The Jellyhook card
          on that contact says they came from your spring campaign ad, read pricing for two minutes and came back twice, and <B>Open visit chart</B>{" "}
          shows the whole visit.
        </P>
      </Section>

      <Section title="Connect HubSpot">
        <OL>
          <li>In Jellyhook, open <B>Integrations</B>. Under CRM, click <B>Connect</B> on HubSpot. An owner or admin of the site does this.</li>
          <li>HubSpot asks you to pick an account and approve. Jellyhook asks only to read contacts.</li>
          <li>Back in Integrations, HubSpot shows <B>Connected</B> with the account number. This also installs the Jellyhook app in that HubSpot account.</li>
          <li>Add the card to your contact records. HubSpot never shows a new card by itself: see the next section.</li>
        </OL>
        <Callout title="What Jellyhook reads">
          Only which contact has a lead&apos;s email. Jellyhook never creates, changes or deletes anything in HubSpot. To disconnect, click{" "}
          <B>Disconnect</B> in Integrations; removing the Jellyhook app in HubSpot also ends the connection.
        </Callout>
      </Section>

      <Section title="Add the card to your contacts">
        <P>Do this once, in the HubSpot account you connected. Everyone in the account then sees the card.</P>
        <OL>
          <li>In HubSpot, go to <B>CRM → Contacts</B> and open any contact.</li>
          <li>Click <B>Customize</B> at the top of the middle column, then <B>Default view</B>.</li>
          <li>Choose the tab you want the card on (for example the Overview tab).</li>
          <li>Hover where you want the card and click the <B>+</B> button.</li>
          <li>In the right sidebar open the <B>Card library</B> tab, open the <B>Card types</B> list and choose <B>App</B>.</li>
          <li>Click <B>Add card</B> under <B>Jellyhook</B>, close the sidebar, then click <B>Save and exit</B> (top right).</li>
          <li>Reload the contact. The Jellyhook card is there.</li>
        </OL>
        <Callout title="If the card is not in the library">
          The Jellyhook app is not installed in this HubSpot account. In Jellyhook, open Integrations and connect HubSpot again, and pick this account.
          You can check in HubSpot under Settings → Integrations → Connected apps. Changing the default view needs permission to customize records
          (usually an admin).
        </Callout>
      </Section>

      <Section title="Open in HubSpot, from Slack">
        <UL>
          <li>
            With HubSpot connected, a hook&apos;s Slack message has <B>Open in HubSpot</B> instead of Open the lead. Each hook can choose under Slack
            message, Customize, <B>Open the lead in</B>: HubSpot, Jellyhook, or both buttons.
          </li>
          <li>
            The contact is found when the button is clicked, by the email the lead sent in your form. A HubSpot form creates its contact a few seconds
            after it is sent, so by the time someone clicks, the contact is there.
          </li>
          <li>
            If HubSpot has no contact with that email, the lead has no email, or HubSpot does not answer within 4 seconds, the button opens the lead
            in Jellyhook instead.
          </li>
          <li>Webhooks also receive the link, as <B>lead.hubspot_url</B>.</li>
        </UL>
      </Section>

      <Section title="The Jellyhook card in HubSpot">
        <P>
          At the top, a count of the hooks that caught the contact&apos;s leads and of their marks, and the Short, Moderate and Long switch for the summaries. Then, for the
          contact&apos;s email, their Jellyhook leads (newest first, up to 5), each in its own box. In each box:
        </P>
        <DataTable
          head={["Part", "What it shows"]}
          rows={[
            [<B key="a">Top line</B>, "In small grey text: the page and your site on the left, and the form on the right"],
            [<B key="a2">Form sent</B>, "When, with how long ago on the right"],
            [<B key="c">Hooks and marks</B>, "Green tags for the hooks that caught the lead, blue tags for its marks that are shared with your whole team. Marks kept private by their owner are never shown."],
            [<B key="b">Came from</B>, "Plain text above the summary: the source, campaign and ad the lead is credited to (see Acquisition)"],
            [<B key="d">Summary</B>, "The visit with the form, in Short, Moderate (the default) or Long, as on the lead page in Jellyhook. The first line, the pages in order with their times, is in bold."],
            [<B key="e">Open visit chart</B>, "The visit chart from the lead page, in a HubSpot window: every visit, hover a page, click it for its summary"],
            [<B key="f">Open in Jellyhook</B>, "The lead page in Jellyhook (needs a Jellyhook account)"],
          ]}
        />
        <H3>Who sees it</H3>
        <P>
          Anyone who can open the contact in your HubSpot account. Your sales team does not need a Jellyhook account. The card and the chart never
          show the form&apos;s answers; the contact&apos;s own details are already in HubSpot.
        </P>
      </Section>

      <Section title="When it is empty or looks wrong">
        <UL>
          <li>You do not see the card at all: it was not added to the contact view (see Add the card to your contacts), or the app is not installed in this account.</li>
          <li>&quot;No Jellyhook visits for this email&quot;: nobody sent a form tracked by Jellyhook with that email, or it was sent on a site not connected to this HubSpot account.</li>
          <li>&quot;No email on this contact&quot;: Jellyhook matches by email.</li>
          <li>&quot;Reconnect Jellyhook&quot;: HubSpot stopped accepting the connection (for example, the app was removed in HubSpot). Connect again in Integrations.</li>
          <li>&quot;This chart link has expired&quot;: a chart opened from the card stays readable for 30 minutes. Close it and open it again.</li>
          <li>Open in HubSpot opened Jellyhook: no contact had that email when it was clicked. Click again once the contact exists.</li>
        </UL>
      </Section>

      <Section title="Limits">
        <UL>
          <li>One HubSpot account per Jellyhook site. Several sites can connect to the same HubSpot account; the card then shows leads from each.</li>
          <li>Contacts only, matched by email. No companies or deals yet.</li>
          <li>Nothing is written to HubSpot: no notes on the timeline, no contact properties.</li>
        </UL>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/notifications" className="text-[var(--lime)] hover:underline">Hooks and notifications</Link>,{" "}
          <Link href="/docs/reference/lead-profile" className="text-[var(--lime)] hover:underline">Lead profile page</Link>,{" "}
          <Link href="/docs/reference/acquisition" className="text-[var(--lime)] hover:underline">Acquisition</Link>.
        </P>
      </Section>
    </div>
  );
}
