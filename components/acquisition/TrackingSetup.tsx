"use client";
// components/acquisition/TrackingSetup.tsx
// Acquisition → Set up ad tracking: the parameters to paste into each ad platform once, so every click carries the
// campaign, the ad's id and the ad's name (the platform fills them in itself: dynamic macros). With them, Jellyhook
// knows which exact ad brought each lead, and the Ads library can show its video and thumbnail in Slack.
import * as React from "react";
import { Check, Copy } from "lucide-react";
import { SlackLogo } from "@/components/notifications/Brand";

const PLATFORMS: { name: string; where: string[]; field: string; value: string; note?: string }[] = [
  {
    name: "Meta (Facebook and Instagram)",
    where: ["Ads Manager: open the ad (or select several)", "Scroll to Tracking at the bottom", "URL parameters"],
    field: "URL parameters",
    value: "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&campaign_id={{campaign.id}}&utm_content={{ad.id}}&ad_name={{ad.name}}",
  },
  {
    name: "Google Ads (Search, YouTube, Display)",
    where: ["Admin (or Settings) → Account settings", "Tracking", "Final URL suffix (for the whole account)"],
    field: "Final URL suffix",
    value: "utm_source=google&utm_medium=cpc&campaign_id={campaignid}&utm_content={creative}",
    note: "The Final URL suffix is added to every ad's landing page, even one that already has its own ? parameters (a Tracking template with {lpurl}? would break those). Google has no macro for the campaign's name: campaigns show by their id until you add utm_campaign=<name> to a campaign's own Final URL suffix. Keep auto-tagging (gclid) on.",
  },
  {
    name: "TikTok Ads",
    where: ["Ads Manager: the ad", "Tracking settings → URL parameters (or append to the destination URL)"],
    field: "URL parameters",
    value: "utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&campaign_id=__CAMPAIGN_ID__&utm_content=__CID__&ad_name=__AD_NAME__",
  },
];

function CopyBox({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-start gap-2 rounded-md border bg-background p-2">
      <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-foreground">{value}</code>
      <button
        type="button"
        onClick={() => navigator.clipboard.writeText(value).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
        className="flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function TrackingSetup() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Know which ad brought each lead</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste these once into each ad platform. From then on, every click carries the campaign, the ad&apos;s id and the ad&apos;s name. Jellyhook lists each ad
          under Ads, where you add its video and thumbnail; hooked leads in Slack then show the ad they came from.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <SlackLogo className="size-3.5" /> In Slack: &quot;Came from: Meta · Ads · Spring sale · 2026 Core Demo Video&quot;, the thumbnail, and a Watch the ad button.
        </p>
      </div>
      {PLATFORMS.map((p) => (
        <div key={p.name} className="space-y-2 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">{p.name}</h3>
          <ol className="list-decimal space-y-0.5 pl-5 text-xs text-muted-foreground">
            {p.where.map((w) => (
              <li key={w}>{w}</li>
            ))}
            <li>Paste this into {p.field}:</li>
          </ol>
          <CopyBox value={p.value} />
          {p.note && <p className="text-[11px] text-muted-foreground">{p.note}</p>}
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Only clicks after you paste these carry the ad. Older visits still show their platform (from the ad network&apos;s click id or the referrer), without the
        ad.
      </p>
    </div>
  );
}
