// lib/algorithms/pageAnalysis.server.ts
//
// DB PERSISTENCE LAYER — server-only.
// Imports from pageAnalysis.ts (pure) + Supabase + Clerk.
// Do NOT import this file from any client component directly.
// Client components call these as server actions via ScoreButton.
//
// Exports: calculateScore, getScore, calculateAndGetScore

'use server'

import { createSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'
import {
  analyzePageFull,
  PageViewRow,
  PageStructureRow,
  PageMetricsRow,
  ScoreType,
  ScoreResult,
  SCORE_RECALCULATE_THROTTLE_MS,
} from '@/lib/algorithms/pageAnalysis'

/**
 * calculateScore
 *
 * Runs the full algorithm stack for one page and writes results to page_insights.
 * Throttled: if last_calculated_at is within SCORE_RECALCULATE_THROTTLE_MS,
 * returns cached data without re-computing or writing to DB.
 */
export async function calculateScore(
  siteId: string,
  pagePath: string,
  _scoreType: ScoreType = 'all'
): Promise<ScoreResult> {
  try {
    const { userId } = await auth()
    if (!userId) {
      console.error('[calculateScore] Unauthorized')
      return emptyResult(pagePath)
    }

    const supabase = await createSupabaseClient()

    // ── Throttle check ───────────────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('page_insights')
      .select('retention_score, conversion_score, spotlight_score, label, color, last_calculated_at')
      .eq('site_id', siteId)
      .eq('page_path', pagePath)
      .maybeSingle()

    if (existing?.last_calculated_at) {
      const msSinceLast = Date.now() - new Date(existing.last_calculated_at).getTime()
      if (msSinceLast < SCORE_RECALCULATE_THROTTLE_MS) {
        console.log(`[calculateScore] Throttled — ${Math.round(msSinceLast / 1000)}s ago for ${pagePath}`)
        return {
          page_path: pagePath,
          retentionScore: existing.retention_score,
          conversionScore: existing.conversion_score,
          spotlightScore: existing.spotlight_score,
          label: existing.label,
          color: existing.color,
          last_calculated_at: existing.last_calculated_at,
          fromCache: true,
        }
      }
    }

    // ── Fetch all data in parallel ───────────────────────────────────────────
    const [pvRes, structRes, metricsRes, siteViewsRes, convRes] = await Promise.all([
      supabase
        .from('page_views')
        .select('session_id, visitor_id, page_path, time_on_page, scroll_depth, max_scroll_depth, max_scroll_reached_at, left_at, entered_at')
        .eq('site_id', siteId)
        .eq('page_path', pagePath),
      supabase
        .from('page_structure')
        .select('header_text, header_tag, header_index, position_y, page_height')
        .eq('site_id', siteId)
        .eq('page_path', pagePath)
        .order('header_index', { ascending: true }),
      supabase
        .from('page_metrics')
        .select('page_height')
        .eq('site_id', siteId)
        .eq('page_path', pagePath)
        .maybeSingle(),
      supabase
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId),
      supabase
        .from('form_submissions')
        .select('session_id')
        .eq('site_id', siteId),
    ])

    const views = (pvRes.data ?? []) as PageViewRow[]
    const headers = (structRes.data ?? []) as PageStructureRow[]
    const metrics = (metricsRes.data ?? null) as PageMetricsRow | null
    const totalSiteViews = siteViewsRes.count ?? 0
    const conversionSessionIds = new Set(
      ((convRes.data ?? []) as { session_id: string }[])
        .map(r => r.session_id)
        .filter(Boolean)
    )

    // ── Run algorithm ────────────────────────────────────────────────────────
    const analysis = analyzePageFull(
      pagePath, views, headers, metrics, totalSiteViews, conversionSessionIds
    )

    // ── Upsert scores to page_insights ───────────────────────────────────────
    const now = new Date().toISOString()
    const { error: upsertError } = await supabase
      .from('page_insights')
      .upsert({
        site_id: siteId,
        page_path: pagePath,
        retention_score: analysis.retentionScoreValue,
        conversion_score: analysis.conversionScoreValue,
        spotlight_score: analysis.spotlightScoreValue,
        label: analysis.label,
        color: analysis.color,
        auto_generated: true,
        last_calculated_at: now,
        updated_at: now,
      }, { onConflict: 'site_id,page_path' })

    if (upsertError) {
      console.error('[calculateScore] upsert error:', upsertError.message)
    } else {
      console.log(`[calculateScore] ✅ Scores saved for ${pagePath}`)
    }

    return {
      page_path: pagePath,
      retentionScore: analysis.retentionScoreValue,
      conversionScore: analysis.conversionScoreValue,
      spotlightScore: analysis.spotlightScoreValue,
      label: analysis.label,
      color: analysis.color,
      last_calculated_at: now,
      fromCache: false,
    }
  } catch (err) {
    console.error('[calculateScore] error:', err)
    return emptyResult(pagePath)
  }
}

/**
 * getScore
 *
 * Retrieves current scores from page_insights WITHOUT recalculating.
 * Pass 'calculated' to return null if no scores have been computed yet.
 */
export async function getScore(
  siteId: string,
  pagePath: string,
  scoreType: ScoreType | 'calculated' = 'all'
): Promise<ScoreResult | null> {
  try {
    const supabase = await createSupabaseClient()
    const { data, error } = await supabase
      .from('page_insights')
      .select('retention_score, conversion_score, spotlight_score, label, color, last_calculated_at')
      .eq('site_id', siteId)
      .eq('page_path', pagePath)
      .maybeSingle()

    if (error) {
      console.error('[getScore] error:', error.message)
      return null
    }
    if (!data) return null

    if (scoreType === 'calculated') {
      if (data.retention_score == null && data.conversion_score == null && data.spotlight_score == null) {
        return null
      }
    }

    return {
      page_path: pagePath,
      retentionScore: data.retention_score,
      conversionScore: data.conversion_score,
      spotlightScore: data.spotlight_score,
      label: data.label,
      color: data.color,
      last_calculated_at: data.last_calculated_at,
      fromCache: true,
    }
  } catch (err) {
    console.error('[getScore] error:', err)
    return null
  }
}

/**
 * calculateAndGetScore
 *
 * Runs calculateScore (with throttle) and returns the result.
 * This is what ScoreButton calls.
 */
export async function calculateAndGetScore(
  siteId: string,
  pagePath: string,
  scoreType: ScoreType = 'all'
): Promise<ScoreResult> {
  return calculateScore(siteId, pagePath, scoreType)
}

// ── Internal helper ──────────────────────────────────────────────────────────

function emptyResult(pagePath: string): ScoreResult {
  return {
    page_path: pagePath,
    retentionScore: null,
    conversionScore: null,
    spotlightScore: null,
    label: null,
    color: null,
    last_calculated_at: null,
    fromCache: false,
  }
}