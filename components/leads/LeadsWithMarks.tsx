"use client";
// components/leads/LeadsWithMarks.tsx
// The leads page body: the table, and the marks panel on its right. Applied marks live in the address (?marks=id,id)
// so a view can be shared and survives a reload; after any change to a mark the page data is reloaded from the server
// (badges are stored, not computed here: lib/marks/evaluate.ts).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { MarksPanel } from "@/components/marks/MarksPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarksState } from "@/lib/actions/marks.action";
import { LeadsTable, type LeadRow, type TableMarks } from "./LeadsTable";

export function LeadsWithMarks({ leads, siteId, marks }: { leads: LeadRow[]; siteId: string; marks: MarksState }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const raw = sp.get("marks");

  const visible = useMemo(() => (marks.ok ? marks.marks : []), [marks]);
  // only marks that exist, are visible and on can be applied
  const applied = useMemo(() => (raw ? raw.split(",").filter((id) => visible.some((m) => m.id === id && m.active)) : []), [raw, visible]);
  const setApplied = useCallback(
    (ids: string[]) => {
      const q = new URLSearchParams(sp.toString());
      if (ids.length) q.set("marks", ids.join(","));
      else q.delete("marks");
      router.replace(pathname + (q.size ? "?" + q : ""), { scroll: false });
    },
    [sp, router, pathname],
  );

  const table: TableMarks | undefined = useMemo(() => {
    if (!marks.ok || !marks.ready) return undefined;
    const byId = new Map(visible.map((m) => [m.id, m]));
    const byLead: TableMarks["byLead"] = {};
    for (const lm of marks.leadMarks) {
      const m = byId.get(lm.markId);
      if (!m || !m.active) continue;
      (byLead[lm.leadId] ??= []).push({ mark: { id: m.id, name: m.name, color: m.color }, parts: lm.parts });
    }
    return { byLead, applied };
  }, [marks, visible, applied]);

  return (
    <div className="flex items-start gap-4">
      <Card className="min-w-0 flex-1">
        <CardHeader>
          <CardTitle className="text-base">All leads</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadsTable leads={leads} siteId={siteId} marks={table} />
        </CardContent>
      </Card>
      <MarksPanel state={marks} applied={applied} onApply={setApplied} onChanged={() => router.refresh()} />
    </div>
  );
}
