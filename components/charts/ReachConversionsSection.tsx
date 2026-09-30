// components/charts/ReachConversionsSection.tsx
//
// The /platform/conversions view-mode container: separate (default),
// split, or merged. Each mode is a genuinely different layout/component,
// not the same two components re-styled:
//   - separate: NewReachChart + ConversionsAreaChart, full width, stacked,
//     each fully independent (own Card, own range).
//   - split: the same two charts side by side in ONE shared card, flush
//     against each other (no gap/padding between them) — still two
//     independent ranges, via the `embedded` prop on both chart components.
//   - merged: MergedReachConversionsChart — one chart, one range, both
//     series together. The other two charts are hidden entirely while this
//     mode is active, not layered underneath.
"use client";

import * as React from "react";
import { Columns2, Combine, Rows3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { NewReachChart } from "./NewReachChart";
import { ConversionsAreaChart } from "./ConversionsAreaChart";
import { MergedReachConversionsChart } from "./MergedReachConversionsChart";

type ViewMode = "separate" | "split" | "merged";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "separate", label: "Separate", icon: Rows3 },
  { value: "split", label: "Split", icon: Columns2 },
  { value: "merged", label: "Merged", icon: Combine },
];

export function ReachConversionsSection({ siteId }: { siteId: string }) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("separate");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setViewMode(value)}
            aria-pressed={viewMode === value}
            title={label}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              viewMode === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {viewMode === "separate" && (
        <div className="space-y-4">
          <NewReachChart siteId={siteId} />
          <ConversionsAreaChart siteId={siteId} />
        </div>
      )}

      {viewMode === "split" && (
        <Card className="w-full overflow-hidden">
          <div className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <NewReachChart siteId={siteId} embedded />
            <ConversionsAreaChart siteId={siteId} embedded />
          </div>
        </Card>
      )}

      {viewMode === "merged" && (
        <Card className="w-full">
          <MergedReachConversionsChart siteId={siteId} />
        </Card>
      )}
    </div>
  );
}
