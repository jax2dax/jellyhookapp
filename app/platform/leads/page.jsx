import { getAuthUser, requireSite, getPlanLabel } from "@/lib/actions/permission.actions";
import { getLeads } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";
import { Suspense } from "react";
import { LeadsWithMarks } from "@/components/leads/LeadsWithMarks";
import { loadMarks } from "@/lib/actions/marks.action";

export default async function LeadsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  // only the marks themselves: which leads have them is kept in the browser (components/leads/LeadsWithMarks.tsx)
  const [leads, marks] = await Promise.all([getLeads(site.id), loadMarks()]);
  // See app/platform/acquisition/page.jsx — user.plan/site.plan are never
  // populated from Clerk Billing; getPlanLabel() is the real source of truth.
  const userPlan = await getPlanLabel();

  return (
    <div className="min-h-screen bg-background p-6">
      <PlanGate userPlan={userPlan} required="free">
        <Suspense fallback={<div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>}>
          <LeadsWithMarks leads={leads} siteId={site.id} marks={marks} />
        </Suspense>
      </PlanGate>
    </div>
  );
}
