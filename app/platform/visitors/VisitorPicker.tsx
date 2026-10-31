"use client";
// app/platform/visitors/VisitorPicker.tsx
// A list of the latest visitors' ids to jump between visitors from a visitor's page.
import { useRouter } from "next/navigation";

export function VisitorPicker({ current, options }: { current: string; options: { id: string; label: string }[] }) {
  const router = useRouter();
  return (
    <select
      value={current}
      onChange={(e) => router.push(`/platform/visitors/${encodeURIComponent(e.target.value)}`)}
      className="max-w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs text-foreground"
      aria-label="Pick another visitor"
    >
      {!options.some((o) => o.id === current) && <option value={current}>{current}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
