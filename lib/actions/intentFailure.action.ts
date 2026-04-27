
// lib/actions/intentFailure.action.ts
//
// ─── SCORING MODEL ────────────────────────────────────────────────────────────
//   normalized_time  = clamp(avg_time_ms / 60000, 0, 1)   [60s = full engagement]
//   scroll_score     = avg_scroll_depth                    [0.0–1.0]
//   exit_rate        = views_with_left_at / total_views
//   raw_score        = (time × 0.4) + (scroll × 0.3) + (exit × 0.3)
//   × cross_session_multiplier (1.5 if cross_repeat > 0.3)
//   × within_session_multiplier (1.25 if within_repeat > 0.3)
//   failure_score    = clamp(raw_score, 0, 1)
//
// ─── ADAPTIVE THRESHOLD ───────────────────────────────────────────────────────
//   threshold = clamp(mean(scores) + 0.5 × stddev(scores), 0.35, 0.75)
//   Pages above threshold are flagged is_failing = true.
//   UI also lets user set a manual override.
//
// ─── HEADER VISIBILITY ────────────────────────────────────────────────────────
//   header_ratio = position_y / page_height
//   A header is "viewed" by a session when max(scroll_depth per session) >= header_ratio
//   viewed_rate = sessions_that_reached_it / total_sessions_on_page
//   intent_label = most-viewed h1, or most-viewed header, or prettified path
//
// ─── DUAL REPEAT SIGNALS ─────────────────────────────────────────────────────
//   cross_session_repeat_rate: visitor_id appears > 1 row for this page (across sessions)
//   within_session_repeat_rate: session_id appears > 1 row for this page (same visit)

import { createSupabaseClient } from '@/lib/supabase/server'
import { auth } from '@clerk/nextjs/server'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewedHeader {
  header_text: string
  header_tag: string
  header_ratio: number     // position_y / page_height
  viewed_rate: number      // fraction of sessions that scrolled to this header
}

export interface IntentFailurePage {
  page_path: string
  intent_label: string
  viewed_headers: ViewedHeader[]
  failure_score: number
  is_failing: boolean
  avg_time_ms: number
  avg_scroll: number
  exit_rate: number
  cross_session_repeat_rate: number
  within_session_repeat_rate: number
  total_views: number
  unique_visitors: number
  unique_sessions: number
  failure_reason: string
  score_breakdown: {
    time_contribution: number
    scroll_contribution: number
    exit_contribution: number
    cross_session_multiplier: number
    within_session_multiplier: number
  }
}

export interface UniquePageSummary {
  page_path: string
  total_views: number
  unique_visitors: number
  avg_time_ms: number
  avg_scroll: number
  exit_rate: number
}

export interface IntentFailureResult {
  pages: IntentFailurePage[]
  summary: UniquePageSummary[]
  adaptive_threshold: number
  siteId: string
  computedAt: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function prettifyPath(path: string): string {
  if (path === '/') return 'Home'
  return path
    .replace(/^\//, '')
    .split('/')
    .map(p => p.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(' › ')
}

function computeAdaptiveThreshold(scores: number[]): number {
  if (scores.length === 0) return 0.5
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length
  const stddev = Math.sqrt(variance)
  return clamp(mean + 0.5 * stddev, 0.35, 0.75)
}

function buildFailureReason(
  normalized_time: number,
  avg_scroll: number,
  exit_rate: number,
  cross_repeat: number,
  within_repeat: number
): string {
  if (normalized_time > 0.6 && avg_scroll > 0.6 && exit_rate > 0.5) {
    return 'Users read deeply but still left — content likely does not answer their core question'
  }
  if (normalized_time < 0.2 && exit_rate > 0.6) {
    return 'Users left almost immediately — page content likely mismatched their expectation'
  }
  if (cross_repeat > 0.4) {
    return `${Math.round(cross_repeat * 100)}% of visitors returned on separate sessions — intent was not resolved on first visit`
  }
  if (within_repeat > 0.4) {
    return `${Math.round(within_repeat * 100)}% of sessions revisited this page in the same visit — likely circling back due to confusion`
  }
  if (avg_scroll < 0.25 && exit_rate > 0.5) {
    return 'Users exited without scrolling — above-the-fold content is not compelling or relevant'
  }
  if (normalized_time > 0.3 && avg_scroll > 0.3 && exit_rate > 0.5) {
    return 'Users engaged partially then abandoned — possible friction or missing information mid-page'
  }
  return 'Moderate failure signals — review time-on-page and exit patterns for this page'
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function getIntentFailureAnalysis(siteId: string): Promise<IntentFailureResult | null> {
  console.log(`[intentFailure] ▶ Starting analysis siteId=${siteId}`)
 console.log('🚨 FUNCTION CALLED', siteId)
  const { userId } = await auth()
  if (!userId) {
    console.error('[intentFailure] ❌ Unauthorized — no userId')
    return null
  }

  const supabase = await createSupabaseClient()

  // ── 1. Fetch all page views ───────────────────────────────────────────────
  const { data: pageViews, error: pvError } = await supabase
    .from('page_views')
    .select('session_id, visitor_id, page_path, time_on_page, scroll_depth, left_at')
    .eq('site_id', siteId)
    .not('page_path', 'is', null)

  if (pvError) {
    console.error('[intentFailure] ❌ page_views fetch error:', pvError.message)
    return null
  }

  if (!pageViews || pageViews.length === 0) {
    console.warn('[intentFailure] ⚠ No page views found for siteId:', siteId)
    return { pages: [], summary: [], adaptive_threshold: 0.5, siteId, computedAt: new Date().toISOString() }
  }

  console.log(`[intentFailure] ✅ Fetched ${pageViews.length} page view rows`)

  // ── 2. Fetch page_structure for header labels + visibility ────────────────
  const { data: structures, error: strError } = await supabase
    .from('page_structure')
    .select('page_path, header_text, header_tag, header_index, position_y, page_height')
    .eq('site_id', siteId)
    .order('header_index', { ascending: true })

  if (strError) {
    console.warn('[intentFailure] ⚠ page_structure fetch error (non-fatal):', strError.message)
  }

  // Build: page_path → sorted header rows with pre-computed ratio
  const structureByPage = new Map<string, {
    header_text: string
    header_tag: string
    header_index: number
    header_ratio: number
  }[]>()

  if (structures) {
    for (const row of structures) {
      const path = row.page_path as string
      if (!structureByPage.has(path)) structureByPage.set(path, [])
      const page_height = Math.max((row.page_height as number) || 1, 1)
      const header_ratio = clamp((row.position_y as number) / page_height, 0, 1)
      structureByPage.get(path)!.push({
        header_text: row.header_text as string,
        header_tag: row.header_tag as string,
        header_index: row.header_index as number,
        header_ratio,
      })
    }
    console.log(`[intentFailure] ✅ page_structure loaded for ${structureByPage.size} pages`)
  }

  // ── 3. Group page views by page_path ─────────────────────────────────────
  const grouped = new Map<string, {
    times: number[]
    scrolls: number[]
    exits: number
    total: number
    visitorCounts: Map<string, number>
    sessionCounts: Map<string, number>
  }>()

  for (const pv of pageViews) {
    const path = pv.page_path as string
    if (!grouped.has(path)) {
      grouped.set(path, {
        times: [],
        scrolls: [],
        exits: 0,
        total: 0,
        visitorCounts: new Map(),
        sessionCounts: new Map(),
      })
    }
    const g = grouped.get(path)!
    g.total++

    if (pv.time_on_page != null && (pv.time_on_page as number) > 0) {
      g.times.push(pv.time_on_page as number)
    }
    if (pv.scroll_depth != null) {
      g.scrolls.push(pv.scroll_depth as number)
    }
    if (pv.left_at != null) g.exits++

    const vid = pv.visitor_id as string
    if (vid) g.visitorCounts.set(vid, (g.visitorCounts.get(vid) ?? 0) + 1)

    const sid = pv.session_id as string
    if (sid) g.sessionCounts.set(sid, (g.sessionCounts.get(sid) ?? 0) + 1)
  }

  console.log(`[intentFailure] ✅ Grouped into ${grouped.size} unique page paths`)

  // ── 4. Compute scores ─────────────────────────────────────────────────────
  const pages: IntentFailurePage[] = []
  const summary: UniquePageSummary[] = []
  const allScores: number[] = []

  for (const [page_path, g] of grouped.entries()) {
    const total_views = g.total
    const unique_visitors = g.visitorCounts.size
    const unique_sessions = g.sessionCounts.size

    const avg_time_ms = g.times.length > 0
      ? Math.round(g.times.reduce((a, b) => a + b, 0) / g.times.length)
      : 0

    const avg_scroll = g.scrolls.length > 0
      ? g.scrolls.reduce((a, b) => a + b, 0) / g.scrolls.length
      : 0

    const exit_rate = total_views > 0 ? g.exits / total_views : 0

    // Cross-session repeat: visitor_id seen more than once on this page
    let crossRepeatVisitors = 0
    for (const c of g.visitorCounts.values()) if (c > 1) crossRepeatVisitors++
    const cross_session_repeat_rate = unique_visitors > 0 ? crossRepeatVisitors / unique_visitors : 0

    // Within-session repeat: session_id seen more than once on this page
    let withinRepeatSessions = 0
    for (const c of g.sessionCounts.values()) if (c > 1) withinRepeatSessions++
    const within_session_repeat_rate = unique_sessions > 0 ? withinRepeatSessions / unique_sessions : 0

    // Score
    const normalized_time = clamp(avg_time_ms / 60000, 0, 1)
    const time_contribution   = normalized_time * 0.4
    const scroll_contribution = avg_scroll * 0.3
    const exit_contribution   = exit_rate * 0.3

    const cross_session_multiplier  = cross_session_repeat_rate > 0.3 ? 1.5 : 1.0
    const within_session_multiplier = within_session_repeat_rate > 0.3 ? 1.25 : 1.0

    const failure_score = clamp(
      (time_contribution + scroll_contribution + exit_contribution)
        * cross_session_multiplier
        * within_session_multiplier,
      0, 1
    )

    allScores.push(failure_score)

    // ── Header visibility enrichment ────────────────────────────────────────
    const viewed_headers: ViewedHeader[] = []
    const headerRows = structureByPage.get(page_path)

    if (headerRows && headerRows.length > 0) {
      // Build session_id → max scroll_depth for this page
      const sessionMaxScroll = new Map<string, number>()
      for (const pv of pageViews) {
        if ((pv.page_path as string) !== page_path) continue
        const sid = pv.session_id as string
        const scroll = (pv.scroll_depth as number) ?? 0
        if (sid) sessionMaxScroll.set(sid, Math.max(sessionMaxScroll.get(sid) ?? 0, scroll))
      }

      const totalSessions = sessionMaxScroll.size

      for (const h of headerRows) {
        let sessionsReached = 0
        for (const maxScroll of sessionMaxScroll.values()) {
          if (maxScroll >= h.header_ratio) sessionsReached++
        }
        viewed_headers.push({
          header_text: h.header_text,
          header_tag: h.header_tag,
          header_ratio: h.header_ratio,
          viewed_rate: totalSessions > 0 ? sessionsReached / totalSessions : 0,
        })
      }
    }

    // ── Intent label ────────────────────────────────────────────────────────
    let intent_label = prettifyPath(page_path)
    if (viewed_headers.length > 0) {
      const h1s = viewed_headers.filter(h => h.header_tag === 'h1')
      if (h1s.length > 0) {
        intent_label = h1s.sort((a, b) => b.viewed_rate - a.viewed_rate)[0].header_text
      } else {
        intent_label = [...viewed_headers].sort((a, b) => b.viewed_rate - a.viewed_rate)[0].header_text
      }
    } else if (structureByPage.has(page_path)) {
      const fallback = structureByPage.get(page_path)!
      const h1 = fallback.find(h => h.header_tag === 'h1')
      intent_label = h1?.header_text ?? fallback[0]?.header_text ?? prettifyPath(page_path)
    }

    pages.push({
      page_path,
      intent_label,
      viewed_headers,
      failure_score,
      is_failing: false, // set after threshold computed
      avg_time_ms,
      avg_scroll,
      exit_rate,
      cross_session_repeat_rate,
      within_session_repeat_rate,
      total_views,
      unique_visitors,
      unique_sessions,
      failure_reason: buildFailureReason(normalized_time, avg_scroll, exit_rate, cross_session_repeat_rate, within_session_repeat_rate),
      score_breakdown: {
        time_contribution,
        scroll_contribution,
        exit_contribution,
        cross_session_multiplier,
        within_session_multiplier,
      },
    })

    summary.push({ page_path, total_views, unique_visitors, avg_time_ms, avg_scroll, exit_rate })
  }

  // ── 5. Adaptive threshold + is_failing flag ───────────────────────────────
  const adaptive_threshold = computeAdaptiveThreshold(allScores)
  for (const p of pages) p.is_failing = p.failure_score > adaptive_threshold

  pages.sort((a, b) => b.failure_score - a.failure_score)
  summary.sort((a, b) => b.total_views - a.total_views)
  
  console.log(
    `[intentFailure] ✅ Done — ${pages.length} pages, ` +
    `threshold=${adaptive_threshold.toFixed(3)}, ` +
    `failing=${pages.filter(p => p.is_failing).length}, ` +
    `worst=${pages[0]?.page_path ?? 'none'} @ ${pages[0]?.failure_score?.toFixed(3) ?? 'n/a'}`
  )

  return { pages, summary, adaptive_threshold, siteId, computedAt: new Date().toISOString() }
}