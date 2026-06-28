// components/ScoreButton.jsx
// Button that calls calculateAndGetScore for a page and displays results.
// Usage: <ScoreButton siteId={site.id} pagePath="/pricing" />
"use client";

import { useState } from "react";
import { calculateAndGetScore } from "@/lib/algorithms/pageAnalysis.server";

const COLOR_MAP = {
  red: "hsl(var(--destructive))",
  orange: "#f97316",
  yellow: "#eab308",
  green: "hsl(var(--chart-2, #22c55e))",
};

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

  const labelColor = result?.color ? COLOR_MAP[result.color] : "hsl(var(--muted-foreground))";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        onClick={handleCalculate}
        disabled={loading}
        style={{
          padding: "7px 16px",
          background: loading ? "hsl(var(--muted))" : "hsl(var(--primary))",
          color: "hsl(var(--primary-foreground))",
          border: "none",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "monospace",
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {loading && (
          <span style={{
            width: 10, height: 10, borderRadius: "50%",
            border: "2px solid hsl(var(--primary-foreground))",
            borderTopColor: "transparent",
            display: "inline-block",
            animation: "spin 0.6s linear infinite",
          }} />
        )}
        {loading ? "Calculating..." : result?.fromCache ? "↺ Recalculate" : "Calculate Scores"}
      </button>

      {result && (
        <div style={{
          padding: "10px 12px",
          background: "hsl(var(--card))",
          border: `1px solid ${labelColor}40`,
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
              color: labelColor,
              background: labelColor + "20",
              border: `1px solid ${labelColor}40`,
              borderRadius: 99, padding: "2px 8px",
            }}>
              {result.label?.toUpperCase() ?? "—"}
            </span>
            {result.fromCache && (
              <span style={{ fontSize: 9, color: "hsl(var(--muted-foreground))" }}>cached</span>
            )}
          </div>

          {[
            { label: "Retention", value: result.retentionScore },
            { label: "Conversion", value: result.conversionScore },
            { label: "Spotlight", value: result.spotlightScore },
          ].map(({ label, value }) => (
            value != null && (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", width: 70 }}>
                  {label}
                </span>
                <div style={{
                  flex: 1, height: 4,
                  background: "hsl(var(--muted))",
                  borderRadius: 2, overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.round(value * 100)}%`,
                    height: "100%",
                    background: labelColor,
                    borderRadius: 2,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <span style={{ fontSize: 11, color: "hsl(var(--foreground))", width: 32, textAlign: "right" }}>
                  {Math.round(value * 100)}%
                </span>
              </div>
            )
          ))}

          {result.last_calculated_at && (
            <div style={{ fontSize: 9, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>
              Last updated: {new Date(result.last_calculated_at).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: "hsl(var(--destructive))" }}>
          Error: {error}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}