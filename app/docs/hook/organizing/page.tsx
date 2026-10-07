import type { Metadata } from "next";
import { DocHeader, Section, P, UL, B, C, Callout, DataTable, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Organize, share and run",
  description: "Naming and collapsing long questions, sharing a question as a link, run order, speed and credits.",
  alternates: { canonical: "/docs/hook/organizing" },
};

export default function OrganizingPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Organize, share and run"
        intro="Long questions are normal in Hook. This page covers keeping them readable, sharing them, and understanding how they run, how fast, and what they cost."
      />

      <Section title="Names, notes, collapsing and spacing">
        <DataTable
          head={["Control", "What it does"]}
          rows={[
            [<B key="a">Name</B>, "Click the title line of any hook, sub-hook or condition and type a name."],
            [<B key="b">+ note</B>, "Adds a description in your own words: what the block is for."],
            [<B key="c">The arrow</B>, "Collapses a block to one line. A collapsed block shows its name, or a one-line summary."],
            [<B key="d">The dotted handle</B>, "On the left of each condition. Drag it down or up to add space above the condition, or use the arrow keys. Double-click to remove the space."],
          ]}
        />
        <P>
          Names, notes, collapsed blocks and spacing are all part of the question itself, so a shared link opens looking exactly the same. Limits: names up to 80 characters, notes up to 500.
        </P>
      </Section>

      <Section title="Sharing and reusing a question">
        <UL>
          <li>
            <B>Copy link</B> copies a link to the exact question. Whoever opens it runs it against <B>their own current site</B>. The link never contains your data and never names your site.
          </li>
          <li>
            <B>&lt;/&gt;</B> opens the question as code. <B>Show the current query here</B> displays the one you are editing. Paste a question there and press <B>Load into builder</B> to rebuild it on screen.
          </li>
          <li>
            Older questions and links keep working. Hook upgrades them automatically and tells you it did.
          </li>
        </UL>
        <P>Saving a hook for later is planned. It is not available today, so use Copy link.</P>
      </Section>

      <Section title="Run order and speed">
        <P>
          A question is a list of steps (its top-level conditions). Some steps keep very few rows, others keep almost everything. Doing the small ones first makes the whole question faster. The order never changes the answer, only the speed.
        </P>
        <DataTable
          head={["Mode", "What happens"]}
          rows={[
            [<B key="a">Automatic (default)</B>, "Hook asks the database how big each step is, without reading any data, and runs the most selective step first."],
            [<B key="b">Manual</B>, "You set the order. Hook steps in only if your order would be at least 10 times slower than the best one, and says so. You can switch that safeguard off."],
          ]}
        />
        <P>
          Open <B>How it ran</B> after a run to see the order used and why, and whether Hook overrode yours.
        </P>
      </Section>

      <Section title="Credits and limits">
        <UL>
          <li>
            Every run costs <B>at least 1 credit</B>. Heavier questions cost more.
          </li>
          <li>
            The cost is worked out <B>before</B> anything runs. If it is over your limit, nothing runs and you see the estimate.
          </li>
          <li>
            A comparison costs the credits of both hooks. The base rate shown beside a number is included in the credits you see.
          </li>
          <li>
            Showing more items in a result list is free: it does not run the question again. See <C>The results</C>.
          </li>
          <li>The allowance per plan is not final, so it is not listed here.</li>
        </UL>
        <Callout title="What makes a question expensive">
          <p>
            Questions that measure connected rows across your whole site as the first step (for example &quot;average share of page seen&quot; over every page view ever) cost more than the same question after a selective condition. Put the narrowest condition in the question, and the cost drops.
          </p>
        </Callout>
      </Section>

      <Section title="Limits of a single question">
        <DataTable
          head={["Limit", "Value"]}
          rows={[
            ["Conditions in one question, sub-hooks included", "60"],
            ["Levels of nesting (groups, connected rows, sub-hooks)", "6"],
            ["Values in a list", "500"],
            ["Characters in a text value", "200"],
            ["Items in a list result", "5,000"],
            ["Rows in a breakdown", "500"],
            ["A single run", "stopped after 8 seconds"],
          ]}
        />
        <P>If a question hits a limit, the message names it and says what to change.</P>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
