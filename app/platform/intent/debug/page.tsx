// app/platform/intent/debug/page.tsx
// DELETE 
import { auth } from '@clerk/nextjs/server'
import { requireSite } from '@/lib/actions/site-management.actions'
import { getIntentFailureAnalysis } from '@/lib/actions/intentFailure.action'
import ScoreButton from '@/components/ScoreButton'

export default async function IntentDebugPage() {
  const { userId } = await auth()
  const site = await requireSite(userId)
  const data = await getIntentFailureAnalysis((site as { id: string }).id)

  if (!data || data.pages.length === 0) {
    return <div className="p-10 text-sm text-muted-foreground">No data yet.</div>
  }

  const topPage = data.pages[0]

  return (
    <div className="max-w-3xl p-10 text-sm text-foreground">
      <h2 className="mb-6 text-lg font-semibold">Intent Debug — {data.pages.length} pages</h2>

      <div className="mb-8 space-y-0.5">
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

      <div className="mb-6">
        <strong>Score Button test:</strong>
        <div className="mt-3">
          {/*//@ts-ignore */}
          <ScoreButton
            siteId={(site as { id: string }).id}
            pagePath={topPage.page_path}
          />
        </div>
      </div>

      <details>
        <summary className="mb-3 cursor-pointer">Full breakdown JSON</summary>
        <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">
          {JSON.stringify(topPage.scoreBreakdown, null, 2)}
        </pre>
      </details>

      <details>
        <summary className="mt-4 cursor-pointer">All pages summary</summary>
        <pre className="overflow-auto rounded-lg bg-muted p-4 text-xs">
          {data.pages.map(p =>
            `${p.page_path.padEnd(30)} score=${(p.intentFailureScore*100).toFixed(1).padStart(5)}% label=${p.label} views=${p.totalViews}`
          ).join('\n')}
        </pre>
      </details>
    </div>
  )
}