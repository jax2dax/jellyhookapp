import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getLeadProfileByLeadId } from "@/lib/actions/leadProfile.actions";
import { buildLeadProfile } from "@/lib/algorithms/leadProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { LeadTimeBar } from "@/components/charts/leadTimeBar";
import { LeadSessionExplorer } from "@/components/leads/LeadSessionExplorer";
import { LeadQualifyToggle } from "@/components/leads/LeadQualifyToggle";
import { LeadStatsCard } from "@/components/leads/LeadStatsCard";
import { ConversionEventsBadges } from "@/components/leads/ConversionEventsBadges";
import { FormDetails } from "@/components/leads/FormDetails";
import { LocalDate } from "@/components/LocalDate";
import { formatRelativeTime } from "@/lib/leadFormat";
import { LeadFormsCard } from "@/components/forms/LeadFormsCard";
import { collectFormActivities } from "@/jh-forms/collect";
import { getFormReference } from "@/lib/actions/formDashboard.action";
import { marksOfLead } from "@/lib/actions/marks.action";
import { MarkPill } from "@/components/marks/MarkBadge";
import { InfoTip } from "@/components/forms/InfoTip";

export default async function LeadProfilePage({ params }) {
  const { lead_id } = await params;
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const raw = await getLeadProfileByLeadId(site.id, lead_id);

  return (
    <div className="min-h-screen bg-background p-6">
      <Link href="/platform/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to leads
      </Link>

      {!raw ? (
        <Card className="mt-4">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No lead found with id <span className="font-mono">{lead_id}</span> on this site.
          </CardContent>
        </Card>
      ) : (
        <LeadProfileBody profile={buildLeadProfile({ ...raw, focusSubmission: raw.focusSubmission })} raw={raw} siteId={site.id} />
      )}
    </div>
  );
}

async function LeadProfileBody({ profile, raw, siteId }) {
  // every form this visitor started (submitted, abandoned or still open), with its session's page views
  const formActivities = collectFormActivities(raw.formEngagement || [], raw.pageViews || []);
  // each form's "All time" healthy reference (no compare picker here): unusual fields are outlined in red. One read of
  // the form's newest submitted rows per form (lib/actions/formDashboard.action.ts getFormReference).
  const keys = [...new Set(formActivities.map((fa) => fa.formKey).filter(Boolean))];
  const references = new Map(await Promise.all(keys.map(async (k) => [k, await getFormReference(k)])));
  // the marks this lead has (only "on" marks the viewer can see), with why: stored, nothing is computed here
  const leadMarks = await marksOfLead(raw.focusSubmission.id);
  const {
    identity,
    lastActivity,
    firstSeen,
    device,
    totalVisits,
    totalPageViews,
    totalEngagedMs,
    avgScrollPct,
    visitorType,
    visitsBeforeConversion,
    timeToConvertMs,
    conversions,
    primaryConversion,
    preConversionPath,
  } = profile;

  const hasConverted = !!primaryConversion;
  const otherConversions = conversions.filter((c) => !c.isFocus);

  return (
    <div className="space-y-6">
      {/* ── Section 1: Profile ─────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <InitialsAvatar label={identity.name || identity.email} size="lg" className="h-14 w-14 text-lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-foreground">{identity.name || "Unnamed visitor"}</h1>
                {visitorType && (
                  <Badge variant="outline">
                    {visitorType === "first-time" ? "First-time convert" : `Returning · converted after ${visitsBeforeConversion} visit${visitsBeforeConversion === 1 ? "" : "s"}`}
                  </Badge>
                )}
              </div>
              <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
                {identity.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {identity.email}
                  </span>
                )}
                {identity.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {identity.phone}
                  </span>
                )}
              </div>
              {leadMarks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {leadMarks.map(({ mark, parts }) => (
                    <MarkPill key={mark.id} mark={mark} parts={parts} />
                  ))}
                </div>
              )}
              {otherConversions.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted from the same browser as {otherConversions.length} other lead{otherConversions.length === 1 ? "" : "s"}, see Conversion Events below.
                </p>
              )}
            </div>
          </div>

          <div className="text-left text-sm text-muted-foreground sm:text-right">
            <div className="mb-1.5 flex items-center gap-2 sm:justify-end">
              <span className="text-xs">Qualify:</span>
              <LeadQualifyToggle siteId={siteId} leadId={raw.focusSubmission.id} initialQualified={raw.focusSubmission.qualified} />
            </div>
            <div>
              Last active <span className="font-medium text-foreground">{formatRelativeTime(lastActivity)}</span>
            </div>
            <div className="text-xs">First seen <LocalDate value={firstSeen} />{device ? ` · ${device}` : ""}</div>
          </div>
        </CardContent>

        {primaryConversion?.fields && (primaryConversion.fields.scalars.length > 0 || primaryConversion.fields.complex.length > 0) && (
          <CardContent className="pt-0">
            <FormDetails scalars={primaryConversion.fields.scalars} complex={primaryConversion.fields.complex} />
          </CardContent>
        )}
      </Card>

      {/* ── Section 2: Activity stats ──────────────────────────────────── */}
      <LeadStatsCard
        totalVisits={totalVisits}
        totalPageViews={totalPageViews}
        totalEngagedMs={totalEngagedMs}
        avgScrollPct={avgScrollPct}
        hasConverted={hasConverted}
        timeToConvertMs={timeToConvertMs}
        visitsBeforeConversion={visitsBeforeConversion}
      />

      {/* ── Section 2b: the lead's forms: a bar per form, or field by field under "Advanced"
          (components/forms/LeadFormsCard.tsx). The old "The form they submitted" card is gone: its two times are
          the bar's two parts. ── */}
      {formActivities.length > 0 && <LeadFormsCard activities={formActivities} references={Object.fromEntries(references)} />}

      {/* ── Section 3: Path to conversion ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Path to Conversion</CardTitle>
          <CardDescription>
            {hasConverted
              ? `Every page viewed before ${identity.name || "this lead"} converted, in order. Bar length is time spent on that page.`
              : "Pages viewed so far. This visitor hasn't converted yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadTimeBar
            data={preConversionPath.map((pv) => ({
              label: pv.pagePath,
              timeMs: pv.timeOnPageMs,
              scrollDepthPct: pv.scrollDepthPct,
              visitNumber: pv.visitNumber,
              highlight: !!pv.isConversionPage,
            }))}
          />
        </CardContent>
      </Card>

      {/* ── Section 4: Conversion events (only when there is more than one) ─ */}
      {conversions.length > 1 && (
        <ConversionEventsBadges events={conversions.map((c) => ({ id: c.id, pagePath: c.pagePath, submittedAt: c.submittedAt, isFocus: !!c.isFocus }))} />
      )}

      {/* ── Section 5: Full session history (converted + non-converted) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Session History
            <InfoTip>Every visit made from this browser, including visits where they left without sending a form. Pick a visit on the left to see it; click a page in the chart to see what they did there.</InfoTip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-6 text-center text-sm text-muted-foreground">Loading sessions…</div>}>
            <LeadSessionExplorer
              siteId={siteId}
              visitorId={raw.focusSubmission?.visitor_id || ""}
              deviceType={raw.visitor?.device_type}
              initialSessionRows={raw.sessions}
              initialPageViewRows={raw.pageViews}
              initialSubmissionRows={raw.submissions}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
