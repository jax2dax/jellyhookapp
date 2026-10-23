import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, P, UL, B } from "../../ui";

export const metadata: Metadata = {
  title: "Lead groups",
  description: "Put leads into named groups on the Leads page, for yourself or for your teammates.",
  alternates: { canonical: "/docs/reference/groups" },
};

export default function GroupsReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Feature reference"
        title="Lead groups"
        intro="Where do I keep the leads I am working on? A group is a named box of leads on the Leads page. You put leads in by hand, or a notification rule can put them in for you. A group has no rules of its own and never sends notifications."
      />

      <Section title="When you would use it">
        <P>
          You call five leads this week and two say yes. You select those two on the Leads page and choose New group from selection, name it
          &quot;Deal done&quot;, and leave it visible to Teammates. Everyone on the site now has a &quot;Deal done&quot; tab above the table.
        </P>
      </Section>

      <Section title="What you see">
        <UL>
          <li><B>Tabs above the table</B>: All leads, then one tab per group with its count. Picking a tab shows only that group&apos;s leads, and the address bar remembers it.</li>
          <li><B>Checkboxes</B> on each row and in the header. Ticking leads shows a bar: &quot;2 selected&quot;, Add to group, New group from selection, Remove from (the open group), Clear.</li>
          <li><B>The group dialog</B>: Name, and Who sees it: Teammates (the default) or Only me. The same dialog renames a group, changes who sees it, or deletes it.</li>
        </UL>
      </Section>

      <Section title="What it needs">
        <P>Nothing beyond leads. A group can also start empty and be filled later.</P>
      </Section>

      <Section title="How it works">
        <UL>
          <li>Adding a lead to a group does not move or copy it. The lead stays in All leads, and one lead can be in many groups.</li>
          <li>Deleting a group deletes the box, not the leads.</li>
          <li>A notification rule can have &quot;add the lead to group&quot; ticked. Then each lead that fires the rule is added to that group too.</li>
          <li>The person who made a group, or an owner or admin of the site, can rename or delete it. A group set to Only me is seen only by its maker.</li>
        </UL>
      </Section>

      <Section title="When it is empty or looks wrong">
        <UL>
          <li>&quot;This group is empty.&quot; Select leads in All leads and choose Add to group.</li>
          <li>A teammate cannot see your group: it is set to Only me. Change Who sees it to Teammates.</li>
        </UL>
      </Section>

      <Section title="Limits">
        <UL>
          <li>30 groups per site.</li>
          <li>Groups do not notify anyone. Notifications come from rules only.</li>
        </UL>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/notifications" className="text-[var(--lime)] hover:underline">Notifications</Link>,{" "}
          <Link href="/docs/reference/leads" className="text-[var(--lime)] hover:underline">Leads page</Link>.
        </P>
      </Section>
    </div>
  );
}
