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
        intro="A group is a named list of leads on the Leads page, filled by hand or by a hook. Use groups to keep track of the leads you are working on. A group has no rules of its own and sends no notifications."
      />

      <Section title="Using groups">
        <P>
          For example, after a week of calls, select the two leads that agreed to a proposal, choose <B>New group from selection</B> and name it
          &quot;Proposal sent&quot;. Everyone on the site now has a &quot;Proposal sent&quot; tab above the table.
        </P>
        <UL>
          <li><B>Tabs above the table</B>: All leads, then one tab per group with its count. The open tab is kept in the address bar.</li>
          <li><B>Selection bar</B>: tick leads to Add to group, create a New group from selection, Remove from the open group, or Clear.</li>
          <li><B>Group settings</B>: name, and who sees it: Teammates (the default) or Only me. The same dialog renames or deletes the group.</li>
        </UL>
      </Section>

      <Section title="How it works">
        <UL>
          <li>A lead in a group stays in All leads. One lead can be in several groups.</li>
          <li>Deleting a group deletes the list, not its leads.</li>
          <li>A hook with <B>Add lead to group</B> set adds every lead it catches to that group.</li>
          <li>The group&apos;s creator, or an owner or admin, can rename or delete it. A group set to Only me is visible to its creator only.</li>
        </UL>
      </Section>

      <Section title="Limits and troubleshooting">
        <UL>
          <li>Up to 30 groups per site.</li>
          <li>An empty group shows &quot;This group is empty.&quot; Add leads from All leads.</li>
          <li>A teammate cannot see a group set to Only me. Change it to Teammates.</li>
        </UL>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/notifications" className="text-[var(--lime)] hover:underline">Hooks and notifications</Link>,{" "}
          <Link href="/docs/reference/leads" className="text-[var(--lime)] hover:underline">Leads page</Link>.
        </P>
      </Section>
    </div>
  );
}
