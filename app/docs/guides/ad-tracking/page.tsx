import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, P, UL, OL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Set up ad tracking",
  description: "Paste one set of parameters into Meta, Google Ads and TikTok so every lead shows the exact ad that brought it.",
  alternates: { canonical: "/docs/guides/ad-tracking" },
};

const META = "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&campaign_id={{campaign.id}}&utm_content={{ad.id}}&ad_name={{ad.name}}";
const GOOGLE = "utm_source=google&utm_medium=cpc&campaign_id={campaignid}&utm_content={creative}";
const TIKTOK = "utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&campaign_id=__CAMPAIGN_ID__&utm_content=__CID__&ad_name=__AD_NAME__";

function Snippet({ value }: { value: string }) {
  return <pre className="max-w-2xl overflow-x-auto whitespace-pre-wrap break-all border border-[#1b1b18] bg-[#0a0a09] p-3 ff-mono text-[12px] text-[#c9c7bd]">{value}</pre>;
}

export default function AdTrackingGuidePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Guide"
        title="Set up ad tracking"
        intro="How do I see which exact ad brought a lead? Paste one line of parameters into each ad platform once. The platform then fills in the campaign and the ad on every click, and Jellyhook shows that ad on the lead, in Acquisition and in hook messages in Slack."
      />

      <Section title="What it gives you">
        <UL>
          <li>Acquisition shows each campaign and each ad, with its visitors, leads and hooked leads.</li>
          <li>Acquisition → Ads lists every ad that brought a click. Add its video link and thumbnail there once.</li>
          <li>Hook messages in Slack can show &quot;Came from: Meta · Ads · Spring sale · 2026 Core Demo Video&quot;, the thumbnail and a Watch the ad button.</li>
        </UL>
        <Callout title="Optional">
          Without these parameters, Jellyhook still knows the platform and whether a visit was paid (from the ad network&apos;s own click id or the
          referrer). The parameters add the campaign and the ad.
        </Callout>
      </Section>

      <Section title="Meta (Facebook and Instagram)">
        <OL>
          <li>In Ads Manager, open the ad, or select several ads and edit them together.</li>
          <li>Scroll to <B>Tracking</B> at the bottom of the ad.</li>
          <li>Paste this into <B>URL parameters</B> (not into the website URL):</li>
        </OL>
        <Snippet value={META} />
        <P>Meta replaces each value in double braces with the real campaign and ad on every click.</P>
      </Section>

      <Section title="Google Ads (Search, YouTube, Display)">
        <OL>
          <li>Go to <B>Admin</B> (or Settings) → <B>Account settings</B> → <B>Tracking</B>.</li>
          <li>Paste this into <B>Final URL suffix</B>. It applies to every campaign in the account:</li>
        </OL>
        <Snippet value={GOOGLE} />
        <UL>
          <li>
            Use the Final URL suffix, not a tracking template of the form <C>{"{lpurl}?..."}</C>: a template like that breaks landing pages whose address
            already contains parameters, while the suffix is added correctly to any landing page.
          </li>
          <li>Keep auto-tagging on. Its click id (gclid) tells Jellyhook a visit came from a Google ad even without parameters.</li>
          <li>
            Google has no value for a campaign&apos;s name, only its id, so Google campaigns appear as &quot;Campaign 2134...&quot;. To show a name, add{" "}
            <C>utm_campaign=Your name</C> to that campaign&apos;s own Final URL suffix.
          </li>
        </UL>
      </Section>

      <Section title="TikTok Ads">
        <OL>
          <li>In Ads Manager, open the ad.</li>
          <li>Under tracking settings, paste this into <B>URL parameters</B>, or add it to the end of the destination URL:</li>
        </OL>
        <Snippet value={TIKTOK} />
      </Section>

      <Section title="What each parameter carries">
        <DataTable
          head={["Parameter", "Holds", "Used for"]}
          rows={[
            [<C key="a">utm_source</C>, "The platform", "The source row (Meta, Google, TikTok)"],
            [<C key="b">utm_medium</C>, "paid_social or cpc", "Marks the visit as paid"],
            [<C key="c">utm_campaign</C>, "The campaign's name", "The campaign level"],
            [<C key="d">campaign_id</C>, "The campaign's id", "The campaign when there is no name (Google)"],
            [<C key="e">utm_content</C>, "The ad's id", "The ad level and the Ads library"],
            [<C key="f">ad_name</C>, "The ad's name", "How the ad is named until you give it a tag"],
          ]}
        />
      </Section>

      <Section title="Check that it works">
        <OL>
          <li>
            Open your site in a private window with a test link, for example:
            <Snippet value="https://yoursite.com/?utm_source=facebook&utm_medium=paid_social&utm_campaign=Test&utm_content=12345&ad_name=Core+Demo" />
          </li>
          <li>Open Jellyhook → Acquisition → Ads: the ad &quot;Core Demo&quot; (id 12345) is listed. Add a tag, a video link and a thumbnail.</li>
          <li>Send your form in that same window. In Acquisition → Overview, open <B>Meta · Ads</B> → <B>Test</B>: the lead is there.</li>
          <li>If a hook with Slack caught the lead, its message shows the ad. To see the message without a lead, use <B>Send a test to Slack</B> in the hook editor.</li>
        </OL>
        <P>
          Clicks made before the parameters were pasted do not carry an ad. Real ads start showing with their first click after the change.
        </P>
      </Section>

      <Section title="Related">
        <P>
          <Link href="/docs/reference/acquisition" className="text-[var(--lime)] hover:underline">Acquisition</Link>,{" "}
          <Link href="/docs/reference/notifications" className="text-[var(--lime)] hover:underline">Hooks and notifications</Link>.
        </P>
      </Section>
    </div>
  );
}
