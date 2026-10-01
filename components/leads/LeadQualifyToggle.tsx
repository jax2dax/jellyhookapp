// components/leads/LeadQualifyToggle.tsx
// Sales's manual real/junk flag on a lead — clicking the already-active
// state resets it back to unreviewed (null), it's not a one-way switch.
// Optimistic update: reverts on write failure.
"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import { setLeadQualified } from "@/lib/actions/leadQualify.action";

export function LeadQualifyToggle({
  siteId,
  leadId,
  initialQualified,
  compact = false,
}: {
  siteId: string;
  leadId: string;
  initialQualified: boolean | null;
  compact?: boolean;
}) {
  const [qualified, setQualified] = React.useState<boolean | null>(initialQualified);
  const [saving, setSaving] = React.useState(false);

  async function toggle(next: boolean) {
    const nextValue = qualified === next ? null : next; // clicking the active one un-marks it
    const prev = qualified;
    setQualified(nextValue);
    setSaving(true);
    try {
      await setLeadQualified(siteId, leadId, nextValue);
    } catch (err) {
      console.error("[LeadQualifyToggle] save failed:", err);
      setQualified(prev); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  const size = compact ? "h-6 w-6" : "h-7 w-7";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title="Qualified — this lead is real"
        disabled={saving}
        onClick={() => toggle(true)}
        className={`flex ${size} items-center justify-center rounded-md border transition-colors ${
          qualified === true ? "border-green-600 bg-green-600/15 text-green-600" : "border-input text-muted-foreground hover:bg-muted"
        }`}
      >
        <Check className={iconSize} />
      </button>
      <button
        type="button"
        title="Junk — not a real lead"
        disabled={saving}
        onClick={() => toggle(false)}
        className={`flex ${size} items-center justify-center rounded-md border transition-colors ${
          qualified === false ? "border-destructive bg-destructive/15 text-destructive" : "border-input text-muted-foreground hover:bg-muted"
        }`}
      >
        <X className={iconSize} />
      </button>
    </div>
  );
}
