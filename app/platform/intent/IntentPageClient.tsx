// app/platform/intent/IntentPageClient.tsx
'use client'

import * as React from 'react'
import {
  AlertTriangle, CheckCircle, XCircle, RefreshCw,
  TrendingDown, TrendingUp, Minus, Eye, Clock,
  MousePointer, Users, ArrowLeft, Code2, Info,
  ChevronDown, ChevronUp, BarChart2, Target, Zap,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { IntentFailureResult } from '@/lib/actions/intentFailure.action'
import type { FullPageAnalysis } from '@/lib/algorithms/pageAnalysis'
import {
  getCachedIntent, setCachedIntent, clearCachedIntent,
  getDevMode, setDevMode, CACHE_TTL_MS,
} from '@/lib/intentCache'
import { getIntentFailureAnalysis } from '@/lib/actions/intentFailure.action'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface GoalValues {
  targetConversionRate: number   // e.g. 0.02 = 2%
  targetExitRate: number         // acceptable exit rate e.g. 0.5
  targetReadTimeRatio: number    // expected time ratio e.g. 0.7 = 70% of expected
  targetReturnRate: number       // acceptable return rate e.g. 0.15
}

const DEFAULT_GOALS: GoalValues = {
  targetConversionRate: 0.03,
  targetExitRate: 0.55,
  targetReadTimeRatio: 0.7,
  targetReturnRate: 0.15,
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%` }

function formatDuration(ms: number): string {
  if (!ms || ms === 0) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), r = s % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

function getPageStatusIcon(score: number) {
  if (score >= 0.7) return <XCircle className="h-4 w-4 text-destructive" />
  if (score >= 0.5) return <AlertTriangle className="h-4 w-4 text-orange-500" />
  if (score >= 0.3) return <Minus className="h-4 w-4 text-yellow-500" />
  return <CheckCircle className="h-4 w-4 text-green-500" />
}

function getPageStatusColor(score: number): string {
  if (score >= 0.7) return 'hsl(var(--destructive))'
  if (score >= 0.5) return '#f97316'
  if (score >= 0.3) return '#eab308'
  return '#22c55e'
}

function getPageStatusBg(score: number): string {
  if (score >= 0.7) return 'rgba(239,68,68,0.08)'
  if (score >= 0.5) return 'rgba(249,115,22,0.08)'
  if (score >= 0.3) return 'rgba(234,179,8,0.08)'
  return 'rgba(34,197,94,0.08)'
}

function getPageStatusLabel(score: number): string {
  if (score >= 0.7) return 'Needs urgent attention'
  if (score >= 0.5) return 'Underperforming'
  if (score >= 0.3) return 'Could be better'
  return 'Performing well'
}

function isHomePage(path: string): boolean {
  return path === '/' || path === '/home' || path === '/index'
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIP WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground inline-block ml-1 cursor-help" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GOAL INPUT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface GoalInputProps {
  label: string
  tooltip: string
  example: string
  value: number
  recommended: number
  step: number
  min: number
  max: number
  formatDisplay: (v: number) => string
  onChange: (v: number) => void
}

function GoalInput({ label, tooltip, example, value, recommended, step, min, max, formatDisplay, onChange }: GoalInputProps) {
  const isDifferentFromRecommended = Math.abs(value - recommended) > step * 0.5
  const displayValue = Math.round(value * 1000) / 1000

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm text-xs space-y-1">
              <p>{tooltip}</p>
              <p className="text-muted-foreground italic">{example}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          className="h-8 w-8 p-0 text-lg"
          onClick={() => onChange(Math.max(min, value - step))}
        >−</Button>
        <Input
          type="number" className="h-8 w-20 text-center text-sm"
          value={displayValue}
          min={min} max={max} step={step}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
          }}
        />
        <Button
          variant="outline" size="sm"
          className="h-8 w-8 p-0 text-lg"
          onClick={() => onChange(Math.min(max, value + step))}
        >+</Button>
        <span className="text-sm font-semibold">{formatDisplay(value)}</span>
        {isDifferentFromRecommended && (
          <span className="text-xs text-muted-foreground">
            (suggested: {formatDisplay(recommended)})
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DONUT CHART (pure SVG, no library needed)
// ─────────────────────────────────────────────────────────────────────────────

function DonutChart({
  segments,
  size = 120,
  strokeWidth = 18,
  label,
}: {
  segments: { value: number; color: string; label: string }[]
  size?: number
  strokeWidth?: number
  label?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="text-xs text-muted-foreground">No data</span></div>

  let offset = 0
  const arcs = segments.map(seg => {
    const fraction = seg.value / total
    const dash = fraction * circumference
    const arc = { ...seg, dash, gap: circumference - dash, offset: circumference - offset }
    offset += dash
    return arc
  })

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={arc.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {label && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="text-xs font-bold text-foreground">{label}</span>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME DISTRIBUTION BAR CHART
// ─────────────────────────────────────────────────────────────────────────────

function TimeDistributionChart({ page }: { page: FullPageAnalysis }) {
  const dist = page.timeDistribution
  const maxCount = Math.max(...dist.buckets.map(b => b.count), 1)

  const zoneColors = {
    red: 'hsl(var(--destructive))',
    green: '#22c55e',
    yellow: '#eab308',
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-24">
        {dist.buckets.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <div
              style={{
                width: '100%',
                height: `${Math.max((b.count / maxCount) * 88, b.count > 0 ? 4 : 0)}px`,
                background: zoneColors[b.zone],
                borderRadius: '3px 3px 0 0',
                opacity: b.count === 0 ? 0.15 : 1,
                transition: 'height 0.4s ease',
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {dist.buckets.map((b, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[9px] text-muted-foreground truncate block">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
        <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: zoneColors.red, display: 'inline-block' }} /> Left too fast ({dist.belowExpected})</span>
        <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: zoneColors.green, display: 'inline-block' }} /> Good time ({dist.withinExpected})</span>
        <span className="flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: zoneColors.yellow, display: 'inline-block' }} /> Lingered ({dist.aboveExpected})</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE DETAIL PANEL — shown when a page card is selected
// ─────────────────────────────────────────────────────────────────────────────

function PageDetailPanel({ page, goals, devMode }: { page: FullPageAnalysis; goals: GoalValues; devMode: boolean }) {
  const color = getPageStatusColor(page.intentFailureScore)
  const [showRaw, setShowRaw] = React.useState(false)

  // Determine what we can confidently say
  const hasConfidentInsight = page.intentFailureScore >= 0.7 && page.isStatisticallyMeaningful

  // Exit rate vs stayed
  const stayedCount = page.totalViews - Math.round(page.retention.exitRate * page.totalViews)
  const exitedCount = Math.round(page.retention.exitRate * page.totalViews)

  // Reading quality business label
  const readingLabel = page.functionIII.businessLabel

  // Early exit pattern
  const earlyExitPct = page.functionIV.isEarlyExitPattern
    ? pct(page.functionIV.earlyExitRate)
    : null

  // Max scroll data coverage
  const maxScrollCoverage = page.functionIII.maxScrollCoverage
  const hasMaxScrollData = maxScrollCoverage > 0.5

  return (
    <div className="space-y-5">
      {/* Top insight */}
      <Card style={{ borderColor: color + '40', background: getPageStatusBg(page.intentFailureScore) }}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {getPageStatusIcon(page.intentFailureScore)}
            </div>
            <div className="space-y-1 flex-1">
              <p className="text-sm font-semibold text-foreground leading-relaxed">
                {hasConfidentInsight
                  ? page.insightSentence
                  : `Here's what's happening on this page:`}
              </p>
              {!hasConfidentInsight && (
                <ul className="text-sm text-muted-foreground space-y-0.5 mt-2">
                  {page.retention.exitRate > 0.7 && (
                    <li>• {pct(page.retention.exitRate)} of visitors left from this page</li>
                  )}
                  {page.retention.crossSessionRepeatRate > 0.2 && (
                    <li>• {pct(page.retention.crossSessionRepeatRate)} of visitors came back on a different day</li>
                  )}
                  {page.readingPace.hasSignificantBacktrack && (
                    <li>• Visitors scrolled back up {pct(page.readingPace.scrollBackFraction)} of the page on average</li>
                  )}
                  {earlyExitPct && (
                    <li>• {earlyExitPct} of visitors scrolled to the bottom and left within 10 seconds</li>
                  )}
                  {!page.isStatisticallyMeaningful && (
                    <li className="text-muted-foreground/60">• Only {page.totalViews} visit{page.totalViews !== 1 ? 's' : ''} recorded — more data needed for confident analysis</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reading behaviour (fn III) */}
      {hasMaxScrollData && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              How visitors read this page
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground">{readingLabel}</p>
            {devMode && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                scroll_px_per_sec={page.functionIII.scrollPxPerSec.toFixed(1)} | quality={page.functionIII.readingQuality} | max_scroll_coverage={pct(maxScrollCoverage)} ({page.functionIII.rowsTotal - page.functionIII.rowsWithoutMaxScroll}/{page.functionIII.rowsTotal} rows)
              </p>
            )}
            {page.functionIII.rowsWithoutMaxScroll > 0 && devMode && (
              <p className="text-xs text-yellow-500 mt-1">
                ⚠ {page.functionIII.rowsWithoutMaxScroll} rows missing max_scroll_reached_at (old tracker data)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confusion zone (fn II) */}
      {page.functionII.hasConfusionZone && page.functionII.primaryBacktrackHeader && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 text-orange-500" />
              Visitors kept coming back to one section
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground">
              <span className="font-semibold">"{page.functionII.primaryBacktrackHeader.header_text}"</span>
              {' '}was revisited by{' '}
              <span className="font-semibold">{pct(page.functionII.primaryBacktrackHeader.backtrack_rate)}</span>
              {' '}of the visitors who saw it. This section may need clearer wording or more supporting information.
            </p>
            {devMode && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                confusionZoneRatio={page.functionII.confusionZoneRatio.toFixed(3)} | headers_analyzed={page.functionII.headers.length}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Classification (fn I) */}
      {page.functionI.classification !== 'normal' && page.isStatisticallyMeaningful && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Visitor behaviour pattern
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground">
              {page.functionI.classification === 'deep_confusion' && 'Visitors spent a long time on this page and scrolled back up, but still left without taking action. The content may be unclear or missing a key answer they were looking for.'}
              {page.functionI.classification === 'deep_engagement' && 'Visitors who scrolled back up were more likely to convert — they were carefully evaluating the content before deciding.'}
              {page.functionI.classification === 'smooth_low_value' && 'Visitors read the page at a normal pace but still left without converting. The content may not be compelling enough to drive action.'}
              {page.functionI.classification === 'quick_bounce' && 'Visitors left quickly without reading much. The page may not match what they expected to find when they arrived.'}
            </p>
            {devMode && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                classification={page.functionI.classification} | confidence={page.functionI.confidence.toFixed(3)} | scrollBackPx={page.functionI.scrollBackPx.toFixed(0)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Early exit pattern (fn IV) */}
      {page.functionIV.isEarlyExitPattern && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Visitors are leaving without reading
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground">
              {pct(page.functionIV.earlyExitRate)} of visitors reached the bottom of this page and left within 10 seconds. They likely scanned for something specific, didn't find it, and moved on.
            </p>
            {devMode && (
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                earlyExitSessions={page.functionIV.earlyExitSessions}/{page.functionIV.totalSessions} | retentionPenalty={page.functionIV.retentionScorePenalty.toFixed(3)} | ratios=[{page.functionIV.debugRatios.slice(0, 5).map(r => r.toFixed(1)).join(', ')}]
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Exit donut */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Who left vs who stayed</CardTitle>
            <CardDescription className="text-xs">Out of {page.totalViews} visit{page.totalViews !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex items-center gap-5">
            <DonutChart
              size={100}
              strokeWidth={16}
              label={pct(1 - page.retention.exitRate)}
              segments={[
                { value: stayedCount, color: '#22c55e', label: 'Stayed' },
                { value: exitedCount, color: 'hsl(var(--destructive))', label: 'Left' },
              ]}
            />
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-green-500 flex-shrink-0" />
                <span className="text-foreground">{stayedCount} continued browsing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-destructive flex-shrink-0" />
                <span className="text-foreground">{exitedCount} left the site here</span>
              </div>
              {page.retention.crossSessionRepeatRate > 0.1 && (
                <p className="text-xs text-muted-foreground pt-1">
                  {pct(page.retention.crossSessionRepeatRate)} of the people who left came back on another day
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time distribution */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">How long visitors stayed</CardTitle>
            <CardDescription className="text-xs">
              Expected reading time: {formatDuration(page.timeDistribution.expectedTimeMs)}
              <InfoTooltip content="Based on page length and content density. Visitors who stayed this long likely read the page properly." />
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <TimeDistributionChart page={page} />
          </CardContent>
        </Card>
      </div>

      {/* Conversion signal */}
      {page.conversion.conversionScore > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Conversion connection
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-sm text-foreground">
              {pct(page.conversion.conversionScore)} of the visits to this page were part of a session where someone submitted a form.
              {page.conversion.conversionScore >= goals.targetConversionRate
                ? ' This is at or above your conversion goal.'
                : ` Your goal is ${pct(goals.targetConversionRate)}.`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* What visitors actually read */}
      {page.headers.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">What visitors actually read on this page</CardTitle>
            <CardDescription className="text-xs">Sections ranked by how many visitors scrolled far enough to see them</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {page.headers.map((h, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    h.header_tag === 'h1' ? 'bg-indigo-500/10 text-indigo-400' :
                    h.header_tag === 'h2' ? 'bg-sky-500/10 text-sky-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {h.header_tag.toUpperCase()}
                  </span>
                  <span className="text-sm text-foreground flex-1 truncate">{h.header_text}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        style={{
                          width: `${Math.round(h.viewed_rate * 100)}%`,
                          height: '100%',
                          background: h.viewed_rate > 0.5 ? '#22c55e' : h.viewed_rate > 0.25 ? '#eab308' : 'hsl(var(--destructive))',
                          borderRadius: 99,
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-9 text-right text-foreground">{pct(h.viewed_rate)}</span>
                    {h.inBacktrackZone && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-orange-500/40 text-orange-400">revisited</Badge>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-xs">
                            A significant portion of visitors who saw this section scrolled back up to read it again — suggesting it needs clarification.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dev mode raw data */}
      {devMode && (
        <Card className="border-dashed border-muted-foreground/30">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-mono text-muted-foreground flex items-center gap-2">
              <Code2 className="h-3 w-3" /> DEV MODE — Raw scores
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <pre className="text-[10px] text-muted-foreground font-mono leading-relaxed overflow-x-auto">
{`intentFailureScore:   ${page.intentFailureScore.toFixed(4)}
retentionScore:       ${page.retentionScoreValue.toFixed(4)}
conversionScore:      ${page.conversionScoreValue.toFixed(4)}
spotlightScore:       ${page.spotlightScoreValue.toFixed(4)}
pageHeight:           ${page.pageHeight}px
contentDensity:       ${page.readingPace.contentDensity}
scrollPxPerSec:       ${page.readingPace.scrollPxPerSec.toFixed(2)}
scrollBackFraction:   ${page.readingPace.scrollBackFraction.toFixed(4)}
postPeakTimeRatio:    ${page.readingPace.postPeakTimeRatio.toFixed(4)}
engagementTimeScore:  ${page.engagement.timeScore.toFixed(4)}
engagementScrollScore:${page.engagement.scrollScore.toFixed(4)}
expectedReadTimeMs:   ${page.engagement.expectedReadTimeMs.toFixed(0)}
exitRate:             ${page.retention.exitRate.toFixed(4)}
crossSessionRepeat:   ${page.retention.crossSessionRepeatRate.toFixed(4)}
withinSessionRepeat:  ${page.retention.withinSessionRepeatRate.toFixed(4)}
fnI.classification:   ${page.functionI.classification}
fnI.confidence:       ${page.functionI.confidence.toFixed(4)}
fnII.confusionZone:   ${page.functionII.confusionZoneRatio.toFixed(4)}
fnIII.readingQuality: ${page.functionIII.readingQuality}
fnIV.earlyExitRate:   ${page.functionIV.earlyExitRate.toFixed(4)}
scoreBreakdown:       ${JSON.stringify(page.scoreBreakdown, null, 0)}`}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE GRID CARD
// ─────────────────────────────────────────────────────────────────────────────

function PageCard({
  page,
  isSelected,
  onClick,
}: {
  page: FullPageAnalysis
  isSelected: boolean
  onClick: () => void
}) {
  const color = getPageStatusColor(page.intentFailureScore)
  const bg = getPageStatusBg(page.intentFailureScore)
  const label = getPageStatusLabel(page.intentFailureScore)

  return (
    <button
      onClick={onClick}
      style={{
        background: isSelected ? bg : 'hsl(var(--card))',
        border: `1.5px solid ${isSelected ? color : 'hsl(var(--border))'}`,
        borderRadius: 10,
        padding: '12px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {getPageStatusIcon(page.intentFailureScore)}
        {!page.isStatisticallyMeaningful && (
          <span className="text-[9px] text-muted-foreground bg-muted rounded px-1">low data</span>
        )}
      </div>
      <div>
        <p className="text-xs font-mono text-muted-foreground truncate max-w-full">
          {page.page_path || '/'}
        </p>
        <p className="text-xs text-foreground mt-0.5" style={{ color }}>
          {label}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 3, background: 'hsl(var(--muted))', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${Math.round(page.intentFailureScore * 100)}%`, height: '100%', background: color, borderRadius: 99 }} />
        </div>
        <span className="text-[10px] font-bold" style={{ color }}>
          {pct(page.intentFailureScore)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
        <span className="flex items-center gap-0.5">
          <Eye className="h-2.5 w-2.5" />{page.totalViews}
        </span>
        <span className="flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5" />{page.uniqueVisitors}
        </span>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GOAL SECTION
// ─────────────────────────────────────────────────────────────────────────────

function GoalSection({
  goals,
  recommendedGoals,
  onChange,
  devMode,
}: {
  goals: GoalValues
  recommendedGoals: GoalValues
  onChange: (g: GoalValues) => void
  devMode: boolean
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Card>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Set your goals for this site</span>
          <span className="text-xs text-muted-foreground">— used to measure how your pages are performing</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          <Separator />
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <GoalInput
                label="Conversion goal"
                tooltip="Out of 100 visitors, how many do you expect to submit a form or take a key action?"
                example="2% means: if 100 people visit, you expect 2 to convert. A low-traffic B2B site might aim for 5%, an e-commerce site might target 1%."
                value={goals.targetConversionRate}
                recommended={recommendedGoals.targetConversionRate}
                step={0.01}
                min={0.001}
                max={1}
                formatDisplay={v => pct(v)}
                onChange={v => onChange({ ...goals, targetConversionRate: v })}
              />
              <GoalInput
                label="Acceptable exit rate"
                tooltip="What fraction of visitors leaving from a page is normal for your business?"
                example="60% means: it's OK if 60 out of 100 visitors leave from this page. Lower is better, but some pages are naturally exit points."
                value={goals.targetExitRate}
                recommended={recommendedGoals.targetExitRate}
                step={0.05}
                min={0.01}
                max={1}
                formatDisplay={v => pct(v)}
                onChange={v => onChange({ ...goals, targetExitRate: v })}
              />
              <GoalInput
                label="Minimum reading time"
                tooltip="What fraction of the expected reading time should visitors spend at minimum?"
                example="70% means: if a page is expected to take 30 seconds to read, visitors should spend at least 21 seconds. Below this is a warning sign."
                value={goals.targetReadTimeRatio}
                recommended={recommendedGoals.targetReadTimeRatio}
                step={0.05}
                min={0.1}
                max={1}
                formatDisplay={v => pct(v)}
                onChange={v => onChange({ ...goals, targetReadTimeRatio: v })}
              />
              <GoalInput
                label="Return visitor tolerance"
                tooltip="How many visitors returning multiple times without converting is acceptable?"
                example="15% means: if more than 15 out of 100 visitors keep coming back without converting, something is stopping them."
                value={goals.targetReturnRate}
                recommended={recommendedGoals.targetReturnRate}
                step={0.05}
                min={0.01}
                max={1}
                formatDisplay={v => pct(v)}
                onChange={v => onChange({ ...goals, targetReturnRate: v })}
              />
            </div>
            {devMode && (
              <p className="text-xs font-mono text-muted-foreground mt-4">
                recommendedGoals: {JSON.stringify(recommendedGoals)}
              </p>
            )}
          </CardContent>
        </>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLIENT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function IntentPageClient({
  initialData,
  siteId,
}: {
  initialData: IntentFailureResult | null
  siteId: string
}) {
  const [data, setData] = React.useState<IntentFailureResult | null>(initialData)
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [lastFetchedAt, setLastFetchedAt] = React.useState<number>(Date.now())
  const [goals, setGoals] = React.useState<GoalValues>(DEFAULT_GOALS)
  const [devMode, setDevModeState] = React.useState(false)
  const [cacheStatus, setCacheStatus] = React.useState<'fresh' | 'stale' | 'db'>('db')

  // Init from localStorage on mount
  React.useEffect(() => {
    setDevModeState(getDevMode())

    const cached = getCachedIntent(siteId)
    if (cached && !cached.isStale) {
      setData(cached.data as IntentFailureResult)
      setCacheStatus('fresh')
    } else if (initialData) {
      setCachedIntent(siteId, initialData)
      setCacheStatus('db')
    }

    // Auto-select home page or first page
    if (initialData?.pages.length) {
      const home = initialData.pages.find(p => isHomePage(p.page_path))
      setSelectedPath(home?.page_path ?? initialData.pages[0].page_path)
    }
  }, [siteId, initialData])

  const toggleDevMode = () => {
    const next = !devMode
    setDevModeState(next)
    setDevMode(next)
  }

  const handleRefresh = async () => {
    setLoading(true)
    clearCachedIntent(siteId)
    try {
      const fresh = await getIntentFailureAnalysis(siteId)
      if (fresh) {
        setData(fresh)
        setCachedIntent(siteId, fresh)
        setLastFetchedAt(Date.now())
        setCacheStatus('db')
        // Keep selected page if it still exists
        if (selectedPath && !fresh.pages.find(p => p.page_path === selectedPath)) {
          setSelectedPath(fresh.pages[0]?.page_path ?? null)
        }
      }
    } catch (err) {
      console.error('[IntentPageClient] refresh error:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectedPage = data?.pages.find(p => p.page_path === selectedPath) ?? null

  // Compute recommended goals from data
  const recommendedGoals: GoalValues = React.useMemo(() => {
    if (!data?.pages.length) return DEFAULT_GOALS
    const avgConversion = data.pages.reduce((s, p) => s + p.conversion.conversionScore, 0) / data.pages.length
    const avgExit = data.pages.reduce((s, p) => s + p.retention.exitRate, 0) / data.pages.length
    const avgReturn = data.pages.reduce((s, p) => s + p.retention.crossSessionRepeatRate, 0) / data.pages.length
    return {
      targetConversionRate: Math.max(avgConversion * 1.2, 0.02),
      targetExitRate: Math.min(avgExit * 0.9, 0.8),
      targetReadTimeRatio: 0.7,
      targetReturnRate: Math.min(avgReturn * 0.8, 0.3),
    }
  }, [data])

  if (!data || data.pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No page data yet. Install the tracker and wait for your first visitors.
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Visitor Behaviour</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Understand what visitors are doing on each page — and where they're getting stuck.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {cacheStatus === 'fresh' && (
              <span className="text-xs text-muted-foreground">
                Cached · {Math.round((Date.now() - lastFetchedAt) / 1000)}s ago
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {/* Dev mode toggle — hidden in prod, visible only when you know it's there */}
            {process.env.NODE_ENV === 'development' && (
              <Button
                variant={devMode ? 'default' : 'ghost'}
                size="sm"
                onClick={toggleDevMode}
                className="text-xs"
              >
                <Code2 className="h-3.5 w-3.5 mr-1" />
                {devMode ? 'Dev ON' : 'Dev'}
              </Button>
            )}
          </div>
        </div>

        {/* Goal section */}
        <GoalSection
          goals={goals}
          recommendedGoals={recommendedGoals}
          onChange={setGoals}
          devMode={devMode}
        />

        {/* Page grid */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
            Your pages — {data.pages.length} tracked
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10,
            }}
          >
            {data.pages.map(page => (
              <PageCard
                key={page.page_path}
                page={page}
                isSelected={selectedPath === page.page_path}
                onClick={() => setSelectedPath(page.page_path)}
              />
            ))}
          </div>
        </div>

        <Separator />

        {/* Selected page detail */}
        {selectedPage ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {selectedPage.headers.find(h => h.header_tag === 'h1')?.header_text ?? selectedPage.page_path}
                </h2>
                <p className="text-xs text-muted-foreground font-mono">{selectedPage.page_path}</p>
              </div>
              <Badge
                variant="outline"
                style={{
                  borderColor: getPageStatusColor(selectedPage.intentFailureScore) + '60',
                  color: getPageStatusColor(selectedPage.intentFailureScore),
                  background: getPageStatusBg(selectedPage.intentFailureScore),
                }}
              >
                {getPageStatusLabel(selectedPage.intentFailureScore)}
              </Badge>
            </div>
            <PageDetailPanel page={selectedPage} goals={goals} devMode={devMode} />
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-12">
            Select a page above to see its analysis
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}