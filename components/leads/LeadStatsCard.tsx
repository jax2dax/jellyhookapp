// components/leads/LeadStatsCard.tsx
// The lead page's "at a glance" card, replacing five identical stat tiles
// with one card that tells the story left to right: how often they came,
// how much they looked at, how long and how deep, and how long it took to
// convert. Each number has its own shape (not just a different icon):
//   - Pages per visit: a row of dots, one per page (capped at 10)
//   - Avg scroll: a filled bar
//   - Time to convert: yellow (FramePlate's "converted" colour) once converted
// Pure render, no state: the numbers come from lib/algorithms/leadProfile.js.
import type { LucideIcon } from "lucide-react";
import { Clock, Eye, FileStack, MousePointerClick, Repeat, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { formatDuration } from "@/lib/leadFormat";

const CONVERTED_YELLOW = "#eab308";

interface Props {
  totalVisits: number;
  totalPageViews: number;
  totalEngagedMs: number;
  avgScrollPct: number | null;
  hasConverted: boolean;
  timeToConvertMs: number | null;
  visitsBeforeConversion: number;
}

function Cell({ icon: Icon, label, info, accent, children, sub }: { icon: LucideIcon; label: string; info: string; accent?: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: accent ? `${accent}26` : "var(--muted)", color: accent ?? "var(--muted-foreground)" }}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="truncate">{label}</span>
        <InfoTip label={`About ${label}`}>{info}</InfoTip>
      </div>
      <div className="text-2xl font-bold leading-none text-foreground">{children}</div>
      {sub && <div className="min-h-4 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function LeadStatsCard({ totalVisits, totalPageViews, totalEngagedMs, avgScrollPct, hasConverted, timeToConvertMs, visitsBeforeConversion }: Props) {
  const pagesPerVisit = totalVisits > 0 ? totalPageViews / totalVisits : null;
  const dots = Math.min(10, Math.max(0, Math.round(pagesPerVisit ?? 0)));
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid grid-cols-2 divide-x divide-y p-0 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6 [&>*:nth-child(n+3)]:border-t sm:[&>*:nth-child(n+3)]:border-t-0 sm:[&>*:nth-child(n+4)]:border-t lg:[&>*:nth-child(n+4)]:border-t-0">
        <Cell icon={Repeat} label="Visits" info="How many separate visits (sessions) this person has made to your site." sub={totalVisits === 1 ? "a single visit" : "sessions on this site"}>
          {totalVisits}
        </Cell>
        <Cell icon={Eye} label="Page views" info="Every page this person opened, across all their visits." sub="across all visits">
          {totalPageViews}
        </Cell>
        <Cell
          icon={FileStack}
          label="Pages per visit"
          info="Page views divided by visits: how many pages they open each time they come."
          accent="#3b82f6"
          sub={
            <span className="flex items-center gap-0.5" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < dots ? "bg-blue-500" : "bg-muted"}`} />
              ))}
              {(pagesPerVisit ?? 0) > 10 && <span className="ml-1">+</span>}
            </span>
          }
        >
          {pagesPerVisit != null ? (Number.isInteger(pagesPerVisit) ? pagesPerVisit : pagesPerVisit.toFixed(1)) : "–"}
        </Cell>
        <Cell icon={Clock} label="Time engaged" info="Total time this person had one of your pages open, across every visit." sub="total time on page">
          {formatDuration(totalEngagedMs)}
        </Cell>
        <Cell
          icon={MousePointerClick}
          label="Avg scroll"
          info="How far down each page they scrolled, on average, as a share of the page."
          accent="#22c55e"
          sub={
            <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, avgScrollPct ?? 0)}%` }} />
            </span>
          }
        >
          {avgScrollPct != null ? `${avgScrollPct}%` : "–"}
        </Cell>
        <Cell
          icon={Timer}
          label="Time to convert"
          info="From their first visit to the moment they submitted the form."
          accent={hasConverted ? CONVERTED_YELLOW : undefined}
          sub={hasConverted ? (visitsBeforeConversion === 0 ? "on the first visit" : `after ${visitsBeforeConversion} earlier visit${visitsBeforeConversion === 1 ? "" : "s"}`) : "not converted yet"}
        >
          <span style={hasConverted ? { color: CONVERTED_YELLOW } : undefined}>{hasConverted ? formatDuration(timeToConvertMs) : "–"}</span>
        </Cell>
      </CardContent>
    </Card>
  );
}
