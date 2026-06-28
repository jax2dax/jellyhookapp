// lib/actions/intentFailure.action.ts
// Now delegates scoring to lib/algorithms/pageAnalysis.ts
// The component (IntentFailurePanel) receives FullPageAnalysis[] instead of
// the old IntentFailurePage[]. See migration note at bottom.
'use server'

import { createSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import {
  analyzePageFull,
  PageViewRow,
  PageStructureRow,
  PageMetricsRow,
  FullPageAnalysis,
} from '@/lib/algorithms/pageAnalysis'



export interface UniquePageSummary {
  page_path: string
  total_views: number
  unique_visitors: number
  avg_time_ms: number
  avg_scroll: number
  exit_rate: number
}

export interface IntentFailureResult {
  pages: FullPageAnalysis[]
  summary: UniquePageSummary[]
  adaptive_threshold: number
  siteId: string
  computedAt: string
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function computeAdaptiveThreshold(scores: number[]): number {
  if (scores.length === 0) return 0.5
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length
  const stddev = Math.sqrt(variance)
  return clamp(mean + 0.5 * stddev, 0.35, 0.75)
}

export async function getIntentFailureAnalysis(
  siteId: string
): Promise<IntentFailureResult | null> {
  console.log(`[intentFailure] ▶ siteId=${siteId}`)

  const { userId } = await auth()
  if (!userId) {
    console.error('[intentFailure] ❌ Unauthorized')
    return null
  }

  const supabase = await createSupabaseClient()

  // Fetch all page views for this site
  const { data: pageViews, error: pvError } = await supabase
    .from('page_views')
    .select('session_id, visitor_id, page_path, time_on_page, scroll_depth, max_scroll_depth, max_scroll_reached_at, left_at, entered_at')
    .eq('site_id', siteId)
    .not('page_path', 'is', null)

  if (pvError) {
    console.error('[intentFailure] ❌ page_views error:', pvError.message)
    return null
  }

  if (!pageViews?.length) {
    return { pages: [], summary: [], adaptive_threshold: 0.5, siteId, computedAt: new Date().toISOString() }
  }

  // Fetch all structures, metrics, and conversions in parallel
  const [structRes, metricsRes, convRes] = await Promise.all([
    supabase.from('page_structure')
      .select('page_path, header_text, header_tag, header_index, position_y, page_height')
      .eq('site_id', siteId)
      .order('header_index', { ascending: true }),
    supabase.from('page_metrics')
      .select('page_path, page_height')
      .eq('site_id', siteId),
    supabase.from('form_submissions')
      .select('session_id')
      .eq('site_id', siteId),
  ])

  // Build lookup maps
  const structureByPage = new Map<string, PageStructureRow[]>()
  for (const row of structRes.data ?? []) {
    const path = row.page_path as string
    if (!structureByPage.has(path)) structureByPage.set(path, [])
    structureByPage.get(path)!.push(row as PageStructureRow)
  }

  const metricsByPage = new Map<string, PageMetricsRow>()
  for (const row of metricsRes.data ?? []) {
    metricsByPage.set(row.page_path as string, { page_height: row.page_height as number })
  }

  const conversionSessionIds = new Set(
    (convRes.data ?? []).map((r: { session_id: string }) => r.session_id).filter(Boolean)
  )

  // Group page views by path
  const viewsByPage = new Map<string, PageViewRow[]>()
  for (const pv of pageViews) {
    const path = pv.page_path as string
    if (!viewsByPage.has(path)) viewsByPage.set(path, [])
    viewsByPage.get(path)!.push(pv as PageViewRow)
  }

  const totalSiteViews = pageViews.length

  // Analyze each page using the algorithm engine
  const pages: FullPageAnalysis[] = []

  for (const [pagePath, views] of viewsByPage.entries()) {
    try {
      const analysis = await analyzePageFull(
        pagePath,
        views,
        structureByPage.get(pagePath) ?? [],
        metricsByPage.get(pagePath) ?? null,
        totalSiteViews,
        conversionSessionIds
      )
      pages.push(analysis)
    } catch (err) {
      console.error(`[intentFailure] ❌ analyzePageFull failed for ${pagePath}:`, err)
    }
  }

  pages.sort((a, b) => b.intentFailureScore - a.intentFailureScore)

  const adaptive_threshold = computeAdaptiveThreshold(pages.map(p => p.intentFailureScore))

  console.log(`[intentFailure] ✅ ${pages.length} pages analyzed, threshold=${adaptive_threshold.toFixed(3)}`)
// Build summary from FullPageAnalysis pages (no separate computation needed)
  const summary: UniquePageSummary[] = [...pages]
    .sort((a, b) => b.totalViews - a.totalViews)
    .map(p => ({
      page_path: p.page_path,
      total_views: p.totalViews,
      unique_visitors: p.uniqueVisitors,
      avg_time_ms: p.engagement.expectedReadTimeMs > 0
        ? p.engagement.timeScore * p.engagement.expectedReadTimeMs
        : 0,
      avg_scroll: p.readingPace.normalizedScrollCoverage,
      exit_rate: p.retention.exitRate,
    }))

  return { pages, summary, adaptive_threshold, siteId, computedAt: new Date().toISOString() }
}