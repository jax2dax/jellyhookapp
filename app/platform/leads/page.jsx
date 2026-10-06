import { getAuthUser, requireSite, getPlanLabel } from "@/lib/actions/permission.actions";
import { getLeads } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { LeadsTable } from "@/components/leads/LeadsTable";

export default async function LeadsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const leads = await getLeads(site.id);
  // See app/platform/acquisition/page.jsx — user.plan/site.plan are never
  // populated from Clerk Billing; getPlanLabel() is the real source of truth.
  const userPlan = await getPlanLabel();

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Leads</h1>
      <PlanGate userPlan={userPlan} required="free">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All leads</CardTitle>
            <CardDescription>Every form submitted on your site, newest first. Search, pick a date range or filter by status; the page address keeps your choices, so you can share the exact view. Click any row to open the lead.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>}>
              <LeadsTable leads={leads} siteId={site.id} />
            </Suspense>
          </CardContent>
        </Card>
      </PlanGate>
    </div>
  );
}
