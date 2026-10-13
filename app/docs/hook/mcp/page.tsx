import type { Metadata } from "next";
import { DocHeader, Section, P, UL, OL, B, C, Callout, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Connect an AI app",
  description: "Let Claude, Cursor or another AI app ask questions of one site's Hook data with a personal access token.",
  alternates: { canonical: "/docs/hook/mcp" },
};

export default function McpPage() {
  return (
    <div>
      <DocHeader
        eyebrow="Hook"
        title="Connect an AI app"
        intro="An AI app such as Claude Code or Cursor can ask questions of one site's Hook data for you. You give it a token. It can read, only that site, and only until the token expires."
      />

      <Section title="Set it up">
        <OL>
          <li>Open <B>Settings</B> and find <B>AI access</B>. Only the site owner and admins see it.</li>
          <li>Give the token a name, choose how long it lasts (30, 90 or 365 days), and tick the box to confirm you understand where the data goes.</li>
          <li>Press <B>Create token</B> and copy it. It is shown once. If you lose it, revoke it and create another.</li>
          <li>In Claude Code, run the command shown under the token: <C>claude mcp add --transport http jellyhook https://your-domain/api/mcp --header &quot;Authorization: Bearer YOUR_TOKEN&quot;</C></li>
          <li>Other apps that accept a server address and a header work the same way. Use the address <C>/api/mcp</C> and the header <C>Authorization: Bearer YOUR_TOKEN</C>.</li>
        </OL>
      </Section>

      <Section title="What the AI can do">
        <UL>
          <li><B>Read how Hook works</B> and write a query itself, then check it before running.</li>
          <li><B>See your top pages.</B></li>
          <li><B>Run a Hook query</B> and get a number, a ranking, a time series, or a short list (up to 50 rows) of sessions, leads, visitors, pages or forms.</li>
        </UL>
        <P>It cannot change anything, cannot see other sites, and cannot choose a different site. Each run uses Hook credits like a run from the screen, and a query that would cost too much is refused with a message.</P>
      </Section>

      <Section title="What it sees about people">
        <Callout title="Personal details are hidden by default">
          Emails, names and phone numbers come back masked, for example <C>h***@gmail.com</C> and <C>H. A.</C>. What visitors typed into your forms is never returned. A token can be allowed to see unmasked email, name and phone, but only if you tick a second box when you create it.
        </Callout>
        <P>The answers are sent to the AI provider of the app you connect, for example Anthropic or OpenAI. Only connect apps you are allowed to share this site&apos;s data with, and read your own privacy notice. This page is not legal advice.</P>
      </Section>

      <Section title="Limits and control">
        <UL>
          <li>Each token has a call limit per minute and per day.</li>
          <li><B>Revoke</B> a token in Settings and it stops working at once.</li>
          <li>Tokens expire. Create a new one when it does.</li>
          <li>If you are not sure which token an app is using, the list shows its name, the start of the token and when it was last used.</li>
        </UL>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
