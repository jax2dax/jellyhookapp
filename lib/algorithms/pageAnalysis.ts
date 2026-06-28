// lib/algorithms/pageAnalysis.ts
// Pure math only. No server imports. Safe everywhere.

export const SCORE_RECALCULATE_THROTTLE_MS = 5 * 60 * 1000
const DENSE_PAGE_THRESHOLD_PX = 2000
const SPARSE_PAGE_THRESHOLD_PX = 500
const MIN_VIEWS_FOR_SCORING = 3

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PageViewRow {
  session_id: string | null
  visitor_id: string | null
  page_path: string
  time_on_page: number | null
  scroll_depth: number | null
  max_scroll_depth: number | null
  max_scroll_reached_at: string | null
  left_at: string | null
  entered_at: string | null
}

export interface PageStructureRow {
  header_text: string
  header_tag: string
  header_index: number
  position_y: number
  page_height: number
}

export interface PageMetricsRow {
  page_height: number | null
}

export interface ReadingPaceSignal {
  normalizedScrollCoverage: number
  scrollPxPerSec: number
  isPlausibleReading: boolean
  postPeakTimeRatio: number
  scrollBackFraction: number
  hasSignificantBacktrack: boolean
  pageHeightUsed: number
  contentDensity: 'sparse' | 'medium' | 'dense'
}

export interface ConfusionSignal {
  backtrackScore: number
  reverseTimeScore: number
  combined: number
  reason: string
}

export interface EngagementSignal {
  timeScore: number
  scrollScore: number
  combined: number
  expectedReadTimeMs: number
  metExpectedTime: boolean
}

export interface RetentionSignal {
  exitRate: number
  crossSessionRepeatRate: number
  withinSessionRepeatRate: number
  retentionScore: number
}

export interface SpotlightSignal {
  totalViews: number
  trafficShare: number
  uniqueVisitors: number
  spotlightScore: number
}

export interface ConversionSignal {
  precededConversionRate: number
  directConversionRate: number
  conversionScore: number
}

export interface HeaderVisibilitySignal {
  header_text: string
  header_tag: string
  header_ratio: number
  viewed_rate: number
  inBacktrackZone: boolean
  importanceWeight: number
}

export interface FunctionIResult {
  classification: 'deep_confusion' | 'deep_engagement' | 'smooth_low_value' | 'quick_bounce' | 'normal'
  confidence: number
  scrollBackPx: number
  metTimeThreshold: boolean
  debugInfo: {
    avgMaxScrollDepth: number
    avgExitScrollDepth: number
    avgTimeMs: number
    expectedTimeMs: number
    pageHeightPx: number
  }
}

export interface FunctionIIHeaderResult {
  header_text: string
  header_tag: string
  header_ratio: number
  sessions_viewed: number
  sessions_backtracked_to: number
  backtrack_rate: number
  is_primary_backtrack: boolean
}

export interface FunctionIIResult {
  headers: FunctionIIHeaderResult[]
  primaryBacktrackHeader: FunctionIIHeaderResult | null
  hasConfusionZone: boolean
  confusionZoneRatio: number
}

export interface FunctionIIIResult {
  readingQuality: 'idle' | 'careful' | 'normal' | 'skimming' | 'not_reading' | 'unknown'
  scrollPxPerSec: number
  businessLabel: string
  isProblematic: boolean
  rowsWithoutMaxScroll: number
  rowsTotal: number
  maxScrollCoverage: number
}

export interface FunctionIVResult {
  earlyExitSessions: number
  totalSessions: number
  earlyExitRate: number
  isEarlyExitPattern: boolean
  retentionScorePenalty: number
  conversionScorePenalty: number
  debugRatios: number[]
}

export interface TimeDistributionResult {
  totalSessions: number
  belowExpected: number
  withinExpected: number
  aboveExpected: number
  expectedTimeMs: number
  buckets: { label: string; count: number; zone: 'red' | 'green' | 'yellow' }[]
}

export interface FullPageAnalysis {
  page_path: string
  pageHeight: number
  totalViews: number
  uniqueVisitors: number
  uniqueSessions: number
  readingPace: ReadingPaceSignal
  confusion: ConfusionSignal
  engagement: EngagementSignal
  retention: RetentionSignal
  spotlight: SpotlightSignal
  conversion: ConversionSignal
  headers: HeaderVisibilitySignal[]
  functionI: FunctionIResult
  functionII: FunctionIIResult
  functionIII: FunctionIIIResult
  functionIV: FunctionIVResult
  timeDistribution: TimeDistributionResult
  intentFailureScore: number
  retentionScoreValue: number
  conversionScoreValue: number
  spotlightScoreValue: number
  label: 'critical' | 'warning' | 'good' | 'investigating'
  color: 'red' | 'orange' | 'yellow' | 'green'
  insightSentence: string
  scoreBreakdown: {
    timeContribution: number
    scrollContribution: number
    exitContribution: number
    confusionContribution: number
    backtrackContribution: number
    crossSessionMultiplier: number
    withinSessionMultiplier: number
    densityAdjustment: number
  }
  isStatisticallyMeaningful: boolean
}

export type ScoreType = 'retentionScore' | 'conversionScore' | 'spotlightScore' | 'all'

export interface ScoreResult {
  page_path: string
  retentionScore: number | null
  conversionScore: number | null
  spotlightScore: number | null
  label: string | null
  color: string | null
  last_calculated_at: string | null
  fromCache: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

export function computeAdaptiveThreshold(scores: number[]): number {
  if (scores.length === 0) return 0.5
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length
  const stddev = Math.sqrt(variance)
  return clamp(mean + 0.5 * stddev, 0.35, 0.75)
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — SIGNAL EXTRACTORS
// ─────────────────────────────────────────────────────────────────────────────

export function computeReadingPaceSignal(views: PageViewRow[], pageHeight: number): ReadingPaceSignal {
  const empty: ReadingPaceSignal = {
    normalizedScrollCoverage: 0, scrollPxPerSec: 0, isPlausibleReading: false,
    postPeakTimeRatio: 0, scrollBackFraction: 0, hasSignificantBacktrack: false,
    pageHeightUsed: pageHeight, contentDensity: 'medium',
  }
  try {
    if (!views.length || pageHeight <= 0) return empty
    const contentDensity: ReadingPaceSignal['contentDensity'] =
      pageHeight >= DENSE_PAGE_THRESHOLD_PX ? 'dense' :
      pageHeight >= SPARSE_PAGE_THRESHOLD_PX ? 'medium' : 'sparse'

    const pxScrolledArr = views.map(v => (v.max_scroll_depth ?? v.scroll_depth ?? 0) * pageHeight).filter(v => v > 0)
    const avgPxScrolled = pxScrolledArr.length ? pxScrolledArr.reduce((a, b) => a + b, 0) / pxScrolledArr.length : 0
    const timesMs = views.filter(v => v.time_on_page != null && v.time_on_page > 0)
    const avgTimeMs = timesMs.length ? timesMs.reduce((s, v) => s + v.time_on_page!, 0) / timesMs.length : 0
    const avgTimeSec = avgTimeMs / 1000
    const scrollPxPerSec = avgTimeSec > 0 ? avgPxScrolled / avgTimeSec : 0
    const normalizedScrollCoverage = clamp(avgPxScrolled / pageHeight, 0, 1)
    const isPlausibleReading = scrollPxPerSec > 1 && scrollPxPerSec < 200

    let postPeakSum = 0, postPeakCount = 0
    for (const v of views) {
      if (!v.entered_at || !v.left_at || !v.max_scroll_reached_at || !v.time_on_page) continue
      try {
        const sfx = (s: string) => s.includes('Z') || s.includes('+') ? s : s + 'Z'
        const enteredMs = new Date(sfx(v.entered_at)).getTime()
        const leftMs = new Date(sfx(v.left_at)).getTime()
        const peakMs = new Date(v.max_scroll_reached_at).getTime()
        const totalMs = leftMs - enteredMs
        if (totalMs <= 0) continue
        postPeakSum += clamp((leftMs - peakMs) / totalMs, 0, 1)
        postPeakCount++
      } catch { /* skip */ }
    }
    const postPeakTimeRatio = postPeakCount > 0 ? postPeakSum / postPeakCount : 0
    const scrollBacks = views.filter(v => v.max_scroll_depth != null && v.scroll_depth != null).map(v => Math.max(0, v.max_scroll_depth! - v.scroll_depth!))
    const scrollBackFraction = scrollBacks.length ? scrollBacks.reduce((a, b) => a + b, 0) / scrollBacks.length : 0

    return { normalizedScrollCoverage, scrollPxPerSec, isPlausibleReading, postPeakTimeRatio, scrollBackFraction, hasSignificantBacktrack: scrollBackFraction > 0.1, pageHeightUsed: pageHeight, contentDensity }
  } catch (err) {
    console.error('[algo:readingPace] error:', err)
    return empty
  }
}

export function computeConfusionSignal(pace: ReadingPaceSignal, avgTimeMs: number, exitRate: number): ConfusionSignal {
  try {
    const backtrackScore = clamp(pace.scrollBackFraction * 2, 0, 1)
    const reverseTimeScore = pace.postPeakTimeRatio > 0.4 ? clamp((pace.postPeakTimeRatio - 0.4) * 3, 0, 1) : 0
    const combined = clamp(backtrackScore * 0.5 + reverseTimeScore * 0.5, 0, 1)
    let reason = ''
    if (pace.hasSignificantBacktrack && pace.postPeakTimeRatio > 0.4) reason = `Visitors scrolled back up ${pct(pace.scrollBackFraction)} of the page and spent ${pct(pace.postPeakTimeRatio)} of their time after the deepest point — strong confusion pattern`
    else if (pace.hasSignificantBacktrack) reason = `Visitors consistently scrolled back after reaching the deepest point — likely re-reading or searching for something specific`
    else if (pace.postPeakTimeRatio > 0.5) reason = `Visitors spent most of their time after reaching the bottom — possible decision paralysis or missing next action`
    else if (exitRate > 0.8 && avgTimeMs < 3000) reason = `Visitors left almost immediately — page content likely mismatched their expectation`
    else reason = `No strong confusion signals detected on this page`
    return { backtrackScore, reverseTimeScore, combined, reason }
  } catch (err) {
    console.error('[algo:confusion] error:', err)
    return { backtrackScore: 0, reverseTimeScore: 0, combined: 0, reason: 'Unable to compute' }
  }
}

export function computeTimeDigest(pageHeight: number, normalizedScrollCoverage: number): { expectedMs: number; densityMultiplier: number } {
  try {
    const baseSec = 3 + pageHeight / 100
    const densityMultiplier = pageHeight >= DENSE_PAGE_THRESHOLD_PX ? 1.5 : pageHeight >= SPARSE_PAGE_THRESHOLD_PX ? 1.0 : 0.6
    const coverageFactor = Math.max(normalizedScrollCoverage, 0.2)
    const expectedMs = baseSec * densityMultiplier * coverageFactor * 1000
    return { expectedMs, densityMultiplier }
  } catch (err) {
    console.error('[algo:timeDigest] error:', err)
    return { expectedMs: 5000, densityMultiplier: 1 }
  }
}

export function computeEngagementSignal(views: PageViewRow[], pace: ReadingPaceSignal, pageHeight: number): EngagementSignal {
  try {
    const timesMs = views.filter(v => v.time_on_page != null && v.time_on_page > 0)
    const avgTimeMs = timesMs.length ? timesMs.reduce((s, v) => s + v.time_on_page!, 0) / timesMs.length : 0
    const { expectedMs } = computeTimeDigest(pageHeight, pace.normalizedScrollCoverage)
    const timeScore = clamp(avgTimeMs / expectedMs, 0, 1)
    const scrollBaseline = pace.contentDensity === 'dense' ? 0.3 : pace.contentDensity === 'medium' ? 0.5 : 0.7
    const scrollScore = clamp(pace.normalizedScrollCoverage / scrollBaseline, 0, 1)
    const combined = clamp(timeScore * 0.55 + scrollScore * 0.45, 0, 1)
    return { timeScore, scrollScore, combined, expectedReadTimeMs: expectedMs, metExpectedTime: avgTimeMs >= expectedMs * 0.7 }
  } catch (err) {
    console.error('[algo:engagement] error:', err)
    return { timeScore: 0, scrollScore: 0, combined: 0, expectedReadTimeMs: 5000, metExpectedTime: false }
  }
}

export function computeRetentionSignal(views: PageViewRow[]): RetentionSignal {
  try {
    const total = views.length
    const exitRate = total > 0 ? views.filter(v => v.left_at != null).length / total : 0
    const visitorCounts = new Map<string, number>()
    const sessionCounts = new Map<string, number>()
    for (const v of views) {
      if (v.visitor_id) visitorCounts.set(v.visitor_id, (visitorCounts.get(v.visitor_id) ?? 0) + 1)
      if (v.session_id) sessionCounts.set(v.session_id, (sessionCounts.get(v.session_id) ?? 0) + 1)
    }
    const uniqueVisitors = visitorCounts.size
    const uniqueSessions = sessionCounts.size
    let crossRepeat = 0
    for (const c of visitorCounts.values()) if (c > 1) crossRepeat++
    let withinRepeat = 0
    for (const c of sessionCounts.values()) if (c > 1) withinRepeat++
    const crossSessionRepeatRate = uniqueVisitors > 0 ? crossRepeat / uniqueVisitors : 0
    const withinSessionRepeatRate = uniqueSessions > 0 ? withinRepeat / uniqueSessions : 0
    const retentionScore = clamp(exitRate * 0.4 + crossSessionRepeatRate * 0.35 + withinSessionRepeatRate * 0.25, 0, 1)
    return { exitRate, crossSessionRepeatRate, withinSessionRepeatRate, retentionScore }
  } catch (err) {
    console.error('[algo:retention] error:', err)
    return { exitRate: 0, crossSessionRepeatRate: 0, withinSessionRepeatRate: 0, retentionScore: 0 }
  }
}

export function computeSpotlightSignal(pageViews: number, totalSiteViews: number, uniqueVisitors: number): SpotlightSignal {
  try {
    const trafficShare = totalSiteViews > 0 ? pageViews / totalSiteViews : 0
    const spotlightScore = clamp(Math.log1p(trafficShare * 10) / Math.log1p(10), 0, 1)
    return { totalViews: pageViews, trafficShare, uniqueVisitors, spotlightScore }
  } catch (err) {
    console.error('[algo:spotlight] error:', err)
    return { totalViews: 0, trafficShare: 0, uniqueVisitors: 0, spotlightScore: 0 }
  }
}

export function computeConversionSignal(views: PageViewRow[], conversionSessionIds: Set<string>): ConversionSignal {
  try {
    const sessionsOnPage = new Set(views.map(v => v.session_id).filter(Boolean) as string[])
    const convertedCount = [...sessionsOnPage].filter(sid => conversionSessionIds.has(sid)).length
    const precededConversionRate = sessionsOnPage.size > 0 ? convertedCount / sessionsOnPage.size : 0
    const conversionScore = clamp(precededConversionRate, 0, 1)
    return { precededConversionRate, directConversionRate: precededConversionRate, conversionScore }
  } catch (err) {
    console.error('[algo:conversion] error:', err)
    return { precededConversionRate: 0, directConversionRate: 0, conversionScore: 0 }
  }
}

export function computeHeaderVisibility(views: PageViewRow[], headers: PageStructureRow[], pageHeight: number): HeaderVisibilitySignal[] {
  try {
    if (!headers.length || pageHeight <= 0) return []
    const sessionMaxScroll = new Map<string, number>()
    const sessionExitScroll = new Map<string, number>()
    for (const v of views) {
      if (!v.session_id) continue
      sessionMaxScroll.set(v.session_id, Math.max(sessionMaxScroll.get(v.session_id) ?? 0, v.max_scroll_depth ?? v.scroll_depth ?? 0))
      sessionExitScroll.set(v.session_id, v.scroll_depth ?? 0)
    }
    const totalSessions = sessionMaxScroll.size
    return headers.map(h => {
      const ratio = clamp(h.position_y / pageHeight, 0, 1)
      let sessionsViewed = 0, sessionsInBacktrackZone = 0
      for (const [sid, maxScroll] of sessionMaxScroll.entries()) {
        if (maxScroll >= ratio) {
          sessionsViewed++
          const exitScroll = sessionExitScroll.get(sid) ?? maxScroll
          if (ratio >= exitScroll && ratio <= maxScroll && maxScroll - exitScroll > 0.05) sessionsInBacktrackZone++
        }
      }
      return {
        header_text: h.header_text, header_tag: h.header_tag, header_ratio: ratio,
        viewed_rate: totalSessions > 0 ? sessionsViewed / totalSessions : 0,
        inBacktrackZone: sessionsInBacktrackZone > totalSessions * 0.2,
        importanceWeight: h.header_tag === 'h1' ? 1.0 : h.header_tag === 'h2' ? 0.7 : 0.4,
      }
    })
  } catch (err) {
    console.error('[algo:headerVisibility] error:', err)
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAMED ALGORITHMS i, ii, iii, iv
// ─────────────────────────────────────────────────────────────────────────────

export function algorithmFunctionI(views: PageViewRow[], pageHeight: number, expectedTimeMs: number, conversionSessionIds: Set<string>): FunctionIResult {
  const empty: FunctionIResult = {
    classification: 'normal', confidence: 0, scrollBackPx: 0, metTimeThreshold: false,
    debugInfo: { avgMaxScrollDepth: 0, avgExitScrollDepth: 0, avgTimeMs: 0, expectedTimeMs, pageHeightPx: pageHeight },
  }
  try {
    if (!views.length || pageHeight <= 0) return empty
    const withBothScrolls = views.filter(v => v.max_scroll_depth != null && v.scroll_depth != null)
    if (!withBothScrolls.length) return empty
    const avgMaxScroll = withBothScrolls.reduce((s, v) => s + v.max_scroll_depth!, 0) / withBothScrolls.length
    const avgExitScroll = withBothScrolls.reduce((s, v) => s + v.scroll_depth!, 0) / withBothScrolls.length
    const scrollBackFraction = Math.max(0, avgMaxScroll - avgExitScroll)
    const scrollBackPx = scrollBackFraction * pageHeight
    const timesMs = views.filter(v => v.time_on_page != null && v.time_on_page > 0)
    const avgTimeMs = timesMs.length ? timesMs.reduce((s, v) => s + v.time_on_page!, 0) / timesMs.length : 0
    const metTimeThreshold = avgTimeMs >= expectedTimeMs * 0.7
    const significantBacktrackThreshold = Math.min(100 / pageHeight, 0.15)
    const hasBacktrack = scrollBackFraction > significantBacktrackThreshold
    const sessionIds = new Set(views.map(v => v.session_id).filter(Boolean) as string[])
    const convertedHere = [...sessionIds].filter(sid => conversionSessionIds.has(sid)).length
    const conversionRate = sessionIds.size > 0 ? convertedHere / sessionIds.size : 0
    let classification: FunctionIResult['classification'] = 'normal'
    let confidence = 0
    if (hasBacktrack && metTimeThreshold && conversionRate < 0.05) { classification = 'deep_confusion'; confidence = clamp(scrollBackFraction * 2 + (avgTimeMs / expectedTimeMs) * 0.3, 0, 1) }
    else if (hasBacktrack && conversionRate > 0.1) { classification = 'deep_engagement'; confidence = clamp(conversionRate * 2, 0, 1) }
    else if (!hasBacktrack && metTimeThreshold && conversionRate < 0.05) { classification = 'smooth_low_value'; confidence = clamp((avgTimeMs / expectedTimeMs) * 0.5, 0, 1) }
    else if (!hasBacktrack && !metTimeThreshold) { classification = 'quick_bounce'; confidence = clamp(1 - avgTimeMs / Math.max(expectedTimeMs, 1000), 0, 1) }
    return { classification, confidence, scrollBackPx, metTimeThreshold, debugInfo: { avgMaxScrollDepth: avgMaxScroll, avgExitScrollDepth: avgExitScroll, avgTimeMs, expectedTimeMs, pageHeightPx: pageHeight } }
  } catch (err) {
    console.error('[algo:fnI] error:', err)
    return empty
  }
}

export function algorithmFunctionII(views: PageViewRow[], headers: PageStructureRow[], pageHeight: number): FunctionIIResult {
  const empty: FunctionIIResult = { headers: [], primaryBacktrackHeader: null, hasConfusionZone: false, confusionZoneRatio: 0 }
  try {
    if (!headers.length || pageHeight <= 0 || !views.length) return empty
    const sessionMaxScroll = new Map<string, number>()
    const sessionExitScroll = new Map<string, number>()
    for (const v of views) {
      if (!v.session_id) continue
      sessionMaxScroll.set(v.session_id, Math.max(sessionMaxScroll.get(v.session_id) ?? 0, v.max_scroll_depth ?? v.scroll_depth ?? 0))
      sessionExitScroll.set(v.session_id, v.scroll_depth ?? 0)
    }
    const totalSessions = sessionMaxScroll.size
    let sessionsWithAnyBacktrack = 0
    const results: FunctionIIHeaderResult[] = headers.map(h => {
      const ratio = clamp(h.position_y / pageHeight, 0, 1)
      let sessionsViewed = 0, sessionsBacktrackedTo = 0
      for (const [sid, maxScroll] of sessionMaxScroll.entries()) {
        if (maxScroll >= ratio) {
          sessionsViewed++
          const exitScroll = sessionExitScroll.get(sid) ?? maxScroll
          if (ratio >= exitScroll && ratio <= maxScroll && maxScroll - exitScroll > 0.05) sessionsBacktrackedTo++
        }
      }
      const backtrackRate = sessionsViewed > 0 ? sessionsBacktrackedTo / sessionsViewed : 0
      if (sessionsBacktrackedTo > 0) sessionsWithAnyBacktrack++
      return { header_text: h.header_text, header_tag: h.header_tag, header_ratio: ratio, sessions_viewed: sessionsViewed, sessions_backtracked_to: sessionsBacktrackedTo, backtrack_rate: backtrackRate, is_primary_backtrack: false }
    })
    const h1s = results.filter(r => r.header_tag === 'h1' && r.backtrack_rate > 0)
    if (h1s.length > 0) h1s.sort((a, b) => b.backtrack_rate - a.backtrack_rate)[0].is_primary_backtrack = true
    const primaryBacktrackHeader = results.filter(r => r.backtrack_rate > 0).sort((a, b) => b.backtrack_rate - a.backtrack_rate)[0] ?? null
    const confusionZoneRatio = totalSessions > 0 ? sessionsWithAnyBacktrack / totalSessions : 0
    return { headers: results, primaryBacktrackHeader, hasConfusionZone: confusionZoneRatio > 0.2, confusionZoneRatio }
  } catch (err) {
    console.error('[algo:fnII] error:', err)
    return empty
  }
}

export function algorithmFunctionIII(views: PageViewRow[], pageHeight: number): FunctionIIIResult {
  try {
    const rowsTotal = views.length
    const rowsWithoutMaxScroll = views.filter(v => v.max_scroll_reached_at == null).length
    const maxScrollCoverage = rowsTotal > 0 ? (rowsTotal - rowsWithoutMaxScroll) / rowsTotal : 0
    if (rowsTotal === 0 || pageHeight <= 0) return { readingQuality: 'unknown', scrollPxPerSec: 0, businessLabel: 'Not enough data', isProblematic: false, rowsWithoutMaxScroll, rowsTotal, maxScrollCoverage }
    const validViews = views.filter(v => v.max_scroll_depth != null && v.time_on_page != null && v.time_on_page > 0)
    if (!validViews.length) return { readingQuality: 'unknown', scrollPxPerSec: 0, businessLabel: 'Not enough scroll data yet', isProblematic: false, rowsWithoutMaxScroll, rowsTotal, maxScrollCoverage }
    const avgPxScrolled = validViews.reduce((s, v) => s + (v.max_scroll_depth! * pageHeight), 0) / validViews.length
    const avgTimeSec = validViews.reduce((s, v) => s + (v.time_on_page! / 1000), 0) / validViews.length
    const scrollPxPerSec = avgTimeSec > 0 ? avgPxScrolled / avgTimeSec : 0
    let readingQuality: FunctionIIIResult['readingQuality']
    let businessLabel: string
    let isProblematic: boolean
    if (scrollPxPerSec < 1) { readingQuality = 'idle'; businessLabel = 'Visitors left the tab open but were not actively reading'; isProblematic = true }
    else if (scrollPxPerSec < 20) { readingQuality = 'careful'; businessLabel = 'Visitors are reading your content carefully'; isProblematic = false }
    else if (scrollPxPerSec < 80) { readingQuality = 'normal'; businessLabel = 'Visitors are reading at a normal pace'; isProblematic = false }
    else if (scrollPxPerSec < 200) { readingQuality = 'skimming'; businessLabel = 'Visitors are skimming — looking for something specific'; isProblematic = true }
    else { readingQuality = 'not_reading'; businessLabel = 'Visitors are scrolling past content without reading'; isProblematic = true }
    return { readingQuality, scrollPxPerSec, businessLabel, isProblematic, rowsWithoutMaxScroll, rowsTotal, maxScrollCoverage }
  } catch (err) {
    console.error('[algo:fnIII] error:', err)
    return { readingQuality: 'unknown', scrollPxPerSec: 0, businessLabel: 'Unable to compute', isProblematic: false, rowsWithoutMaxScroll: 0, rowsTotal: views.length, maxScrollCoverage: 0 }
  }
}

export function algorithmFunctionIV(views: PageViewRow[]): FunctionIVResult {
  const empty: FunctionIVResult = { earlyExitSessions: 0, totalSessions: 0, earlyExitRate: 0, isEarlyExitPattern: false, retentionScorePenalty: 0, conversionScorePenalty: 0, debugRatios: [] }
  try {
    const validViews = views.filter(v => v.entered_at && v.left_at && v.max_scroll_reached_at && v.time_on_page)
    const totalSessions = new Set(views.map(v => v.session_id).filter(Boolean)).size
    if (!validViews.length) return { ...empty, totalSessions }
    const debugRatios: number[] = []
    let earlyExitCount = 0
    for (const v of validViews) {
      try {
        const sfx = (s: string) => s.includes('Z') || s.includes('+') ? s : s + 'Z'
        const enteredMs = new Date(sfx(v.entered_at!)).getTime()
        const leftMs = new Date(sfx(v.left_at!)).getTime()
        const peakMs = new Date(v.max_scroll_reached_at!).getTime()
        const totalTime = leftMs - enteredMs
        const timeAfterPeak = leftMs - peakMs
        if (totalTime <= 0 || timeAfterPeak <= 0) continue
        const ratio = (peakMs - enteredMs) / timeAfterPeak
        debugRatios.push(ratio)
        if (v.time_on_page! < 10000 && ratio > 3) earlyExitCount++
      } catch { /* skip */ }
    }
    const earlyExitRate = totalSessions > 0 ? earlyExitCount / totalSessions : 0
    return { earlyExitSessions: earlyExitCount, totalSessions, earlyExitRate, isEarlyExitPattern: earlyExitRate > 0.3, retentionScorePenalty: clamp(earlyExitRate * 1.2, 0, 0.4), conversionScorePenalty: clamp(earlyExitRate * 0.8, 0, 0.3), debugRatios }
  } catch (err) {
    console.error('[algo:fnIV] error:', err)
    return empty
  }
}

export function computeTimeDistribution(views: PageViewRow[], expectedTimeMs: number): TimeDistributionResult {
  try {
    const validTimes = views.filter(v => v.time_on_page != null && v.time_on_page > 0).map(v => v.time_on_page!)
    const totalSessions = validTimes.length
    if (!totalSessions || expectedTimeMs <= 0) return { totalSessions, belowExpected: 0, withinExpected: 0, aboveExpected: 0, expectedTimeMs, buckets: [] }
    const below70 = expectedTimeMs * 0.7
    const above130 = expectedTimeMs * 1.3
    let belowExpected = 0, withinExpected = 0, aboveExpected = 0
    const maxBucketMs = expectedTimeMs * 3
    const bucketCount = 6
    const bucketSizeMs = maxBucketMs / bucketCount
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const start = i * bucketSizeMs
      const end = start + bucketSizeMs
      const zone: 'red' | 'green' | 'yellow' = end <= below70 ? 'red' : start >= above130 ? 'yellow' : 'green'
      const label = start < 60000 ? `${Math.round(start / 1000)}–${Math.round(end / 1000)}s` : `${Math.round(start / 60000)}–${Math.round(end / 60000)}m`
      return { label, count: 0, zone }
    })
    for (const t of validTimes) {
      if (t < below70) belowExpected++
      else if (t > above130) aboveExpected++
      else withinExpected++
      buckets[Math.min(Math.floor(t / bucketSizeMs), bucketCount - 1)].count++
    }
    return { totalSessions, belowExpected, withinExpected, aboveExpected, expectedTimeMs, buckets }
  } catch (err) {
    console.error('[algo:timeDistribution] error:', err)
    return { totalSessions: 0, belowExpected: 0, withinExpected: 0, aboveExpected: 0, expectedTimeMs, buckets: [] }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — COMPOSITE SCORES
// ─────────────────────────────────────────────────────────────────────────────

export function computeIntentFailureScore(engagement: EngagementSignal, retention: RetentionSignal, confusion: ConfusionSignal, pace: ReadingPaceSignal): { score: number; breakdown: FullPageAnalysis['scoreBreakdown'] } {
  try {
    const timeContribution = (1 - engagement.timeScore) * 0.25
    const scrollContribution = (1 - engagement.scrollScore) * 0.20
    const exitContribution = retention.exitRate * 0.20
    const confusionContribution = confusion.combined * 0.20
    const backtrackContribution = pace.scrollBackFraction * 0.15
    const base = timeContribution + scrollContribution + exitContribution + confusionContribution + backtrackContribution
    const crossSessionMultiplier = retention.crossSessionRepeatRate > 0.3 ? 1.5 : 1.0
    const withinSessionMultiplier = retention.withinSessionRepeatRate > 0.3 ? 1.25 : 1.0
    const densityAdjustment = pace.contentDensity === 'sparse' ? 0.8 : 1.0
    const score = clamp(base * crossSessionMultiplier * withinSessionMultiplier * densityAdjustment, 0, 1)
    return { score, breakdown: { timeContribution, scrollContribution, exitContribution, confusionContribution, backtrackContribution, crossSessionMultiplier, withinSessionMultiplier, densityAdjustment } }
  } catch (err) {
    console.error('[algo:intentFailureScore] error:', err)
    return { score: 0, breakdown: { timeContribution: 0, scrollContribution: 0, exitContribution: 0, confusionContribution: 0, backtrackContribution: 0, crossSessionMultiplier: 1, withinSessionMultiplier: 1, densityAdjustment: 1 } }
  }
}

export function computeLabelAndColor(intentFailureScore: number, engagement: EngagementSignal, confusion: ConfusionSignal): { label: FullPageAnalysis['label']; color: FullPageAnalysis['color'] } {
  if (intentFailureScore >= 0.7) return { label: 'critical', color: 'red' }
  if (intentFailureScore >= 0.5) return { label: 'warning', color: 'orange' }
  if (confusion.combined > 0.5 && !engagement.metExpectedTime) return { label: 'investigating', color: 'yellow' }
  return { label: 'good', color: 'green' }
}

export function buildInsightSentence(pagePath: string, pace: ReadingPaceSignal, engagement: EngagementSignal, retention: RetentionSignal, confusion: ConfusionSignal, headers: HeaderVisibilitySignal[], intentFailureScore: number): string {
  try {
    const topHeader = headers.find(h => h.header_tag === 'h1') ?? headers[0]
    const pageLabel = topHeader?.header_text ?? pagePath
    const backtrackHeaders = headers.filter(h => h.inBacktrackZone)
    const mostViewed = [...headers].sort((a, b) => b.viewed_rate - a.viewed_rate)[0]
    if (intentFailureScore >= 0.7) {
      if (confusion.combined > 0.5 && pace.hasSignificantBacktrack) return `Visitors on "${pageLabel}" are showing strong confusion — they scroll back to re-read content but still leave without converting. Consider restructuring the page flow or clarifying the main message.`
      if (retention.exitRate > 0.8 && !engagement.metExpectedTime) return `Most visitors are leaving "${pageLabel}" almost immediately — the page may not match what they expected to find. Review your headlines and above-the-fold content.`
      if (retention.crossSessionRepeatRate > 0.3) return `${pct(retention.crossSessionRepeatRate)} of visitors are returning to "${pageLabel}" across multiple sessions without converting — they are interested but something is preventing action.`
      return `"${pageLabel}" has critical engagement issues — visitors are not spending enough time or scrolling through the content to find what they need.`
    }
    if (intentFailureScore >= 0.5) {
      if (backtrackHeaders.length > 0) return `Visitors on "${pageLabel}" frequently revisit the "${backtrackHeaders[0].header_text}" section — this area may need clarification or better supporting content.`
      if (pace.postPeakTimeRatio > 0.5) return `Visitors spend most of their time on "${pageLabel}" after reaching the bottom — your call-to-action or next steps may not be clear enough.`
      return `"${pageLabel}" has moderate engagement issues — visitors are reading but not converting. Consider improving your value proposition or CTA placement.`
    }
    if (mostViewed && mostViewed.viewed_rate > 0.7) return `"${pageLabel}" is performing well — ${pct(mostViewed.viewed_rate)} of visitors reach the "${mostViewed.header_text}" section. Continue monitoring for conversion opportunities.`
    return `"${pageLabel}" is performing within acceptable ranges — visitors are engaging with the content at expected levels.`
  } catch (err) {
    console.error('[algo:insightSentence] error:', err)
    return 'Unable to generate insight for this page.'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — FULL PAGE ANALYSIS RUNNER
// ─────────────────────────────────────────────────────────────────────────────

export function analyzePageFull(
  pagePath: string,
  views: PageViewRow[],
  headers: PageStructureRow[],
  pageMetrics: PageMetricsRow | null,
  totalSiteViews: number,
  conversionSessionIds: Set<string>
): FullPageAnalysis {
  try {
    const heightFromMetrics = pageMetrics?.page_height ?? 0
    const heightFromStructure = headers.length > 0 ? Math.max(...headers.map(h => h.page_height ?? 0)) : 0
    const pageHeight = Math.max(heightFromMetrics, heightFromStructure, 100)

    const uniqueVisitors = new Set(views.map(v => v.visitor_id).filter(Boolean)).size
    const uniqueSessions = new Set(views.map(v => v.session_id).filter(Boolean)).size
    const timesMs = views.filter(v => v.time_on_page != null && v.time_on_page > 0)
    const avgTimeMs = timesMs.length ? timesMs.reduce((s, v) => s + v.time_on_page!, 0) / timesMs.length : 0

    const pace = computeReadingPaceSignal(views, pageHeight)
    const retention = computeRetentionSignal(views)
    const confusion = computeConfusionSignal(pace, avgTimeMs, retention.exitRate)
    const engagement = computeEngagementSignal(views, pace, pageHeight)
    const spotlight = computeSpotlightSignal(views.length, totalSiteViews, uniqueVisitors)
    const conversion = computeConversionSignal(views, conversionSessionIds)
    const headerSignals = computeHeaderVisibility(views, headers, pageHeight)

    // Named algorithms
    const { expectedMs: expectedTimeForFnI } = computeTimeDigest(pageHeight, pace.normalizedScrollCoverage)
    const functionI = algorithmFunctionI(views, pageHeight, expectedTimeForFnI, conversionSessionIds)
    const functionII = algorithmFunctionII(views, headers, pageHeight)
    const functionIII = algorithmFunctionIII(views, pageHeight)
    const functionIV = algorithmFunctionIV(views)
    const timeDistribution = computeTimeDistribution(views, expectedTimeForFnI)

    const { score: intentFailureScore, breakdown } = computeIntentFailureScore(engagement, retention, confusion, pace)
    const { label, color } = computeLabelAndColor(intentFailureScore, engagement, confusion)
    const insightSentence = buildInsightSentence(pagePath, pace, engagement, retention, confusion, headerSignals, intentFailureScore)

    return {
      page_path: pagePath,
      pageHeight,
      totalViews: views.length,
      uniqueVisitors,
      uniqueSessions,
      readingPace: pace,
      confusion,
      engagement,
      retention,
      spotlight,
      conversion,
      headers: headerSignals,
      functionI,
      functionII,
      functionIII,
      functionIV,
      timeDistribution,
      intentFailureScore,
      retentionScoreValue: retention.retentionScore,
      conversionScoreValue: conversion.conversionScore,
      spotlightScoreValue: spotlight.spotlightScore,
      label,
      color,
      insightSentence,
      scoreBreakdown: breakdown,
      isStatisticallyMeaningful: views.length >= MIN_VIEWS_FOR_SCORING,
    }
  } catch (err) {
    console.error(`[algo:analyzePageFull] error for ${pagePath}:`, err)
    throw err
  }
}