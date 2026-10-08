import type { Metadata } from "next";
import { DocHeader, Section, P, UL, B, Callout, DocFooter } from "../../ui";

export const metadata: Metadata = {
  title: "Ask Hook",
  description: "Describe what you want to know in your own words and Hook fills in the question for you to check and run.",
  alternates: { canonical: "/docs/hook/ask" },
};

export default function AskHookPage() {
  return (
    <div>
      <DocHeader eyebrow="Hook" title="Ask Hook" intro="Type your question in plain words. Hook turns it into a question in the builder, which you check and run like any other." />

      <Section title="How to use it">
        <UL>
          <li>Type a question in the <B>Ask Hook</B> row above the builder, for example &quot;How many sessions from google read the pricing page and didn&apos;t convert?&quot;, and press <B>Ask</B>.</li>
          <li>The builder fills in below. Read it, change anything you like, then press <B>Run</B>. Asking never runs anything by itself.</li>
          <li><B>Undo</B> puts back the question that was in the builder before.</li>
          <li>With <B>Edit current</B> ticked, your words change the question already in the builder (&quot;only from google&quot;). Untick it to start a new one.</li>
          <li>If something needed is missing (&quot;between this and this&quot; with no dates), Ask Hook asks you one short question first.</li>
          <li>If Hook cannot answer something (for example comparing two periods in one question), it says so and suggests what to do instead.</li>
        </UL>
      </Section>

      <Section title="What it costs">
        <P>Each question uses a few Hook credits (usually about 3), shown after the answer. Running the question afterwards uses credits as usual. Each person can ask 20 questions a day; the allowance resets at midnight UTC.</P>
      </Section>

      <Section title="Check the answer">
        <P>Ask Hook is a translator, and it can misread you. The <B>Reads as</B> line under the builder says in words what the question will do, so read it before you run. If it is wrong, edit it in the builder or ask again with more detail.</P>
      </Section>

      <Section title="What is sent to the AI">
        <Callout title="Your visitors' data is never sent">
          Only your sentence, the question currently in the builder, today&apos;s date and up to 25 page paths of your site are sent to OpenAI, together with the list of things Hook can ask about. No visitor rows, results, names, emails or IP addresses leave Jellyhook. Avoid typing personal details into the question.
        </Callout>
      </Section>

      <DocFooter feature="hook" />
    </div>
  );
}
