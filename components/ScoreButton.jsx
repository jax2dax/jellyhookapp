// components/ScoreButton.jsx
// Button that calls calculateAndGetScore for a page and displays results.
// Usage: <ScoreButton siteId={site.id} pagePath="/pricing" />
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { calculateAndGetScore } from "@/lib/algorithms/pageAnalysis.server";

// Maps a page-insight status to the design system's status classes — no
// hardcoded hex here, only the tokens declared in app/globals.css.
const STATUS_CLASSES = {
  red: { text: "text-destructive", bg: "bg-destructive/15", border: "border-destructive/40", fill: "bg-destructive" },
  orange: { text: "text-warning", bg: "bg-warning/15", border: "border-warning/40", fill: "bg-warning" },
  yellow: { text: "text-warning", bg: "bg-warning/15", border: "border-warning/40", fill: "bg-warning" },
  green: { text: "text-primary", bg: "bg-primary/15", border: "border-primary/40", fill: "bg-primary" },
};
const DEFAULT_STATUS = { text: "text-muted-foreground", bg: "bg-muted", border: "border-border", fill: "bg-muted-foreground" };

export default function ScoreButton({ siteId, pagePath, onResult }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await calculateAndGetScore(siteId, pagePath, "all");
      setResult(res);
      onResult?.(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const status = result?.color ? STATUS_CLASSES[result.color] ?? DEFAULT_STATUS : DEFAULT_STATUS;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCalculate}
        disabled={loading}
        className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-medium text-primary-foreground ${loading ? "cursor-wait bg-muted-foreground" : "cursor-pointer bg-primary"} disabled:opacity-70`}
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        {loading ? "Calculating..." : result?.fromCache ? "↺ Recalculate" : "Calculate Scores"}
      </button>

      {result && (
        <div className={`flex flex-col gap-1.5 rounded-md border bg-card p-3 ${status.border}`}>
          <div className="mb-0.5 flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${status.text} ${status.bg} ${status.border}`}>
              {result.label?.toUpperCase() ?? "—"}
            </span>
            {result.fromCache && <span className="text-[9px] text-muted-foreground">cached</span>}
          </div>

          {[
            { label: "Retention", value: result.retentionScore },
            { label: "Conversion", value: result.conversionScore },
            { label: "Spotlight", value: result.spotlightScore },
          ].map(
            ({ label, value }) =>
              value != null && (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-18 text-[11px] text-muted-foreground">{label}</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full transition-[width] duration-300 ${status.fill}`} style={{ width: `${Math.round(value * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right text-[11px] text-foreground">{Math.round(value * 100)}%</span>
                </div>
              )
          )}

          {result.last_calculated_at && (
            <div className="mt-0.5 text-[9px] text-muted-foreground">Last updated: {new Date(result.last_calculated_at).toLocaleTimeString()}</div>
          )}
        </div>
      )}

      {error && <div className="text-[11px] text-destructive">Error: {error}</div>}
    </div>
  );
}
