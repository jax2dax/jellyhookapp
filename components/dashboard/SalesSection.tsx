// components/dashboard/SalesSection.tsx
// The sales part of the dashboard (founder 2026-10-24: "a dashboard more focused on sales"): who to call first.
// Loads on the server through the same actions as the Hooks and Leads pages; ./SalesSectionView.tsx draws it.
import { loadHookedLeads } from "@/lib/actions/hooks.action";
import { loadMarks } from "@/lib/actions/marks.action";
import { SalesSectionView, type SalesLead } from "./SalesSectionView";

interface LeadRow {
  id: string;
  name: string | null;
  email: string | null;
  page_path: string | null;
  submitted_at: string;
}

export async function SalesSection({ leads }: { leads: LeadRow[] }) {
  const latest = leads.slice(0, 8);
  const [hooked, marks] = await Promise.all([loadHookedLeads(6), loadMarks({ leadIds: latest.map((l) => l.id) })]);
  const active = marks.ok ? marks.marks.filter((m) => m.active) : [];
  const markOf = new Map(active.map((m) => [m.id, m]));
  const rows: SalesLead[] = latest.map((l) => ({
    ...l,
    badges: marks.ok
      ? marks.leadMarks
          .filter((lm) => lm.leadId === l.id && markOf.has(lm.markId))
          .map((lm) => ({ mark: { id: lm.markId, name: markOf.get(lm.markId)!.name, color: markOf.get(lm.markId)!.color }, parts: lm.parts }))
      : [],
  }));
  return (
    <SalesSectionView
      hooked={hooked}
      marks={active.map((m) => ({ id: m.id, name: m.name, color: m.color, count: m.matchCount ?? 0 })).sort((a, b) => b.count - a.count)}
      latest={rows}
      totalLeads={leads.length}
    />
  );
}
