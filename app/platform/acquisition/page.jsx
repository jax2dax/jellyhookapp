import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getAcquisitionSources } from "@/lib/actions/supabase.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Not linked from the sidebar right now (see components/app-sidebar.tsx) —
// reachable only by direct URL. Previously wrapped in <PlanGate required="pro">,
// which contradicted both the sidebar's own plan:"free" entry for this page
// and the site-wide "everything free during early access" messaging; removed
// rather than fixed in place, since the page was hidden from navigation for a
// separate reason (not considered to have real content yet).
export default async function AcquisitionPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const sources = await getAcquisitionSources(site.id);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Acquisition Intelligence</h1>
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
    </div>
  );
}
