import Link from "next/link";
import { ArrowLeft, Clock, Eye, Mail, MousePointerClick, Phone, Repeat, Sparkles, Timer } from "lucide-react";
import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getLeadProfileByLeadId } from "@/lib/actions/leadProfile.actions";
import { buildLeadProfile } from "@/lib/algorithms/leadProfile";
import PlanGate from "@/components/PlanGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { LeadTimeBar } from "@/components/charts/leadTimeBar";
import { LeadEngagementRadial } from "@/components/charts/leadEngagementRadial";
import { LeadSessionHistory } from "@/components/leads/LeadSessionHistory";
import { StatTile } from "@/components/StatTile";
import { formatDate, formatDateTime, formatDuration, formatRelativeTime } from "@/lib/leadFormat";

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
        <PlanGate userPlan={user.plan} sitePlan={site.plan} required="pro">
          <LeadProfileBody profile={buildLeadProfile({ ...raw, focusSubmission: raw.focusSubmission })} />
        </PlanGate>
      )}
    </div>
  );
}

function LeadProfileBody({ profile }) {
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
    engagementScore,
    conversions,
    primaryConversion,
    sessions,
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
                {hasConverted && <Badge>Converted</Badge>}
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
              {otherConversions.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Submitted from the same browser as {otherConversions.length} other lead{otherConversions.length === 1 ? "" : "s"} — see Conversion Events below.
                </p>
              )}
            </div>
          </div>

          <div className="text-left text-sm text-muted-foreground sm:text-right">
            <div>
              Last active <span className="font-medium text-foreground">{formatRelativeTime(lastActivity)}</span>
            </div>
            <div className="text-xs">First seen {formatDate(firstSeen)}{device ? ` · ${device}` : ""}</div>
          </div>
        </CardContent>

        {primaryConversion?.fields && (primaryConversion.fields.scalars.length > 0 || primaryConversion.fields.complex.length > 0) && (
          <CardContent className="pt-0 space-y-3">
            {primaryConversion.fields.scalars.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Submitted form details</p>
                <div className="flex flex-wrap gap-2">
                  {primaryConversion.fields.scalars.map((f) => (
                    <div key={f.key} className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
                      <span className="text-muted-foreground">{f.key}: </span>
                      <span className="font-medium text-foreground">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {primaryConversion.fields.complex.map((f) => (
              <details key={f.key} className="rounded-md border bg-muted/20">
                <summary className="cursor-pointer select-none px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                  {f.key} (raw data)
                </summary>
                <pre className="max-h-64 overflow-auto border-t px-2.5 py-2 text-[11px] leading-relaxed text-foreground">{f.value}</pre>
              </details>
            ))}
          </CardContent>
        )}
      </Card>

      {/* ── Section 2: Activity stats ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={Repeat} label="Total Visits" value={totalVisits} sub={totalVisits === 1 ? "single-visit lead" : "sessions on this site"} />
        <StatTile icon={Eye} label="Page Views" value={totalPageViews} sub="across all visits" />
        <StatTile icon={Clock} label="Time Engaged" value={formatDuration(totalEngagedMs)} sub="total time on page" />
        <StatTile icon={MousePointerClick} label="Avg Scroll" value={avgScrollPct != null ? `${avgScrollPct}%` : "—"} sub="depth per page" />
        <StatTile
          icon={Timer}
          label="Time to Convert"
          value={hasConverted ? formatDuration(timeToConvertMs) : "—"}
          sub={hasConverted ? (visitsBeforeConversion === 0 ? "on the first visit" : `after ${visitsBeforeConversion} earlier visit${visitsBeforeConversion === 1 ? "" : "s"}`) : "not converted yet"}
        />
      </div>

      {/* ── Section 3: Engagement + path to conversion ─────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Sparkles className="h-4 w-4" /> Engagement Score
            </CardTitle>
            <CardDescription>Pages, time on site, and scroll depth combined into one signal.</CardDescription>
          </CardHeader>
          <CardContent>
            <LeadEngagementRadial score={engagementScore} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Path to Conversion</CardTitle>
            <CardDescription>
              {hasConverted
                ? `Every page viewed before ${identity.name || "this lead"} converted, in order — bar length is time spent on that page.`
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
      </div>

      {/* ── Section 4: Conversion events (only when there is more than one) ─ */}
      {conversions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion Events</CardTitle>
            <CardDescription>{conversions.length} forms submitted from this same browser over time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {conversions.map((c) => (
              <div key={c.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${c.isFocus ? "border-primary/50 bg-primary/5" : ""}`}>
                <div>
                  <span className="font-medium text-foreground">{c.pagePath}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(c.submittedAt)}</span>
                  {c.isFocus && (
                    <Badge variant="outline" className="ml-2">
                      Viewing
                    </Badge>
                  )}
                </div>
                <Badge variant={c.confidence === "high" ? "default" : "outline"}>{c.confidence || "unknown"} confidence</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Section 5: Full session history (converted + non-converted) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session History</CardTitle>
          <CardDescription>
            Every visit made from this browser, including sessions where they left without converting. Click a row to see the pages viewed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadSessionHistory sessions={sessions} />
        </CardContent>
      </Card>
    </div>
  );
}
