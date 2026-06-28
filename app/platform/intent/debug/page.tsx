// app/platform/intent/debug/page.tsx
// DELETE THIS PAGE before production
import { auth } from '@clerk/nextjs/server'
import { requireSite } from '@/lib/actions/site-management.actions'
import { getIntentFailureAnalysis } from '@/lib/actions/intentFailure.action'
import ScoreButton from '@/components/ScoreButton'

export default async function IntentDebugPage() {
  const { userId } = await auth()
  const site = await requireSite(userId)
  const data = await getIntentFailureAnalysis((site as { id: string }).id)

  if (!data || data.pages.length === 0) {
    return <div style={{ padding: 40, fontFamily: 'monospace' }}>No data yet.</div>
  }

  const topPage = data.pages[0]

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: 800 }}>
      <h2 style={{ marginBottom: 24 }}>Intent Debug — {data.pages.length} pages</h2>

      <div style={{ marginBottom: 32 }}>
        <strong>Top failing page:</strong> {topPage.page_path}<br />
        <strong>Intent failure score:</strong> {(topPage.intentFailureScore * 100).toFixed(1)}%<br />
        <strong>Label:</strong> {topPage.label}<br />
        <strong>Page height used:</strong> {topPage.pageHeight}px<br />
        <strong>Content density:</strong> {topPage.readingPace.contentDensity}<br />
        <strong>Scroll px/sec:</strong> {topPage.readingPace.scrollPxPerSec.toFixed(1)}<br />
        <strong>Plausible reading:</strong> {String(topPage.readingPace.isPlausibleReading)}<br />
        <strong>Has backtrack:</strong> {String(topPage.readingPace.hasSignificantBacktrack)}<br />
        <strong>Post-peak time ratio:</strong> {(topPage.readingPace.postPeakTimeRatio * 100).toFixed(1)}%<br />
        <strong>Confusion combined:</strong> {(topPage.confusion.combined * 100).toFixed(1)}%<br />
        <strong>Engagement combined:</strong> {(topPage.engagement.combined * 100).toFixed(1)}%<br />
        <strong>Met expected time:</strong> {String(topPage.engagement.metExpectedTime)}<br />
        <strong>Expected read time:</strong> {(topPage.engagement.expectedReadTimeMs / 1000).toFixed(1)}s<br />
        <strong>Insight:</strong> {topPage.insightSentence}
      </div>

      <div style={{ marginBottom: 24 }}>
        <strong>Score Button test:</strong>
        <div style={{ marginTop: 12 }}>
          {/*//@ts-ignore */}
          <ScoreButton 
            siteId={(site as { id: string }).id}
            pagePath={topPage.page_path}
          />
        </div>
      </div>

      <details>
        <summary style={{ cursor: 'pointer', marginBottom: 12 }}>Full breakdown JSON</summary>
        <pre style={{ fontSize: 11, overflow: 'auto', background: 'hsl(var(--muted))', padding: 16, borderRadius: 8 }}>
          {JSON.stringify(topPage.scoreBreakdown, null, 2)}
        </pre>
      </details>

      <details>
        <summary style={{ cursor: 'pointer', marginTop: 16 }}>All pages summary</summary>
        <pre style={{ fontSize: 10, overflow: 'auto', background: 'hsl(var(--muted))', padding: 16, borderRadius: 8 }}>
          {data.pages.map(p =>
            `${p.page_path.padEnd(30)} score=${(p.intentFailureScore*100).toFixed(1).padStart(5)}% label=${p.label} views=${p.totalViews}`
          ).join('\n')}
        </pre>
      </details>
    </div>
  )
}