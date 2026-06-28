// IntentFailurePanel.tsx
// Updated to use FullPageAnalysis from lib/algorithms/pageAnalysis.ts
// Old types IntentFailurePage and UniquePageSummary are gone.
// New type is FullPageAnalysis which has richer signal data.
'use client'

import * as React from 'react'
import type {
  IntentFailureResult,
  UniquePageSummary,
} from '@/lib/actions/intentFailure.action'
import type { FullPageAnalysis } from '@/lib/algorithms/pageAnalysis'

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  if (s >= 0.75) return 'hsl(var(--destructive))'
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
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

function Bar({ value, color, height = 5 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ width: '100%', height, background: 'hsl(var(--muted))', borderRadius: height, overflow: 'hidden' }}>
      <div style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, height: '100%', background: color, borderRadius: height, transition: 'width 0.4s ease' }} />
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
// Threshold control
// ─────────────────────────────────────────────────────────────────────────────

function ThresholdControl({ adaptive, value, onChange }: {
  adaptive: number; value: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 10, padding: '14px 18px', background: 'hsl(var(--card))', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: 'hsl(var(--foreground))' }}>Sensitivity Threshold</p>
          <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
            Pages above this score are flagged as needing attention. Auto-suggested: <strong>{pct(adaptive)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: scoreColor(value) }}>{pct(value)}</span>
          {Math.abs(value - adaptive) > 0.01 && (
            <button onClick={() => onChange(adaptive)} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', cursor: 'pointer' }}>
              Reset
            </button>
          )}
        </div>
      </div>
      <input type="range" min={0} max={100} step={1} value={Math.round(value * 100)} onChange={e => onChange(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: scoreColor(value) }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
        <span>Flag everything</span>
        <span>Flag nothing</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Header visibility table — uses new HeaderVisibilitySignal type
// ─────────────────────────────────────────────────────────────────────────────

function HeaderVisibilityTable({ headers }: { headers: FullPageAnalysis['headers'] }) {
  if (!headers || headers.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
        No page structure data yet — the tracker will capture this on the next page load.
      </p>
    )
  }

  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'hsl(var(--muted)/0.5)' }}>
            {['Level', 'Section heading', 'Position', 'Visitors who saw it', 'Re-visited'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid hsl(var(--border))', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={i} style={{ borderBottom: i < headers.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
              <td style={{ padding: '7px 12px' }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                  color: h.header_tag === 'h1' ? '#6366f1' : h.header_tag === 'h2' ? '#0ea5e9' : 'hsl(var(--muted-foreground))',
                  background: h.header_tag === 'h1' ? 'rgba(99,102,241,0.1)' : h.header_tag === 'h2' ? 'rgba(14,165,233,0.1)' : 'hsl(var(--muted))',
                  padding: '2px 6px', borderRadius: 4,
                }}>
                  {h.header_tag.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: '7px 12px', color: 'hsl(var(--foreground))' }}>{h.header_text}</td>
              <td style={{ padding: '7px 12px', color: 'hsl(var(--muted-foreground))' }}>{pct(h.header_ratio)} down page</td>
              <td style={{ padding: '7px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60 }}>
                    <Bar value={h.viewed_rate} color={h.viewed_rate > 0.5 ? '#22c55e' : h.viewed_rate > 0.25 ? '#eab308' : 'hsl(var(--destructive))'} height={4} />
                  </div>
                  <span style={{ fontWeight: 600, color: h.viewed_rate > 0.5 ? '#22c55e' : h.viewed_rate > 0.25 ? '#eab308' : 'hsl(var(--destructive))' }}>
                    {pct(h.viewed_rate)}
                  </span>
                </div>
              </td>
              <td style={{ padding: '7px 12px' }}>
                {h.inBacktrackZone
                  ? <span style={{ fontSize: 10, color: '#f97316', background: 'rgba(249,115,22,0.1)', padding: '2px 6px', borderRadius: 4 }}>Yes — users scrolled back here</span>
                  : <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Expandable page row — uses FullPageAnalysis
// ─────────────────────────────────────────────────────────────────────────────

function FailureRow({ page, rank, threshold }: { page: FullPageAnalysis; rank: number; threshold: number }) {
  const [expanded, setExpanded] = React.useState(false)
  const isFailing = page.intentFailureScore > threshold
  const color = scoreColor(page.intentFailureScore)
  const bg = scoreBg(page.intentFailureScore)

  // Derive intent label from headers (h1 first, then any header, then path)
  const intentLabel = page.headers.find(h => h.header_tag === 'h1')?.header_text
    ?? page.headers[0]?.header_text
    ?? page.page_path

  return (
    <div style={{ border: `1px solid ${isFailing ? color + '50' : 'hsl(var(--border))'}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10, background: 'hsl(var(--card))' }}>
      {/* Collapsed row */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', display: 'grid', gridTemplateColumns: '30px 1fr auto', alignItems: 'center', gap: 14, padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: bg, border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>
          {rank}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {intentLabel}
            </span>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace', background: 'hsl(var(--muted))', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>
              {page.page_path}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color, background: bg, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
              {severityLabel(page.intentFailureScore)}
            </span>
            {isFailing && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'hsl(var(--destructive))', background: 'rgba(239,68,68,0.1)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                NEEDS ATTENTION
              </span>
            )}
            {!page.isStatisticallyMeaningful && (
              <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>
                Low data
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, maxWidth: 200 }}>
              <Bar value={page.intentFailureScore} color={color} height={5} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color, flexShrink: 0 }}>{pct(page.intentFailureScore)}</span>
          </div>
        </div>

        <svg width={15} height={15} viewBox="0 0 16 16" fill="none"
          style={{ color: 'hsl(var(--muted-foreground))', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid hsl(var(--border))', padding: '16px 18px', background: bg, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Insight sentence — business language always */}
          <div style={{ padding: '10px 14px', border: `1px solid ${color}30`, borderLeft: `3px solid ${color}`, borderRadius: 6, background: 'hsl(var(--card))' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color, margin: '0 0 4px' }}>What we found</p>
            <p style={{ fontSize: 13, color: 'hsl(var(--foreground))', lineHeight: 1.6, margin: 0 }}>{page.insightSentence}</p>
          </div>

          {/* Confusion reason if meaningful */}
          {page.confusion.combined > 0.2 && (
            <div style={{ padding: '9px 13px', border: '1px solid hsl(var(--border))', borderRadius: 6, background: 'hsl(var(--card))' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', margin: '0 0 3px' }}>Visitor behaviour pattern</p>
              <p style={{ fontSize: 12, color: 'hsl(var(--foreground))', margin: 0, lineHeight: 1.5 }}>{page.confusion.reason}</p>
            </div>
          )}

          {/* Metric cards — business labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 9 }}>
            <MetricCard label="Total visits" value={String(page.totalViews)} desc="times this page was loaded" />
            <MetricCard label="Unique visitors" value={String(page.uniqueVisitors)} desc="individual people" />
            <MetricCard label="Unique sessions" value={String(page.uniqueSessions)} desc="separate browsing sessions" />
            <MetricCard
              label="Avg time spent"
              value={formatDuration(page.engagement.timeScore * page.engagement.expectedReadTimeMs)}
              desc={`expected: ${formatDuration(page.engagement.expectedReadTimeMs)}`}
            />
            <MetricCard
              label="Scroll coverage"
              value={pct(page.readingPace.normalizedScrollCoverage)}
              desc="how far down visitors scroll"
            />
            <MetricCard
              label="Exit rate"
              value={pct(page.retention.exitRate)}
              desc="left the site from this page"
              color={page.retention.exitRate > 0.7 ? 'hsl(var(--destructive))' : undefined}
            />
            <MetricCard
              label="Return visits"
              value={pct(page.retention.crossSessionRepeatRate)}
              desc="came back on a different day"
              color={page.retention.crossSessionRepeatRate > 0.3 ? '#f97316' : undefined}
            />
            <MetricCard
              label="In-session revisits"
              value={pct(page.retention.withinSessionRepeatRate)}
              desc="circled back same visit"
              color={page.retention.withinSessionRepeatRate > 0.3 ? '#eab308' : undefined}
            />
            {page.readingPace.hasSignificantBacktrack && (
              <MetricCard
                label="Scroll-back rate"
                value={pct(page.readingPace.scrollBackFraction)}
                desc="scrolled back up after reading"
                color="#f97316"
              />
            )}
            <MetricCard
              label="Conversion signal"
              value={pct(page.conversion.conversionScore)}
              desc="sessions that led to a form submit"
              color={page.conversion.conversionScore > 0.1 ? '#22c55e' : undefined}
            />
          </div>

          {/* Reading behaviour */}
          {(page.readingPace.hasSignificantBacktrack || page.readingPace.postPeakTimeRatio > 0.4) && (
            <div style={{ padding: '10px 13px', background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Reading behaviour</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {page.readingPace.hasSignificantBacktrack && (
                  <div style={{ fontSize: 12, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#f97316' }}>↑</span>
                    Visitors scrolled back up {pct(page.readingPace.scrollBackFraction)} of the page on average — they were looking for something they passed
                  </div>
                )}
                {page.readingPace.postPeakTimeRatio > 0.4 && (
                  <div style={{ fontSize: 12, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#eab308' }}>⏱</span>
                    {pct(page.readingPace.postPeakTimeRatio)} of time was spent after reaching the deepest scroll point — visitors lingered without a clear next step
                  </div>
                )}
                {!page.readingPace.isPlausibleReading && page.readingPace.scrollPxPerSec > 200 && (
                  <div style={{ fontSize: 12, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#eab308' }}>⚡</span>
                    Visitors scrolled very fast ({Math.round(page.readingPace.scrollPxPerSec)}px/sec) — they may have been skimming rather than reading
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Score signal breakdown */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Signal Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                {
                  label: 'Time engagement',
                  value: 1 - page.engagement.timeScore,
                  contrib: page.scoreBreakdown.timeContribution,
                  note: page.engagement.metExpectedTime ? 'met expected reading time' : 'below expected reading time',
                },
                {
                  label: 'Scroll coverage',
                  value: 1 - page.engagement.scrollScore,
                  contrib: page.scoreBreakdown.scrollContribution,
                  note: `${pct(page.readingPace.normalizedScrollCoverage)} of page covered`,
                },
                {
                  label: 'Exit rate',
                  value: page.retention.exitRate,
                  contrib: page.scoreBreakdown.exitContribution,
                  note: `${pct(page.retention.exitRate)} left from this page`,
                },
                {
                  label: 'Confusion signals',
                  value: page.confusion.combined,
                  contrib: page.scoreBreakdown.confusionContribution,
                  note: page.readingPace.hasSignificantBacktrack ? 'scroll-back detected' : 'normal pattern',
                },
                {
                  label: 'Backtrack depth',
                  value: page.readingPace.scrollBackFraction,
                  contrib: page.scoreBreakdown.backtrackContribution,
                  note: `${pct(page.readingPace.scrollBackFraction)} scroll reversal`,
                },
              ].map(sig => (
                <div key={sig.label} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', width: 120, flexShrink: 0 }}>{sig.label}</span>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <Bar value={sig.value} color={scoreColor(sig.value)} height={5} />
                  </div>
                  <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>{sig.note}</span>
                </div>
              ))}

              {page.scoreBreakdown.crossSessionMultiplier > 1 && (
                <div style={{ fontSize: 11, color: '#f97316', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 5, padding: '5px 10px', marginTop: 3 }}>
                  {pct(page.retention.crossSessionRepeatRate)} of visitors returned on separate days without converting — this amplifies the urgency score
                </div>
              )}
              {page.scoreBreakdown.withinSessionMultiplier > 1 && (
                <div style={{ fontSize: 11, color: '#eab308', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 5, padding: '5px 10px', marginTop: 3 }}>
                  {pct(page.retention.withinSessionRepeatRate)} of sessions came back to this page in the same visit — likely circling due to confusion
                </div>
              )}
              {page.scoreBreakdown.densityAdjustment < 1 && (
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderRadius: 5, padding: '5px 10px', marginTop: 3 }}>
                  This is a short page so expectations are adjusted accordingly
                </div>
              )}
            </div>
          </div>

          {/* Header visibility */}
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              What visitors actually read
            </p>
            <HeaderVisibilityTable headers={page.headers} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary table — uses UniquePageSummary
// ─────────────────────────────────────────────────────────────────────────────

function SummaryTable({ summary }: { summary: UniquePageSummary[] }) {
  return (
    <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 10, overflow: 'hidden', background: 'hsl(var(--card))', marginBottom: 24 }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid hsl(var(--border))' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 2px', color: 'hsl(var(--foreground))' }}>All Pages — Traffic Overview</h3>
        <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', margin: 0 }}>Every tracked page sorted by number of visits</p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'hsl(var(--muted)/0.4)' }}>
              {['Page', 'Visits', 'Visitors', 'Avg time', 'Scroll coverage', 'Exit rate'].map(h => (
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
                  <span style={{ fontSize: 11, fontWeight: row.exit_rate > 0.7 ? 600 : 400, color: row.exit_rate > 0.7 ? 'hsl(var(--destructive))' : row.exit_rate > 0.5 ? '#f97316' : 'hsl(var(--muted-foreground))' }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export default function IntentFailurePanel({ data }: { data: IntentFailureResult | null }) {
  const [threshold, setThreshold] = React.useState<number | null>(null)
  const [filter, setFilter] = React.useState<'all' | 'failing' | 'critical' | 'high' | 'medium' | 'low'>('all')

  React.useEffect(() => {
    if (data && threshold === null) setThreshold(data.adaptive_threshold)
  }, [data, threshold])

  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>Unable to load analysis.</div>
  }

  if (data.pages.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>No page data yet. Install the tracker and wait for your first visitors.</div>
  }

  const activeThreshold = threshold ?? data.adaptive_threshold

  const filteredPages = data.pages.filter(p => {
    if (filter === 'all') return true
    if (filter === 'failing') return p.intentFailureScore > activeThreshold
    if (filter === 'critical') return p.intentFailureScore >= 0.75
    if (filter === 'high') return p.intentFailureScore >= 0.50 && p.intentFailureScore < 0.75
    if (filter === 'medium') return p.intentFailureScore >= 0.30 && p.intentFailureScore < 0.50
    if (filter === 'low') return p.intentFailureScore < 0.30
    return true
  })

  const failingCount = data.pages.filter(p => p.intentFailureScore > activeThreshold).length
  const avgScore = data.pages.reduce((a, b) => a + b.intentFailureScore, 0) / data.pages.length

  const filterBtns = [
    { key: 'all' as const, label: 'All pages', count: data.pages.length, color: 'hsl(var(--foreground))' },
    { key: 'failing' as const, label: 'Needs attention', count: failingCount, color: 'hsl(var(--destructive))' },
    { key: 'critical' as const, label: 'Critical', count: data.pages.filter(p => p.intentFailureScore >= 0.75).length, color: 'hsl(var(--destructive))' },
    { key: 'high' as const, label: 'High', count: data.pages.filter(p => p.intentFailureScore >= 0.50 && p.intentFailureScore < 0.75).length, color: '#f97316' },
    { key: 'medium' as const, label: 'Medium', count: data.pages.filter(p => p.intentFailureScore >= 0.30 && p.intentFailureScore < 0.50).length, color: '#eab308' },
    { key: 'low' as const, label: 'Good', count: data.pages.filter(p => p.intentFailureScore < 0.30).length, color: '#22c55e' },
  ]

  return (
    <div style={{ maxWidth: 940 }}>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: 'hsl(var(--foreground))' }}>Visitor Intent Analysis</h2>
        <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', margin: 0 }}>
          Pages where visitors couldn't find what they were looking for — ranked by urgency. Last updated {new Date(data.computedAt).toLocaleTimeString()}.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 11, marginBottom: 24 }}>
        <MetricCard label="Pages tracked" value={String(data.pages.length)} desc="unique page paths with data" />
        <MetricCard label="Need attention" value={String(failingCount)} desc="pages with issues detected" color={failingCount > 0 ? 'hsl(var(--destructive))' : undefined} />
        <MetricCard label="Avg health score" value={pct(1 - avgScore)} desc="higher is better" color={scoreColor(avgScore)} />
        <MetricCard label="Auto sensitivity" value={pct(data.adaptive_threshold)} desc="calibrated to your site's data" />
      </div>

      <ThresholdControl adaptive={data.adaptive_threshold} value={activeThreshold} onChange={setThreshold} />

      <SummaryTable summary={data.summary} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'hsl(var(--foreground))' }}>Page-by-Page Analysis</h3>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {filterBtns.map(btn => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              style={{
                padding: '4px 10px', borderRadius: 20,
                border: `1px solid ${filter === btn.key ? btn.color : 'hsl(var(--border))'}`,
                background: filter === btn.key ? `${btn.color}15` : 'transparent',
                color: filter === btn.key ? btn.color : 'hsl(var(--muted-foreground))',
                fontSize: 11, fontWeight: filter === btn.key ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s',
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

      {filteredPages.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--muted-foreground))', border: '1px dashed hsl(var(--border))', borderRadius: 10, fontSize: 13 }}>
          No pages in this category.
        </div>
      ) : (
        filteredPages.map((page, i) => (
          <FailureRow key={page.page_path} page={page} rank={i + 1} threshold={activeThreshold} />
        ))
      )}
    </div>
  )
}