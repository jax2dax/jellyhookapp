// app/platform/form-engagement/page.tsx
// Form engagement: the site's lead form (data-conversion="true"; the one with the most submissions unless another is
// picked), its current version over its whole life, an optional comparison, and every form started in that version.
// Everything below the header runs in the browser (components/forms/FormEngagementClient.tsx) so the dashboard can be
// kept in localStorage. Not linked from the sidebar yet (founder decision 2026-10-14).
// Design: mds/build/form-study/averages-and-versions.md.
import { Suspense } from "react";
import { InfoTip } from "@/components/forms/InfoTip";
import { FormEngagementClient } from "@/components/forms/FormEngagementClient";
import { siteOrThrow } from "@/lib/hook/site";

export const dynamic = "force-dynamic";

export default async function FormEngagementPage() {
  const siteId = await siteOrThrow();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          Form engagement
          <InfoTip>
            Your lead form as it is now: how many see it, start it and submit it, how long the typical successful submission takes field by field, and where people stop. Pick a comparison to see what changed against an older version, all time, or chosen dates. Only times are recorded, never what was typed.
          </InfoTip>
        </h1>
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <FormEngagementClient siteId={siteId} />
      </Suspense>
    </div>
  );
}
