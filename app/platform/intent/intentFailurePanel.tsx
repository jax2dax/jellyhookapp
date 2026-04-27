'use client'
export const dynamic = 'force-dynamic'
// components/analytics/IntentFailurePanel.tsx
//
// HOW TO USE (in your page server component):
//
//   // app/platform/intent/page.tsx
//   import { auth } from '@clerk/nextjs/server'
//   import { requireSite } from '@/lib/actions/site-management.actions'
//   import { getIntentFailureAnalysis } from '@/lib/actions/intentFailure.action'
//   import { IntentFailurePanel } from '@/components/analytics/IntentFailurePanel'
//
//   export default async function IntentPage() {
//     const { userId } = await auth()
//     const site = await requireSite(userId)
//     const data = await getIntentFailureAnalysis(site.id)
//     return <div className="p-6"><IntentFailurePanel data={data} /></div>
//   }

import * as React from 'react'

import type { IntentFailureResult, IntentFailurePage, UniquePageSummary } from '../../../lib/actions/intentFailure.action.ts'
console.log('🔥 FILE LOADED: intentFailure.action.ts')
// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function formatDuration(ms: number): string {
  if (!ms || ms === 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60), r = s % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

function pct(v: number) { return `${Math.round(v * 100)}%` }

function scoreColor(s: number) {
  if (s >= 0.75) return '#ef4444'
  if (s >= 0.50) return '#f97316'
  if (s >= 0.30) return '#eab308'
  return '#22c55e'
}

function scoreBg(s: number) {
  if (s >= 0.75) return 'rgba(239,68,68,0.07)'
  if (s >= 0.50) return 'rgba(249,115,22,0.07)'
  if (s >= 0.30) return 'rgba(234,179,8,0.07)'
  return 'rgba(34,197,94,0.07)'
}

function severityLabel(s: number) {
  if (s >= 0.75) return 'Critical'
  if (s >= 0.50) return 'High'
  if (s >= 0.30) return 'Medium'
  return 'Low'
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

function Bar({ value, color, height = 5 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ width: '100%', height, background: 'hsl(var(--muted))', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: color, borderRadius: height, transition: 'width 0.4s ease' }} />
    </div>
  )
}

function MetricCard({ label, value, desc, color }: { label: string; value: string; desc: string; color?: string }) {
  return (
    <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, padding: '10px 13px' }}>
      <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: color ?? 'hsl(var(--foreground))', margin: '0 0 2px' }}>{value}</p>
      <p style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', margin: 0 }}>{desc}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Threshold slider — lets user override the adaptive threshold
// ─────────────────────────────────────────────────────────────────────────────
function ThresholdControl({
  adaptive,
  value,
  onChange,
}: {
  adaptive: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{
      border: '1px solid hsl(var(--border))',
      borderRadius: 10,
      padding: '14px 18px',
      background: 'hsl(var(--card))',
      marginBottom: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: 'hsl(var(--foreground))' }}>
            Failure Threshold
          </p>
          <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
            Pages above this score are marked as failing.
            Auto-computed: <strong>{pct(adaptive)}</strong> (mean + 0.5σ of your site scores).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(value) }}>{pct(value)}</span>
          {Math.abs(value - adaptive) > 0.01 && (
            <button
              onClick={() => onChange(adaptive)}
              style={{
                fontSize: 11,
                padding: '3px 9px',
                borderRadius: 6,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--muted))',
                color: 'hsl(var(--muted-foreground))',
                cursor: 'pointer',
              }}
            >
              Reset to auto
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={e => onChange(Number(e.target.value) / 100)}
        style={{ width: '100%', accentColor: scoreColor(value) }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
        <span>0% — flag everything</span>
        <span>100% — flag nothing</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Header visibility table (inside expanded row)
// ─────────────────────────────────────────────────────────────────────────────
function HeaderVisibilityTable({ headers }: { headers: IntentFailurePage['viewed_headers'] }) {
  if (!headers || headers.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
        No page structure data — install tracker and wait for a page load.
      </p>
    )
  }

  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'hsl(var(--muted)/0.5)' }}>
            {['Tag', 'Header text', 'Position on page', 'Sessions that saw it'].map(h => (
              <th key={h} style={{
                padding: '7px 12px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: '1px solid hsl(var(--border))',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={i} style={{ borderBottom: i < headers.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
              <td style={{ padding: '7px 12px' }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: h.header_tag === 'h1' ? '#6366f1' : h.header_tag === 'h2' ? '#0ea5e9' : 'hsl(var(--muted-foreground))',
                  background: h.header_tag === 'h1' ? 'rgba(99,102,241,0.1)' : h.header_tag === 'h2' ? 'rgba(14,165,233,0.1)' : 'hsl(var(--muted))',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}>
                  {h.header_tag.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '7px 12px', color: 'hsl(var(--foreground))' }}>{h.header_text}</td>
              <td style={{ padding: '7px 12px', color: 'hsl(var(--muted-foreground))' }}>{pct(h.header_ratio)} down page</td>
              <td style={{ padding: '7px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60 }}>
                    <Bar value={h.viewed_rate} color={h.viewed_rate > 0.5 ? '#22c55e' : h.viewed_rate > 0.25 ? '#eab308' : '#ef4444'} height={4} />
                  </div>
                  <span style={{
                    fontWeight: 600,
                    color: h.viewed_rate > 0.5 ? '#22c55e' : h.viewed_rate > 0.25 ? '#eab308' : '#ef4444',
                  }}>
                    {pct(h.viewed_rate)}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Expandable failure row
// ─────────────────────────────────────────────────────────────────────────────
function FailureRow({
  page,
  rank,
  threshold,
}: {
  page: IntentFailurePage
  rank: number
  threshold: number
}) {
  const [expanded, setExpanded] = React.useState(false)
  const isFailing = page.failure_score > threshold
  const color = scoreColor(page.failure_score)
  const bg = scoreBg(page.failure_score)

  return (
    <div style={{
      border: `1px solid ${isFailing ? color + '50' : 'hsl(var(--border))'}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 10,
      background: 'hsl(var(--card))',
    }}>
      {/* ── Collapsed header row ── */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '30px 1fr auto',
          alignItems: 'center',
          gap: 14,
          padding: '13px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Rank circle */}
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: bg, border: `1.5px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color, flexShrink: 0,
        }}>
          {rank}
        </div>

        {/* Page label + score bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {page.intent_label}
            </span>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', background: 'hsl(var(--muted))', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
              {page.page_path}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color, background: bg, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
              {severityLabel(page.failure_score)}
            </span>
            {isFailing && (
              <span style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                FAILING
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, maxWidth: 200 }}>
              <Bar value={page.failure_score} color={color} height={5} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>
              {pct(page.failure_score)}
            </span>
            {/* Threshold marker line — visual reference */}
            <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
              threshold: {pct(threshold)}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <svg width={15} height={15} viewBox="0 0 16 16" fill="none"
          style={{ color: 'hsl(var(--muted-foreground))', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid hsl(var(--border))', padding: '16px 18px', background: bg, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Failure reason callout */}
          <div style={{ padding: '10px 14px', border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 6, background: 'hsl(var(--card))' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color, margin: '0 0 3px' }}>Why this page is failing</p>
            <p style={{ fontSize: 13, color: 'hsl(var(--foreground))', lineHeight: 1.55, margin: 0 }}>{page.failure_reason}</p>
          </div>

          {/* Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 9 }}>
            <MetricCard label="Total views" value={String(page.total_views)} desc="raw page_view rows" />
            <MetricCard label="Unique visitors" value={String(page.unique_visitors)} desc="distinct visitor_ids" />
            <MetricCard label="Unique sessions" value={String(page.unique_sessions)} desc="distinct session_ids" />
            <MetricCard label="Avg time" value={formatDuration(page.avg_time_ms)} desc="60s = full engagement" />
            <MetricCard label="Avg scroll" value={pct(page.avg_scroll)} desc="0% = no scroll" />
            <MetricCard label="Exit rate" value={pct(page.exit_rate)} desc="views with left_at set" color={page.exit_rate > 0.7 ? '#ef4444' : undefined} />
            <MetricCard
              label="Cross-session repeat"
              value={pct(page.cross_session_repeat_rate)}
              desc="returned on a later day"
              color={page.cross_session_repeat_rate > 0.3 ? '#f97316' : undefined}
            />
            <MetricCard
              label="Within-session repeat"
              value={pct(page.within_session_repeat_rate)}
              desc="same visit, circled back"
              color={page.within_session_repeat_rate > 0.3 ? '#eab308' : undefined}
            />
          </div>

          {/* Score breakdown */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Score Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                {
                  label: 'Time signal',
                  value: clamp(page.avg_time_ms / 60000, 0, 1),
                  contrib: page.score_breakdown.time_contribution,
                  weight: '40%',
                  note: 'high time + exit = confusion',
                },
                {
                  label: 'Scroll signal',
                  value: page.avg_scroll,
                  contrib: page.score_breakdown.scroll_contribution,
                  weight: '30%',
                  note: 'read everything, still left',
                },
                {
                  label: 'Exit signal',
                  value: page.exit_rate,
                  contrib: page.score_breakdown.exit_contribution,
                  weight: '30%',
                  note: 'sessions that ended here',
                },
              ].map(sig => (
                <div key={sig.label} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', width: 90, flexShrink: 0 }}>{sig.label}</span>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <Bar value={sig.value} color={scoreColor(sig.value)} height={5} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(sig.value), width: 34, textAlign: 'right', flexShrink: 0 }}>{pct(sig.value)}</span>
                  <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>×{sig.weight} = {sig.contrib.toFixed(3)}</span>
                  <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>({sig.note})</span>
                </div>
              ))}

              {/* Multiplier callouts */}
              {page.score_breakdown.cross_session_multiplier > 1 && (
                <div style={{ fontSize: 11, color: '#f97316', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 5, padding: '5px 10px', marginTop: 3 }}>
                  ⚠ Cross-session multiplier ×1.5 applied — {pct(page.cross_session_repeat_rate)} of visitors returned on a separate day
                </div>
              )}
              {page.score_breakdown.within_session_multiplier > 1 && (
                <div style={{ fontSize: 11, color: '#eab308', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 5, padding: '5px 10px', marginTop: 3 }}>
                  ⚠ Within-session multiplier ×1.25 applied — {pct(page.within_session_repeat_rate)} of sessions circled back in the same visit
                </div>
              )}
            </div>
          </div>

          {/* Header visibility */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Header Visibility — what users actually saw
            </p>
            <HeaderVisibilityTable headers={page.viewed_headers} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// All-pages summary table
// ─────────────────────────────────────────────────────────────────────────────
function SummaryTable({ summary }: { summary: UniquePageSummary[] }) {
  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 10, overflow: 'hidden', background: 'hsl(var(--card))', marginBottom: 24 }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid hsl(var(--border))' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px', color: 'hsl(var(--foreground))' }}>All Pages — Traffic Overview</h3>
        <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>Raw stats for every tracked page, sorted by traffic</p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'hsl(var(--muted)/0.4)' }}>
              {['Page', 'Views', 'Visitors', 'Avg time', 'Avg scroll', 'Exit rate'].map(h => (
                <th key={h} style={{ padding: '8px 13px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid hsl(var(--border))', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map((row, i) => (
              <tr key={row.page_path} style={{ borderBottom: i < summary.length - 1 ? '1px solid hsl(var(--border))' : 'none', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--muted)/0.15)' }}>
                <td style={{ padding: '8px 13px', fontFamily: 'monospace', fontSize: 11, color: 'hsl(var(--foreground))' }}>{row.page_path}</td>
                <td style={{ padding: '8px 13px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>{row.total_views.toLocaleString()}</td>
                <td style={{ padding: '8px 13px', color: 'hsl(var(--muted-foreground))' }}>{row.unique_visitors.toLocaleString()}</td>
                <td style={{ padding: '8px 13px', color: 'hsl(var(--muted-foreground))' }}>{formatDuration(row.avg_time_ms)}</td>
                <td style={{ padding: '8px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 44, height: 4, background: 'hsl(var(--muted))', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.round(row.avg_scroll * 100)}%`, height: '100%', background: 'hsl(var(--foreground)/0.35)', borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{pct(row.avg_scroll)}</span>
                  </div>
                </td>
                <td style={{ padding: '8px 13px' }}>
                  <span style={{ fontSize: 11, fontWeight: row.exit_rate > 0.7 ? 600 : 400, color: row.exit_rate > 0.7 ? '#ef4444' : row.exit_rate > 0.5 ? '#f97316' : 'hsl(var(--muted-foreground))' }}>
                    {pct(row.exit_rate)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
console.log('📄 PAGE EXECUTING')
// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export default function IntentFailurePanel({ data }: { data: IntentFailureResult | null }) {
  
  const [threshold, setThreshold] = React.useState<number | null>(null)
  const [filter, setFilter] = React.useState<'all' | 'failing' | 'critical' | 'high' | 'medium' | 'low'>('all')

  // Once data loads, seed threshold from adaptive value
  React.useEffect(() => {
    if (data && threshold === null) setThreshold(data.adaptive_threshold)
  }, [data, threshold])

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>Unable to load intent failure analysis.</div>
  }

  if (data.pages.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>No page view data yet. Install the tracker and wait for visitors.</div>
  }

  const activeThreshold = threshold ?? data.adaptive_threshold

  // Apply filter using active threshold (not adaptive — respects user override)
  const filteredPages = data.pages.filter(p => {
    if (filter === 'all') return true
    if (filter === 'failing') return p.failure_score > activeThreshold
    if (filter === 'critical') return p.failure_score >= 0.75
    if (filter === 'high') return p.failure_score >= 0.50 && p.failure_score < 0.75
    if (filter === 'medium') return p.failure_score >= 0.30 && p.failure_score < 0.50
    if (filter === 'low') return p.failure_score < 0.30
    return true
  })

  const failingCount = data.pages.filter(p => p.failure_score > activeThreshold).length
  const avgScore = data.pages.reduce((a, b) => a + b.failure_score, 0) / data.pages.length

  const filterBtns = [
    { key: 'all' as const, label: 'All', count: data.pages.length, color: 'hsl(var(--foreground))' },
    { key: 'failing' as const, label: 'Failing', count: failingCount, color: '#ef4444' },
    { key: 'critical' as const, label: 'Critical ≥75%', count: data.pages.filter(p => p.failure_score >= 0.75).length, color: '#ef4444' },
    { key: 'high' as const, label: 'High 50–74%', count: data.pages.filter(p => p.failure_score >= 0.50 && p.failure_score < 0.75).length, color: '#f97316' },
    { key: 'medium' as const, label: 'Medium 30–49%', count: data.pages.filter(p => p.failure_score >= 0.30 && p.failure_score < 0.50).length, color: '#eab308' },
    { key: 'low' as const, label: 'Low <30%', count: data.pages.filter(p => p.failure_score < 0.30).length, color: '#22c55e' },
  ]

  return (
    <div style={{ maxWidth: 940 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: 'hsl(var(--foreground))' }}>User Intent Failures</h2>
        <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
          Pages where users showed confusion or unresolved intent — ranked worst first. Computed at {new Date(data.computedAt).toLocaleTimeString()}.
        </p>
      </div>

      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 11, marginBottom: 24 }}>
        <MetricCard label="Pages analyzed" value={String(data.pages.length)} desc="unique page paths tracked" />
        <MetricCard label="Failing pages" value={String(failingCount)} desc={`above ${pct(activeThreshold)} threshold`} color={failingCount > 0 ? '#ef4444' : undefined} />
        <MetricCard label="Avg failure score" value={pct(avgScore)} desc="across all pages" color={scoreColor(avgScore)} />
        <MetricCard label="Auto threshold" value={pct(data.adaptive_threshold)} desc="mean + 0.5σ of your scores" />
      </div>

      {/* Threshold control */}
      <ThresholdControl
        adaptive={data.adaptive_threshold}
        value={activeThreshold}
        onChange={setThreshold}
      />

      {/* All pages summary table */}
      <SummaryTable summary={data.summary} />

      {/* Filter pills + section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'hsl(var(--foreground))' }}>Intent Failure Analysis</h3>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {filterBtns.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: `1px solid ${filter === btn.key ? btn.color : 'hsl(var(--border))'}`,
                background: filter === btn.key ? `${btn.color}15` : 'transparent',
                color: filter === btn.key ? btn.color : 'hsl(var(--muted-foreground))',
                fontSize: 11,
                fontWeight: filter === btn.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {btn.label}
              {btn.count > 0 && (
                <span style={{ marginLeft: 5, background: filter === btn.key ? `${btn.color}20` : 'hsl(var(--muted))', borderRadius: 10, padding: '1px 5px', fontSize: 10 }}>
                  {btn.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      {filteredPages.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--muted-foreground))', border: '1px dashed hsl(var(--border))', borderRadius: 10, fontSize: 13 }}>
          No pages in this category.
        </div>
      ) : (
        filteredPages.map((page, i) => (
          <FailureRow key={page.page_path} page={page} rank={i + 1} threshold={activeThreshold} />
        ))
      )}

      {/* Legend */}
      <div style={{ marginTop: 18, padding: '12px 16px', border: '1px solid hsl(var(--border))', borderRadius: 8, background: 'hsl(var(--muted)/0.3)' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>How the score works</p>
        <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0, lineHeight: 1.6 }}>
          Score = (time × 0.4) + (scroll × 0.3) + (exit_rate × 0.3). 
          If &gt;30% of visitors returned across sessions → ×1.5. 
          If &gt;30% of sessions circled back in the same visit → ×1.25. 
          Both can stack. Capped at 100%. 
          Threshold auto-computes as mean + 0.5σ of your site scores (clamped 35%–75%), but you can override it above.
        </p>
      </div>
    </div>
  )
}