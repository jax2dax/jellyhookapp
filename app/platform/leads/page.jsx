import { getAuthUser, requireSite } from "@/lib/actions/permission.actions";
import { getLeads } from "@/lib/actions/supabase.actions";
import PlanGate from "@/components/PlanGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

export default async function LeadsPage() {
  const user = await getAuthUser();
  const site = await requireSite(user.id);
  const leads = await getLeads(site.id);

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-6 text-lg font-semibold text-foreground">Leads</h1>
      <PlanGate userPlan={user.plan} sitePlan={site.plan} required="free">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All leads</CardTitle>
            <CardDescription>Every form submitted on your site, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No leads yet. Leads appear when visitors submit forms on your site.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Page</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <Link href={`/platform/leads/${lead.id}`} className="text-foreground hover:text-primary hover:underline">
                          {lead.name || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.email || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.page_path || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.submitted_at ? new Date(lead.submitted_at).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={lead.confidence === "high" ? "default" : "outline"}>{lead.confidence || "unknown"}</Badge>
                      </TableCell>
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
