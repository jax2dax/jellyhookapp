import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, Section, H3, P, UL, B, C, Callout, DataTable } from "../../ui";

export const metadata: Metadata = {
  title: "Acquisition",
  description: "Which platforms, campaigns and ads bring your leads, how a lead is credited to one of them, and the Ads library.",
  alternates: { canonical: "/docs/reference/acquisition" },
};

export default function AcquisitionReferencePage() {
  return (
    <div>
      <DocHeader
        eyebrow="Feature reference"
        title="Acquisition"
        intro="Which platforms, campaigns and ads bring your leads, and your best ones? Acquisition groups every visit by where it came from and credits each lead to one source, so you can compare ordinary traffic, leads and hooked leads side by side."
      />

      <Section title="When you would use it">
        <P>
          You run ads on Meta and Google and also get search traffic. Acquisition shows that Meta ads bring more visitors, but Google ads bring more
          of the leads your hooks catch. Opening Meta shows which campaign and which ad those leads came from.
        </P>
      </Section>

      <Section title="What you see">
        <P>
          <B>Acquisition</B> in the sidebar. Three tabs:
        </P>
        <H3>Overview</H3>
        <UL>
          <li>A range (7, 30 or 90 days, or all time) and the credit model (<B>Last non-direct</B> or <B>First touch</B>). Both are kept in the page address.</li>
          <li>Totals: visitors, leads, conversion rate, hooked leads.</li>
          <li>
            <B>Where leads come from</B>: one row per source, sorted by leads. Open a source for its campaigns, a campaign for its ads and the page each
            ad led to. Each row shows visitors, leads, rate and hooked leads.
          </li>
          <li>Two radar charts, <B>By platform</B> and <B>By campaign</B>, each comparing normal traffic, converted leads and hooked leads.</li>
        </UL>
        <H3>Ads</H3>
        <P>
          Every ad a click came from, with its platform, campaign, clicks and when it was last seen. You add three things once per ad: an internal
          tag (for example &quot;2026 Core Demo Video&quot;), the link to watch the video, and a thumbnail (uploaded, or copied from an image link).
          Hook messages in Slack use all three. Ads still missing a video or thumbnail are listed first.
        </P>
        <H3>Set up ad tracking</H3>
        <P>
          The parameters to paste into Meta, Google and TikTok so each click carries its campaign and ad. Full steps:{" "}
          <Link href="/docs/guides/ad-tracking" className="text-[var(--lime)] hover:underline">Set up ad tracking</Link>.
        </P>
      </Section>

      <Section title="How a visit's source is read">
        <P>Each visit is read once, when it starts, from its landing link and its referrer, strongest signal first:</P>
        <DataTable
          head={["Signal", "Example", "Becomes"]}
          rows={[
            ["The ad network's click id", <C key="a">gclid, fbclid, msclkid, ttclid, li_fat_id, twclid</C>, "That network, paid: Google · Ads, Meta · Ads ..."],
            ["utm_source and utm_medium", <C key="b">utm_source=facebook&amp;utm_medium=cpc</C>, "Meta · Ads. A medium like cpc, ppc, paid or paid_social means paid; social, organic or email means free"],
            ["The referrer", <C key="c">google.com, l.facebook.com, chatgpt.com</C>, "Google · Search, Meta · Social, AI assistants · Answer; any other site: Referral · its address"],
            ["Nothing", "Typed the address, a bookmark", "Direct"],
          ]}
        />
        <P>
          Paid and free are separate sources: <B>Google · Ads</B> and <B>Google · Search</B> are two rows. The campaign is <C>utm_campaign</C> (or{" "}
          <C>campaign_id</C> when no name is given), the ad is <C>utm_content</C> with its name from <C>ad_name</C>.
        </P>
        <Callout title="Ad ids are optional">
          Nothing depends on them. Without any setup, every visit still gets its platform and whether it was paid, from the ad network&apos;s click id
          or the referrer, and campaigns appear wherever your links already carry <C>utm_campaign</C>. The ad id and name only add the ad level and the
          ad in Slack.
        </Callout>
      </Section>

      <Section title="How a lead is credited">
        <UL>
          <li>
            <B>Last non-direct</B> (the default): the last visit before sending the form that did not come Direct. A lead who came from a Facebook ad,
            then from a Google ad, then typed your address and converted counts for the Google ad.
          </li>
          <li>
            <B>First touch</B>: the first visit. The same lead counts for the Facebook ad.
          </li>
          <li>Direct gets the credit only when every visit was Direct. Visits more than 90 days before the form are not considered.</li>
          <li>Visitors count once, under the source of their first visit in the range. Leads count once, under their credited visit.</li>
          <li>The rate is leads divided by visitors of that row. It can pass 100% when leads are credited to visits from before the range; it is shown as at most 100%.</li>
        </UL>
      </Section>

      <Section title="Where else it appears">
        <UL>
          <li>
            <Link href="/docs/reference/notifications" className="text-[var(--lime)] hover:underline">Hooked leads</Link> show where each lead came from,
            with the ad&apos;s thumbnail, and hook messages in Slack can show the same.
          </li>
          <li>
            <Link href="/docs/reference/marks" className="text-[var(--lime)] hover:underline">Marks</Link>: the visit condition{" "}
            <B>Came from an ad or platform</B> (platform, paid or free, campaign, ad).
          </li>
        </UL>
      </Section>

      <Section title="When it is empty or looks wrong">
        <UL>
          <li>&quot;No visits in this range.&quot;: pick a longer range.</li>
          <li>Everything is Direct: your links carry no UTMs and visitors arrive without a referrer (apps, email clients). Add UTMs to links you share.</li>
          <li>Ads show as &quot;(no ad named)&quot;: the clicks carried no ad id. See the setup guide.</li>
          <li>The Ads tab is empty: no click has carried an ad id yet.</li>
        </UL>
      </Section>

      <Section title="Limits">
        <UL>
          <li>Built from links and referrers only. It does not read your ad accounts, so there is no spend, cost per lead or return on ad spend.</li>
          <li>A thumbnail and video are added by your team per ad. Connecting ad accounts to fill them in is planned.</li>
          <li>Visits recorded before October 24, 2026 have no ad id, keyword or click id.</li>
        </UL>
      </Section>
    </div>
  );
}
