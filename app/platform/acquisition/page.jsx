import { getAuthUser, requireSite, getPlanLabel } from "@/lib/actions/permission.actions";
import { getAcquisitionSources } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function AcquisitionPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const sources = await getAcquisitionSources(site.id);
  // getPlanLabel() reads Clerk's own has({plan}) check — Clerk is the system
  // of record for billing, not the sites/users tables (site.plan is never
  // set to anything but "free" at creation and user.plan doesn't exist on
  // Clerk's user object at all — both were silently gating everyone to free).
  const userPlan = await getPlanLabel();

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Acquisition Intelligence</h1>
      <PlanGate userPlan={userPlan} required="pro">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where sessions come from</CardTitle>
            <CardDescription>Sessions grouped by referrer.</CardDescription>
          </CardHeader>
          <CardContent>
            {sources.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No sessions recorded yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Sessions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((s) => (
                    <TableRow key={s.source}>
                      <TableCell className="text-foreground">{s.source}</TableCell>
                      <TableCell className="text-right">{s.sessions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PlanGate>
    </div>
  );
}
